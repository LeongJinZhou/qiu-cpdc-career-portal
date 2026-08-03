import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mapPeopleProfile } from '../lib/integrations/google-directory.js';

// A People API `person` resource shaped like the QIU directory card for
// "Yau Ming Soo" (QIU Student • BCS, Employee ID QIU-202310-006958).
const YAU = {
  names: [{ displayName: 'Yau Ming Soo', metadata: { primary: true } }],
  emailAddresses: [
    { value: 'yauming.soo@qiu.edu.my', metadata: { primary: true } },
  ],
  organizations: [
    { name: 'QIU Student', title: 'QIU Student', department: 'BCS', metadata: { primary: true } },
  ],
  externalIds: [
    { value: 'QIU-202310-006958', type: 'organization', formattedType: 'Employee ID' },
  ],
};

test('maps QIU directory profile to employee id, course and email', () => {
  const mapped = mapPeopleProfile(YAU);
  assert.equal(mapped.email, 'yauming.soo@qiu.edu.my');
  assert.equal(mapped.employeeId, 'QIU-202310-006958');
  assert.equal(mapped.courseCode, 'BCS');
  assert.equal(mapped.employeeType, 'Student');
  assert.equal(mapped.displayName, 'Yau Ming Soo');
});

test('finds the QIU employee id even when the type is unlabelled', () => {
  const mapped = mapPeopleProfile({
    externalIds: [{ value: 'QIU-202404-007157' }],
    emailAddresses: [{ value: 'a@qiu.edu.my' }],
  });
  assert.equal(mapped.employeeId, 'QIU-202404-007157');
});

test('prefers the @qiu.edu.my address when no primary is flagged', () => {
  const mapped = mapPeopleProfile({
    emailAddresses: [
      { value: 'personal@gmail.com' },
      { value: 'ming.soo@qiu.edu.my' },
    ],
  });
  assert.equal(mapped.email, 'ming.soo@qiu.edu.my');
});

test('returns nulls, not throws, for an empty or malformed profile', () => {
  assert.deepEqual(mapPeopleProfile(), { email: null, employeeId: null, courseCode: null, employeeType: null, displayName: null });
  assert.deepEqual(mapPeopleProfile(null), { email: null, employeeId: null, courseCode: null, employeeType: null, displayName: null });
});

test('reads course code from cost centre when department is absent', () => {
  const mapped = mapPeopleProfile({
    organizations: [{ title: 'QIU Student', costCenter: 'BCS', metadata: { primary: true } }],
  });
  assert.equal(mapped.courseCode, 'BCS');
});
