/**
 * Server-side scoping for the staff student directory.
 *
 * Two rules this module exists to keep:
 *
 *   1. The scope filter is part of the *database query*, never a filter applied
 *      to rows we already fetched. A Faculty Coordinator for Computing must not
 *      be able to page through Medicine students, and the only way to guarantee
 *      that is for Medicine rows never to leave Postgres.
 *   2. The scope used to build the list is derived from the same assignments
 *      `hasCapability(identity, 'student.read', ...)` reads, so a student who
 *      appears in the list can always be opened, and a student who cannot be
 *      opened never appears in the list.
 *
 * Everything here is pure — no Prisma import — so it can be unit tested without
 * a database.
 */

/** Roles whose remit is the whole university (mirrors GLOBAL_ROLES in lib/auth/permissions.js). */
const GLOBAL_ROLES = new Set([
  'SUPER_ADMIN',
  'CPDC_ADMIN',
  'CAREER_COUNSELOR',
  'UNIVERSITY_REGISTRAR',
]);

/**
 * Staff roles that may open the directory at all.
 *
 * STUDENT holds `student.read` for their own record, but a directory of one's
 * self is not a directory — students use their own dashboard instead, so they
 * are refused here rather than shown a one-row table.
 */
export const DIRECTORY_ROLES = new Set([
  'HEAD_OF_PROGRAMME',
  'FACULTY_COORDINATOR',
  'ACADEMIC_SUPERVISOR',
  'PLACEMENT_OFFICER',
  'CPDC_ADMIN',
  'CAREER_COUNSELOR',
  'UNIVERSITY_REGISTRAR',
  'SUPER_ADMIN',
]);

/** Roles granted `student.read` in lib/auth/permissions.js. Kept in step with it. */
const STUDENT_READ_ROLES = new Set([
  'STUDENT',
  'HEAD_OF_PROGRAMME',
  'FACULTY_COORDINATOR',
  'ACADEMIC_SUPERVISOR',
  'PLACEMENT_OFFICER',
  'CPDC_ADMIN',
  'CAREER_COUNSELOR',
  'UNIVERSITY_REGISTRAR',
  'SUPER_ADMIN',
]);

function grantedRoles(identity) {
  const roles = new Set();
  if (identity?.user?.role) roles.add(identity.user.role);
  for (const assignment of identity?.assignments ?? []) {
    if (assignment?.role) roles.add(assignment.role);
  }
  return [...roles];
}

function assignmentsFor(identity, role, scopeType) {
  return (identity?.assignments ?? [])
    .filter((assignment) => assignment?.role === role && assignment?.scopeType === scopeType)
    .map((assignment) => assignment.scopeValue)
    .filter(Boolean);
}

function hasGlobalGrant(identity, role) {
  if (GLOBAL_ROLES.has(role) && identity?.user?.role === role) return true;
  return assignmentsFor(identity, role, 'GLOBAL').includes('GLOBAL');
}

/**
 * Build the Prisma `where` fragment describing every student this identity may
 * read, across all of the roles it holds.
 *
 * @returns {{ unrestricted: boolean, where: object|null, reach: object }}
 *   `where === null` means the identity reaches no student at all; the caller
 *   must return an empty list rather than an unfiltered query.
 */
