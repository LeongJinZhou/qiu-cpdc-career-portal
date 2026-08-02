import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDemoIdentity,
  buildDirectoryWhere,
  buildStudentScopeWhere,
  describeScope,
  parseDirectoryQuery,
} from '../../app/api/students/student-scope.js';
import {
  buildStudentRecordResponse,
  describeHiddenLayers,
  toVisibilityRecord,
} from '../../app/api/students/profile-view.js';
import { hasCapability, requireCapability } from '../../lib/auth/permissions.js';

const COMPUTING = 'computing_engineering';
const MEDICINE = 'medicine';

function coordinator(facultyId = COMPUTING) {
  return {
    user: { id: 'user-coord', role: 'FACULTY_COORDINATOR' },
    student: null,
    assignments: [{ role: 'FACULTY_COORDINATOR', scopeType: 'FACULTY', scopeValue: facultyId }],
  };
}

function registrar() {
  return { user: { id: 'user-reg', role: 'UNIVERSITY_REGISTRAR' }, student: null, assignments: [] };
}

// --- scope is a database predicate, not a post-fetch filter ------------------

test('a faculty coordinator is scoped to their faculty in the query itself', () => {
  const scope = buildStudentScopeWhere(coordinator());
  assert.equal(scope.unrestricted, false);
  assert.deepEqual(scope.where, { facultyId: { in: [COMPUTING] } });
});

test('a head of programme is scoped to their programme', () => {
  const identity = {
    user: { id: 'user-hop', role: 'HEAD_OF_PROGRAMME' },
    student: null,
    assignments: [{ role: 'HEAD_OF_PROGRAMME', scopeType: 'PROGRAMME', scopeValue: 'programme-1' }],
  };
  assert.deepEqual(buildStudentScopeWhere(identity).where, { programmeId: { in: ['programme-1'] } });
});

test('an academic supervisor is scoped to their named mentees only', () => {
  const identity = {
    user: { id: 'user-sup', role: 'ACADEMIC_SUPERVISOR' },
    student: null,
    assignments: [
      { role: 'ACADEMIC_SUPERVISOR', scopeType: 'STUDENT', scopeValue: 'student-a' },
      { role: 'ACADEMIC_SUPERVISOR', scopeType: 'STUDENT', scopeValue: 'student-b' },
    ],
  };
  assert.deepEqual(buildStudentScopeWhere(identity).where, { id: { in: ['student-a', 'student-b'] } });
});

test('a global staff role is unrestricted', () => {
  const scope = buildStudentScopeWhere(registrar());
  assert.equal(scope.unrestricted, true);
  assert.deepEqual(scope.where, {});
});

test('a coordinator with no assignment reaches nobody, and never produces an unfiltered query', () => {
  const identity = { user: { id: 'user-x', role: 'FACULTY_COORDINATOR' }, student: null, assignments: [] };
  const scope = buildStudentScopeWhere(identity);
  assert.equal(scope.where, null);
  assert.match(describeScope(scope.reach), /No students have been assigned/);
});

test('a requested faculty filter narrows the scope and can never widen it', () => {
  const scope = buildStudentScopeWhere(coordinator());
  // A coordinator for Computing hand-editing the URL to ask for Medicine.
  const where = buildDirectoryWhere(scope.where, { facultyId: MEDICINE });
  assert.deepEqual(where, {
    AND: [
      { facultyId: { in: [COMPUTING] } },
      { facultyId: MEDICINE },
    ],
  });
  // Both clauses are ANDed, so the result set is empty rather than Medicine's cohort.
});

test('search looks at matric number, name and email', () => {
  const where = buildDirectoryWhere({}, { search: 'thorne' });
  const searchClause = where.AND[1].OR;
  assert.equal(searchClause.length, 3);
  assert.deepEqual(searchClause[0], { matricNo: { contains: 'thorne', mode: 'insensitive' } });
});

test('query parsing rejects nonsense and caps the page size', () => {
  const params = new URLSearchParams({ year: 'ninety', page: '-4', pageSize: '5000', needsAttention: 'true' });
  const parsed = parseDirectoryQuery(params);
  assert.equal(parsed.year, null);
  assert.equal(parsed.page, 1);
  assert.equal(parsed.pageSize, 100);
  assert.equal(parsed.needsAttention, true);
});

// --- the negative case: out-of-faculty student is a 403 ----------------------

test('a faculty-scoped coordinator is refused a student from another faculty', () => {
  const identity = coordinator(COMPUTING);

  assert.equal(
    hasCapability(identity, 'student.read', { studentId: 's1', facultyId: COMPUTING, programmeId: 'p1' }),
    true,
    'their own faculty is readable',
  );

  assert.equal(
    hasCapability(identity, 'student.read', { studentId: 's2', facultyId: MEDICINE, programmeId: 'p9' }),
    false,
    'another faculty is not',
  );

  // This is what /api/students/[id]/profile does, so this assertion is the 403.
  assert.throws(
    () => requireCapability(identity, 'student.read', { studentId: 's2', facultyId: MEDICINE, programmeId: 'p9' }),
    (error) => error.status === 403 && error.code === 'INSUFFICIENT_CAPABILITY',
  );
});

test('a demo staff role gets a real narrow scope, not a global one', () => {
  const identity = buildDemoIdentity({
    role: 'FACULTY_COORDINATOR',
    user: { id: 'demo-user' },
    student: { id: 'student-1', facultyId: COMPUTING, programmeId: 'programme-1' },
  });

  assert.deepEqual(buildStudentScopeWhere(identity).where, { facultyId: { in: [COMPUTING] } });
  assert.throws(
    () => requireCapability(identity, 'student.read', { studentId: 's2', facultyId: MEDICINE, programmeId: 'p9' }),
    (error) => error.status === 403,
  );
});

