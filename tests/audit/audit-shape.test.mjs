import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuditEntry, sanitizeAuditPayload } from '../../lib/audit/index.js';

test('sanitizeAuditPayload recursively redacts secrets from audit JSON', () => {
  const sanitized = sanitizeAuditPayload({
    password: 'plain-text',
    profile: {
      accessToken: 'abc123',
      nestedSecret: 'hidden',
      privateKey: 'pem',
      credential: 'signed',
      safe: 'keep-me',
    },
    sessions: [
      { refreshToken: 'refresh-me' },
      { metadata: { apiToken: 'api-me', label: 'student' } },
    ],
  });

  assert.deepEqual(sanitized, {
    password: '[REDACTED]',
    profile: {
      accessToken: '[REDACTED]',
      nestedSecret: '[REDACTED]',
      privateKey: '[REDACTED]',
      credential: '[REDACTED]',
      safe: 'keep-me',
    },
    sessions: [
      { refreshToken: '[REDACTED]' },
      { metadata: { apiToken: '[REDACTED]', label: 'student' } },
    ],
  });
});

test('createAuditEntry sanitizes payloads before writing through Prisma tx', async () => {
  let captured;

  const tx = {
    auditLog: {
      async create(payload) {
        captured = payload;
        return { id: 'audit-1', ...payload.data };
      },
    },
  };

  const result = await createAuditEntry({
    tx,
    actorUserId: 'user-1',
    action: 'identity.linked',
    resourceType: 'User',
    resourceId: 'user-1',
    before: {
      password: 'before-secret',
      nested: { accessToken: 'before-token', ok: true },
    },
    after: {
      credential: 'after-credential',
      profile: { privateKey: 'after-key', label: 'student' },
    },
    requestId: 'req-1',
    metadata: {
      apiToken: 'meta-token',
      scope: 'identity',
    },
  });

  assert.deepEqual(captured, {
    data: {
      actorUserId: 'user-1',
      action: 'identity.linked',
      resourceType: 'User',
      resourceId: 'user-1',
      before: {
        password: '[REDACTED]',
        nested: { accessToken: '[REDACTED]', ok: true },
      },
      after: {
        credential: '[REDACTED]',
        profile: { privateKey: '[REDACTED]', label: 'student' },
      },
      requestId: 'req-1',
      metadata: {
        apiToken: '[REDACTED]',
        scope: 'identity',
      },
    },
  });

  assert.equal(result.id, 'audit-1');
});
