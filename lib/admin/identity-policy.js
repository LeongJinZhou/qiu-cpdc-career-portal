import { z } from 'zod';

import { sanitizeAuditPayload, createAuditEntry } from '../audit/index.js';
import { parseStudentId } from '../identity/student-id.js';
import { prisma } from '../prisma.js';

const ADMIN_ROLES = new Set(['CPDC_ADMIN', 'SUPER_ADMIN']);

/**
 * The only roles a non-super-admin may hand out.
 *
 * Everything else is privileged by definition — see PRIVILEGED_ROLES below,
 * which is derived from this rather than listed separately.
 */
const MANAGEABLE_BASE_ROLES = new Set(['STUDENT', 'EMPLOYER', 'ALUMNI']);
const ALLOWED_SCOPE_TYPES = new Set(['GLOBAL', 'FACULTY', 'PROGRAMME', 'STUDENT', 'SELF']);

function createAdminError(status, code, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function dedupeKeyForCreate(idempotencyKey) {
  return idempotencyKey ? `admin.users.create:${idempotencyKey}` : null;
}

function dedupeKeyForUpdate(targetUserId, idempotencyKey) {
  return idempotencyKey ? `admin.users.update:${targetUserId}:${idempotencyKey}` : null;
}

function ensureValidScopeType(scopeType) {
  if (!ALLOWED_SCOPE_TYPES.has(scopeType)) {
    throw createAdminError(400, 'INVALID_SCOPE_TYPE', `Unsupported scopeType "${scopeType}".`);
  }
}

function toSafeAssignment(assignment) {
  return {
    id: assignment.id,
    role: assignment.role,
    scopeType: assignment.scopeType,
    scopeValue: assignment.scopeValue,
  };
}

function toSafeStudent(student) {
  if (!student) {
    return null;
  }

  return {
    id: student.id,
    matricNo: student.matricNo,
    intakeYearMonth: student.intakeYearMonth ?? null,
    intakeSequence: student.intakeSequence ?? null,
    academicYear: student.academicYear,
    facultyId: student.facultyId,
    programmeId: student.programmeId,
    facultyName: student.faculty?.name ?? null,
    programmeName: student.programme?.name ?? null,
  };
}

function toSafeUser(userRecord) {
  return {
    id: userRecord.id,
    email: userRecord.email,
    normalizedEmail: userRecord.normalizedEmail ?? null,
    name: userRecord.name,
    role: userRecord.role,
    avatarUrl: userRecord.avatarUrl ?? null,
    loginAllowed: Boolean(userRecord.loginAllowed),
    accountStatus: userRecord.accountStatus,
    identitySource: userRecord.identitySource,
    createdAt: userRecord.createdAt ?? null,
    updatedAt: userRecord.updatedAt ?? null,
  };
}

function coerceOptionalString(value) {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (value == null || value === '') {
    return null;
  }

  return value;
}

/**
 * Every assignable account role. Must stay in step with the Prisma `Role` enum
 * and with ROLES in lib/modules.js.
 */
const SUPPORTED_ROLES = [
  'STUDENT',
  'CPDC_ADMIN',
  'FACULTY_COORDINATOR',
  'HEAD_OF_PROGRAMME',
  'ACADEMIC_SUPERVISOR',
  'PLACEMENT_OFFICER',
  'CAREER_COUNSELOR',
  'UNIVERSITY_REGISTRAR',
  'SUPER_ADMIN',
  'EMPLOYER',
  'ALUMNI',
];

/**
 * Roles only a Super Admin may assign — derived, never hand-listed.
 *
 * This used to be a literal set of four staff roles. When ACADEMIC_SUPERVISOR,
 * PLACEMENT_OFFICER, CAREER_COUNSELOR and UNIVERSITY_REGISTRAR were added, the
 * set was not updated, so a faculty-scoped CPDC_ADMIN could promote a student
 * in their own faculty to UNIVERSITY_REGISTRAR or CAREER_COUNSELOR — both of
 * which are GLOBAL_ROLES in lib/auth/permissions.js, where holding the role on
 * the User row *is* the grant. That is a privilege escalation out of the
 * officer's own faculty. Deriving it means a new role is privileged by default
 * and a future addition cannot silently reopen the hole.
 */
export const PRIVILEGED_ROLES = new Set(
  SUPPORTED_ROLES.filter((role) => !MANAGEABLE_BASE_ROLES.has(role)),
);

/** Exported so the derivation invariant can be asserted directly in tests. */
export { SUPPORTED_ROLES, MANAGEABLE_BASE_ROLES };

const roleAssignmentSchema = z.object({
  // Derived from SUPPORTED_ROLES for the same reason: the inline enum here had
  // drifted, so a RoleAssignment for any of the four newest roles was rejected
  // at validation — leaving those roles assignable on the User row but unable
  // to hold the scope they need, i.e. shipped but non-functional.
  role: z.enum(SUPPORTED_ROLES),
  scopeType: z.enum(['GLOBAL', 'FACULTY', 'PROGRAMME', 'STUDENT', 'SELF']),
  scopeValue: z.string().trim().min(1, 'scopeValue is required'),
});

const studentProfileCreateSchema = z.object({
  matricNo: z.string().trim().min(1, 'studentProfile.matricNo is required'),
  facultyId: z.string().trim().min(1, 'studentProfile.facultyId is required'),
  programmeId: z.string().trim().min(1, 'studentProfile.programmeId is required'),
  academicYear: z.coerce.number().int().min(1, 'studentProfile.academicYear must be at least 1').max(12, 'studentProfile.academicYear is too large'),
});

const studentProfilePatchSchema = z.object({
  matricNo: z.string().trim().min(1, 'studentProfile.matricNo is required').optional(),
  facultyId: z.string().trim().min(1, 'studentProfile.facultyId is required').optional(),
  programmeId: z.string().trim().min(1, 'studentProfile.programmeId is required').optional(),
  academicYear: z.coerce.number().int().min(1, 'studentProfile.academicYear must be at least 1').max(12, 'studentProfile.academicYear is too large').optional(),
});

const createUserSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email('email must be a valid email address').max(254, 'email is too long'),
  name: z.string().trim().min(1, 'name is required').max(120, 'name is too long'),
  avatarUrl: z.union([
    z.string().trim().url('avatarUrl must be a valid URL'),
    z.literal(''),
    z.null(),
    z.undefined(),
  ]).optional(),
  loginAllowed: z.boolean().optional().default(true),
  status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED']).optional().default('INVITED'),
  primaryRole: z.enum(SUPPORTED_ROLES).optional().default('STUDENT'),
  studentProfile: studentProfileCreateSchema.optional(),
  roleAssignments: z.array(roleAssignmentSchema).optional().default([]),
});

const patchUserSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(120).optional(),
  name: z.string().trim().min(1, 'name is required').max(120, 'name is too long').optional(),
  avatarUrl: z.union([
    z.string().trim().url('avatarUrl must be a valid URL'),
    z.literal(''),
    z.null(),
    z.undefined(),
  ]).optional(),
  email: z.string().trim().email('email must be a valid email address').max(254, 'email is too long').optional(),
  loginAllowed: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED']).optional(),
  primaryRole: z.enum(SUPPORTED_ROLES).optional(),
  studentProfile: studentProfilePatchSchema.optional(),
  roleAssignments: z.array(roleAssignmentSchema).optional(),
}).refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field must be provided.' },
);

export function parseCreateAdminUserInput(body) {
  try {
    return createUserSchema.parse(body);
  } catch (error) {
    if (error?.name === 'ZodError') {
      const firstIssue = error.issues?.[0];
      const fieldPath = firstIssue?.path?.join('.') ?? 'payload';
      throw createAdminError(400, 'INVALID_ADMIN_USER_PAYLOAD', `${fieldPath}: ${firstIssue?.message ?? 'Invalid value.'}`);
    }

    throw error;
  }
}

export function parsePatchAdminUserInput(body) {
  try {
    return patchUserSchema.parse(body);
  } catch (error) {
    if (error?.name === 'ZodError') {
      const firstIssue = error.issues?.[0];
      const fieldPath = firstIssue?.path?.join('.') ?? 'payload';
      throw createAdminError(400, 'INVALID_ADMIN_USER_PAYLOAD', `${fieldPath}: ${firstIssue?.message ?? 'Invalid value.'}`);
    }

    throw error;
  }
}

export function parseAdminUsersQuery(searchParams) {
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') ?? '10') || 10));

  return {
    page,
    pageSize,
    query: searchParams.get('query')?.trim() ?? '',
    role: searchParams.get('role')?.trim() ?? '',
    status: searchParams.get('status')?.trim() ?? '',
    facultyId: searchParams.get('facultyId')?.trim() ?? '',
    programmeId: searchParams.get('programmeId')?.trim() ?? '',
  };
}