test('a demo student role can only reach itself', () => {
  const student = { id: 'student-1', facultyId: COMPUTING, programmeId: 'programme-1' };
  const identity = buildDemoIdentity({ role: 'STUDENT', user: { id: 'demo-user' }, student });
  assert.deepEqual(buildStudentScopeWhere(identity).where, { id: { in: ['student-1'] } });
});

// --- field-level visibility is actually applied ------------------------------

const DB_STUDENT = {
  id: 'student-1',
  matricNo: 'QIU-202404-007157',
  academicYear: 3,
  intakeYearMonth: 202404,
  lifecycleStatus: 'ACTIVE_STUDENT',
  searchable: false,
  skillTags: ['React', 'SQL'],
  facultyId: COMPUTING,
  programmeId: 'programme-1',
  user: { id: 'u1', name: 'Demo Student', email: 'demo@student.qiu.edu.my', accountStatus: 'ACTIVE', lastSignInAt: null },
  faculty: { id: COMPUTING, name: 'Faculty of Computing and Engineering', code: 'FCE' },
  programme: { id: 'programme-1', name: 'Bachelor of Computer Science (Honours)', level: 'BACHELOR' },
  xpEvents: [{ amount: 600, source: 'PROFILE_SETUP' }],
  badges: [{ id: 'b1', title: 'First Log', category: 'logbook', icon: 'star', xp: 50 }],
  logbookEntries: [{
    id: 'entry-1',
    title: 'Clinic rotation',
    details: 'Ward round',
    hours: 6,
    entryDate: new Date('2026-05-04'),
    status: 'APPROVED',
    latitude: 3.0738,
    longitude: 101.5183,
    approval: { supervisorName: 'Dr Lim', decision: 'APPROVED', usedAt: new Date('2026-05-05') },
  }],
  fypProject: { id: 'f1', title: 'Campus routing', abstract: 'a', status: 'PENDING_REVIEW', publicOptIn: false },
  diagnostics: [{ id: 'd1', testId: 'general', score: 0.72, passed: true, gapTags: ['SQL'], createdAt: new Date('2026-04-01') }],
  courseEnrolments: [{ id: 'c1', title: 'SQL Basics', provider: 'Coursera', skillTag: 'SQL', status: 'COMPLETED', verificationStatus: 'VERIFIED', verifiedAt: new Date('2026-04-10') }],
  applications: [],
};

test('the record projection never invents a figure the database does not hold', () => {
  const record = toVisibilityRecord(DB_STUDENT);
  assert.equal(record.atsScore, null, 'no ATS score is stored, so none is reported');
  assert.equal(record.hoursRequired, null, 'no required-hours target is stored');
  assert.equal(record.hoursCompleted, 6, 'approved hours are summed from real entries');
  assert.equal(record.xp, 600);
  assert.equal(record.tier, 'Bronze');
});

test('a career counselor gets CV and diagnostics but no logbook at all', () => {
  const response = buildStudentRecordResponse(DB_STUDENT, { role: 'CAREER_COUNSELOR' });
  assert.ok(response.profile.cv, 'CV layer present');
  assert.ok(response.profile.diagnostics, 'diagnostics layer present');
  assert.equal(response.profile.logbook, undefined, 'no fieldwork layer');
  assert.equal(response.gpsVisible, false);

  const hiddenLogbook = response.hiddenLayers.find((layer) => layer.layer === 'logbook');
  assert.ok(hiddenLogbook, 'the omission is listed, not silent');
  assert.match(hiddenLogbook.reason, /GPS/, 'and it is explained in a sentence');
});

test('a registrar sees the logbook but never the GPS coordinates', () => {
  const response = buildStudentRecordResponse(DB_STUDENT, { role: 'UNIVERSITY_REGISTRAR' });
  const entry = response.profile.logbook.entries[0];
  assert.equal(response.gpsVisible, false);
  assert.equal('latitude' in entry, false);
  assert.equal('longitude' in entry, false);
  assert.equal(entry.hours, 6, 'the rest of the entry survives');
});

test('a placement officer supervising fieldwork does see the GPS coordinates', () => {
  const response = buildStudentRecordResponse(DB_STUDENT, { role: 'PLACEMENT_OFFICER' });
  assert.equal(response.gpsVisible, true);
  assert.equal(response.profile.logbook.entries[0].latitude, 3.0738);
  assert.equal(response.profile.cv, undefined, 'but not the CV layer');
});

test('every hidden layer carries a plain-English reason', () => {
  for (const role of ['CAREER_COUNSELOR', 'UNIVERSITY_REGISTRAR', 'PLACEMENT_OFFICER', 'ACADEMIC_SUPERVISOR']) {
    for (const hidden of describeHiddenLayers(role)) {
      assert.ok(hidden.reason.length > 20, `${role}/${hidden.layer} needs a real explanation`);
      assert.ok(hidden.label, `${role}/${hidden.layer} needs a human label`);
    }
  }
});

test('a super admin sees all seven layers and nothing is hidden', () => {
  const response = buildStudentRecordResponse(DB_STUDENT, { role: 'SUPER_ADMIN' });
  assert.equal(response.layers.length, 7);
  assert.deepEqual(response.hiddenLayers, []);
});
