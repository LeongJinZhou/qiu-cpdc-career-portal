import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ConnectionError,
  normalizeProfileUrl,
  probeProfile,
} from '../../lib/onboarding/connections.js';

test('accepts what students actually paste and canonicalises it', () => {
  const cases = [
    'https://www.linkedin.com/in/yau-ming-soo',
    'linkedin.com/in/yau-ming-soo',
    'http://linkedin.com/in/yau-ming-soo/',
    'https://my.linkedin.com/in/yau-ming-soo',
    'https://www.linkedin.com/in/yau-ming-soo?utm_source=share&trk=copy',
    'https://www.linkedin.com/mwlite/in/yau-ming-soo',
    '  https://www.linkedin.com/in/yau-ming-soo#about  ',
  ];

  for (const raw of cases) {
    const result = normalizeProfileUrl('LINKEDIN', raw);
    assert.equal(
      result.profileUrl,
      'https://www.linkedin.com/in/yau-ming-soo',
      `failed to canonicalise: ${raw}`,
    );
    assert.equal(result.handle, 'yau-ming-soo');
  }
});

test('rejects a LinkedIn company page as a personal profile', () => {
  assert.throws(
    () => normalizeProfileUrl('LINKEDIN', 'https://www.linkedin.com/company/qiu'),
    (error) => error instanceof ConnectionError && error.code === 'WRONG_PATH',
  );
  assert.throws(
    () => normalizeProfileUrl('LINKEDIN', 'https://www.linkedin.com/school/qiu'),
    (error) => error.code === 'WRONG_PATH',
  );
});

test('rejects the wrong provider host', () => {
  assert.throws(
    () => normalizeProfileUrl('LINKEDIN', 'https://github.com/someone'),
    (error) => error.code === 'WRONG_HOST',
  );
  // A lookalike domain must not pass the suffix check.
  assert.throws(
    () => normalizeProfileUrl('LINKEDIN', 'https://linkedin.com.evil.example/in/x'),
    (error) => error.code === 'WRONG_HOST',
  );
});

test('GitHub accepts a profile and rejects a repository', () => {
  assert.equal(
    normalizeProfileUrl('GITHUB', 'github.com/octocat/').profileUrl,
    'https://github.com/octocat',
  );
  assert.throws(
    () => normalizeProfileUrl('GITHUB', 'https://github.com/octocat/hello-world'),
    (error) => error.code === 'WRONG_PATH',
  );
});

test('ORCID accepts only a well-formed iD, including the X checksum', () => {
  assert.equal(
    normalizeProfileUrl('ORCID', 'orcid.org/0000-0002-1825-0097').profileUrl,
    'https://orcid.org/0000-0002-1825-0097',
  );
  assert.equal(
    normalizeProfileUrl('ORCID', 'https://orcid.org/0000-0002-1825-009X').handle,
    '0000-0002-1825-009X',
  );
  assert.throws(() => normalizeProfileUrl('ORCID', 'https://orcid.org/not-an-id'));
});

test('a blank or malformed value is refused with a helpful code', () => {
  assert.throws(() => normalizeProfileUrl('LINKEDIN', '   '), (e) => e.code === 'EMPTY');
  assert.throws(() => normalizeProfileUrl('LINKEDIN', 'not a url at all'));
  assert.throws(() => normalizeProfileUrl('NOPE', 'https://x.com'), (e) => e.code === 'UNKNOWN_PROVIDER');
});

test('the open-ended portfolio provider accepts any https host', () => {
  assert.equal(
    normalizeProfileUrl('PORTFOLIO', 'my-site.example/work/').profileUrl,
    'https://my-site.example/work',
  );
});

test('probeProfile treats only 404/410 as gone, never a provider block', async () => {
  const stub = (status) => async () => ({ ok: status >= 200 && status < 300, status });

  assert.deepEqual(await probeProfile('https://x', { fetchImpl: stub(200) }), {
    reachable: true, status: 200, note: 'OK',
  });
  assert.equal((await probeProfile('https://x', { fetchImpl: stub(404) })).reachable, false);
  assert.equal((await probeProfile('https://x', { fetchImpl: stub(410) })).reachable, false);
  // LinkedIn's anti-bot responses must NOT read as "profile does not exist".
  for (const status of [403, 429, 999]) {
    assert.equal(
      (await probeProfile('https://x', { fetchImpl: stub(status) })).reachable,
      null,
      `${status} must be inconclusive, not a rejection`,
    );
  }
});

test('probeProfile never throws on a network failure', async () => {
  const result = await probeProfile('https://x', {
    fetchImpl: async () => { throw new Error('ECONNREFUSED'); },
  });
  assert.equal(result.reachable, null);
  assert.equal(result.note, 'Check failed');
});
