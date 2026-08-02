import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeBootstrapAdminInput } from '../../lib/admin/bootstrap.js';

test('normalizeBootstrapAdminInput canonicalizes the bootstrap email and supplies a safe name', () => {
  assert.deepEqual(
    normalizeBootstrapAdminInput({ email: '  Admin@QIU.EDU.MY  ' }),
    {
      email: 'Admin@QIU.EDU.MY',
      normalizedEmail: 'admin@qiu.edu.my',
      name: 'QIU CPDC Super Admin',
    },
  );
});

test('normalizeBootstrapAdminInput preserves an explicit display name', () => {
  assert.deepEqual(
    normalizeBootstrapAdminInput({
      email: 'admin@qiu.edu.my',
      name: '  CPDC Operations  ',
    }),
    {
      email: 'admin@qiu.edu.my',
      normalizedEmail: 'admin@qiu.edu.my',
      name: 'CPDC Operations',
    },
  );
});

test('normalizeBootstrapAdminInput rejects missing or malformed email values', () => {
  assert.throws(
    () => normalizeBootstrapAdminInput({ email: '' }),
    /email/i,
  );
  assert.throws(
    () => normalizeBootstrapAdminInput({ email: 'not-an-email' }),
    /email/i,
  );
});
