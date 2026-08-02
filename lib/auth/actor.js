// Demo-aware actor resolution for the persistence APIs (Modules 1-5).
//
// The portal runs in one of two modes (see lib/auth/config.js):
//   - firebase-google: a real signed-in identity backed by a session cookie.
//   - demo (local dev only): no cookie; the UI renders the seeded QIU student.
//
// Rather than fork every route, these helpers resolve a single "actor" for both
// modes. Under real auth the actor is the authenticated identity's student.
// In demo mode the actor IS the seeded student in Postgres, so the same DB
// reads/writes run and the prototype actually persists. Demo mode is refused in
// production by getAuthMode(), so the demo branch can never run on a live site.

import { prisma } from '../prisma.js';
import { getAuthMode } from './config.js';
import { getAuthenticatedIdentity, createIdentityError } from './identity.js';

// The seeded student the demo UI presents as. Kept in sync with
// DEFAULT_STUDENT.email in lib/data/facultyData.js and prisma/seed.mjs.
const DEMO_STUDENT_EMAIL = 'alex.thorne@student.qiu.edu.my';

// Staff roles a demo session is allowed to impersonate via the x-demo-role
// header (the "View as" switcher). Anything else falls back to STUDENT.
const DEMO_ROLES = new Set([
  'STUDENT',
  'ALUMNI',
  'HEAD_OF_PROGRAMME',
  'FACULTY_COORDINATOR',
  'ACADEMIC_SUPERVISOR',
  'PLACEMENT_OFFICER',
  'CPDC_ADMIN',
  'CAREER_COUNSELOR',
  'UNIVERSITY_REGISTRAR',
  'SUPER_ADMIN',
  'EMPLOYER',
]);

function readDemoRole(request) {
  const header = request?.headers?.get?.('x-demo-role');
  const candidate = typeof header === 'string' ? header.trim() : '';
  return DEMO_ROLES.has(candidate) ? candidate : 'STUDENT';
}

const STUDENT_INCLUDE = {
  faculty: { select: { id: true, name: true, code: true } },
  programme: { select: { id: true, name: true, level: true } },
};

async function loadDemoStudent() {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_STUDENT_EMAIL },
    include: { student: { include: STUDENT_INCLUDE } },
  });

  if (!user?.student) {
    throw createIdentityError(
      503,
      'DEMO_STUDENT_UNAVAILABLE',
      'Demo mode is on but the seeded student is missing. Run `npm run db:seed`.',
    );
  }

  return { user, student: user.student };
}

/**
 * Resolve the acting student for a request in either auth mode.
 *
 * Returns { demo, role, user, student } where `student` includes faculty and
 * programme. Throws an identity error (with .status/.code) when no actor can be
 * resolved — 401 under real auth with no session, or a config error otherwise.
 *
 * @param {Request} request
 * @param {{ allowNonStudent?: boolean }} [options] When true, a staff actor
 *   without a student record is allowed (student is null) — used by approval
 *   queues that a Head of Programme, not a student, drives.
 */
export async function resolveActor(request, { allowNonStudent = false } = {}) {
  let identity = null;
  try {
    identity = await getAuthenticatedIdentity(request);
  } catch (error) {
    // Only fall back to the seeded student when demo mode is explicitly on.
    if (error?.status === 401 && getAuthMode() === 'demo') {
      const role = readDemoRole(request);
      const { user, student } = await loadDemoStudent();
      return {
        demo: true,
        role,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        student,
      };
    }
    throw error;
  }

  // Real authenticated identity. Load the full student row (identity.student is
  // a trimmed projection) so writes have faculty/programme context.
  let student = null;
  if (identity.student?.id) {
    student = await prisma.student.findUnique({
      where: { id: identity.student.id },
      include: STUDENT_INCLUDE,
    });
  }

  if (!student && !allowNonStudent) {
    throw createIdentityError(
      403,
      'STUDENT_CONTEXT_REQUIRED',
      'This action requires a student context.',
    );
  }

  return {
    demo: false,
    role: identity.role ?? identity.user.role,
    user: identity.user,
    student,
    identity,
  };
}

/**
 * Guard a self-service write/read that must belong to the signed-in student.
 * Staff accounts can carry a linked student row for testing or legacy data,
 * but that must never turn an admin session into a student action.
 */
export function requireStudentActor(actor) {
  if (!actor?.student || actor.role !== 'STUDENT') {
    throw createIdentityError(
      403,
      'STUDENT_ROLE_REQUIRED',
      'This action is available only to the signed-in student account.',
    );
  }
  return actor;
}

/**
 * True when the actor may drive staff-only review queues (Module 2 approvals).
 *
 * Kept as the general "can open a review queue" predicate. Who may actually
 * *write* a decision is narrower and differs per artefact, so use the two
 * predicates below for that rather than treating queue access as approval
 * authority.
 */
export function actorCanReview(role) {
  return (
    role === 'HEAD_OF_PROGRAMME' ||
    role === 'FACULTY_COORDINATOR' ||
    role === 'ACADEMIC_SUPERVISOR' ||
    role === 'PLACEMENT_OFFICER' ||
    role === 'CPDC_ADMIN' ||
    role === 'UNIVERSITY_REGISTRAR' ||
    role === 'SUPER_ADMIN'
  );
}

/**
 * Who may record an FYP decision (approve / request revision / reject).
 *
 * The roles matrix gives the Head of Programme the write action and marks
 * faculty/CPDC/super-admin as viewers, but the CPDC blueprint also names CPDC
 * staff as the platform-wide backup approver when a programme lead is absent.
 * Both are honoured: HOP is the owner, CPDC_ADMIN and SUPER_ADMIN are the
 * escalation path. A Faculty Coordinator reviews but does not sign off, which
 * is the one place the two documents genuinely disagree.
 */
export function actorCanDecideFyp(role) {
  return (
    role === 'HEAD_OF_PROGRAMME' ||
    role === 'CPDC_ADMIN' ||
    role === 'SUPER_ADMIN'
  );
}

/**
 * Who may publish a workshop or event.
 *
 * Narrower than actorCanReview, which only means "may open a staff queue".
 * Gating the publish route on the broad predicate let an Academic Supervisor
 * or a Registrar POST a workshop that the UI never offers them — the tab was
 * hidden but the endpoint accepted it, which is not the same thing.
 *
 * Kept in step with `canPublish` in components/WorkshopHub.jsx.
 */
export function actorCanPublishWorkshops(role) {
  return (
    role === 'HEAD_OF_PROGRAMME' ||
    role === 'FACULTY_COORDINATOR' ||
    role === 'PLACEMENT_OFFICER' ||
    role === 'CPDC_ADMIN' ||
    role === 'SUPER_ADMIN'
  );
}

/**
 * Who may endorse a logbook entry from inside the platform.
 *
 * The off-campus supervisor's tokenised sign-off is the primary path and is
 * handled entirely by /api/approvals/[token] — it needs no role at all. This
 * covers the internal academic endorsement that runs alongside it.
 */
export function actorCanEndorseLogbook(role) {
  return (
    role === 'ACADEMIC_SUPERVISOR' ||
    role === 'HEAD_OF_PROGRAMME' ||
    role === 'FACULTY_COORDINATOR' ||
    role === 'PLACEMENT_OFFICER' ||
    role === 'CPDC_ADMIN' ||
    role === 'SUPER_ADMIN'
  );
}
