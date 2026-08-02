import test from 'node:test';
import assert from 'node:assert/strict';

import { getAuthMode, getSessionSecret } from '../../lib/auth/config.js';
import { assertGoogleSignInProvider } from '../../lib/auth/firebase-admin.js';
import {
  authorizeSessionUser,
  createSessionCookie,
  readSessionCookie,
} from '../../lib/auth/session.js';

function createPrismaStub(user, { auditShouldFail = false } = {}) {
  const state = {
    user: user ? structuredClone(user) : null,
  };

  const operations = {
    updates: [],
    audits: [],
  };

  function cloneCurrentUser() {
    return state.user ? structuredClone(state.user) : null;
  }

  function matchesUser(candidate, where) {
    if (!candidate || !where) {
      return false;
    }

    if (where.id) {
      return candidate.id === where.id;
    }

    if (where.firebaseUid) {
      return candidate.firebaseUid === where.firebaseUid;
    }

    if (where.normalizedEmail) {
      return candidate.normalizedEmail === where.normalizedEmail;
    }

    const normalizedEmail = where?.OR?.find((entry) => entry.normalizedEmail)?.normalizedEmail;
    const firebaseUid = where?.OR?.find((entry) => entry.firebaseUid)?.firebaseUid;

    return Boolean(
      (firebaseUid && candidate.firebaseUid === firebaseUid)
      || (normalizedEmail && candidate.normalizedEmail === normalizedEmail),
    );
  }

  async function findFirst({ where }) {
    const candidate = cloneCurrentUser();
    return matchesUser(candidate, where) ? candidate : null;
  }

  async function findUnique({ where }) {
    const candidate = cloneCurrentUser();
    return matchesUser(candidate, where) ? candidate : null;
  }

  const prisma = {
    user: {
      findUnique,
    },
    async $transaction(callback) {
      const txState = {
        user: cloneCurrentUser(),
      };
      const pending = {
        updates: [],
        audits: [],
      };

      const tx = {
        user: {
          async findUnique({ where }) {
            const candidate = txState.user ? structuredClone(txState.user) : null;
            return matchesUser(candidate, where) ? candidate : null;
          },
          async findFirst({ where }) {
            const candidate = txState.user ? structuredClone(txState.user) : null;
            return matchesUser(candidate, where) ? candidate : null;
          },
          async update({ where, data }) {
            if (!txState.user || !matchesUser(txState.user, where)) {
              throw new Error('User not found for update.');
            }

            txState.user = {
              ...txState.user,
              ...data,
            };

            pending.updates.push({ where, data });
            return structuredClone(txState.user);
          },
        },
        auditLog: {
          async create({ data }) {
            if (auditShouldFail) {
              throw new Error('Audit write failed.');
            }

            pending.audits.push(data);
            return { id: 'audit-1', ...data };
          },
        },
      };

      const result = await callback(tx);
      state.user = txState.user ? structuredClone(txState.user) : null;
      operations.updates.push(...pending.updates);
      operations.audits.push(...pending.audits);
      return result;
    },
  };

  return { prisma, operations, state };
}

test('getAuthMode rejects demo mode in production', () => {
  assert.throws(
    () => getAuthMode({ env: { NODE_ENV: 'production', AUTH_MODE: 'demo' } }),
    /AUTH_MODE=demo is allowed only for local development/,
  );
});

test('getAuthMode rejects demo mode in preview-like deployments', () => {
  assert.throws(
    () => getAuthMode({ env: { NODE_ENV: 'preview', AUTH_MODE: 'demo' } }),
    /AUTH_MODE=demo is allowed only for local development/,
  );
});

test('getSessionSecret exposes a service-unavailable configuration error when unset', () => {
  assert.throws(
    () => getSessionSecret({ env: {} }),
    (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.code, 'AUTH_CONFIGURATION_REQUIRED');
      assert.match(error.message, /SESSION_SECRET is required/i);
      return true;
    },
  );
});

test('assertGoogleSignInProvider rejects non-Google Firebase providers', () => {
  assert.throws(
    () => assertGoogleSignInProvider({
      firebase: { sign_in_provider: 'password' },
    }),
    /google/i,
  );
});

