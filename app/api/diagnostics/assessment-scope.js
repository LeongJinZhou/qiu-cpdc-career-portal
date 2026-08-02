// Publishing scope for staff-authored assessments (Module 7 authoring).
//
// A Head of Programme may publish only to their own programme; a Faculty
// Coordinator or Placement Officer only to their faculty; CPDC and super-admins
// university-wide. Every rule is enforced here, server-side; the client's scope
// picker is only ever a convenience.
//
// The live assessment-authoring path (POST /api/assessments) enforces the same
// scope through lib/assessment.js#canManageScope; the helpers here also back the
// scoped student list used by /api/diagnostics.
//
// Under a real session the decision defers to lib/auth/permissions.js, so the
// capability and the scope that satisfies it come from the same role. Demo mode
// carries no identity (see lib/auth/actor.js), so the seeded staff context is
// pinned to the seeded student's own faculty/programme rather than being waved
// through.

import { hasCapability } from '@/lib/auth/permissions';

/** Roles that may create, edit and publish an assessment. */
export const ASSESSMENT_AUTHOR_ROLES = new Set([
  'HEAD_OF_PROGRAMME',
  'FACULTY_COORDINATOR',
  'CPDC_ADMIN',
  'SUPER_ADMIN',
]);

const UNIVERSITY_WIDE = new Set(['CPDC_ADMIN', 'SUPER_ADMIN']);

export function canAuthorAssessments(role) {
  return ASSESSMENT_AUTHOR_ROLES.has(role);
}

export function scopeError(message, code = 'ASSESSMENT_SCOPE_FORBIDDEN', status = 403) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function assignmentValues(actor, scopeType) {
  return (actor?.identity?.assignments ?? [])
    .filter((assignment) => assignment.role === actor.role && assignment.scopeType === scopeType)
    .map((assignment) => assignment.scopeValue)
    .filter(Boolean);
}

/**
 * May this actor publish an assessment at this faculty/programme scope?
 *
 * `programmeId: null` means "the whole faculty", which a Head of Programme is
 * deliberately not allowed to do.
 */
export function canPublishToScope(actor, { facultyId = null, programmeId = null } = {}) {
  if (!canAuthorAssessments(actor?.role)) return false;
  if (UNIVERSITY_WIDE.has(actor.role)) return true;
  if (!facultyId && !programmeId) return false;

  if (actor.identity) {
    // `student.read` is the capability whose scope model already expresses
    // "which students is this staff member responsible for" — the same
    // population an assessment is published to.
    return hasCapability(actor.identity, 'student.read', { facultyId, programmeId });
  }

  // Demo mode: no identity to check assignments against, so the seeded staff
  // member may only reach the seeded student's own programme/faculty.
  const student = actor?.student;
  if (!student) return false;
  if (actor.role === 'HEAD_OF_PROGRAMME') return programmeId === student.programmeId;
  if (actor.role === 'FACULTY_COORDINATOR') return facultyId === student.facultyId;
  return false;
}

export function assertPublishScope(actor, scope) {
  if (!canPublishToScope(actor, scope)) {
    throw scopeError(
      'You can only create assessments for the programme or faculty you are assigned to. Choose a different scope, or ask CPDC to widen your access.',
    );
  }
}

/**
 * The Prisma `where` restricting an assessment list to what this actor may see.
 * Returns null when a staff account has no usable scope at all, which the route
 * turns into an explanatory 403 rather than an empty list.
 */
export function authorListWhere(actor) {
  if (UNIVERSITY_WIDE.has(actor.role)) return {};

  if (actor.identity) {
    const programmeIds = assignmentValues(actor, 'PROGRAMME');
    const facultyIds = assignmentValues(actor, 'FACULTY');
    if (actor.role === 'HEAD_OF_PROGRAMME' && programmeIds.length) {
      return { programmeId: { in: programmeIds } };
    }
    if (facultyIds.length) return { facultyId: { in: facultyIds } };
    return null;
  }

  const student = actor?.student;
  if (!student) return null;
  if (actor.role === 'HEAD_OF_PROGRAMME') return { programmeId: student.programmeId };
  if (actor.role === 'FACULTY_COORDINATOR') return { facultyId: student.facultyId };
  return null;
}

/** Published assessments a given student may sit. */
export function studentListWhere(student) {
  return {
    status: 'PUBLISHED',
    OR: [{ facultyId: null }, { facultyId: student.facultyId }],
    AND: [{ OR: [{ programmeId: null }, { programmeId: student.programmeId }] }],
  };
}

/**
 * The faculty/programme options this actor may publish to, for the scope picker.
 * Computed on the server so the client never has to guess and a stale option can
 * never widen anyone's reach.
 */
export async function publishableScopes(actor, prisma) {
  if (UNIVERSITY_WIDE.has(actor.role)) {
    const faculties = await prisma.faculty.findMany({
      select: { id: true, name: true, programmes: { select: { id: true, name: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return faculties.map((faculty) => ({
      facultyId: faculty.id,
      facultyName: faculty.name,
      programmes: faculty.programmes,
    }));
  }

  const where = authorListWhere(actor);
  if (!where) return [];

  if (where.programmeId) {
    const ids = typeof where.programmeId === 'string' ? [where.programmeId] : where.programmeId.in;
    const programmes = await prisma.programme.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, faculty: { select: { id: true, name: true } } },
    });
    return programmes.map((programme) => ({
      facultyId: programme.faculty.id,
      facultyName: programme.faculty.name,
      programmes: [{ id: programme.id, name: programme.name }],
    }));
  }

  const ids = typeof where.facultyId === 'string' ? [where.facultyId] : where.facultyId.in;
  const faculties = await prisma.faculty.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, programmes: { select: { id: true, name: true }, orderBy: { name: 'asc' } } },
  });
  return faculties.map((faculty) => ({
    facultyId: faculty.id,
    facultyName: faculty.name,
    programmes: faculty.programmes,
  }));
}
