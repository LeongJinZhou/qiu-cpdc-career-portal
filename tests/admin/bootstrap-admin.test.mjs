import test from 'node:test';
import assert from 'node:assert/strict';

import { isDeliberatelyBlocked, normalizeBootstrapAdminInput, superAdminPatchFor } from '../../lib/admin/bootstrap.js';

const ACTIVE_OWNER = { role: 'SUPER_ADMIN', loginAllowed: true, accountStatus: 'ACTIVE', normalizedEmail: 'ai@qiu.edu.my' };

test('superAdminPatchFor leaves an active super admin untouched (no audit noise per deploy)', () => {
  assert.equal(superAdminPatchFor(ACTIVE_OWNER, 'ai@qiu.edu.my'), null);
});

test('superAdminPatchFor changes only what is missing', () => {
  assert.deepEqual(superAdminPatchFor({ ...ACTIVE_OWNER, role: 'STUDENT' }, 'ai@qiu.edu.my'), { role: 'SUPER_ADMIN' });
  assert.deepEqual(superAdminPatchFor({ ...ACTIVE_OWNER, loginAllowed: false }, 'ai@qiu.edu.my'), { loginAllowed: true });
  assert.deepEqual(superAdminPatchFor({ ...ACTIVE_OWNER, accountStatus: 'INVITED' }, 'ai@qiu.edu.my'), { accountStatus: 'ACTIVE' });
  // A row matched by email only gets its normalizedEmail filled in.
  assert.deepEqual(superAdminPatchFor({ ...ACTIVE_OWNER, normalizedEmail: null }, 'ai@qiu.edu.my'), { normalizedEmail: 'ai@qiu.edu.my' });
});

test('a suspended or disabled owner account is treated as deliberately blocked', () => {
  assert.equal(isDeliberatelyBlocked({ accountStatus: 'SUSPENDED' }), true);
  assert.equal(isDeliberatelyBlocked({ accountStatus: 'DISABLED' }), true);
  assert.equal(isDeliberatelyBlocked({ accountStatus: 'INVITED' }), false);
  assert.equal(isDeliberatelyBlocked(null), false);
});

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