test('authorizeSessionUser matches by normalized email and commits update plus audit in one transaction', async () => {
  const { prisma, operations, state } = createPrismaStub({
    id: 'user-1',
    email: 'Student@QIU.EDU.MY',
    normalizedEmail: 'student@qiu.edu.my',
    name: 'Student User',
    role: 'STUDENT',
    avatarUrl: 'https://example.com/avatar.png',
    firebaseUid: null,
    loginAllowed: true,
    accountStatus: 'ACTIVE',
    identitySource: 'MANUAL',
    student: {
      id: 'student-1',
      facultyId: 'computing_engineering',
      programmeId: 'programme-1',
      matricNo: 'QIU-202404-007157',
    },
  });

  const sessionUser = await authorizeSessionUser({
    prisma,
    verifiedIdentity: {
      firebaseUid: 'firebase-123',
      email: '  Student@QIU.EDU.MY ',
      name: 'Student User',
      avatarUrl: 'https://example.com/avatar.png',
    },
    now: new Date('2026-08-01T10:00:00.000Z'),
    requestId: 'req-1',
  });

  assert.deepEqual(sessionUser, {
    id: 'user-1',
    email: 'Student@QIU.EDU.MY',
    normalizedEmail: 'student@qiu.edu.my',
    name: 'Student User',
    role: 'STUDENT',
    avatarUrl: 'https://example.com/avatar.png',
    customAvatarUrl: null,
    googleAvatarUrl: 'https://example.com/avatar.png',
    student: {
      id: 'student-1',
      facultyId: 'computing_engineering',
      programmeId: 'programme-1',
      matricNo: 'QIU-202404-007157',
    },
  });

  assert.equal(operations.updates.length, 1);
  assert.equal(operations.audits.length, 1);
  assert.equal(state.user.firebaseUid, 'firebase-123');
  assert.equal(state.user.identitySource, 'FIREBASE');
  assert.equal('loginAllowed' in sessionUser, false);
  assert.equal('accountStatus' in sessionUser, false);
  assert.equal('firebaseUid' in sessionUser, false);
});

test('authorizeSessionUser rolls back the identity update when the LOGIN_SUCCESS audit write fails', async () => {
  const { prisma, operations, state } = createPrismaStub({
    id: 'user-1',
    email: 'Student@QIU.EDU.MY',
    normalizedEmail: 'student@qiu.edu.my',
    name: 'Student User',
    role: 'STUDENT',
    avatarUrl: 'https://example.com/avatar.png',
    firebaseUid: null,
    loginAllowed: true,
    accountStatus: 'ACTIVE',
    identitySource: 'MANUAL',
    student: null,
  }, { auditShouldFail: true });

  await assert.rejects(
    authorizeSessionUser({
      prisma,
      verifiedIdentity: {
        firebaseUid: 'firebase-123',
        email: 'student@qiu.edu.my',
        name: 'Student User',
        avatarUrl: null,
      },
      now: new Date('2026-08-01T10:00:00.000Z'),
    }),
    /Audit write failed/,
  );

  assert.equal(operations.updates.length, 0);
  assert.equal(operations.audits.length, 0);
  assert.equal(state.user.firebaseUid, null);
  assert.equal(state.user.identitySource, 'MANUAL');
});

test('authorizeSessionUser denies unknown emails', async () => {
  const { prisma } = createPrismaStub(null);

  await assert.rejects(
    authorizeSessionUser({
      prisma,
      verifiedIdentity: {
        firebaseUid: 'firebase-404',
        email: 'unknown@qiu.edu.my',
        name: 'Unknown User',
        avatarUrl: null,
      },
    }),
    (error) => {
      assert.equal(error.status, 403);
      assert.match(error.message, /not authorized/i);
      return true;
    },
  );
});

test('authorizeSessionUser denies suspended accounts', async () => {
  const { prisma } = createPrismaStub({
    id: 'user-2',
    email: 'staff@qiu.edu.my',
    normalizedEmail: 'staff@qiu.edu.my',
    name: 'Suspended Staff',
    role: 'CPDC_ADMIN',
    avatarUrl: null,
    firebaseUid: 'firebase-222',
    loginAllowed: true,
    accountStatus: 'SUSPENDED',
    student: null,
  });

  await assert.rejects(
    authorizeSessionUser({
      prisma,
      verifiedIdentity: {
        firebaseUid: 'firebase-222',
        email: 'staff@qiu.edu.my',
        name: 'Suspended Staff',
        avatarUrl: null,
      },
    }),
    (error) => {
      assert.equal(error.status, 403);
      assert.match(error.message, /suspended/i);
      return true;
    },
  );
});

