import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyCanonicalLogbookFailure,
  createUnauthenticatedStudentProjection,
  normalizeCanonicalIdentity,
  mergeCanonicalStudentLogbookEntries,
  shouldRenderAuthenticatedPortalChrome,
} from '../../lib/api.js';

test('normalizeCanonicalIdentity consumes the canonical /api/identity/me payload as authority', () => {
  const identity = {
    user: {
      id: 'user-1',
      email: 'student@qiu.edu.my',
      name: 'Student User',
      role: 'STUDENT',
    },
    student: {
      id: 'student-db-1',
      matricNo: 'QIU-202404-007157',
      academicYear: 3,
      facultyId: 'computing_engineering',
      programmeId: 'programme-1',
    },
    faculty: {
      id: 'computing_engineering',
      name: 'Faculty of Computing and Engineering',
      code: 'FCE',
    },
    programme: {
      id: 'programme-1',
      name: 'Bachelor of Computer Science',
      level: 'Degree',
    },
    role: 'STUDENT',
    assignments: [
      {
        id: 'assignment-1',
        role: 'STUDENT',
        scopeType: 'SELF',
        scopeValue: 'student-db-1',
      },
    ],
    scopes: [
      {
        role: 'STUDENT',
        scopeType: 'SELF',
        studentId: 'student-db-1',
      },
    ],
    capabilities: ['identity.read.self', 'logbook.read', 'logbook.write', 'student.read'],
  };

  const demoStudent = {
    id: 'STU-2026-9812',
    facultyId: 'business',
    programme: 'Demo Programme',
    year: 1,
    logbookEntries: [{ id: 'fixture-log-1', title: 'Fixture entry' }],
    badges: [{ id: 'badge-1', title: 'Fixture badge' }],
  };

  const normalized = normalizeCanonicalIdentity({
    identity,
    fallbackStudent: demoStudent,
    demoRole: 'CPDC_ADMIN',
    authMode: 'firebase-google',
  });

  assert.equal(normalized.identity.user.id, 'user-1');
  assert.equal(normalized.currentRole, 'STUDENT');
  assert.equal(normalized.activeFaculty.id, 'computing_engineering');
  assert.equal(normalized.student.id, 'QIU-202404-007157');
  assert.equal(normalized.student.databaseId, 'student-db-1');
  assert.equal(normalized.student.matricNo, 'QIU-202404-007157');
  assert.equal(normalized.student.facultyId, 'computing_engineering');
  assert.equal(normalized.student.programmeId, 'programme-1');
  assert.equal(normalized.student.programme, 'Bachelor of Computer Science');
  assert.equal(normalized.student.year, 3);
  assert.deepEqual(normalized.identity.assignments, identity.assignments);
  assert.deepEqual(normalized.identity.scopes, identity.scopes);
  assert.deepEqual(normalized.identity.capabilities, identity.capabilities);
  assert.deepEqual(normalized.student.logbookEntries, []);
  assert.notDeepEqual(normalized.student.logbookEntries, demoStudent.logbookEntries);
});

test('normalizeCanonicalIdentity allows an explicit demo-only fallback when auth mode is demo', () => {
  const demoStudent = {
    id: 'STU-2026-9812',
    facultyId: 'business',
    programme: 'Demo Programme',
    year: 2,
    logbookEntries: [{ id: 'fixture-log-1', title: 'Fixture entry' }],
  };

  const normalized = normalizeCanonicalIdentity({
    identity: null,
    fallbackStudent: demoStudent,
    demoRole: 'EMPLOYER',
    authMode: 'demo',
  });

  assert.equal(normalized.identity, null);
  assert.equal(normalized.currentRole, 'EMPLOYER');
  assert.equal(normalized.student.id, 'STU-2026-9812');
  assert.deepEqual(normalized.student.logbookEntries, demoStudent.logbookEntries);
  assert.equal(normalized.demoMode, true);
});

