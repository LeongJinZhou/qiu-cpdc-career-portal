const GLOBAL_ROLES = new Set(['CPDC_ADMIN', 'SUPER_ADMIN']);
const SCOPED_ROLES = new Set(['HEAD_OF_PROGRAMME', 'FACULTY_COORDINATOR']);

function roleAssignments(actor, role) {
  return (actor?.identity?.assignments ?? []).filter((assignment) => (
    assignment?.role === role
  ));
}

function hasGlobalAuthority(actor) {
  if (!GLOBAL_ROLES.has(actor?.role)) return false;
  if (actor?.demo) return true;
  if (actor?.identity?.user?.role === actor.role) return true;
  return roleAssignments(actor, actor.role).some((assignment) => (
    assignment.scopeType === 'GLOBAL' && assignment.scopeValue === 'GLOBAL'
  ));
}

/**
 * Return the Prisma relation filter for a reviewer, or null when their role
 * has no usable scope. Demo staff uses the seeded student's scope; real staff
 * must carry an explicit role assignment (or a global primary role).
 */
export function reviewerWhere(actor) {
  if (hasGlobalAuthority(actor)) return {};

  const role = actor?.role;
  if (!SCOPED_ROLES.has(role)) return null;

  const assignments = roleAssignments(actor, role);
  const scopeType = role === 'HEAD_OF_PROGRAMME' ? 'PROGRAMME' : 'FACULTY';
  const values = assignments
    .filter((assignment) => assignment.scopeType === scopeType)
    .map((assignment) => assignment.scopeValue)
    .filter(Boolean);

  if (values.length === 0 && actor?.demo && actor.student) {
    const fallback = role === 'HEAD_OF_PROGRAMME'
      ? actor.student.programmeId
      : actor.student.facultyId;
    if (fallback) values.push(fallback);
  }

  if (values.length === 0) return null;
  const field = role === 'HEAD_OF_PROGRAMME' ? 'programmeId' : 'facultyId';
  return { student: { [field]: values.length === 1 ? values[0] : { in: values } } };
}

/** Check a reviewer's scope against the project's student context. */
export function canReviewStudent(actor, student) {
  const where = reviewerWhere(actor);
  if (where == null) return false;
  if (Object.keys(where).length === 0) return true;

  const scope = where.student;
  const [field] = Object.keys(scope);
  const expected = scope[field];
  const actual = student?.[field];
  return typeof expected === 'object' && expected?.in
    ? expected.in.includes(actual)
    : expected === actual;
}
