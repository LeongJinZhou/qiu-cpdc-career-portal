import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FAILURE_THRESHOLD,
  classifyProbe,
  nextCourseState,
  probeCourseUrl,
  trendingScore,
} from '../../lib/learning/liveness.js';

const COURSE_URL = 'https://www.coursera.org/specializations/machine-learning-introduction';

test('a 404 or 410 is the course being gone', () => {
  assert.equal(classifyProbe({ status: 404 }).verdict, 'GONE');
  assert.equal(classifyProbe({ status: 410 }).verdict, 'GONE');
});

test('a 200 on the course page is alive', () => {
  assert.equal(
    classifyProbe({ status: 200, requestedUrl: COURSE_URL, finalUrl: COURSE_URL }).verdict,
    'ALIVE',
  );
});

test('a 200 after a redirect to the provider search page is a retirement', () => {
  // How Coursera and edX actually retire courses: they bounce to the catalogue.
  const verdict = classifyProbe({
    status: 200,
    requestedUrl: COURSE_URL,
    finalUrl: 'https://www.coursera.org/search',
  });
  assert.equal(verdict.verdict, 'GONE');
  assert.match(verdict.note, /retired/);
});

test('a redirect that still lands on a course page stays alive', () => {
  assert.equal(
    classifyProbe({
      status: 200,
      requestedUrl: COURSE_URL,
      finalUrl: 'https://www.coursera.org/specializations/machine-learning',
    }).verdict,
    'ALIVE',
  );
});

test('provider blocking and outages are inconclusive, never a take-down', () => {
  for (const status of [401, 403, 429, 500, 502, 503]) {
    assert.equal(
      classifyProbe({ status }).verdict,
      'INCONCLUSIVE',
      `${status} must never delist a course`,
    );
  }
  assert.equal(classifyProbe({ error: 'timed out' }).verdict, 'INCONCLUSIVE');
});

test('one confirmed-gone probe is not enough to hide a course', () => {
  const state = nextCourseState(
    { availability: 'AVAILABLE', failureStreak: 0, unavailableSince: null },
    classifyProbe({ status: 404 }),
  );
  assert.equal(state.availability, 'AVAILABLE', 'still visible after a single strike');
  assert.equal(state.failureStreak, 1);
  assert.equal(state.unavailableSince, null);
});

test('the threshold-th consecutive confirmed-gone probe delists it', () => {
  let state = { availability: 'AVAILABLE', failureStreak: FAILURE_THRESHOLD - 1, unavailableSince: null };
  state = nextCourseState(state, classifyProbe({ status: 404 }));
  assert.equal(state.availability, 'UNAVAILABLE');
  assert.equal(state.failureStreak, FAILURE_THRESHOLD);
  assert.ok(state.unavailableSince instanceof Date, 'records when it went away');
});

test('an outage between two 404s does not reset the streak', () => {
  // A provider that 404s, times out, then 404s again is still a retired course.
  let state = { availability: 'AVAILABLE', failureStreak: 0, unavailableSince: null };
  state = nextCourseState(state, classifyProbe({ status: 404 }));
  state = nextCourseState(state, classifyProbe({ error: 'timed out' }));
  assert.equal(state.failureStreak, 1, 'inconclusive neither adds nor clears');
  assert.equal(state.availability, 'AVAILABLE');
  state = nextCourseState(state, classifyProbe({ status: 404 }));
  assert.equal(state.availability, 'UNAVAILABLE');
});

test('a course that comes back is restored', () => {
  const state = nextCourseState(
    { availability: 'UNAVAILABLE', failureStreak: 5, unavailableSince: new Date('2026-01-01') },
    classifyProbe({ status: 200, requestedUrl: COURSE_URL, finalUrl: COURSE_URL }),
  );
  assert.equal(state.availability, 'AVAILABLE');
  assert.equal(state.failureStreak, 0);
  assert.equal(state.unavailableSince, null);
});

test('an inconclusive probe never changes visibility', () => {
  const before = { availability: 'AVAILABLE', failureStreak: 0, unavailableSince: null };
  const after = nextCourseState(before, classifyProbe({ status: 429 }));
  assert.equal(after.availability, 'AVAILABLE');
  assert.equal(after.failureStreak, 0);
  assert.ok(after.lastCheckedAt instanceof Date, 'but does record that we looked');
});

test('probeCourseUrl never throws and maps a network failure to inconclusive', async () => {
  const result = await probeCourseUrl(COURSE_URL, {
    fetchImpl: async () => { throw new Error('ENOTFOUND'); },
  });
  assert.equal(result.verdict, 'INCONCLUSIVE');
});

test('probeCourseUrl reads the final URL to detect a retirement redirect', async () => {
  const result = await probeCourseUrl(COURSE_URL, {
    fetchImpl: async () => ({ status: 200, url: 'https://www.coursera.org/search' }),
  });
  assert.equal(result.verdict, 'GONE');
});

test('trending favours enrolments but lets a brand-new course surface', () => {
  const now = new Date('2026-08-03');
  const popular = trendingScore({ enrolmentsRecent: 100, addedAt: new Date('2025-01-01'), now });
  const quiet = trendingScore({ enrolmentsRecent: 0, addedAt: new Date('2025-01-01'), now });
  const brandNew = trendingScore({ enrolmentsRecent: 0, addedAt: now, now });

  assert.ok(popular > quiet, 'enrolments raise the score');
  assert.ok(brandNew > quiet, 'a new listing is discoverable before it has enrolments');
  assert.ok(popular > brandNew, 'but novelty never beats real popularity');
});
