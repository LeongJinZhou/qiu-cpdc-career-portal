import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STUDENT_PROFILE_LAYERS,
  buildStudentProfileView,
  canReadGps,
  canReadLayer,
  layersForRole,
} from '../../lib/auth/student-profile-visibility.js';

/** A student carrying at least one field from every one of the seven layers. */
function makeStudent(overrides = {}) {
  return {
    id: 'stu-1',
    matricNo: 'QIU-202404-007157',
    name: 'Alex Thorne',
    email: 'alex.thorne@student.qiu.edu.my',
    facultyId: 'computing_engineering',
    programmeId: 'prog-cs',
    programme: 'Bachelor of Computer Science (Honours)',
    year: 3,
    xp: 1450,
    tier: 'Bronze',
    badges: [{ id: 'b1', title: 'Git Master' }],
    hoursCompleted: 28,
    hoursRequired: 120,
    logbookEntries: [
      { id: 'log-1', title: 'Ward round', hours: 8, latitude: 4.5975, longitude: 101.0901 },
      { id: 'log-2', title: 'Lab session', hours: 4, latitude: 4.6, longitude: 101.1 },
    ],
    atsScore: 82,
    verifiedSkills: ['Python'],
    diagnosticScores: { technical: 82, communication: 45 },
    fyp: { title: 'Distributed caching', status: 'APPROVED' },
    careerTargets: 'Software engineer',
    portfolioUrl: 'https://example.invalid/portfolio',
    publicTalent: false,
    ...overrides,
  };
}

test('an unknown role gets nothing rather than everything', () => {
  assert.deepEqual(layersForRole('NOT_A_ROLE'), []);
  const view = buildStudentProfileView(makeStudent(), { role: 'NOT_A_ROLE' });
  assert.deepEqual(view.profile, {});
});

test('a student reads their own record in full but not a peer\'s', () => {
  const own = buildStudentProfileView(makeStudent(), { role: 'STUDENT', isSelf: true });
  assert.equal(own.layers.length, 7);
  assert.ok(own.profile.logbook);
  assert.ok(own.profile.diagnostics);

  const peer = buildStudentProfileView(makeStudent(), { role: 'STUDENT', isSelf: false });
  assert.deepEqual(peer.profile, {});
});

test('employers and alumni cannot see a student who has not opted in', () => {
  const student = makeStudent({ publicTalent: false });
  for (const role of ['EMPLOYER', 'ALUMNI']) {
    const view = buildStudentProfileView(student, { role });
    assert.equal(view.profile, null, `${role} must not receive a private record`);
    assert.equal(view.reason, 'NOT_PUBLIC');
  }
});

test('an opted-in student exposes only layers 1, 4, 6 and 7 to an employer', () => {
  const view = buildStudentProfileView(makeStudent({ publicTalent: true }), { role: 'EMPLOYER' });

  assert.ok(view.profile.identity);
  assert.ok(view.profile.cv);
  assert.ok(view.profile.fyp);
  assert.ok(view.profile.careerTargets);

  // The private half of the record must be absent, not merely empty.
  assert.equal(view.profile.logbook, undefined);
  assert.equal(view.profile.diagnostics, undefined);
  assert.equal(view.profile.gamification, undefined);
});

test('an employer never receives a contact address or GPS, even when opted in', () => {
  const view = buildStudentProfileView(makeStudent({ publicTalent: true }), { role: 'EMPLOYER' });
  assert.equal(view.profile.identity.email, null);
  assert.equal(canReadGps('EMPLOYER'), false);
});

test('an unapproved FYP is withheld from outsiders but visible to staff', () => {
  const pending = makeStudent({ publicTalent: true, fyp: { title: 'Draft', status: 'PENDING_REVIEW' } });

  assert.equal(buildStudentProfileView(pending, { role: 'EMPLOYER' }).profile.fyp, null);
  assert.equal(
    buildStudentProfileView(pending, { role: 'HEAD_OF_PROGRAMME' }).profile.fyp.title,
    'Draft',
  );
});

test('a career counselor sees career data but no placement location history', () => {
  const view = buildStudentProfileView(makeStudent(), { role: 'CAREER_COUNSELOR' });

  assert.ok(view.profile.cv);
  assert.ok(view.profile.diagnostics);
  assert.equal(view.profile.logbook, undefined);
  assert.equal(canReadGps('CAREER_COUNSELOR'), false);
});

test('a registrar sees hours for clearance but not the diagnostic radar', () => {
  const view = buildStudentProfileView(makeStudent(), { role: 'UNIVERSITY_REGISTRAR' });

  assert.equal(view.profile.logbook.hoursCompleted, 28);
  assert.equal(view.profile.diagnostics, undefined);
  // Reading hours for clearance does not require knowing where they happened.
  assert.equal(canReadGps('UNIVERSITY_REGISTRAR'), false);
  assert.equal(view.profile.logbook.entries[0].latitude, undefined);
});

test('an external supervisor sees only the single entry their token authorises', () => {
  const view = buildStudentProfileView(makeStudent(), {
    role: 'EXTERNAL_SUPERVISOR',
    logbookEntryId: 'log-1',
  });

  assert.equal(view.profile.logbook.entries.length, 1);
  assert.equal(view.profile.logbook.entries[0].id, 'log-1');
  // The check-in map is the point of the sign-off, so coordinates stay.
  assert.equal(view.profile.logbook.entries[0].latitude, 4.5975);

  // And nothing beyond identity + that entry.
  assert.equal(view.profile.cv, undefined);
  assert.equal(view.profile.diagnostics, undefined);
  assert.equal(view.profile.careerTargets, undefined);
});

test('layer helpers agree with the projection', () => {
  assert.equal(canReadLayer('EMPLOYER', STUDENT_PROFILE_LAYERS.LOGBOOK), false);
  assert.equal(canReadLayer('FACULTY_COORDINATOR', STUDENT_PROFILE_LAYERS.LOGBOOK), true);
  assert.equal(canReadLayer('ACADEMIC_SUPERVISOR', STUDENT_PROFILE_LAYERS.CV), false);
});