export function parseAdminAuditQuery(searchParams) {
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') ?? '10') || 10));
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  if (dateFrom && Number.isNaN(new Date(dateFrom).getTime())) {
    throw createAdminError(400, 'INVALID_AUDIT_FILTER', 'dateFrom must be a valid date.');
  }

  if (dateTo && Number.isNaN(new Date(dateTo).getTime())) {
    throw createAdminError(400, 'INVALID_AUDIT_FILTER', 'dateTo must be a valid date.');
  }

  return {
    page,
    pageSize,
    action: searchParams.get('action')?.trim() ?? '',
    resource: searchParams.get('resource')?.trim() ?? '',
    actor: searchParams.get('actor')?.trim() ?? '',
    dateFrom,
    dateTo,
  };
}

function hasAdminRole(identity) {
  return ADMIN_ROLES.has(identity?.user?.role);
}

function isSuperAdmin(identity) {
  return identity?.user?.role === 'SUPER_ADMIN';
}

function getAdminAssignments(identity) {
  return (identity?.assignments ?? []).filter((assignment) => ADMIN_ROLES.has(assignment.role));
}

function getManagementScopes(identity) {
  if (isSuperAdmin(identity)) {
    return [{ type: 'GLOBAL', value: 'GLOBAL' }];
  }

  const assignments = getAdminAssignments(identity);
  if (assignments.some((assignment) => assignment.scopeType === 'GLOBAL' && assignment.scopeValue === 'GLOBAL')) {
    return [{ type: 'GLOBAL', value: 'GLOBAL' }];
  }

  return assignments.map((assignment) => ({
    type: assignment.scopeType,
    value: assignment.scopeValue,
  }));
}

function isPrivilegedRole(role) {
  return PRIVILEGED_ROLES.has(role);
}

function ensureManageableRole(role, identity) {
  if (isPrivilegedRole(role) && !isSuperAdmin(identity)) {
    throw createAdminError(403, 'INSUFFICIENT_CAPABILITY', 'Only a Super Admin may assign or escalate privileged roles.');
  }
}

function normalizeAssignmentInput(assignments, identity) {
  return (assignments ?? []).map((assignment, index) => {
    ensureValidScopeType(assignment.scopeType);
    ensureManageableRole(assignment.role, identity);

    if (assignment.role === 'STUDENT' && assignment.scopeType === 'SELF' && assignment.scopeValue !== 'SELF') {
      throw createAdminError(400, 'INVALID_SCOPE_VALUE', `roleAssignments.${index}.scopeValue must be SELF for STUDENT self scope.`);
    }

    return {
      role: assignment.role,
      scopeType: assignment.scopeType,
      scopeValue: assignment.scopeValue.trim(),
    };
  });
}

function deriveManagedScopeFromInput({ studentProfile, roleAssignments, primaryRole }) {
  if (studentProfile?.programmeId || studentProfile?.facultyId) {
    return {
      facultyId: studentProfile.facultyId ?? null,
      programmeId: studentProfile.programmeId ?? null,
    };
  }

  const programmeAssignment = (roleAssignments ?? []).find((assignment) => assignment.scopeType === 'PROGRAMME');
  if (programmeAssignment) {
    return {
      facultyId: null,
      programmeId: programmeAssignment.scopeValue,
    };
  }

  const facultyAssignment = (roleAssignments ?? []).find((assignment) => assignment.scopeType === 'FACULTY');
  if (facultyAssignment) {
    return {
      facultyId: facultyAssignment.scopeValue,
      programmeId: null,
    };
  }

  if (primaryRole && MANAGEABLE_BASE_ROLES.has(primaryRole)) {
    return { facultyId: null, programmeId: null };
  }

  return null;
}

function scopeMatches(identity, targetScope) {
  if (isSuperAdmin(identity)) {
    return true;
  }

  const scopes = getManagementScopes(identity);
  if (scopes.some((scope) => scope.type === 'GLOBAL' && scope.value === 'GLOBAL')) {
    return true;
  }

  if (!targetScope) {
    return false;
  }

  return scopes.some((scope) => {
    if (scope.type === 'PROGRAMME') {
      return Boolean(targetScope.programmeId && targetScope.programmeId === scope.value);
    }

    if (scope.type === 'FACULTY') {
      return Boolean(targetScope.facultyId && targetScope.facultyId === scope.value);
    }

    return false;
  });
}

function requireManagedScope(identity, targetScope) {
  if (!scopeMatches(identity, targetScope)) {
    throw createAdminError(403, 'INSUFFICIENT_CAPABILITY', 'This admin action is outside your permitted scope.');
  }
}

function requiresStudentProfile(role, studentProfile, roleAssignments) {
  if (studentProfile) {
    return true;
  }

  if (role === 'STUDENT') {
    return true;
  }

  return (roleAssignments ?? []).some((assignment) => assignment.role === 'STUDENT');
}

