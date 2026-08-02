import { prisma } from '../prisma.js';
import { createAuditEntry } from '../audit/index.js';
import {
  DEFAULT_SETTINGS,
  PLATFORM_SETTINGS_KEY,
  validateSettings,
  withDefaults,
} from './shared.js';

function createSettingsError(status, code, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

const SCOPED_SETTINGS_ROLES = new Set([
  'CPDC_ADMIN',
  'FACULTY_COORDINATOR',
  'HEAD_OF_PROGRAMME',
]);

function normalizeScope(scope) {
  const type = String(scope?.type ?? 'PLATFORM').trim().toUpperCase();
  const value = String(
    scope?.value
      ?? (type === 'PLATFORM' ? 'GLOBAL' : ''),
  ).trim();

  if (!['PLATFORM', 'FACULTY', 'PROGRAMME'].includes(type)) {
    throw createSettingsError(400, 'INVALID_SETTINGS_SCOPE', `Unsupported settings scope "${type}".`);
  }

  if ((type === 'FACULTY' || type === 'PROGRAMME') && !value) {
    throw createSettingsError(400, 'INVALID_SETTINGS_SCOPE', `${type.toLowerCase()} scope requires a value.`);
  }

  return {
    type,
    value: type === 'PLATFORM' ? 'GLOBAL' : value,
  };
}

function identityHasScope(identity, scope) {
  const primaryRole = identity?.user?.role;

  if (primaryRole === 'SUPER_ADMIN') {
    return true;
  }

  const assignments = Array.isArray(identity?.assignments) ? identity.assignments : [];

  if (scope.type === 'PLATFORM') {
    return false;
  }

  if (!SCOPED_SETTINGS_ROLES.has(primaryRole)) {
    return false;
  }

  return assignments.some((assignment) => {
    if (
      !assignment?.role
      || !assignment?.scopeType
      || !assignment?.scopeValue
      || !SCOPED_SETTINGS_ROLES.has(assignment.role)
      || assignment.role !== primaryRole
    ) {
      return false;
    }

    if (scope.type === 'FACULTY') {
      return (
        assignment.scopeType === 'FACULTY'
        && assignment.scopeValue === scope.value
        && (assignment.role === 'CPDC_ADMIN' || assignment.role === 'FACULTY_COORDINATOR')
      );
    }

    return (
      assignment.scopeType === 'PROGRAMME'
      && assignment.scopeValue === scope.value
      && (assignment.role === 'CPDC_ADMIN' || assignment.role === 'HEAD_OF_PROGRAMME')
    );
  });
}

function requireSettingsScopeAccess(identity, scope) {
  if (!identity?.user?.id) {
    throw createSettingsError(401, 'AUTHENTICATION_REQUIRED', 'Sign in is required.');
  }

  if (!identityHasScope(identity, scope)) {
    throw createSettingsError(403, 'INSUFFICIENT_CAPABILITY', 'You are not allowed to manage settings for this scope.');
  }
}

function requireSettingsReadAccess(identity, scope) {
  if (!identity?.user?.id) {
    throw createSettingsError(401, 'AUTHENTICATION_REQUIRED', 'Sign in is required.');
  }

  if (scope.type === 'PLATFORM') {
    return;
  }

  requireSettingsScopeAccess(identity, scope);
}

function toRecordScope(scope) {
  return {
    key: PLATFORM_SETTINGS_KEY,
    scopeType: scope.type,
    scopeValue: scope.value,
  };
}

function recordWhere(scope) {
  const record = toRecordScope(scope);
  // Prisma expects the named compound unique as an object, not a positional
  // array — the array form throws at runtime, which previously made every
  // settings read/write fail and silently fall back to defaults (so admin
  // feature toggles never took effect: Module 15).
  return {
    scopeKey: {
      key: record.key,
      scopeType: record.scopeType,
      scopeValue: record.scopeValue,
    },
  };
}

function buildSettingsResponse(record, scope) {
  return {
    settings: withDefaults(record?.value ?? DEFAULT_SETTINGS),
    scope,
    version: record?.version ?? 0,
    updatedAt: record?.updatedAt ?? null,
  };
}

async function loadFallbackRecord(prismaClient, scope) {
  const exact = await prismaClient.platformSetting.findUnique({
    where: recordWhere(scope),
  });

  if (exact || scope.type === 'PLATFORM') {
    return exact;
  }

  return prismaClient.platformSetting.findUnique({
    where: recordWhere({ type: 'PLATFORM', value: 'GLOBAL' }),
  });
}

function parseMutationInput(input) {
  const expectedVersionRaw = input?.expectedVersion;
  const expectedVersion = typeof expectedVersionRaw === 'undefined'
    ? undefined
    : Number(expectedVersionRaw);

  if (typeof expectedVersion !== 'undefined' && (!Number.isInteger(expectedVersion) || expectedVersion < 0)) {
    throw createSettingsError(400, 'INVALID_SETTINGS_PAYLOAD', 'expectedVersion must be a non-negative integer.');
  }

  const expectedUpdatedAt = typeof input?.expectedUpdatedAt === 'undefined' || input.expectedUpdatedAt == null || input.expectedUpdatedAt === ''
    ? undefined
    : new Date(input.expectedUpdatedAt);

  if (expectedUpdatedAt && Number.isNaN(expectedUpdatedAt.getTime())) {
    throw createSettingsError(400, 'INVALID_SETTINGS_PAYLOAD', 'expectedUpdatedAt must be a valid ISO timestamp.');
  }

  if (typeof input?.settings === 'undefined') {
    throw createSettingsError(400, 'INVALID_SETTINGS_PAYLOAD', 'settings is required.');
  }

  return {
    expectedVersion,
    expectedUpdatedAt: expectedUpdatedAt ? expectedUpdatedAt.toISOString() : undefined,
    settings: validateSettings(input.settings),
  };
}

function assertOptimisticConcurrency(currentRecord, input) {
  const currentVersion = currentRecord?.version ?? 0;
  const currentUpdatedAt = currentRecord?.updatedAt ? new Date(currentRecord.updatedAt).toISOString() : null;

  if (typeof input.expectedVersion !== 'undefined' && input.expectedVersion !== currentVersion) {
    throw createSettingsError(409, 'SETTINGS_CONFLICT', 'Settings were updated elsewhere. Reload the latest server version before saving again.', {
      expectedVersion: input.expectedVersion,
      currentVersion,
    });
  }

  if (
    typeof input.expectedUpdatedAt !== 'undefined'
    && input.expectedUpdatedAt !== currentUpdatedAt
  ) {
    throw createSettingsError(409, 'SETTINGS_CONFLICT', 'Settings were updated elsewhere. Reload the latest server version before saving again.', {
      expectedUpdatedAt: input.expectedUpdatedAt,
      currentUpdatedAt,
    });
  }
}

export async function getAdminSettings({
  identity,
  scope,
  prismaClient = prisma,
}) {
  const normalizedScope = normalizeScope(scope);
  requireSettingsReadAccess(identity, normalizedScope);
  const record = await loadFallbackRecord(prismaClient, normalizedScope);
  return buildSettingsResponse(record, normalizedScope);
}

export async function updateAdminSettings({
  identity,
  scope,
  input,
  prismaClient = prisma,
  requestId = null,
}) {
  const normalizedScope = normalizeScope(scope);
  requireSettingsScopeAccess(identity, normalizedScope);
  const parsed = parseMutationInput(input);

  try {
    return await prismaClient.$transaction(async (tx) => {
      const currentRecord = await tx.platformSetting.findUnique({
        where: recordWhere(normalizedScope),
      });

      assertOptimisticConcurrency(currentRecord, parsed);

      const nextVersion = (currentRecord?.version ?? 0) + 1;
      const data = {
        key: PLATFORM_SETTINGS_KEY,
        value: parsed.settings,
        description: currentRecord?.description ?? 'Governed platform settings',
        updatedByUserId: identity.user.id,
        scopeType: normalizedScope.type,
        scopeValue: normalizedScope.value,
        version: nextVersion,
      };

      const updatedRecord = currentRecord
        ? await tx.platformSetting.update({
          where: recordWhere(normalizedScope),
          data,
        })
        : await tx.platformSetting.create({
          data,
        });

      const response = buildSettingsResponse(updatedRecord, normalizedScope);

      await createAuditEntry({
        tx,
        actorUserId: identity.user.id,
        action: 'ADMIN_SETTINGS_UPDATED',
        resourceType: 'PlatformSetting',
        resourceId: `${normalizedScope.type}:${normalizedScope.value}`,
        before: currentRecord ? buildSettingsResponse(currentRecord, normalizedScope) : null,
        after: response,
        requestId,
        metadata: {
          scope: normalizedScope,
          version: response.version,
        },
      });

      return response;
    });
  } catch (error) {
    if (error?.status === 409) {
      const currentRecord = await prismaClient.platformSetting.findUnique({
        where: recordWhere(normalizedScope),
      });
      error.current = buildSettingsResponse(currentRecord, normalizedScope);
    }

    throw error;
  }
}

export function parseSettingsScopeFromSearchParams(searchParams) {
  const scope = String(searchParams.get('scope') ?? 'platform').trim().toLowerCase();

  if (scope === 'platform') {
    return { type: 'PLATFORM', value: 'GLOBAL' };
  }

  if (scope === 'faculty') {
    return {
      type: 'FACULTY',
      value: String(searchParams.get('facultyId') ?? '').trim(),
    };
  }

  if (scope === 'programme') {
    return {
      type: 'PROGRAMME',
      value: String(searchParams.get('programmeId') ?? '').trim(),
    };
  }

  throw createSettingsError(400, 'INVALID_SETTINGS_SCOPE', `Unsupported settings scope "${scope}".`);
}

export function toSettingsRouteError(error) {
  if (typeof error?.status === 'number') {
    return {
      status: error.status,
      code: error.code ?? 'SETTINGS_ERROR',
      message: error.message,
      current: error.current ?? null,
    };
  }

  return {
    status: 500,
    code: 'SETTINGS_ERROR',
    message: 'Settings services are unavailable right now.',
    current: null,
  };
}
