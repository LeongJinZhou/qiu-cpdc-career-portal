function createAuthorizationError(message, details = {}) {
  const error = new Error(message);
  error.status = 403;
  error.code = 'INSUFFICIENT_CAPABILITY';
  error.details = details;
  return error;
}

// Every account role can read and update its own identity; the rest is what
// distinguishes them. Listed explicitly per role rather than by inheritance so
// a reviewer can read one entry and know the whole grant.
const SELF = ['identity.read.self', 'identity.update.self'];

const ROLE_CAPABILITIES = {
  STUDENT: [
    ...SELF,
    'student.read',
    'logbook.read',
    'logbook.write',
  ],
  // Alumni and employers reach students only through the opt-in talent feed,
  // which is its own capability — they get no `student.read` at all, so no
  // scope mistake can widen them into the private record.
  ALUMNI: [
    ...SELF,
    'talent.read.public',
  ],
  EMPLOYER: [
    ...SELF,
    'talent.read.public',
  ],
  HEAD_OF_PROGRAMME: [
    ...SELF,
    'student.read',
    'logbook.read',
    'logbook.write',
    'fyp.decide',
    'careerpath.manage',
  ],
  FACULTY_COORDINATOR: [
    ...SELF,
    'student.read',
    'logbook.read',
    'logbook.write',
  ],
  ACADEMIC_SUPERVISOR: [
    ...SELF,
    'student.read',
    'logbook.read',
    'logbook.write',
  ],
  PLACEMENT_OFFICER: [
    ...SELF,
    'student.read',
    'logbook.read',
  ],
  CPDC_ADMIN: [
    ...SELF,
    'student.read',
    'logbook.read',
    'logbook.write',
    'fyp.decide',
    'talent.read.public',
  ],
  // Career data only. Notably no `identity.manage` — a counselor annotating a
  // CV has no business reassigning a student's faculty.
  CAREER_COUNSELOR: [
    ...SELF,
    'student.read',
    'cv.review',
  ],
  // Reads for graduation clearance and transcript export; never writes to a
  // student's career record.
  UNIVERSITY_REGISTRAR: [
    ...SELF,
    'student.read',
    'logbook.read',
  ],
  SUPER_ADMIN: [
    ...SELF,
    'student.read',
    'logbook.read',
    'logbook.write',
    'fyp.decide',
    'careerpath.manage',
    'cv.review',
    'talent.read.public',
    'identity.manage',
  ],
};

function normalizeAssignmentScope(assignment) {
  return {
    role: assignment.role,
    type: assignment.scopeType,
    value: assignment.scopeValue,
  };
}

function getAssignmentsForRole(identity, role) {
  const assignments = Array.isArray(identity?.assignments) ? identity.assignments : [];
  return assignments.filter((assignment) => assignment.role === role);
}

// Roles whose remit is the whole university, so holding the role on the User
// row is itself the grant. Every other role must carry an explicit scoped
// RoleAssignment — there is no such thing as an unscoped coordinator.
const GLOBAL_ROLES = new Set([
  'SUPER_ADMIN',
  'CPDC_ADMIN',
  'CAREER_COUNSELOR',
  'UNIVERSITY_REGISTRAR',
]);

function hasGlobalScope(identity, role) {
  if (GLOBAL_ROLES.has(role) && identity?.user?.role === role) {
    return true;
  }

  return getAssignmentsForRole(identity, role).some((assignment) => (
    assignment.scopeType === 'GLOBAL' && assignment.scopeValue === 'GLOBAL'
  ));
}

/**
 * An academic supervisor is scoped to named mentees, not to a programme or
 * faculty — the narrowest staff scope on the platform. Each supervised student
 * is one STUDENT-typed assignment.
 */
function hasMenteeScope(identity, role, resourceScope) {
  return getAssignmentsForRole(identity, role).some((assignment) => (
    assignment.scopeType === 'STUDENT'
    && resourceScope?.studentId
    && assignment.scopeValue === resourceScope.studentId
  ));
}

function hasStudentSelfScope(identity, resourceScope) {
  return Boolean(
    identity?.student?.id
    && resourceScope?.studentId
    && identity.student.id === resourceScope.studentId,
  );
}

function hasProgrammeScope(identity, role, resourceScope) {
  return getAssignmentsForRole(identity, role).some((assignment) => (
    assignment.scopeType === 'PROGRAMME'
    && resourceScope?.programmeId
    && assignment.scopeValue === resourceScope.programmeId
  ));
}

