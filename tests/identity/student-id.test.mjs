import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatStudentId,
  isStudentId,
  parseStudentId,
} from '../../lib/identity/student-id.js';

test('parseStudentId accepts the canonical QIU format', () => {
  assert.deepEqual(parseStudentId('QIU-202404-007157'), {
    intakeYearMonth: 202404,
    sequence: 7157,
  });
});

test('formatStudentId emits QIU-YYYYMM-NNNNNN', () => {
  assert.equal(
    formatStudentId({ intakeYearMonth: 202404, sequence: 7157 }),
    'QIU-202404-007157',
  );
});

test('isStudentId returns true only for canonical IDs', () => {
  assert.equal(isStudentId('QIU-202404-007157'), true);
  assert.equal(isStudentId('STU-2026-9812'), false);
});

test('parseStudentId rejects a four-digit suffix', () => {
  assert.throws(() => parseStudentId('QIU-202404-7157'), {
    name: 'StudentIdValidationError',
  });
});

test('parseStudentId rejects invalid intake months', () => {
  assert.throws(() => parseStudentId('QIU-202413-007157'), {
    name: 'StudentIdValidationError',
  });
});

test('parseStudentId rejects the wrong prefix', () => {
  assert.throws(() => parseStudentId('STU-202404-007157'), {
    name: 'StudentIdValidationError',
  });
});