async function resolveProgrammeReference(tx, studentProfile) {
  let programme = await tx.programme.findUnique({
    where: { id: studentProfile.programmeId },
  });

  if (!programme && tx.programme.findFirst) {
    programme = await tx.programme.findFirst({
      where: {
        facultyId: studentProfile.facultyId,
        name: studentProfile.programmeId,
      },
    });
  }

  return programme;
}

async function validateProgrammeFacultyPair(tx, studentProfile) {
  if (!studentProfile) {
    return null;
  }

  const faculty = await tx.faculty.findUnique({
    where: { id: studentProfile.facultyId },
  });

  if (!faculty) {
    throw createAdminError(400, 'INVALID_SCOPE_REFERENCE', 'studentProfile.facultyId does not exist.');
  }

  const programme = await resolveProgrammeReference(tx, studentProfile);

  if (!programme) {
    throw createAdminError(400, 'INVALID_SCOPE_REFERENCE', 'studentProfile.programmeId does not exist.');
  }

  if (programme.facultyId !== studentProfile.facultyId) {
    throw createAdminError(400, 'INVALID_SCOPE_REFERENCE', 'studentProfile.programmeId does not belong to studentProfile.facultyId.');
  }

  return {
    faculty,
    programme,
    studentProfile: {
      ...studentProfile,
      programmeId: programme.id,
    },
  };
}

function applyStudentIdParts(studentProfile) {
  if (!studentProfile?.matricNo) {
    return studentProfile;
  }

  const parsed = parseStudentId(studentProfile.matricNo);
  return {
    ...studentProfile,
    matricNo: studentProfile.matricNo.trim(),
    intakeYearMonth: parsed.intakeYearMonth,
    intakeSequence: parsed.sequence,
  };
}

async function ensureNoDuplicateUser(tx, normalizedEmail, excludeUserId = null) {
  const existing = await tx.user.findFirst({
    where: {
      normalizedEmail,
    },
  });

  if (existing && existing.id !== excludeUserId) {
    throw createAdminError(409, 'DUPLICATE_EMAIL', 'A user with this email already exists.');
  }
}

async function ensureNoDuplicateStudent(tx, matricNo, excludeUserId = null) {
  if (!matricNo) {
    return;
  }

  const existing = await tx.student.findFirst({
    where: {
      matricNo,
    },
  });

  if (existing && existing.userId !== excludeUserId) {
    throw createAdminError(409, 'DUPLICATE_STUDENT_ID', 'A student with this student ID already exists.');
  }
}

function sanitizeAssignments(assignments) {
  return (assignments ?? []).map(toSafeAssignment);
}

export function sanitizeAdminUserRecord(userRecord) {
  return {
    user: toSafeUser(userRecord),
    student: toSafeStudent(userRecord.student),
    assignments: sanitizeAssignments(userRecord.roleAssignments ?? userRecord.assignments),
  };
}

export function sanitizeAdminAuditRecord(auditRecord) {
  return {
    id: auditRecord.id,
    action: auditRecord.action,
    resourceType: auditRecord.resourceType,
    resourceId: auditRecord.resourceId,
    requestId: auditRecord.requestId ?? null,
    createdAt: auditRecord.createdAt ?? null,
    actor: auditRecord.actorUser ? {
      id: auditRecord.actorUser.id,
      email: auditRecord.actorUser.email,
      normalizedEmail: auditRecord.actorUser.normalizedEmail ?? null,
      name: auditRecord.actorUser.name,
      role: auditRecord.actorUser.role,
      avatarUrl: auditRecord.actorUser.avatarUrl ?? null,
    } : null,
    before: auditRecord.before == null ? null : sanitizeAuditPayload(auditRecord.before),
    after: auditRecord.after == null ? null : sanitizeAuditPayload(auditRecord.after),
    metadata: auditRecord.metadata == null ? null : sanitizeAuditPayload(auditRecord.metadata),
  };
}

export function requireAdminAccess(identity) {
  if (!identity?.user?.id) {
    throw createAdminError(401, 'AUTHENTICATION_REQUIRED', 'Sign in is required.');
  }

  if (!hasAdminRole(identity)) {
    throw createAdminError(403, 'INSUFFICIENT_CAPABILITY', 'This API is restricted to CPDC and Super Admin accounts.');
  }

  return identity;
}

async function loadUserForAdmin(tx, userId) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    include: {
      roleAssignments: true,
      student: {
        include: {
          faculty: true,
          programme: true,
        },
      },
    },
  });

  if (!user) {
    throw createAdminError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  return user;
}