function hasFacultyScope(identity, role, resourceScope) {
  return getAssignmentsForRole(identity, role).some((assignment) => (
    assignment.scopeType === 'FACULTY'
    && resourceScope?.facultyId
    && assignment.scopeValue === resourceScope.facultyId
  ));
}

function canAccessScopedStudentResource(identity, role, resourceScope) {
  switch (role) {
    case 'STUDENT':
      return hasStudentSelfScope(identity, resourceScope);
    case 'HEAD_OF_PROGRAMME':
      return hasProgrammeScope(identity, 'HEAD_OF_PROGRAMME', resourceScope);
    case 'FACULTY_COORDINATOR':
      return hasFacultyScope(identity, 'FACULTY_COORDINATOR', resourceScope);
    case 'PLACEMENT_OFFICER':
      return hasFacultyScope(identity, 'PLACEMENT_OFFICER', resourceScope);
    case 'ACADEMIC_SUPERVISOR':
      return hasMenteeScope(identity, 'ACADEMIC_SUPERVISOR', resourceScope);
    case 'CPDC_ADMIN':
    case 'CAREER_COUNSELOR':
    case 'UNIVERSITY_REGISTRAR':
    case 'SUPER_ADMIN':
      return hasGlobalScope(identity, role);
    // ALUMNI and EMPLOYER intentionally fall through: they hold no
    // student.read capability, so they can never reach this decision.
    default:
      return false;
  }
}

function getGrantedRoles(identity) {
  const roles = new Set();

  if (identity?.user?.role) {
    roles.add(identity.user.role);
  }

  for (const assignment of identity?.assignments ?? []) {
    if (assignment?.role) {
      roles.add(assignment.role);
    }
  }

  return [...roles];
}

export function getCapabilitySet(identity) {
  const capabilities = new Set();

  for (const role of getGrantedRoles(identity)) {
    for (const capability of ROLE_CAPABILITIES[role] ?? []) {
      capabilities.add(capability);
    }
  }

  return capabilities;
}

export function getIdentityScopes(identity) {
  const scopes = [];

  if (identity?.student?.id) {
    scopes.push({
      type: 'SELF',
      studentId: identity.student.id,
      facultyId: identity.student.facultyId ?? null,
      programmeId: identity.student.programmeId ?? null,
    });
  }

  for (const assignment of identity?.assignments ?? []) {
    scopes.push(normalizeAssignmentScope(assignment));
  }

  if (identity?.user?.role === 'CPDC_ADMIN' || identity?.user?.role === 'SUPER_ADMIN') {
    scopes.push({
      type: 'GLOBAL',
      value: 'GLOBAL',
      role: identity.user.role,
    });
  }

  return scopes;
}

export function getIdentityCapabilities(identity) {
  return [...getCapabilitySet(identity)].sort();
}

export function hasCapability(identity, capability, resourceScope = {}) {
  if (!identity?.user?.id) {
    return false;
  }

  if (!getCapabilitySet(identity).has(capability)) {
    return false;
  }

  if (capability === 'identity.read.self' || capability === 'identity.update.self') {
    return !resourceScope?.userId || resourceScope.userId === identity.user.id;
  }

  if (capability === 'identity.manage') {
    return canAccessScopedStudentResource(identity, 'SUPER_ADMIN', resourceScope);
  }

  // The public talent feed is the one student-facing surface that is not
  // scope-gated, because the student themselves opted into it. The caller is
  // still responsible for only ever passing opted-in records — see
  // buildStudentProfileView in ./student-profile-visibility.js.
  if (capability === 'talent.read.public') {
    return true;
  }

  if (
    capability === 'student.read'
    || capability === 'logbook.read'
    || capability === 'logbook.write'
    || capability === 'fyp.decide'
    || capability === 'careerpath.manage'
    || capability === 'cv.review'
  ) {
    // The role that grants the capability must be the same role that satisfies
    // the scope. Testing them independently let one role supply the permission
    // while a different one supplied the reach: a Head of Programme who is also
    // enrolled as a student would clear `fyp.decide` for their own record via
    // the STUDENT self-scope, and so approve their own project.
    return getGrantedRoles(identity)
      .filter((role) => (ROLE_CAPABILITIES[role] ?? []).includes(capability))
      .some((role) => canAccessScopedStudentResource(identity, role, resourceScope));
  }

  return false;
}

export function requireCapability(identity, capability, resourceScope = {}) {
  if (!hasCapability(identity, capability, resourceScope)) {
    throw createAuthorizationError(
      `You are not allowed to ${capability.replace('.', ' ')} for this resource.`,
      { capability, resourceScope },
    );
  }
}
