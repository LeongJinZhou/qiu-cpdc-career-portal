import { prisma } from '../prisma.js';
import { createAuditEntry } from '../audit/index.js';
import { z } from 'zod';

import { AUTH_SESSION_COOKIE, readSessionCookie } from './session.js';
import { getIdentityCapabilities, getIdentityScopes } from './permissions.js';

function createIdentityError(status, code, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

function getSessionCookieValue(request) {
  return request?.cookies?.get?.(AUTH_SESSION_COOKIE)?.value ?? null;
}

function getRequestId(request) {
  return request?.headers?.get?.('x-request-id') ?? null;
}

function toSafeUser(user) {
  return {
    id: user.id,
    email: user.email,
    normalizedEmail: user.normalizedEmail ?? null,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
  };
}

function toSafeStudent(student) {
  if (!student) {
    return null;
  }

  return {
    id: student.id,
    matricNo: student.matricNo,
    academicYear: student.academicYear,
    facultyId: student.facultyId,
    programmeId: student.programmeId,
    intakeYearMonth: student.intakeYearMonth ?? null,
    intakeSequence: student.intakeSequence ?? null,
    phone: student.phone ?? null,
    bio: student.bio ?? null,
    careerTargets: student.careerTargets ?? null,
    industries: student.industries ?? null,
    portfolioUrl: student.portfolioUrl ?? null,
    githubUrl: student.githubUrl ?? null,
    linkedinUrl: student.linkedinUrl ?? null,
    resumeSummary: student.resumeSummary ?? null,
    resumeData: student.resumeData ?? null,
  };
}

function toSafeFaculty(faculty) {
  if (!faculty) {
    return null;
  }

  return {
    id: faculty.id,
    name: faculty.name,
    code: faculty.code,
  };
}

function toSafeProgramme(programme) {
  if (!programme) {
    return null;
  }

  return {
    id: programme.id,
    name: programme.name,
    level: programme.level,
  };
}

function toSafeAssignments(assignments) {
  return (assignments ?? []).map((assignment) => ({
    id: assignment.id,
    role: assignment.role,
    scopeType: assignment.scopeType,
    scopeValue: assignment.scopeValue,
  }));
}

// ---------------------------------------------------------------------------
// Self-service student profile + manual CV sections
// ---------------------------------------------------------------------------
//
// STORAGE NOTE (read before changing): there is no StudentProfile table yet.
// The Student model carries only registry facts (matric, faculty, programme,
// year) plus course-derived skillTags — nothing a student writes about
// themselves. Rather than shadow that data in sessionStorage (where it dies on
// the next reload, which is exactly the bug this replaces), the self-authored
// layer is persisted in the existing scoped key/value store, PlatformSetting,
// under scopeType 'STUDENT' / scopeValue <studentId>:
//
//   key 'student.profile'   -> bio, career targets, industries, skills, links
//   key 'student.cv.manual' -> work experience, volunteering, achievements
//
// PlatformSetting already has @@unique([key, scopeType, scopeValue]) and is only
// ever read by exact key (lib/settings/policy.js reads 'platform.settings'), so
// these rows cannot collide with admin settings. This is a deliberate
// no-migration choice; the recommended follow-up is a real StudentProfile /
// StudentCvEntry model. See the report accompanying this change.

export const STUDENT_PROFILE_SETTING_KEY = 'student.profile';
export const STUDENT_CV_SETTING_KEY = 'student.cv.manual';
const STUDENT_SCOPE_TYPE = 'STUDENT';

/**
 * Fields a student may never write about themselves.
 *
 * Faculty, programme, year and matric number are registry facts confirmed at
 * enrolment; email and role come from the Google identity. Every verified badge,
 * approval and employer match hangs off them, so letting a student retype them
 * would quietly invalidate the whole trust chain. Changing them is a
 * SUPER_ADMIN action on the admin identity console (app/api/admin/users), never
 * a self-service one — so this endpoint refuses them outright rather than
 * accepting-and-ignoring, which would look like a silent save.
 */
export const LOCKED_IDENTITY_FIELDS = Object.freeze([
  'matricNo',
  'studentId',
  'facultyId',
  'faculty',
  'programmeId',
  'programme',
  'academicYear',
  'year',
  'intakeYearMonth',
  'intakeSequence',
  'role',
  'email',
  'normalizedEmail',
  'skillTags',
]);

const LOCKED_FIELD_LABELS = {
  matricNo: 'student ID',
  studentId: 'student ID',
  facultyId: 'faculty',
  faculty: 'faculty',
  programmeId: 'programme',
  programme: 'programme',
  academicYear: 'year of study',
  year: 'year of study',
  intakeYearMonth: 'intake',
  intakeSequence: 'intake',
  role: 'account role',
  email: 'QIU email',
  normalizedEmail: 'QIU email',
  skillTags: 'verified skill tags',
};

/**
 * Throw a 403 if a self-service profile patch tries to touch a locked identity
 * field. Pure and synchronous so it is directly unit-testable.
 */
export function assertNoLockedIdentityFields(body) {
  if (!body || typeof body !== 'object') {
    return [];
  }

  const attempted = LOCKED_IDENTITY_FIELDS.filter(
    (field) => Object.prototype.hasOwnProperty.call(body, field),
  );

  if (attempted.length > 0) {
    const labels = [...new Set(attempted.map((field) => LOCKED_FIELD_LABELS[field] ?? field))];
    throw createIdentityError(
      403,
      'IDENTITY_FIELD_LOCKED',
      `Your ${labels.join(', ')} is confirmed by QIU and cannot be changed here. Ask CPDC or the Registrar if it is wrong.`,
      { fields: attempted },
    );
  }

  return attempted;
}

const optionalLink = z.union([
  z.string().trim().max(300, 'Links must be shorter than 300 characters').url('Enter a full link starting with https://'),
  z.literal(''),
  z.null(),
]).optional();

const studentProfileSchema = z.object({
  phone: z.union([z.string().trim().max(50, 'Keep your phone number under 50 characters'), z.literal('')]).optional(),
  bio: z.union([z.string().trim().max(1200, 'Keep your bio under 1200 characters'), z.literal('')]).optional(),
  careerTargets: z.union([z.string().trim().max(200, 'Keep your career target under 200 characters'), z.literal('')]).optional(),
  industries: z.union([z.string().trim().max(200, 'Keep your target industries under 200 characters'), z.literal('')]).optional(),
  resumeSummary: z.union([z.string().trim().max(3000, 'Keep your resume summary under 3000 characters'), z.literal('')]).optional(),
  skills: z.array(z.string().trim().min(1).max(40, 'Each skill must be under 40 characters'))
    .max(20, 'You can list up to 20 skills')
    .optional(),
  linkedinUrl: optionalLink,
  portfolioUrl: optionalLink,
  githubUrl: optionalLink,
});

const profilePatchSchema = z.object({
  name: z.string().trim().min(1, 'Enter your full name').max(120, 'Your name is too long').optional(),
  avatarUrl: z.union([
    z.string().trim().url('Enter a full image link starting with https://'),
    z.literal(''),
    z.null(),
  ]).optional(),
}).merge(studentProfileSchema).refine(
  (value) => Object.values(value).some((entry) => typeof entry !== 'undefined'),
  { message: 'Change at least one field before saving.' },
);

const cvDateSchema = z.union([
  z.string().trim().max(40, 'Keep dates short, e.g. "Jan 2025"'),
  z.literal(''),
]).optional();

const cvRoleEntrySchema = z.object({
  id: z.string().trim().max(60).optional(),
  title: z.string().trim().min(1, 'Add a role or job title').max(120, 'Keep the title under 120 characters'),
  organisation: z.union([z.string().trim().max(120, 'Keep the organisation under 120 characters'), z.literal('')]).optional(),
  startDate: cvDateSchema,
  endDate: cvDateSchema,
  description: z.union([z.string().trim().max(800, 'Keep the description under 800 characters'), z.literal('')]).optional(),
});

const cvAchievementSchema = z.object({
  id: z.string().trim().max(60).optional(),
  title: z.string().trim().min(1, 'Add the achievement title').max(120, 'Keep the title under 120 characters'),
  organisation: z.union([z.string().trim().max(120, 'Keep the issuer under 120 characters'), z.literal('')]).optional(),
  startDate: cvDateSchema,
  endDate: cvDateSchema,
  description: z.union([z.string().trim().max(800, 'Keep the description under 800 characters'), z.literal('')]).optional(),
});

const manualCvSchema = z.object({
  experience: z.array(cvRoleEntrySchema).max(20, 'You can add up to 20 work experience entries').optional(),
  volunteering: z.array(cvRoleEntrySchema).max(20, 'You can add up to 20 volunteering entries').optional(),
  achievements: z.array(cvAchievementSchema).max(20, 'You can add up to 20 achievements').optional(),
});

export const EMPTY_STUDENT_PROFILE = Object.freeze({
  phone: '',
  bio: '',
  careerTargets: '',
  industries: '',
  resumeSummary: '',
  skills: [],
  linkedinUrl: '',
  portfolioUrl: '',
  githubUrl: '',
});

export const EMPTY_MANUAL_CV = Object.freeze({
  experience: [],
  volunteering: [],
  achievements: [],
});

const logbookBodySchema = z.object({
  studentId: z.string().trim().min(1, 'studentId is required'),
  title: z.string().trim().min(1, 'title is required'),
  details: z.string().max(10000, 'details is too long').optional().default(''),
  hours: z.coerce.number().positive('hours must be a number between 0 and 24').max(24, 'hours must be a number between 0 and 24'),
  entryDate: z.string().optional(),
  fieldValues: z.record(z.string(), z.unknown()).optional().default({}),
  latitude: z.union([z.coerce.number(), z.null(), z.undefined()]).optional(),
  longitude: z.union([z.coerce.number(), z.null(), z.undefined()]).optional(),
  supervisor: z.object({
    name: z.string().trim().min(1, 'supervisor.name is required'),
    email: z.union([
      z.string().trim().email('supervisor.email must be a valid email address').max(254, 'supervisor.email is too long'),
      z.literal(''),
      z.null(),
      z.undefined(),
    ]).optional(),
    phone: z.union([
      z.string().trim().max(50, 'supervisor.phone is too long'),
      z.literal(''),
      z.null(),
      z.undefined(),
    ]).optional(),
  }),
});

export function buildCanonicalIdentity(userRecord) {
  if (!userRecord) {
    throw createIdentityError(401, 'AUTHENTICATION_REQUIRED', 'No active authenticated identity was found.');
  }

  if (userRecord.role === 'STUDENT' && !userRecord.student) {
    throw createIdentityError(404, 'STUDENT_RECORD_NOT_FOUND', 'The authenticated student record was not found.');
  }

  const identity = {
    user: toSafeUser(userRecord),
    student: toSafeStudent(userRecord.student),
    faculty: toSafeFaculty(userRecord.student?.faculty),
    programme: toSafeProgramme(userRecord.student?.programme),
    assignments: toSafeAssignments(userRecord.roleAssignments),
    role: userRecord.role,
  };

  identity.scopes = getIdentityScopes(identity);
  identity.capabilities = getIdentityCapabilities(identity);

  return identity;
}

export async function loadIdentityByUserId(userId, { prismaClient = prisma } = {}) {
  if (!userId) {
    throw createIdentityError(401, 'AUTHENTICATION_REQUIRED', 'No active authenticated identity was found.');
  }

  const userRecord = await prismaClient.user.findUnique({
    where: { id: userId },
    include: {
      roleAssignments: true,
      student: {
        include: {
          faculty: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          programme: {
            select: {
              id: true,
              name: true,
              level: true,
            },
          },
        },
      },
    },
  });

  if (!userRecord) {
    throw createIdentityError(401, 'AUTHENTICATION_REQUIRED', 'The current session is no longer valid.');
  }

  return buildCanonicalIdentity(userRecord);
}

export async function getAuthenticatedIdentity(request, {
  prismaClient = prisma,
  readSessionCookieImpl = readSessionCookie,
} = {}) {
  const sessionCookieValue = getSessionCookieValue(request);
  if (!sessionCookieValue) {
    throw createIdentityError(401, 'AUTHENTICATION_REQUIRED', 'Sign in is required.');
  }

  const session = await readSessionCookieImpl(sessionCookieValue, { prisma: prismaClient });
  if (!session?.user?.id) {
    throw createIdentityError(401, 'AUTHENTICATION_REQUIRED', 'Sign in is required.');
  }

  return loadIdentityByUserId(session.user.id, { prismaClient });
}

export async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    throw createIdentityError(400, 'INVALID_JSON', 'Request body must be valid JSON');
  }
}

