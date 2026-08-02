import test from 'node:test';
import assert from 'node:assert/strict';

import { requireStudentActor } from '../../lib/auth/actor.js';

test('student self-service guard accepts only the student role with a student row', () => {
  const actor = { role: 'STUDENT', student: { id: 'student-1' } };
  assert.equal(requireStudentActor(actor), actor);
});

test('student self-service guard rejects staff accounts even when they have a linked student row', () => {
  assert.throws(
    () => requireStudentActor({ role: 'CPDC_ADMIN', student: { id: 'student-1' } }),
    (error) => error.status === 403 && error.code === 'STUDENT_ROLE_REQUIRED',
  );
});
