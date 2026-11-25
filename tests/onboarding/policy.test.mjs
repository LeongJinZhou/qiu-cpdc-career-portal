import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ONBOARDING_VERSION,
  canCompleteOnboarding,
  evaluateOnboarding,
  requiredProvidersFor,
  suggestedProvidersFor,
} from '../../lib/onboarding/policy.js';

const linkedin = { provider: 'LINKEDIN', brokenAt: null };
const github = { provider: 'GITHUB', brokenAt: null };

function student(overrides = {}) {
  return {
    facultyId: 'business',
    courseCode: 'BBA',
    identityConfirmedAt: new Date('2026-08-01'),
    onboardingCompletedAt: new Date('2026-08-01'),
    onboardingVersion: ONBOARDING_VERSION,
    connectedAccounts: [linkedin],
    ...overrides,
  };
}

test('when LinkedIn sign-in is required, a pasted link does not count and a real sign-in does', () => {
  const pasted = { provider: 'LINKEDIN', method: 'VERIFIED_URL', brokenAt: null };
  const signedIn = { provider: 'LINKEDIN', method: 'OAUTH', providerUserId: 'abc', brokenAt: null };
  const options = { signInRequired: ['LINKEDIN'] };

  const withPaste = evaluateOnboarding(student({ connectedAccounts: [pasted], onboardingCompletedAt: null }), options);
  assert.deepEqual(withPaste.missingProviders, ['LINKEDIN']);
  assert.equal(canCompleteOnboarding(student({ connectedAccounts: [pasted] }), options), false);

  const withSignIn = evaluateOnboarding(student({ connectedAccounts: [signedIn], onboardingCompletedAt: null }), options);
  assert.deepEqual(withSignIn.missingProviders, []);
  assert.equal(canCompleteOnboarding(student({ connectedAccounts: [signedIn] }), options), true);

  // Without the requirement (LinkedIn keys not set), a pasted link still counts.
  assert.deepEqual(evaluateOnboarding(student({ connectedAccounts: [pasted] })).missingProviders, []);
});

test('LinkedIn is required for every faculty', () => {
  for (const facultyId of [
    'business', 'medicine', 'pharmacy', 'education',
    'lifesciences', 'hospitality', 'communication', 'computing_engineering',
  ]) {
    assert.ok(
      requiredProvidersFor({ facultyId }).includes('LINKEDIN'),
      `LinkedIn must be required for ${facultyId}`,
    );
  }
});

test('GitHub is required for computing, and only for computing', () => {
  assert.deepEqual(
    requiredProvidersFor({ facultyId: 'computing_engineering', programmeCode: 'BCS' }),
    ['LINKEDIN', 'GITHUB'],
  );
  assert.deepEqual(requiredProvidersFor({ facultyId: 'business', programmeCode: 'BBA' }), ['LINKEDIN']);
  assert.deepEqual(requiredProvidersFor({ facultyId: 'medicine', programmeCode: 'MBBS' }), ['LINKEDIN']);
});

test('a computing programme code requires GitHub even outside the computing faculty', () => {
  // Covers a programme administratively parked under another faculty.
  assert.deepEqual(
    requiredProvidersFor({ facultyId: 'business', programmeCode: 'bit' }),
    ['LINKEDIN', 'GITHUB'],
  );
});

test('GitHub stays available to non-computing students as a suggestion', () => {
  const suggested = suggestedProvidersFor({ facultyId: 'business', programmeCode: 'BBA' });
  assert.ok(suggested.includes('GITHUB'), 'a Business student may still connect GitHub');
  assert.ok(!suggested.includes('LINKEDIN'), 'a required provider is never also a suggestion');
});

test('a returning student who finished the current flow is never re-prompted', () => {
  const verdict = evaluateOnboarding(student());
  assert.equal(verdict.complete, true);
  assert.equal(verdict.needsOnboarding, false);
  assert.equal(verdict.reason, 'COMPLETE');
});

test('a first-login student with nothing connected must onboard', () => {
  const verdict = evaluateOnboarding(student({
    identityConfirmedAt: null,
    onboardingCompletedAt: null,
    onboardingVersion: 0,
    connectedAccounts: [],
  }));
  assert.equal(verdict.needsOnboarding, true);
  assert.equal(verdict.reason, 'IDENTITY_UNCONFIRMED');
  assert.deepEqual(verdict.missingProviders, ['LINKEDIN']);
});

test('a computing student without GitHub cannot complete', () => {
  const s = student({
    facultyId: 'computing_engineering',
    courseCode: 'BCS',
    onboardingCompletedAt: null,
    onboardingVersion: 0,
    connectedAccounts: [linkedin],
  });
  assert.deepEqual(evaluateOnboarding(s).missingProviders, ['GITHUB']);
  assert.equal(canCompleteOnboarding(s), false);

  const withGithub = { ...s, connectedAccounts: [linkedin, github] };
  assert.deepEqual(evaluateOnboarding(withGithub).missingProviders, []);
  assert.equal(canCompleteOnboarding(withGithub), true);
});

test('a broken connection does not count as connected, and is reported separately', () => {
  const verdict = evaluateOnboarding(student({
    connectedAccounts: [{ provider: 'LINKEDIN', brokenAt: new Date('2026-08-02') }],
    onboardingCompletedAt: null,
    onboardingVersion: 0,
  }));
  assert.deepEqual(verdict.missingProviders, ['LINKEDIN']);
  assert.deepEqual(verdict.brokenProviders, ['LINKEDIN']);
  assert.deepEqual(verdict.connectedProviders, []);
});

test('a policy bump re-prompts a previously complete student', () => {
  const verdict = evaluateOnboarding(student({ onboardingVersion: ONBOARDING_VERSION - 1 }));
  assert.equal(verdict.needsOnboarding, true);
  assert.equal(verdict.reason, 'POLICY_UPDATED');
});

test('a completed student is not un-completed by a later requirement gap', () => {
  // Guards the "confirm once" contract: completion is a recorded fact, not a
  // value re-derived from the current step list on every page load.
  const verdict = evaluateOnboarding(student({
    facultyId: 'computing_engineering',
    courseCode: 'BCS',
    connectedAccounts: [linkedin], // GitHub missing, but they already finished
  }));
  assert.equal(verdict.complete, true);
  assert.equal(verdict.needsOnboarding, false);
  assert.deepEqual(verdict.missingProviders, ['GITHUB'], 'still reported so the UI can nudge');
});

test('no student context gates nothing', () => {
  const verdict = evaluateOnboarding(null);
  assert.equal(verdict.needsOnboarding, false);
  assert.equal(verdict.reason, 'NO_STUDENT');
});