function buildRoleAssignmentsForCreate(userId, assignments, primaryRole) {
  if (assignments?.length) {
    return assignments.map((assignment) => ({
      userId,
      role: assignment.role,
      scopeType: assignment.scopeType,
      scopeValue: assignment.scopeValue,
    }));
  }

  if (primaryRole === 'STUDENT') {
    return [
      {
        userId,
        role: 'STUDENT',
        scopeType: 'SELF',
        scopeValue: 'SELF',
      },
    ];
  }

  return [];
}

function buildAfterSnapshot(userRecord) {
  return sanitizeAdminUserRecord(userRecord);
}

async function findExistingIdempotentResponse(prismaClient, dedupeKey) {
  if (!dedupeKey) {
    return null;
  }

  const existing = await prismaClient.outboxEvent.findUnique({
    where: { dedupeKey },
  });

  return existing?.payload?.response ?? null;
}

async function createOutboxEvent(tx, event) {
  return tx.outboxEvent.create({
    data: event,
  });
}

async function withIdempotentOutboxFallback(work, { prismaClient, dedupeKey }) {
  try {
    return await work();
  } catch (error) {
    if (dedupeKey && isUniqueConstraintError(error)) {
      const existingResponse = await findExistingIdempotentResponse(prismaClient, dedupeKey);
      if (existingResponse) {
        return existingResponse;
      }
    }

    throw error;
  }
}

function hasCompleteStudentProfile(studentProfile) {
  return Boolean(
    studentProfile?.matricNo
    && studentProfile?.facultyId
    && studentProfile?.programmeId
    && typeof studentProfile?.academicYear !== 'undefined',
  );
}

function resolveLogbookAuditStudentId(record) {
  return record?.after?.studentId ?? record?.before?.studentId ?? null;
}

export async function createAdminUser({
  identity,
  input,
  prismaClient = prisma,
  requestId = null,
  idempotencyKey = null,
}) {
  requireAdminAccess(identity);

  const parsed = parseCreateAdminUserInput(input);
  const effectiveIdempotencyKey = idempotencyKey ?? parsed.idempotencyKey ?? null;
  const dedupeKey = dedupeKeyForCreate(effectiveIdempotencyKey);
  const existingResponse = await findExistingIdempotentResponse(prismaClient, dedupeKey);
  if (existingResponse) {
    return existingResponse;
  }

  const normalizedEmail = normalizeEmail(parsed.email);
  const normalizedAssignments = normalizeAssignmentInput(parsed.roleAssignments, identity);
  const role = parsed.primaryRole;
  const avatarUrl = coerceOptionalString(parsed.avatarUrl);
  const studentProfile = parsed.studentProfile ? applyStudentIdParts(parsed.studentProfile) : null;

  ensureManageableRole(role, identity);

  if (requiresStudentProfile(role, studentProfile, normalizedAssignments) && !studentProfile) {
    throw createAdminError(400, 'STUDENT_PROFILE_REQUIRED', 'A student profile is required for student identities.');
  }

  requireManagedScope(identity, deriveManagedScopeFromInput({
    studentProfile,
    roleAssignments: normalizedAssignments,
    primaryRole: role,
  }));

  return withIdempotentOutboxFallback(() => prismaClient.$transaction(async (tx) => {
    await ensureNoDuplicateUser(tx, normalizedEmail);
    await ensureNoDuplicateStudent(tx, studentProfile?.matricNo ?? null);
    const resolvedStudent = await validateProgrammeFacultyPair(tx, studentProfile);

    const createdUser = await tx.user.create({
      data: {
        email: parsed.email.trim(),
        normalizedEmail,
        name: parsed.name.trim(),
        role,
        avatarUrl,
        loginAllowed: parsed.loginAllowed ?? true,
        accountStatus: parsed.status ?? 'INVITED',
        identitySource: 'MANUAL',
      },
    });

    if (resolvedStudent?.studentProfile) {
      await tx.student.create({
        data: {
          userId: createdUser.id,
          matricNo: resolvedStudent.studentProfile.matricNo,
          intakeYearMonth: resolvedStudent.studentProfile.intakeYearMonth,
          intakeSequence: resolvedStudent.studentProfile.intakeSequence,
          facultyId: resolvedStudent.studentProfile.facultyId,
          programmeId: resolvedStudent.studentProfile.programmeId,
          academicYear: resolvedStudent.studentProfile.academicYear,
        },
      });
    }

    const assignmentRows = buildRoleAssignmentsForCreate(createdUser.id, normalizedAssignments, role);
    if (assignmentRows.length > 0) {
      await tx.roleAssignment.createMany({
        data: assignmentRows,
      });
    }

    const createdRecord = await loadUserForAdmin(tx, createdUser.id);
    const response = buildAfterSnapshot(createdRecord);

    await createAuditEntry({
      tx,
      actorUserId: identity.user.id,
      action: 'ADMIN_USER_CREATED',
      resourceType: 'User',
      resourceId: createdUser.id,
      before: null,
      after: response,
      requestId,
      metadata: {
        targetUserId: createdUser.id,
        facultyId: response.student?.facultyId ?? null,
        programmeId: response.student?.programmeId ?? null,
      },
    });

    if (dedupeKey) {
      await createOutboxEvent(tx, {
        topic: 'admin.user.created',
        aggregateType: 'User',
        aggregateId: createdUser.id,
        payload: {
          requestId,
          response,
        },
        dedupeKey,
      });
    }

    return response;
  }), { prismaClient, dedupeKey });
}