test('readSessionCookie revalidates against the current database user and refreshes safe role data', async () => {
  const cookie = await createSessionCookie('google-id-token', {
    secret: 'test-session-secret',
    verifyGoogleIdToken: async () => ({
      firebaseUid: 'firebase-123',
      email: 'student@qiu.edu.my',
      name: 'Student User',
      avatarUrl: 'https://example.com/avatar.png',
    }),
    authorizeSessionUser: async () => ({
      id: 'user-1',
      email: 'student@qiu.edu.my',
      normalizedEmail: 'student@qiu.edu.my',
      name: 'Student User',
      role: 'STUDENT',
      avatarUrl: 'https://example.com/avatar.png',
      student: {
        id: 'student-1',
        facultyId: 'computing_engineering',
        programmeId: 'programme-1',
        matricNo: 'QIU-202404-007157',
      },
    }),
    now: new Date('2026-08-01T10:00:00.000Z'),
  });

  const { prisma, state } = createPrismaStub({
    id: 'user-1',
    email: 'student@qiu.edu.my',
    normalizedEmail: 'student@qiu.edu.my',
    name: 'Student User',
    role: 'CPDC_ADMIN',
    avatarUrl: 'https://example.com/new-avatar.png',
    firebaseUid: 'firebase-123',
    loginAllowed: true,
    accountStatus: 'ACTIVE',
    student: {
      id: 'student-1',
      facultyId: 'business',
      programmeId: 'programme-2',
      matricNo: 'QIU-202404-007157',
    },
  });
  state.user.role = 'CPDC_ADMIN';

  const session = await readSessionCookie(cookie.value, {
    secret: 'test-session-secret',
    prisma,
  });

  assert.deepEqual(session.user, {
    id: 'user-1',
    email: 'student@qiu.edu.my',
    normalizedEmail: 'student@qiu.edu.my',
    name: 'Student User',
    role: 'CPDC_ADMIN',
    avatarUrl: 'https://example.com/new-avatar.png',
    customAvatarUrl: null,
    googleAvatarUrl: 'https://example.com/new-avatar.png',
    student: {
      id: 'student-1',
      facultyId: 'business',
      programmeId: 'programme-2',
      matricNo: 'QIU-202404-007157',
    },
  });
  assert.equal(session.user.loginAllowed, undefined);
  assert.equal(session.user.firebaseUid, undefined);
});

test('readSessionCookie denies a once-valid cookie when the current user is no longer allowed or active', async () => {
  const cookie = await createSessionCookie('google-id-token', {
    secret: 'test-session-secret',
    verifyGoogleIdToken: async () => ({
      firebaseUid: 'firebase-123',
      email: 'student@qiu.edu.my',
      name: 'Student User',
      avatarUrl: null,
    }),
    authorizeSessionUser: async () => ({
      id: 'user-1',
      email: 'student@qiu.edu.my',
      normalizedEmail: 'student@qiu.edu.my',
      name: 'Student User',
      role: 'STUDENT',
      avatarUrl: null,
      student: null,
    }),
    now: new Date('2026-08-01T10:00:00.000Z'),
  });

  const { prisma } = createPrismaStub({
    id: 'user-1',
    email: 'student@qiu.edu.my',
    normalizedEmail: 'student@qiu.edu.my',
    name: 'Student User',
    role: 'STUDENT',
    avatarUrl: null,
    firebaseUid: 'firebase-123',
    loginAllowed: false,
    accountStatus: 'DISABLED',
    student: null,
  });

  const session = await readSessionCookie(cookie.value, {
    secret: 'test-session-secret',
    prisma,
  });

  assert.equal(session, null);
});

test('createSessionCookie and readSessionCookie preserve the safe session payload only', async () => {
  const cookie = await createSessionCookie('google-id-token', {
    secret: 'test-session-secret',
    verifyGoogleIdToken: async () => ({
      firebaseUid: 'firebase-123',
      email: 'student@qiu.edu.my',
      name: 'Student User',
      avatarUrl: 'https://example.com/avatar.png',
    }),
    authorizeSessionUser: async () => ({
      id: 'user-1',
      email: 'student@qiu.edu.my',
      normalizedEmail: 'student@qiu.edu.my',
      name: 'Student User',
      role: 'STUDENT',
      avatarUrl: 'https://example.com/avatar.png',
      student: {
        id: 'student-1',
        facultyId: 'computing_engineering',
        programmeId: 'programme-1',
        matricNo: 'QIU-202404-007157',
      },
    }),
    now: new Date('2026-08-01T10:00:00.000Z'),
  });

  const session = await readSessionCookie(cookie.value, {
    secret: 'test-session-secret',
  });

  assert.deepEqual(session.user, {
    id: 'user-1',
    email: 'student@qiu.edu.my',
    normalizedEmail: 'student@qiu.edu.my',
    name: 'Student User',
    role: 'STUDENT',
    avatarUrl: 'https://example.com/avatar.png',
    student: {
      id: 'student-1',
      facultyId: 'computing_engineering',
      programmeId: 'programme-1',
      matricNo: 'QIU-202404-007157',
    },
  });
  assert.equal(session.user.firebaseUid, undefined);
  assert.equal(session.user.loginAllowed, undefined);
  assert.equal(cookie.options.httpOnly, true);
});
