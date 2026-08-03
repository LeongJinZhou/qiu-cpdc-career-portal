import { test } from 'node:test';
import assert from 'node:assert/strict';

import { programmeInitials, matchProgrammeByCourseCode } from '../lib/data/programme-codes.js';

// A slice of the real QIU programme list.
const PROGRAMMES = [
  { id: 'p_bcs', name: 'Bachelor of Computer Science (Honours)', facultyId: 'computing_engineering' },
  { id: 'p_bit', name: 'Bachelor of Information Technology (Honours)', facultyId: 'computing_engineering' },
  { id: 'p_bba', name: 'Bachelor of Business Administration (Honours)', facultyId: 'business' },
  { id: 'p_bcc', name: 'Bachelor of Corporate Communication (Honours)', facultyId: 'communication' },
  { id: 'p_mbbs', name: 'Bachelor of Medicine and Bachelor of Surgery (MBBS)', facultyId: 'medicine' },
];

test('derives initials, dropping stopwords and parentheticals', () => {
  assert.equal(programmeInitials('Bachelor of Computer Science (Honours)'), 'BCS');
  assert.equal(programmeInitials('Bachelor of Information Technology (Honours)'), 'BIT');
  assert.equal(programmeInitials('Bachelor of Business Administration (Honours)'), 'BBA');
});

test('resolves BCS to the Computer Science programme and its faculty', () => {
  const match = matchProgrammeByCourseCode('BCS', PROGRAMMES);
  assert.equal(match?.id, 'p_bcs');
  assert.equal(match?.facultyId, 'computing_engineering');
});

test('is case- and punctuation-insensitive', () => {
  assert.equal(matchProgrammeByCourseCode('bcs', PROGRAMMES)?.id, 'p_bcs');
  assert.equal(matchProgrammeByCourseCode(' B.C.S ', PROGRAMMES)?.id, 'p_bcs');
});

test('an explicit programme.code overrides the initials fallback', () => {
  const rows = [
    { id: 'p1', name: 'Bachelor of Computer Science (Honours)', code: 'CS101', facultyId: 'computing_engineering' },
    { id: 'p2', name: 'Business Computing Systems', facultyId: 'business' }, // initials "BCS"
  ];
  assert.equal(matchProgrammeByCourseCode('CS101', rows)?.id, 'p1');
});

test('an ambiguous code resolves to null rather than guessing', () => {
  const rows = [
    { id: 'p1', name: 'Bachelor of Computer Science (Honours)', facultyId: 'computing_engineering' }, // BCS
    { id: 'p2', name: 'Business Computing Systems', facultyId: 'business' }, // BCS
  ];
  assert.equal(matchProgrammeByCourseCode('BCS', rows), null);
});

test('an unknown code resolves to null', () => {
  assert.equal(matchProgrammeByCourseCode('ZZZ', PROGRAMMES), null);
  assert.equal(matchProgrammeByCourseCode('', PROGRAMMES), null);
});
