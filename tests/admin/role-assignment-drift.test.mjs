import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MANAGEABLE_BASE_ROLES,
  PRIVILEGED_ROLES,
  SUPPORTED_ROLES,
  parseCreateAdminUserInput,
} from '../../lib/admin/identity-policy.js';
import { ROLES } from '../../lib/modules.js';

/**
 * Regression cover for two defects found in the role audit.
 *
 * 1. `roleAssignmentSchema` carried an inline role enum that was never updated
 *    when four roles were added. Those roles could be set on the User row but
 *    their RoleAssignment was rejected at validation — so they held no scope,
 *    every `student.read` check failed, and the roles shipped non-functional.
 *
 * 2. `PRIVILEGED_ROLES` was a hand-written set of four staff roles. The four
 *    newer roles were therefore *not* privileged, letting a faculty-scoped
 *    CPDC_ADMIN promote someone to a globally-scoped role — an escalation out
 *    of their own faculty.
 *
 * Both are now derived from one list, so the assertions below are really
 * checking that the derivation still holds for every role in the registry.
 */

const STAFF_ROLES = ROLES.map((role) => role.id).filter(
  (id) => !['STUDENT', 'EMPLOYER', 'ALUMNI'].includes(id),
);

const superAdmin = { user: { id: 'u-super', role: 'SUPER_ADMIN' }, assignments: [] };
const facultyOfficer = {
  user: { id: 'u-officer', role: 'CPDC_ADMIN' },
  assignments: [{ role: 'CPDC_ADMIN', scopeType: 'FACULTY', scopeValue: 'computing_engineering' }],
};

test('every role in the registry is accepted as a RoleAssignment role', () => {
  for (const role of ROLES.map((r) => r.id)) {
    const scope =
      role === 'STUDENT'
        ? { scopeType: 'SELF', scopeValue: 'SELF' }
        : { scopeType: 'FACULTY', scopeValue: 'computing_engineering' };

    const parsed = parseCreateAdminUserInput(
      {
        email: 'someone@qiu.edu.my',
        name: 'Someone',
        primaryRole: role,
        roleAssignments: [{ role, ...scope }],
      },
      superAdmin,
    );

    assert.equal(
      parsed.roleAssignments[0].role,
      role,
      `${role} must be assignable — an enum that drifts from the registry ships a dead role`,
    );
  }
});

test('every staff role is privileged, so only a Super Admin may grant it', () => {
  // `ensureManageableRole` (used by createAdminUser/updateAdminUser) throws 403
  // for anything in PRIVILEGED_ROLES unless the caller is a Super Admin. The
  // escalation bug was a role missing from that set, so the invariant to hold
  // is "privileged == not a base role", checked against the live registry.
  for (const role of STAFF_ROLES) {
    assert.ok(
      PRIVILEGED_ROLES.has(role),
      `${role} must be privileged — otherwise a faculty-scoped officer can grant it`,
    );
  }
});

test('the four roles that caused the escalation are covered', () => {
  for (const role of ['ACADEMIC_SUPERVISOR', 'PLACEMENT_OFFICER', 'CAREER_COUNSELOR', 'UNIVERSITY_REGISTRAR']) {
    assert.ok(PRIVILEGED_ROLES.has(role), `${role} was the regression — it must stay privileged`);
  }
});

test('only the three base roles are delegable to a non-super-admin', () => {
  assert.deepEqual([...MANAGEABLE_BASE_ROLES].sort(), ['ALUMNI', 'EMPLOYER', 'STUDENT']);
  for (const role of MANAGEABLE_BASE_ROLES) {
    assert.equal(PRIVILEGED_ROLES.has(role), false, `${role} should stay delegable`);
  }
});

test('the policy role list has not drifted from the module registry', () => {
  assert.deepEqual(
    [...SUPPORTED_ROLES].sort(),
    ROLES.map((role) => role.id).sort(),
    'lib/admin/identity-policy.js and lib/modules.js must declare the same roles',
  );
});