test('normalizeCanonicalIdentity uses an empty unauthenticated projection outside demo mode', () => {
  const normalized = normalizeCanonicalIdentity({
    identity: null,
    fallbackStudent: {
      id: 'STU-2026-9812',
      facultyId: 'business',
      programme: 'Demo Programme',
      year: 2,
      badges: [{ id: 'badge-1', title: 'Fixture badge' }],
      logbookEntries: [{ id: 'fixture-log-1', title: 'Fixture entry' }],
      xp: 3450,
    },
    authMode: 'firebase-google',
  });

  assert.equal(normalized.identity, null);
  assert.equal(normalized.demoMode, false);
  assert.equal(normalized.student.id, null);
  assert.equal(normalized.student.databaseId, null);
  assert.equal(normalized.student.matricNo, null);
  assert.equal(normalized.student.name, '');
  assert.equal(normalized.student.programme, '');
  assert.equal(normalized.student.xp, 0);
  assert.deepEqual(normalized.student.badges, []);
  assert.deepEqual(normalized.student.logbookEntries, []);
});

test('mergeCanonicalStudentLogbookEntries replaces live student logbook entries without falling back to fixtures', () => {
  const canonicalStudent = {
    id: 'QIU-202404-007157',
    databaseId: 'student-db-1',
    matricNo: 'QIU-202404-007157',
    facultyId: 'computing_engineering',
    programmeId: 'programme-1',
    programme: 'Bachelor of Computer Science',
    year: 3,
    logbookEntries: [{ id: 'fixture-log-1', title: 'Fixture entry' }],
  };

  const merged = mergeCanonicalStudentLogbookEntries(canonicalStudent, [
    {
      id: 'log-1',
      title: 'Clinical Placement',
      details: 'Assisted with intake triage.',
      hours: 8,
      status: 'APPROVED',
      entryDate: '2026-08-01T00:00:00.000Z',
      approval: {
        supervisorName: 'Dr Example',
        decision: 'APPROVED',
      },
    },
  ]);

  assert.equal(merged.logbookEntries.length, 1);
  assert.equal(merged.logbookEntries[0].id, 'log-1');
  assert.equal(merged.logbookEntries[0].supervisor, 'Dr Example');
  assert.equal(merged.logbookEntries[0].status, 'APPROVED');
  assert.equal(merged.logbookEntries[0].hours, 8);
  assert.equal(merged.logbookEntries[0].live, true);
  assert.equal(merged.logbookEntries[0].verified, true);
  assert.notEqual(merged.logbookEntries[0].id, 'fixture-log-1');
  assert.equal(merged.liveLogbookLoaded, true);
  assert.equal(merged.liveLogbookError, null);
});

test('applyCanonicalLogbookFailure clears fixture entries and marks the live fetch as failed', () => {
  const canonicalStudent = {
    ...createUnauthenticatedStudentProjection(),
    id: 'QIU-202404-007157',
    databaseId: 'student-db-1',
    matricNo: 'QIU-202404-007157',
    liveIdentity: true,
    identityVerified: true,
    logbookEntries: [{ id: 'fixture-log-1', title: 'Fixture entry' }],
  };

  const failed = applyCanonicalLogbookFailure(canonicalStudent, 'Live logbook fetch failed.');

  assert.deepEqual(failed.logbookEntries, []);
  assert.equal(failed.liveLogbookLoaded, false);
  assert.equal(failed.liveLogbookError, 'Live logbook fetch failed.');
});

test('shouldRenderAuthenticatedPortalChrome suppresses chrome with no identity outside demo mode', () => {
  assert.equal(
    shouldRenderAuthenticatedPortalChrome({
      demoMode: false,
      identity: null,
    }),
    false,
  );
});

test('shouldRenderAuthenticatedPortalChrome allows chrome in demo mode without a real identity', () => {
  assert.equal(
    shouldRenderAuthenticatedPortalChrome({
      demoMode: true,
      identity: null,
    }),
    true,
  );
});

test('shouldRenderAuthenticatedPortalChrome allows chrome for a real authenticated identity', () => {
  assert.equal(
    shouldRenderAuthenticatedPortalChrome({
      demoMode: false,
      identity: {
        user: {
          id: 'user-1',
        },
      },
    }),
    true,
  );
});