export async function parseProfilePatchBody(request) {
  const body = await parseJsonBody(request);
  // Refuse locked registry fields BEFORE Zod strips them. Zod would drop the
  // unknown keys silently and the student would see "Saved" for a change that
  // never happened — the exact silent failure this endpoint must not have.
  assertNoLockedIdentityFields(body);
  return profilePatchSchema.parse(body);
}

/** The subset of a validated patch that lives on the User row. */
export function normalizeProfilePatch(body) {
  return {
    ...(typeof body.name !== 'undefined' ? { name: body.name.trim() } : {}),
    ...(typeof body.avatarUrl !== 'undefined'
      ? {
        avatarUrl: body.avatarUrl === '' ? null : body.avatarUrl,
      }
      : {}),
  };
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** The subset of a validated patch that lives in the scoped profile document. */
export function normalizeStudentProfilePatch(body) {
  const patch = {};

  for (const field of ['phone', 'bio', 'careerTargets', 'industries', 'resumeSummary']) {
    if (typeof body[field] !== 'undefined') {
      patch[field] = normalizeText(body[field]);
    }
  }

  for (const field of ['linkedinUrl', 'portfolioUrl', 'githubUrl']) {
    if (typeof body[field] !== 'undefined') {
      patch[field] = body[field] === null ? '' : normalizeText(body[field]);
    }
  }

  if (typeof body.skills !== 'undefined') {
    const seen = new Set();
    patch.skills = (body.skills ?? [])
      .map((skill) => normalizeText(skill))
      .filter((skill) => {
        const key = skill.toLowerCase();
        if (!skill || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 20);
  }

  return patch;
}

export function mergeStudentProfile(stored) {
  const value = stored && typeof stored === 'object' ? stored : {};
  return {
    ...EMPTY_STUDENT_PROFILE,
    ...Object.fromEntries(
      Object.keys(EMPTY_STUDENT_PROFILE)
        .filter((key) => typeof value[key] !== 'undefined')
        .map((key) => [key, value[key]]),
    ),
    skills: Array.isArray(value.skills) ? value.skills : [],
  };
}

function scopedSettingWhere(key, studentId) {
  return {
    scopeKey: {
      key,
      scopeType: STUDENT_SCOPE_TYPE,
      scopeValue: studentId,
    },
  };
}

async function readScopedDocument(key, studentId, prismaClient) {
  if (!studentId) {
    return null;
  }

  const record = await prismaClient.platformSetting.findUnique({
    where: scopedSettingWhere(key, studentId),
  });

  return record?.value ?? null;
}

async function writeScopedDocument(key, studentId, value, {
  client,
  actorUserId = null,
  description,
}) {
  const existing = await client.platformSetting.findUnique({
    where: scopedSettingWhere(key, studentId),
  });

  if (existing) {
    return client.platformSetting.update({
      where: { id: existing.id },
      data: {
        value,
        updatedByUserId: actorUserId,
        version: { increment: 1 },
      },
    });
  }

  return client.platformSetting.create({
    data: {
      key,
      value,
      description,
      scopeType: STUDENT_SCOPE_TYPE,
      scopeValue: studentId,
      updatedByUserId: actorUserId,
    },
  });
}

/** Read a student's self-authored profile. Always returns a complete shape. */
export async function loadStudentProfile(studentId, { prismaClient = prisma } = {}) {
  return mergeStudentProfile(
    await readScopedDocument(STUDENT_PROFILE_SETTING_KEY, studentId, prismaClient),
  );
}

/**
 * Merge a validated patch into a student's self-authored profile.
 * The caller is responsible for authorization — this writes whatever it is given
 * to the studentId it is given.
 */
export async function saveStudentProfile(studentId, patch, {
  prismaClient = prisma,
  actorUserId = null,
  requestId = null,
} = {}) {
  if (!studentId) {
    throw createIdentityError(
      403,
      'STUDENT_CONTEXT_REQUIRED',
      'Career profile details can only be saved on a student account.',
    );
  }

  return prismaClient.$transaction(async (tx) => {
    const before = mergeStudentProfile(
      await readScopedDocument(STUDENT_PROFILE_SETTING_KEY, studentId, tx),
    );
    const after = mergeStudentProfile({ ...before, ...patch });

    await writeScopedDocument(STUDENT_PROFILE_SETTING_KEY, studentId, after, {
      client: tx,
      actorUserId,
      description: 'Student-authored career profile (self-service).',
    });

    await createAuditEntry({
      tx,
      actorUserId,
      action: 'STUDENT_PROFILE_UPDATED',
      resourceType: 'Student',
      resourceId: studentId,
      before,
      after,
      requestId,
      metadata: { scope: 'self-service' },
    });

    return after;
  });
}

function normalizeCvEntries(entries, prefix) {
  return (entries ?? []).map((entry, index) => ({
    id: normalizeText(entry.id) || `${prefix}-${index + 1}`,
    title: normalizeText(entry.title),
    organisation: normalizeText(entry.organisation),
    startDate: normalizeText(entry.startDate),
    endDate: normalizeText(entry.endDate),
    description: normalizeText(entry.description),
    // The provenance flag the CV renderer keys its "Added by you" vs
    // "Verified by QIU" styling off. Everything this endpoint stores is
    // self-declared by definition, so it is set here and never accepted from
    // the request body — a student must not be able to mark their own entry
    // as verified.
    source: 'MANUAL',
  })).filter((entry) => entry.title);
}

export function mergeManualCv(stored) {
  const value = stored && typeof stored === 'object' ? stored : {};
  return {
    experience: normalizeCvEntries(Array.isArray(value.experience) ? value.experience : [], 'experience'),
    volunteering: normalizeCvEntries(Array.isArray(value.volunteering) ? value.volunteering : [], 'volunteering'),
    achievements: normalizeCvEntries(Array.isArray(value.achievements) ? value.achievements : [], 'achievement'),
  };
}

export async function parseManualCvBody(request) {
  const body = await parseJsonBody(request);
  return manualCvSchema.parse(body);
}

export async function loadManualCv(studentId, { prismaClient = prisma } = {}) {
  return mergeManualCv(await readScopedDocument(STUDENT_CV_SETTING_KEY, studentId, prismaClient));
}

export async function saveManualCv(studentId, sections, {
  prismaClient = prisma,
  actorUserId = null,
  requestId = null,
} = {}) {
  if (!studentId) {
    throw createIdentityError(
      403,
      'STUDENT_CONTEXT_REQUIRED',
      'Resume sections can only be saved on a student account.',
    );
  }

  return prismaClient.$transaction(async (tx) => {
    const before = mergeManualCv(await readScopedDocument(STUDENT_CV_SETTING_KEY, studentId, tx));
    const after = mergeManualCv({ ...before, ...sections });

    await writeScopedDocument(STUDENT_CV_SETTING_KEY, studentId, after, {
      client: tx,
      actorUserId,
      description: 'Student-authored CV sections (self-service).',
    });

    await createAuditEntry({
      tx,
      actorUserId,
      action: 'STUDENT_CV_SECTIONS_UPDATED',
      resourceType: 'Student',
      resourceId: studentId,
      before,
      after,
      requestId,
      metadata: { scope: 'self-service' },
    });

    return after;
  });
}

export function validateLogbookPayload(body) {
  try {
    return logbookBodySchema.parse(body);
  } catch (error) {
    if (error?.name === 'ZodError') {
      const firstIssue = error.issues?.[0];
      const fieldPath = firstIssue?.path?.join('.') ?? 'payload';
      const message = firstIssue?.message
        ? `${fieldPath}: ${firstIssue.message}`
        : 'Invalid logbook entry.';
      throw createIdentityError(400, 'INVALID_LOGBOOK_PAYLOAD', message);
    }

    throw error;
  }
}

export async function updateOwnProfile(userId, input, {
  prismaClient = prisma,
  requestId = null,
} = {}) {
  return prismaClient.$transaction(async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: userId },
      include: {
        roleAssignments: true,
        student: {
          include: {
            faculty: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            programme: {
              select: {
                id: true,
                name: true,
                level: true,
              },
            },
          },
        },
      },
    });

    if (!before) {
      throw createIdentityError(401, 'AUTHENTICATION_REQUIRED', 'The current session is no longer valid.');
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: input,
      include: {
        roleAssignments: true,
        student: {
          include: {
            faculty: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            programme: {
              select: {
                id: true,
                name: true,
                level: true,
              },
            },
          },
        },
      },
    });

    await createAuditEntry({
      tx,
      actorUserId: userId,
      action: 'IDENTITY_PROFILE_UPDATED',
      resourceType: 'User',
      resourceId: userId,
      before: {
        name: before.name,
        avatarUrl: before.avatarUrl ?? null,
      },
      after: {
        name: updated.name,
        avatarUrl: updated.avatarUrl ?? null,
      },
      requestId,
      metadata: {
        scope: 'self-service',
      },
    });

    return buildCanonicalIdentity(updated);
  });
}

export function toIdentityRouteError(error) {
  if (typeof error?.status === 'number') {
    return {
      status: error.status,
      code: error.code ?? 'IDENTITY_ERROR',
      message: error.message,
    };
  }

  return {
    status: 500,
    code: 'IDENTITY_ERROR',
    message: 'Identity services are unavailable right now.',
  };
}

export {
  createIdentityError,
  getRequestId,
};
