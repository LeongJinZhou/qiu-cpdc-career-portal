import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  directoryIdentityMatches,
  fetchGoogleDirectoryProfile,
  mapPeopleProfile,
} from '../lib/integrations/google-directory.js';

// ---------------------------------------------------------------------------
// Parity with sld-orientation: department, job title, Google photo, and the
// admin-set Employee ID that only the directory SEARCH returns.

const STAFF_ME = {
  names: [{ displayName: 'Aina Rahman', metadata: { primary: true } }],
  emailAddresses: [{ value: 'aina.rahman@qiu.edu.my', metadata: { primary: true } }],
  organizations: [{ title: 'Career Officer', department: 'CPDC', metadata: { primary: true } }],
  photos: [{ url: 'https://lh3.googleusercontent.com/a/abc=s100', metadata: { primary: true } }],
};

test('maps department, job title and a Google-hosted photo', () => {
  const mapped = mapPeopleProfile(STAFF_ME);
  assert.equal(mapped.department, 'CPDC');
  assert.equal(mapped.jobTitle, 'Career Officer');
  assert.equal(mapped.photoUrl, 'https://lh3.googleusercontent.com/a/abc=s100');
});

test('drops a photo that is not https on *.googleusercontent.com', () => {
  for (const url of ['http://lh3.googleusercontent.com/a/x', 'https://evil.example/x.png', 'https://googleusercontent.com.evil.example/x']) {
    assert.equal(mapPeopleProfile({ photos: [{ url }] }).photoUrl, null, url);
  }
});

function fakeFetch(routes) {
  const calls = [];
  const impl = async (url) => {
    calls.push(String(url));
    const match = routes.find(([prefix]) => String(url).startsWith(prefix));
    if (!match) return { ok: false, status: 404, json: async () => ({}) };
    const [, status, body] = match;
    return { ok: status === 200, status, json: async () => body };
  };
  return { impl, calls };
}

test('directory search for the own email supplies the admin-set Employee ID', async () => {
  const { impl, calls } = fakeFetch([
    ['https://people.googleapis.com/v1/people/me', 200, STAFF_ME],
    ['https://people.googleapis.com/v1/people:searchDirectoryPeople', 200, {
      people: [
        // A different person whose name matched the query must be ignored.
        { emailAddresses: [{ value: 'aina.rahman2@qiu.edu.my' }], externalIds: [{ value: 'QIU-E-9999', type: 'organization' }] },
        { emailAddresses: [{ value: 'Aina.Rahman@qiu.edu.my' }], externalIds: [{ value: 'QIU-E-0042', formattedType: 'Employee ID' }] },
      ],
    }],
  ]);

  const result = await fetchGoogleDirectoryProfile({
    accessToken: 'token', email: 'aina.rahman@qiu.edu.my', fetchImpl: impl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.employeeId, 'QIU-E-0042');
  assert.equal(result.data.department, 'CPDC');
  assert.equal(result.data.jobTitle, 'Career Officer');
  const searchUrl = new URL(calls.find((u) => u.includes('searchDirectoryPeople')));
  assert.equal(searchUrl.searchParams.get('query'), 'aina.rahman@qiu.edu.my');
  assert.equal(searchUrl.searchParams.get('sources'), 'DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE');
  assert.equal(searchUrl.searchParams.get('readMask'), 'emailAddresses,externalIds,organizations');
});

test('a failed directory search does not fail the profile read', async () => {
  const { impl } = fakeFetch([
    ['https://people.googleapis.com/v1/people/me', 200, STAFF_ME],
    ['https://people.googleapis.com/v1/people:searchDirectoryPeople', 403, {}],
  ]);
  const result = await fetchGoogleDirectoryProfile({ accessToken: 'token', email: 'aina.rahman@qiu.edu.my', fetchImpl: impl });
  assert.equal(result.ok, true);
  assert.equal(result.data.jobTitle, 'Career Officer');
  assert.equal(result.data.employeeId, null);
  assert.equal(result.searchStatus, 403);
});

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
  const empty = {
    email: null, employeeId: null, courseCode: null, employeeType: null, displayName: null,
    department: null, jobTitle: null, photoUrl: null,
  };
  assert.deepEqual(mapPeopleProfile(), empty);
  assert.deepEqual(mapPeopleProfile(null), empty);
});

test('reads course code from cost centre when department is absent', () => {
  const mapped = mapPeopleProfile({
    organizations: [{ title: 'QIU Student', costCenter: 'BCS', metadata: { primary: true } }],
  });
  assert.equal(mapped.courseCode, 'BCS');
});

test('directory enrichment only accepts the signed-in Google identity', () => {
  assert.equal(directoryIdentityMatches('Student@qiu.edu.my', 'student@qiu.edu.my'), true);
  assert.equal(directoryIdentityMatches('student@qiu.edu.my', 'other@qiu.edu.my'), false);
  assert.equal(directoryIdentityMatches('student@qiu.edu.my', null), false);
});