function targetScopeFromUserRecord(userRecord, nextStudentProfile = null, nextAssignments = null) {
  if (nextStudentProfile) {
    return {
      facultyId: nextStudentProfile.facultyId ?? null,
      programmeId: nextStudentProfile.programmeId ?? null,
    };
  }

  if (userRecord.student) {
    return {
      facultyId: userRecord.student.facultyId,
      programmeId: userRecord.student.programmeId,
    };
  }

  return deriveManagedScopeFromInput({
    studentProfile: null,
    roleAssignments: nextAssignments ?? userRecord.roleAssignments ?? [],
    primaryRole: userRecord.role,
  });
}

export async function updateAdminUser({
  identity,
  targetUserId,
  input,
  prismaClient = prisma,
  requestId = null,
  idempotencyKey = null,
}) {
  requireAdminAccess(identity);

  const parsed = parsePatchAdminUserInput(input);
  const effectiveIdempotencyKey = idempotencyKey ?? parsed.idempotencyKey ?? null;
  const dedupeKey = dedupeKeyForUpdate(targetUserId, effectiveIdempotencyKey);
  const existingResponse = await findExistingIdempotentResponse(prismaClient, dedupeKey);
  if (existingResponse) {
    return existingResponse;
  }

  if (
    targetUserId === identity.user.id
    && (
      typeof parsed.loginAllowed !== 'undefined'
      || typeof parsed.status !== 'undefined'
      || typeof parsed.primaryRole !== 'undefined'
      || typeof parsed.roleAssignments !== 'undefined'
    )
  ) {
    throw createAdminError(403, 'SELF_LOCKOUT_BLOCKED', 'You cannot change your own access in a way that risks self-lockout or privilege escalation.');
  }

  const normalizedAssignments = typeof parsed.roleAssignments !== 'undefined'
    ? normalizeAssignmentInput(parsed.roleAssignments, identity)
    : undefined;
  const normalizedEmail = typeof parsed.email !== 'undefined' ? normalizeEmail(parsed.email) : undefined;

  if (!isSuperAdmin(identity) && (typeof normalizedEmail !== 'undefined' || typeof parsed.studentProfile !== 'undefined')) {
    throw createAdminError(403, 'INSUFFICIENT_CAPABILITY', 'Only a Super Admin may change identity-critical fields.');
  }

  if (typeof parsed.primaryRole !== 'undefined') {
    ensureManageableRole(parsed.primaryRole, identity);
  }

  const studentProfile = parsed.studentProfile ? applyStudentIdParts(parsed.studentProfile) : null;

  return withIdempotentOutboxFallback(() => prismaClient.$transaction(async (tx) => {
    const beforeRecord = await loadUserForAdmin(tx, targetUserId);
    requireManagedScope(identity, targetScopeFromUserRecord(beforeRecord));

    if (typeof normalizedEmail !== 'undefined') {
      await ensureNoDuplicateUser(tx, normalizedEmail, targetUserId);
    }

    const currentStudent = beforeRecord.student ?? null;
    const nextStudentProfile = studentProfile ? {
      matricNo: studentProfile.matricNo ?? currentStudent?.matricNo,
      intakeYearMonth: studentProfile.intakeYearMonth ?? currentStudent?.intakeYearMonth ?? null,
      intakeSequence: studentProfile.intakeSequence ?? currentStudent?.intakeSequence ?? null,
      facultyId: studentProfile.facultyId ?? currentStudent?.facultyId,
      programmeId: studentProfile.programmeId ?? currentStudent?.programmeId,
      academicYear: typeof studentProfile.academicYear !== 'undefined'
        ? studentProfile.academicYear
        : currentStudent?.academicYear,
    } : null;

    if (nextStudentProfile) {
      if (!currentStudent && !hasCompleteStudentProfile(nextStudentProfile)) {
        throw createAdminError(400, 'STUDENT_PROFILE_REQUIRED', 'A complete student profile is required when linking a user to a student record.');
      }

      await ensureNoDuplicateStudent(tx, nextStudentProfile.matricNo, targetUserId);
      const resolvedStudent = await validateProgrammeFacultyPair(tx, nextStudentProfile);
      nextStudentProfile.programmeId = resolvedStudent.studentProfile.programmeId;
      requireManagedScope(identity, {
        facultyId: nextStudentProfile.facultyId,
        programmeId: nextStudentProfile.programmeId,
      });
    }

    if (typeof parsed.primaryRole !== 'undefined') {
      const nextScope = targetScopeFromUserRecord(
        beforeRecord,
        nextStudentProfile,
        normalizedAssignments ?? beforeRecord.roleAssignments,
      );
      requireManagedScope(identity, nextScope);
    }

    const updateData = {};
    if (typeof parsed.name !== 'undefined') {
      updateData.name = parsed.name.trim();
    }
    if (typeof parsed.avatarUrl !== 'undefined') {
      updateData.avatarUrl = coerceOptionalString(parsed.avatarUrl);
    }
    if (typeof normalizedEmail !== 'undefined') {
      updateData.email = parsed.email.trim();
      updateData.normalizedEmail = normalizedEmail;
    }
    if (typeof parsed.loginAllowed !== 'undefined') {
      updateData.loginAllowed = parsed.loginAllowed;
    }
    if (typeof parsed.status !== 'undefined') {
      updateData.accountStatus = parsed.status;
    }
    if (typeof parsed.primaryRole !== 'undefined') {
      updateData.role = parsed.primaryRole;
    }

    if (Object.keys(updateData).length > 0) {
      await tx.user.update({
        where: { id: targetUserId },
        data: updateData,
      });
    }

    if (nextStudentProfile && currentStudent) {
      await tx.student.update({
        where: { userId: targetUserId },
        data: nextStudentProfile,
      });
    } else if (nextStudentProfile && !currentStudent) {
      await tx.student.create({
        data: {
          userId: targetUserId,
          matricNo: nextStudentProfile.matricNo,
          intakeYearMonth: nextStudentProfile.intakeYearMonth,
          intakeSequence: nextStudentProfile.intakeSequence,
          facultyId: nextStudentProfile.facultyId,
          programmeId: nextStudentProfile.programmeId,
          academicYear: nextStudentProfile.academicYear,
        },
      });
    }

    if (typeof normalizedAssignments !== 'undefined') {
      await tx.roleAssignment.deleteMany({
        where: { userId: targetUserId },
      });

      if (normalizedAssignments.length > 0) {
        await tx.roleAssignment.createMany({
          data: normalizedAssignments.map((assignment) => ({
            userId: targetUserId,
            role: assignment.role,
            scopeType: assignment.scopeType,
            scopeValue: assignment.scopeValue,
          })),
        });
      }
    }

    const afterRecord = await loadUserForAdmin(tx, targetUserId);
    const before = sanitizeAdminUserRecord(beforeRecord);
    const after = sanitizeAdminUserRecord(afterRecord);

    await createAuditEntry({
      tx,
      actorUserId: identity.user.id,
      action: 'ADMIN_USER_UPDATED',
      resourceType: 'User',
      resourceId: targetUserId,
      before,
      after,
      requestId,
      metadata: {
        targetUserId,
        facultyId: after.student?.facultyId ?? null,
        programmeId: after.student?.programmeId ?? null,
      },
    });

    if (dedupeKey) {
      await createOutboxEvent(tx, {
        topic: 'admin.user.updated',
        aggregateType: 'User',
        aggregateId: targetUserId,
        payload: {
          requestId,
          response: after,
        },
        dedupeKey,
      });
    }

    return after;
  }), { prismaClient, dedupeKey });
}