export function buildStudentScopeWhere(identity) {
  const roles = grantedRoles(identity).filter((role) => STUDENT_READ_ROLES.has(role));

  const facultyIds = new Set();
  const programmeIds = new Set();
  const studentIds = new Set();
  let unrestricted = false;

  for (const role of roles) {
    switch (role) {
      case 'STUDENT':
        if (identity?.student?.id) studentIds.add(identity.student.id);
        break;
      case 'HEAD_OF_PROGRAMME':
        for (const id of assignmentsFor(identity, role, 'PROGRAMME')) programmeIds.add(id);
        break;
      case 'FACULTY_COORDINATOR':
      case 'PLACEMENT_OFFICER':
        for (const id of assignmentsFor(identity, role, 'FACULTY')) facultyIds.add(id);
        break;
      case 'ACADEMIC_SUPERVISOR':
        for (const id of assignmentsFor(identity, role, 'STUDENT')) studentIds.add(id);
        break;
      default:
        if (hasGlobalGrant(identity, role)) unrestricted = true;
        break;
    }
  }

  const reach = {
    unrestricted,
    facultyIds: [...facultyIds],
    programmeIds: [...programmeIds],
    studentIds: [...studentIds],
  };

  if (unrestricted) return { unrestricted: true, where: {}, reach };

  const clauses = [];
  if (facultyIds.size) clauses.push({ facultyId: { in: [...facultyIds] } });
  if (programmeIds.size) clauses.push({ programmeId: { in: [...programmeIds] } });
  if (studentIds.size) clauses.push({ id: { in: [...studentIds] } });

  if (clauses.length === 0) return { unrestricted: false, where: null, reach };
  if (clauses.length === 1) return { unrestricted: false, where: clauses[0], reach };
  return { unrestricted: false, where: { OR: clauses }, reach };
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

function toPositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

/** Read the directory filters off a URL, ignoring anything malformed. */
export function parseDirectoryQuery(searchParams) {
  const get = (key) => {
    const raw = searchParams?.get?.(key);
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  };

  const yearRaw = get('year');
  const year = Number.parseInt(yearRaw ?? '', 10);

  return {
    search: get('search'),
    facultyId: get('facultyId'),
    programmeId: get('programmeId'),
    year: Number.isFinite(year) && year >= 1 && year <= 8 ? year : null,
    needsAttention: get('needsAttention') === 'true',
    page: toPositiveInt(get('page'), 1),
    pageSize: toPositiveInt(get('pageSize'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

/**
 * "Needs attention" expressed as a database predicate rather than a post-fetch
 * pass, so the filter is still correct once results are paginated. It is the
 * negation of the five readiness checks the overview endpoint already uses.
 */
export const NEEDS_ATTENTION_WHERE = {
  OR: [
    { logbookEntries: { none: { status: 'APPROVED' } } },
    { NOT: { fypProject: { is: { status: 'APPROVED' } } } },
    { diagnostics: { none: { passed: true } } },
    { courseEnrolments: { none: { verificationStatus: 'VERIFIED' } } },
  ],
};

/**
 * Combine the scope with the requested filters.
 *
 * Everything is ANDed onto the scope, so a caller asking for `facultyId=medicine`
 * while scoped to Computing narrows to the empty set — it can never widen.
 */
export function buildDirectoryWhere(scopeWhere, filters = {}) {
  const and = [scopeWhere ?? {}];

  if (filters.search) {
    and.push({
      OR: [
        { matricNo: { contains: filters.search, mode: 'insensitive' } },
        { user: { name: { contains: filters.search, mode: 'insensitive' } } },
        { user: { email: { contains: filters.search, mode: 'insensitive' } } },
      ],
    });
  }

  if (filters.facultyId) and.push({ facultyId: filters.facultyId });
  if (filters.programmeId) and.push({ programmeId: filters.programmeId });
  if (filters.year) and.push({ academicYear: filters.year });
  if (filters.needsAttention) and.push(NEEDS_ATTENTION_WHERE);

  return and.length === 1 ? and[0] : { AND: and };
}

/**
 * Synthesise an identity for demo mode.
 *
 * Demo mode has no session, so the "View as" role header decides who is acting.
 * A demo staff role is deliberately given a *narrow, real* scope taken from the
 * seeded student's faculty/programme rather than a global one — that is what
 * makes the scoping visible in the prototype: a demo Faculty Coordinator really
 * is confined to Computing and really does get 403 on a Medicine record.
 */
export function buildDemoIdentity({ role, user, student }) {
  const assignments = [];

  if (GLOBAL_ROLES.has(role)) {
    assignments.push({ role, scopeType: 'GLOBAL', scopeValue: 'GLOBAL' });
  } else if (role === 'HEAD_OF_PROGRAMME' && student?.programmeId) {
    assignments.push({ role, scopeType: 'PROGRAMME', scopeValue: student.programmeId });
  } else if ((role === 'FACULTY_COORDINATOR' || role === 'PLACEMENT_OFFICER') && student?.facultyId) {
    assignments.push({ role, scopeType: 'FACULTY', scopeValue: student.facultyId });
  } else if (role === 'ACADEMIC_SUPERVISOR' && student?.id) {
    assignments.push({ role, scopeType: 'STUDENT', scopeValue: student.id });
  }

  return {
    user: { id: user?.id ?? 'demo-user', email: user?.email ?? null, name: user?.name ?? 'Demo staff', role },
    student: role === 'STUDENT' ? student ?? null : null,
    assignments,
    demo: true,
  };
}

/** The identity to authorise against, in either auth mode. */
export function resolveDirectoryIdentity(actor) {
  if (actor?.demo) {
    return buildDemoIdentity({ role: actor.role, user: actor.user, student: actor.student });
  }
  return actor?.identity ?? null;
}

/** Plain-English sentence describing how wide the actor's reach is. */
export function describeScope(reach, { faculties = [], programmes = [] } = {}) {
  if (reach?.unrestricted) return 'Every student at QIU.';

  const parts = [];
  if (reach?.facultyIds?.length) {
    const names = reach.facultyIds.map((id) => faculties.find((f) => f.id === id)?.name ?? id);
    parts.push(`students in ${names.join(', ')}`);
  }
  if (reach?.programmeIds?.length) {
    const names = reach.programmeIds.map((id) => programmes.find((p) => p.id === id)?.name ?? id);
    parts.push(`students on ${names.join(', ')}`);
  }
  if (reach?.studentIds?.length) {
    parts.push(`${reach.studentIds.length} named student${reach.studentIds.length === 1 ? '' : 's'} assigned to you`);
  }

  if (!parts.length) return 'No students have been assigned to you yet.';
  return `You can see ${parts.join(' and ')}.`;
}
