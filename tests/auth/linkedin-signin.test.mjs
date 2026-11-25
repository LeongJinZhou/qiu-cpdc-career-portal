import test from 'node:test';
import assert from 'node:assert/strict';

import { authorizeAlumniLinkedIn } from '../../lib/auth/linkedin-signin.js';

// Alumni sign in with LinkedIn after their QIU Google account closes. The only
// way in is a LinkedIn account that was linked by signing in to LinkedIn while
// signed in with QIU Google (method OAUTH). LinkedIn never creates accounts.

const NOW = new Date('2026-11-25T10:00:00Z');

function alumnusUser(overrides = {}) {
  return {
    id: 'u1',
    email: 'aina@qiu.edu.my',
    normalizedEmail: 'aina@qiu.edu.my',
    name: 'Aina Rahman',
    role: 'ALUMNI',
    loginAllowed: true,
    accountStatus: 'ACTIVE',
    avatarSource: 'GOOGLE',
    avatarUrl: null,
    googleAvatarUrl: null,
    student: { id: 's1', facultyId: 'f', programmeId: 'p', matricNo: 'QIU-202001-000001' },
    ...overrides,
  };
}

function fakePrisma({ account = null, accounts = account ? [account] : [] } = {}) {
  const calls = { updates: [], audits: [], findWhere: null };
  const tx = {
    connectedAccount: {
      findMany: async ({ where }) => {
        calls.findWhere = where;
        return accounts;
      },
    },
    user: {
      update: async ({ where, data }) => {
        calls.updates.push({ where, data });
        return { ...accounts[0].student.user, ...data };
      },
    },
    auditLog: { create: async ({ data }) => { calls.audits.push(data); return data; } },
  };
  return { prisma: { $transaction: async (fn) => fn(tx) }, calls };
}

const linkedAccount = (user) => ({ id: 'ca1', method: 'OAUTH', student: { user } });

test('an alumnus whose LinkedIn was linked signs in, and contact details are refreshed', async () => {
  const { prisma, calls } = fakePrisma({ account: linkedAccount(alumnusUser()) });
  const user = await authorizeAlumniLinkedIn({
    prisma, linkedinId: 'li-sub-1', verifiedEmail: 'aina.personal@gmail.com', now: NOW,
  });

  assert.equal(user.id, 'u1');
  assert.equal(user.role, 'ALUMNI');
  assert.deepEqual(calls.findWhere, { provider: 'LINKEDIN', providerUserId: 'li-sub-1', method: 'OAUTH' });
  assert.equal(calls.updates[0].data.personalEmail, 'aina.personal@gmail.com');
  assert.equal(calls.updates[0].data.linkedinLastSeenAt, NOW);
  assert.equal(calls.updates[0].data.lastSignInAt, NOW);
  assert.equal(calls.audits[0].action, 'LOGIN_SUCCESS');
  assert.equal(calls.audits[0].metadata.source, 'LINKEDIN');
});

test('an unverified LinkedIn email does not replace the stored personal email', async () => {
  const { prisma, calls } = fakePrisma({ account: linkedAccount(alumnusUser()) });
  await authorizeAlumniLinkedIn({ prisma, linkedinId: 'li-sub-1', verifiedEmail: null, now: NOW });
  assert.equal('personalEmail' in calls.updates[0].data, false);
});

test('a LinkedIn account that was never linked is refused: LinkedIn never creates accounts', async () => {
  const { prisma, calls } = fakePrisma({ account: null });
  await assert.rejects(
    authorizeAlumniLinkedIn({ prisma, linkedinId: 'unknown', verifiedEmail: 'x@y.com', now: NOW }),
    (error) => error.code === 'LINKEDIN_NOT_LINKED' && error.status === 403,
  );
  assert.equal(calls.updates.length, 0);
});

test('current students and staff must use QIU Google, not LinkedIn', async () => {
  for (const role of ['STUDENT', 'CPDC_ADMIN', 'SUPER_ADMIN']) {
    const { prisma, calls } = fakePrisma({ account: linkedAccount(alumnusUser({ role })) });
    await assert.rejects(
      authorizeAlumniLinkedIn({ prisma, linkedinId: 'li-sub-1', verifiedEmail: null, now: NOW }),
      (error) => error.code === 'LINKEDIN_NOT_ALUMNI',
      role,
    );
    assert.equal(calls.updates.length, 0);
  }
});

test('a suspended or blocked alumnus is refused', async () => {
  for (const overrides of [{ accountStatus: 'SUSPENDED' }, { loginAllowed: false }, { accountStatus: 'DISABLED' }]) {
    const { prisma } = fakePrisma({ account: linkedAccount(alumnusUser(overrides)) });
    await assert.rejects(
      authorizeAlumniLinkedIn({ prisma, linkedinId: 'li-sub-1', verifiedEmail: null, now: NOW }),
      (error) => error.status === 403,
    );
  }
});

test('a LinkedIn id linked to two records is refused, never guessed between', async () => {
  const { prisma, calls } = fakePrisma({
    accounts: [linkedAccount(alumnusUser()), linkedAccount(alumnusUser({ id: 'u2' }))],
  });
  await assert.rejects(
    authorizeAlumniLinkedIn({ prisma, linkedinId: 'li-sub-1', now: NOW }),
    (error) => error.code === 'LINKEDIN_AMBIGUOUS',
  );
  assert.equal(calls.updates.length, 0);
});

test('a missing LinkedIn id is refused before any lookup', async () => {
  const { prisma, calls } = fakePrisma({ account: linkedAccount(alumnusUser()) });
  await assert.rejects(authorizeAlumniLinkedIn({ prisma, linkedinId: '', now: NOW }), (error) => error.status === 401);
  assert.equal(calls.findWhere, null);
});
