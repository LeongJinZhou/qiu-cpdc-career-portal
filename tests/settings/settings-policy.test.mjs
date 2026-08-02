import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_SETTINGS } from '../../lib/settings/shared.js';
import {
  getAdminSettings,
  updateAdminSettings,
} from '../../lib/settings/policy.js';
import {
  getIntegrationStatus,
  resolveStudentIdentity,
  syncCareerRecords,
} from '../../lib/integrations/acms-sis.js';

function createIdentity({
  userId = 'actor-1',
  role = 'SUPER_ADMIN',
  assignments = [{ role: 'SUPER_ADMIN', scopeType: 'GLOBAL', scopeValue: 'GLOBAL' }],
} = {}) {
  return {
    user: {
      id: userId,
      role,
      email: `${userId}@qiu.edu.my`,
      name: 'Actor User',
    },
    role,
    student: null,
    assignments,
  };
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function createPrismaStub({
  settings = [],
  auditsShouldFail = false,
} = {}) {
  const state = {
    settings: clone(settings),
    audits: [],
  };

  const operations = {
    auditCreates: 0,
  };

  function findSetting(where, source = state) {
    if (!where) return null;

    if (where.id) {
      return source.settings.find((setting) => setting.id === where.id) ?? null;
    }

    if (where.scopeKey) {
      const scopeKeyObj = where.scopeKey;
      const key = Array.isArray(scopeKeyObj) ? scopeKeyObj[0] : scopeKeyObj.key;
      const scopeType = Array.isArray(scopeKeyObj) ? scopeKeyObj[1] : scopeKeyObj.scopeType;
      const scopeValue = Array.isArray(scopeKeyObj) ? scopeKeyObj[2] : scopeKeyObj.scopeValue;
      return source.settings.find((setting) => (
        setting.key === key
        && setting.scopeType === scopeType
        && setting.scopeValue === scopeValue
      )) ?? null;
    }

    return null;
  }

  function createTxState() {
    return {
      settings: clone(state.settings),
      audits: clone(state.audits),
    };
  }

  function makeTx(txState) {
    return {
      platformSetting: {
        async findUnique({ where }) {
          return clone(findSetting(where, txState));
        },
        async findMany({ where }) {
          return clone(
            txState.settings.filter((setting) => setting.key === where.key),
          );
        },
        async create({ data }) {
          const created = {
            id: data.id ?? `setting-${txState.settings.length + 1}`,
            key: data.key,
            value: clone(data.value),
            description: data.description ?? null,
            updatedByUserId: data.updatedByUserId ?? null,
            scopeType: data.scopeType,
            scopeValue: data.scopeValue,
            version: data.version ?? 1,
            createdAt: data.createdAt ?? '2026-08-01T00:00:00.000Z',
            updatedAt: data.updatedAt ?? '2026-08-01T00:00:00.000Z',
          };
          txState.settings.push(created);
          return clone(created);
        },
        async update({ where, data }) {
          const existing = findSetting(where, txState);
          if (!existing) {
            throw new Error('Setting not found');
          }

          Object.assign(existing, {
            ...data,
            updatedAt: data.updatedAt ?? '2026-08-01T00:05:00.000Z',
          });
          return clone(existing);
        },
      },
      auditLog: {
        async create({ data }) {
          if (auditsShouldFail) {
            throw new Error('Audit create failed');
          }

          operations.auditCreates += 1;
          const created = {
            id: `audit-${txState.audits.length + 1}`,
            ...clone(data),
          };
          txState.audits.push(created);
          return clone(created);
        },
      },
    };
  }

  return {
    operations,
    state,
    platformSetting: {
      async findUnique({ where }) {
        return clone(findSetting(where, state));
      },
      async findMany({ where }) {
        return clone(
          state.settings.filter((setting) => setting.key === where.key),
        );
      },
    },
    auditLog: {
      async findMany() {
        return clone(state.audits);
      },
    },
    async $transaction(work) {
      const txState = createTxState();
      const tx = makeTx(txState);
      const result = await work(tx);
      state.settings = txState.settings;
      state.audits = txState.audits;
      return result;
    },
  };
}

test('SUPER_ADMIN can update platform settings and creates an audit record', async () => {
  const prisma = createPrismaStub();

  const result = await updateAdminSettings({
    identity: createIdentity(),
    scope: { type: 'PLATFORM', value: 'GLOBAL' },
    input: {
      expectedVersion: 0,
      settings: {
        ...DEFAULT_SETTINGS,
        approvals: {
          ...DEFAULT_SETTINGS.approvals,
          fyp: 'auto',
        },
      },
    },
    prismaClient: prisma,
    requestId: 'req-1',
  });

  assert.equal(result.version, 1);
  assert.equal(result.settings.approvals.fyp, 'auto');
  assert.equal(prisma.operations.auditCreates, 1);
  assert.equal(prisma.state.settings.length, 1);
  assert.equal(prisma.state.audits.length, 1);
});

test('non-super-admin roles cannot update PLATFORM/GLOBAL settings even with a GLOBAL assignment', async () => {
  const prisma = createPrismaStub();

  await assert.rejects(
    () => updateAdminSettings({
      identity: createIdentity({
        role: 'CPDC_ADMIN',
        assignments: [{ role: 'CPDC_ADMIN', scopeType: 'GLOBAL', scopeValue: 'GLOBAL' }],
      }),
      scope: { type: 'PLATFORM', value: 'GLOBAL' },
      input: {
        expectedVersion: 0,
        settings: DEFAULT_SETTINGS,
      },
      prismaClient: prisma,
    }),
    (error) => error.status === 403 && /allowed|manage settings/i.test(error.message),
  );
});

test('scoped faculty admin can update only their own faculty scope', async () => {
  const prisma = createPrismaStub();
  const identity = createIdentity({
    role: 'FACULTY_COORDINATOR',
    assignments: [{ role: 'FACULTY_COORDINATOR', scopeType: 'FACULTY', scopeValue: 'computing_engineering' }],
  });

  const allowed = await updateAdminSettings({
    identity,
    scope: { type: 'FACULTY', value: 'computing_engineering' },
    input: {
      expectedVersion: 0,
      settings: {
        ...DEFAULT_SETTINGS,
        featureToggles: {
          ...DEFAULT_SETTINGS.featureToggles,
          workshops: false,
        },
      },
    },
    prismaClient: prisma,
  });

  assert.equal(allowed.settings.featureToggles.workshops, false);

  await assert.rejects(
    () => updateAdminSettings({
      identity,
      scope: { type: 'FACULTY', value: 'business' },
      input: {
        expectedVersion: 0,
        settings: DEFAULT_SETTINGS,
      },
      prismaClient: prisma,
    }),
    (error) => error.status === 403 && /scope|allowed/i.test(error.message),
  );
});

test('student or arbitrary scoped assignment cannot update settings without an allowed admin role', async () => {
  const prisma = createPrismaStub();

  await assert.rejects(
    () => updateAdminSettings({
      identity: createIdentity({
        role: 'STUDENT',
        assignments: [{ role: 'STUDENT', scopeType: 'FACULTY', scopeValue: 'computing_engineering' }],
      }),
      scope: { type: 'FACULTY', value: 'computing_engineering' },
      input: {
        expectedVersion: 0,
        settings: DEFAULT_SETTINGS,
      },
      prismaClient: prisma,
    }),
    (error) => error.status === 403 && /allowed|manage settings/i.test(error.message),
  );

  await assert.rejects(
    () => updateAdminSettings({
      identity: createIdentity({
        role: 'EMPLOYER',
        assignments: [{ role: 'CPDC_ADMIN', scopeType: 'FACULTY', scopeValue: 'computing_engineering' }],
      }),
      scope: { type: 'FACULTY', value: 'computing_engineering' },
      input: {
        expectedVersion: 0,
        settings: DEFAULT_SETTINGS,
      },
      prismaClient: prisma,
    }),
    (error) => error.status === 403 && /allowed|manage settings/i.test(error.message),
  );
});

test('programme-scoped admin can read effective settings for their programme only', async () => {
  const prisma = createPrismaStub({
    settings: [
      {
        id: 'platform-1',
        key: 'platform.settings',
        scopeType: 'PLATFORM',
        scopeValue: 'GLOBAL',
        value: {
          ...DEFAULT_SETTINGS,
          approvals: {
            ...DEFAULT_SETTINGS.approvals,
            course: 'manual',
          },
        },
        version: 2,
        updatedAt: '2026-08-01T01:00:00.000Z',
      },
      {
        id: 'programme-1',
        key: 'platform.settings',
        scopeType: 'PROGRAMME',
        scopeValue: 'programme-1',
        value: {
          ...DEFAULT_SETTINGS,
          approvals: {
            ...DEFAULT_SETTINGS.approvals,
            course: 'auto',
          },
        },
        version: 1,
        updatedAt: '2026-08-01T02:00:00.000Z',
      },
    ],
  });

  const identity = createIdentity({
    role: 'HEAD_OF_PROGRAMME',
    assignments: [{ role: 'HEAD_OF_PROGRAMME', scopeType: 'PROGRAMME', scopeValue: 'programme-1' }],
  });

  const allowed = await getAdminSettings({
    identity,
    scope: { type: 'PROGRAMME', value: 'programme-1' },
    prismaClient: prisma,
  });

  assert.equal(allowed.scope.type, 'PROGRAMME');
  assert.equal(allowed.version, 1);
  assert.equal(allowed.settings.approvals.course, 'auto');

  await assert.rejects(
    () => getAdminSettings({
      identity,
      scope: { type: 'PROGRAMME', value: 'programme-2' },
      prismaClient: prisma,
    }),
    (error) => error.status === 403 && /scope|allowed/i.test(error.message),
  );
});

test('settings updates reject stale expectedVersion conflicts with 409', async () => {
  const prisma = createPrismaStub({
    settings: [
      {
        id: 'platform-1',
        key: 'platform.settings',
        scopeType: 'PLATFORM',
        scopeValue: 'GLOBAL',
        value: DEFAULT_SETTINGS,
        version: 3,
        updatedAt: '2026-08-01T02:00:00.000Z',
      },
    ],
  });

  await assert.rejects(
    () => updateAdminSettings({
      identity: createIdentity(),
      scope: { type: 'PLATFORM', value: 'GLOBAL' },
      input: {
        expectedVersion: 2,
        settings: {
          ...DEFAULT_SETTINGS,
          visibility: {
            ...DEFAULT_SETTINGS.visibility,
            resume: 'optin',
          },
        },
      },
      prismaClient: prisma,
    }),
    (error) => error.status === 409 && /conflict|version/i.test(error.message),
  );
});

test('settings updates validate shape and reject invalid values', async () => {
  const prisma = createPrismaStub();

  await assert.rejects(
    () => updateAdminSettings({
      identity: createIdentity(),
      scope: { type: 'PLATFORM', value: 'GLOBAL' },
      input: {
        expectedVersion: 0,
        settings: {
          ...DEFAULT_SETTINGS,
          approvals: {
            ...DEFAULT_SETTINGS.approvals,
            fyp: 'sometimes',
          },
        },
      },
      prismaClient: prisma,
    }),
    (error) => error.status === 400 && /approvals\.fyp/i.test(error.message),
  );
});

test('settings write rolls back if the audit append fails', async () => {
  const prisma = createPrismaStub({ auditsShouldFail: true });

  await assert.rejects(
    () => updateAdminSettings({
      identity: createIdentity(),
      scope: { type: 'PLATFORM', value: 'GLOBAL' },
      input: {
        expectedVersion: 0,
        settings: {
          ...DEFAULT_SETTINGS,
          matchWeights: {
            ...DEFAULT_SETTINGS.matchWeights,
            faculty: 35,
          },
        },
      },
      prismaClient: prisma,
    }),
    /Audit create failed/,
  );

  assert.equal(prisma.state.settings.length, 0);
  assert.equal(prisma.state.audits.length, 0);
});

test('ACMS/SIS adapter reports NotConfigured and makes no network calls until explicitly enabled', async () => {
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return { ok: true };
  };

  const status = getIntegrationStatus({
    env: {
      ACMS_SIS_ENABLED: 'false',
    },
  });

  assert.equal(status.configured, false);
  assert.equal(status.code, 'NOT_CONFIGURED');

  const identityResult = await resolveStudentIdentity(
    { studentId: 'QIU-202404-007157' },
    {
      env: { ACMS_SIS_ENABLED: 'false' },
      fetchImpl,
    },
  );

  const syncResult = await syncCareerRecords(
    { studentId: 'QIU-202404-007157', records: [] },
    {
      env: { ACMS_SIS_ENABLED: 'false' },
      fetchImpl,
    },
  );

  assert.equal(identityResult.ok, false);
  assert.equal(identityResult.error.code, 'NOT_CONFIGURED');
  assert.equal(syncResult.ok, false);
  assert.equal(syncResult.error.code, 'NOT_CONFIGURED');
  assert.equal(fetchCalls, 0);
});