function matchesScopeForUser(identity, userRecord) {
  requireAdminAccess(identity);
  return scopeMatches(identity, targetScopeFromUserRecord(userRecord));
}

function matchesUserFilters(userRecord, filters) {
  if (filters.role && userRecord.role !== filters.role) {
    return false;
  }

  if (filters.status && userRecord.accountStatus !== filters.status) {
    return false;
  }

  if (filters.facultyId && userRecord.student?.facultyId !== filters.facultyId) {
    return false;
  }

  if (
    filters.programmeId
    && userRecord.student?.programmeId !== filters.programmeId
    && userRecord.student?.programme?.name !== filters.programmeId
  ) {
    return false;
  }

  if (filters.query) {
    const haystack = [
      userRecord.name,
      userRecord.email,
      userRecord.normalizedEmail,
      userRecord.student?.matricNo,
    ].filter(Boolean).join(' ').toLowerCase();

    if (!haystack.includes(filters.query.toLowerCase())) {
      return false;
    }
  }

  return true;
}

export async function listAdminUsers({
  identity,
  filters,
  prismaClient = prisma,
}) {
  requireAdminAccess(identity);

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 10;

  const users = await prismaClient.user.findMany({
    include: {
      roleAssignments: true,
      student: {
        include: {
          faculty: true,
          programme: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const visible = users
    .filter((userRecord) => matchesScopeForUser(identity, userRecord))
    .filter((userRecord) => matchesUserFilters(userRecord, filters));

  const start = (page - 1) * pageSize;
  const items = visible.slice(start, start + pageSize).map(sanitizeAdminUserRecord);

  return {
    items,
    page,
    pageSize,
    total: visible.length,
  };
}

async function getManageableUserIds(identity, prismaClient) {
  if (isSuperAdmin(identity) || getManagementScopes(identity).some((scope) => scope.type === 'GLOBAL')) {
    const users = await prismaClient.user.findMany({
      select: { id: true },
    });
    return new Set(users.map((user) => user.id));
  }

  const users = await prismaClient.user.findMany({
    include: {
      roleAssignments: true,
      student: {
        include: {
          faculty: true,
          programme: true,
        },
      },
    },
  });

  return new Set(
    users
      .filter((userRecord) => matchesScopeForUser(identity, userRecord))
      .map((userRecord) => userRecord.id),
  );
}

async function getManageableStudentIds(identity, prismaClient) {
  if (isSuperAdmin(identity) || getManagementScopes(identity).some((scope) => scope.type === 'GLOBAL')) {
    const users = await prismaClient.user.findMany({
      include: {
        roleAssignments: true,
        student: {
          include: {
            faculty: true,
            programme: true,
          },
        },
      },
    });

    return new Set(
      users
        .map((userRecord) => userRecord.student?.id)
        .filter(Boolean),
    );
  }

  const users = await prismaClient.user.findMany({
    include: {
      roleAssignments: true,
      student: {
        include: {
          faculty: true,
          programme: true,
        },
      },
    },
  });

  return new Set(
    users
      .filter((userRecord) => matchesScopeForUser(identity, userRecord))
      .map((userRecord) => userRecord.student?.id)
      .filter(Boolean),
  );
}

function matchesAuditFilters(record, filters) {
  if (filters.action && record.action !== filters.action) {
    return false;
  }

  if (filters.resource && record.resourceType !== filters.resource) {
    return false;
  }

  if (filters.actor && record.actorUserId !== filters.actor) {
    return false;
  }

  if (filters.dateFrom && new Date(record.createdAt).getTime() < new Date(filters.dateFrom).getTime()) {
    return false;
  }

  if (filters.dateTo) {
    const nextDay = new Date(`${filters.dateTo}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    if (new Date(record.createdAt).getTime() >= nextDay.getTime()) {
      return false;
    }
  }

  return true;
}

export async function listAdminAudit({
  identity,
  filters,
  prismaClient = prisma,
}) {
  requireAdminAccess(identity);

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 10;
  const isGlobalAdmin = isSuperAdmin(identity) || getManagementScopes(identity).some((scope) => scope.type === 'GLOBAL');
  const manageableUserIds = await getManageableUserIds(identity, prismaClient);
  const manageableStudentIds = await getManageableStudentIds(identity, prismaClient);
  const audits = await prismaClient.auditLog.findMany({
    include: {
      actorUser: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const visible = audits.filter((record) => {
    if (!matchesAuditFilters(record, filters)) {
      return false;
    }

    if (isGlobalAdmin) {
      return true;
    }

    if (record.resourceType === 'User') {
      return manageableUserIds.has(record.resourceId);
    }

    if (record.resourceType === 'Student') {
      return manageableStudentIds.has(record.resourceId);
    }

    if (record.resourceType === 'LogbookEntry') {
      const studentId = resolveLogbookAuditStudentId(record);
      return studentId ? manageableStudentIds.has(studentId) : false;
    }

    return false;
  });

  const start = (page - 1) * pageSize;
  const items = visible.slice(start, start + pageSize).map(sanitizeAdminAuditRecord);

  return {
    items,
    page,
    pageSize,
    total: visible.length,
  };
}

export function toAdminRouteError(error) {
  if (typeof error?.status === 'number') {
    return {
      status: error.status,
      code: error.code ?? 'ADMIN_ERROR',
      message: error.message,
    };
  }

  return {
    status: 500,
    code: 'ADMIN_ERROR',
    message: 'Admin services are unavailable right now.',
  };
}
