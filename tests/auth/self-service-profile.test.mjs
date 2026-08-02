import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LOCKED_IDENTITY_FIELDS,
  assertNoLockedIdentityFields,
  mergeManualCv,
  mergeStudentProfile,
  normalizeProfilePatch,
  normalizeStudentProfilePatch,
  parseProfilePatchBody,
} from '../../lib/auth/identity.js';

function fakeRequest(body) {
  return {
    json: async () => body,
    headers: { get: () => null },
  };
}

test('a student cannot edit their own faculty, programme or year', () => {
  for (const field of ['facultyId', 'faculty', 'programmeId', 'programme', 'academicYear', 'year']) {
    assert.throws(
      () => assertNoLockedIdentityFields({ bio: 'hello', [field]: 'anything' }),
      (error) => error.status === 403 && error.code === 'IDENTITY_FIELD_LOCKED',
      `${field} must be refused`,
    );
  }
});

test('every locked identity field is refused, including matric, email and role', () => {
  for (const field of LOCKED_IDENTITY_FIELDS) {
    assert.throws(
      () => assertNoLockedIdentityFields({ [field]: 'anything' }),
      (error) => error.status === 403,
      `${field} must be refused`,
    );
  }
});

test('a locked field is refused even when its value is null or empty', () => {
  assert.throws(() => assertNoLockedIdentityFields({ facultyId: null }), { status: 403 });
  assert.throws(() => assertNoLockedIdentityFields({ programmeId: '' }), { status: 403 });
});

test('the refusal names the field in words a student understands', () => {
  assert.throws(
    () => assertNoLockedIdentityFields({ academicYear: 3 }),
    (error) => /year of study/.test(error.message) && /cannot be changed here/.test(error.message),
  );
});

test('an ordinary profile patch passes untouched', () => {
  assert.deepEqual(
    assertNoLockedIdentityFields({ bio: 'hi', skills: ['python'], linkedinUrl: '' }),
    [],
  );
});

test('parseProfilePatchBody refuses locked fields before validation strips them', async () => {
  await assert.rejects(
    parseProfilePatchBody(fakeRequest({ name: 'Alex', facultyId: 'medicine' })),
    (error) => error.status === 403 && error.code === 'IDENTITY_FIELD_LOCKED',
  );
});

test('parseProfilePatchBody accepts the self-authored fields', async () => {
  const parsed = await parseProfilePatchBody(fakeRequest({
    name: 'Alex Thorne',
    bio: 'Final year computing student.',
    skills: ['Python', 'SQL'],
    linkedinUrl: 'https://linkedin.com/in/alex',
  }));

  assert.equal(parsed.name, 'Alex Thorne');
  assert.deepEqual(parsed.skills, ['Python', 'SQL']);
});

test('a bad link is rejected with a message that says how to fix it', async () => {
  await assert.rejects(
    parseProfilePatchBody(fakeRequest({ linkedinUrl: 'linkedin.com/in/alex' })),
    (error) => error.name === 'ZodError'
      && /https:\/\//.test(error.issues[0].message),
  );
});

test('the user-row half and profile half of a patch are split correctly', () => {
  const body = {
    name: '  Alex Thorne ',
    avatarUrl: '',
    bio: '  Hello  ',
    skills: ['Python', ' python ', 'SQL', ''],
  };

  assert.deepEqual(normalizeProfilePatch(body), { name: 'Alex Thorne', avatarUrl: null });

  const profilePatch = normalizeStudentProfilePatch(body);
  assert.equal(profilePatch.bio, 'Hello');
  // Case-insensitive de-duplication, blanks dropped.
  assert.deepEqual(profilePatch.skills, ['Python', 'SQL']);
  assert.equal('name' in profilePatch, false);
});

test('unset profile fields are left alone rather than blanked', () => {
  const patch = normalizeStudentProfilePatch({ bio: 'only this' });
  assert.deepEqual(Object.keys(patch), ['bio']);
});

test('a stored profile always reads back as a complete shape', () => {
  const profile = mergeStudentProfile({ bio: 'hi' });
  assert.equal(profile.careerTargets, '');
  assert.deepEqual(profile.skills, []);
  assert.equal(mergeStudentProfile(null).bio, '');
});

test('manual CV entries are always stamped as self-declared', () => {
  const merged = mergeManualCv({
    experience: [{ title: 'Intern', organisation: 'Acme', source: 'VERIFIED' }],
    achievements: [{ title: 'Award' }],
  });

  // A student must not be able to pass source: 'VERIFIED' and have their own
  // entry render as QIU-verified on the CV.
  assert.equal(merged.experience[0].source, 'MANUAL');
  assert.equal(merged.achievements[0].source, 'MANUAL');
  assert.deepEqual(merged.volunteering, []);
});

test('manual CV entries without a title are dropped rather than saved blank', () => {
  const merged = mergeManualCv({ experience: [{ title: '   ' }, { title: 'Intern' }] });
  assert.equal(merged.experience.length, 1);
  assert.equal(merged.experience[0].title, 'Intern');
});

test('manual CV entries get a stable id even when the client sends none', () => {
  const merged = mergeManualCv({ volunteering: [{ title: 'Volunteer' }] });
  assert.equal(merged.volunteering[0].id, 'volunteering-1');
});
