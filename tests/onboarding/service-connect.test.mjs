import test from 'node:test';
import assert from 'node:assert/strict';

import { connectAccountByOAuth, connectAccountByUrl } from '../../lib/onboarding/service.js';

// A fake Prisma client that records writes. `existing` is the student's current
// LinkedIn row; `otherOwner` is another student's OAUTH row for the same id.
function fakePrisma({ existing = null, otherOwner = null, upsertError = null } = {}) {
  const calls = { upserts: [], studentUpdates: [], audits: [] };
  const tx = {
    connectedAccount: {
      findFirst: async () => otherOwner,
      findUnique: async () => existing,
      upsert: async (args) => {
        if (upsertError) throw upsertError;
        calls.upserts.push(args);
        return { id: 'ca1', handle: args.update.handle ?? existing?.handle ?? null };
      },
    },
    student: { update: async (args) => { calls.studentUpdates.push(args); return {}; } },
    auditLog: { create: async ({ data }) => { calls.audits.push(data); return data; } },
  };
  return {
    prismaClient: {
      $transaction: async (fn, options) => {
        calls.transactionOptions = options;
        return fn(tx);
      },
    },
    calls,
  };
}

test('a LinkedIn sign-in keeps the profile link the student pasted earlier', async () => {
  const { prismaClient, calls } = fakePrisma({
    existing: { method: 'VERIFIED_URL', profileUrl: 'https://www.linkedin.com/in/aina' },
  });
  await connectAccountByOAuth('s1', 'LINKEDIN', { providerUserId: 'li-1', profileUrl: null, prismaClient });

  const { update } = calls.upserts[0];
  assert.equal('profileUrl' in update, false, 'profileUrl must not be overwritten');
  assert.equal(update.method, 'OAUTH');
  assert.equal(update.providerUserId, 'li-1');
});

test('a LinkedIn account already linked to another student is refused', async () => {
  const { prismaClient, calls } = fakePrisma({ otherOwner: { id: 'other' } });
  await assert.rejects(
    connectAccountByOAuth('s1', 'LINKEDIN', { providerUserId: 'li-1', prismaClient }),
    (error) => error.code === 'OAUTH_ACCOUNT_IN_USE',
  );
  assert.equal(calls.upserts.length, 0);
});

test('linking runs serializable, so two students linking at once cannot both win', async () => {
  const { prismaClient, calls } = fakePrisma();
  await connectAccountByOAuth('s1', 'LINKEDIN', { providerUserId: 'li-1', prismaClient });
  assert.deepEqual(calls.transactionOptions, { isolationLevel: 'Serializable' });

  // The loser of that race gets a clear "try again", not a crash.
  const conflict = Object.assign(new Error('Transaction failed due to a write conflict'), { code: 'P2034' });
  const { prismaClient: racing } = fakePrisma({ upsertError: conflict });
  await assert.rejects(
    connectAccountByOAuth('s1', 'LINKEDIN', { providerUserId: 'li-1', prismaClient: racing }),
    (error) => error.code === 'OAUTH_RETRY',
  );
});

test('pasting the public link after a LinkedIn sign-in keeps the link signed-in (OAUTH)', async () => {
  const { prismaClient, calls } = fakePrisma({ existing: { method: 'OAUTH', profileUrl: '' } });
  await connectAccountByUrl('s1', 'LINKEDIN', 'https://www.linkedin.com/in/aina-rahman', { probe: false, prismaClient });
  assert.equal(calls.upserts[0].update.method, 'OAUTH');
  assert.equal(calls.upserts[0].update.profileUrl, 'https://www.linkedin.com/in/aina-rahman');
});

test('a pasted link with no earlier sign-in stays a pasted link', async () => {
  const { prismaClient, calls } = fakePrisma({ existing: null });
  await connectAccountByUrl('s1', 'LINKEDIN', 'https://www.linkedin.com/in/aina-rahman', { probe: false, prismaClient });
  assert.equal(calls.upserts[0].update.method, 'VERIFIED_URL');
});
