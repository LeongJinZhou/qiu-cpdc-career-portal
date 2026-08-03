import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkInAward,
  isRegistrationOpen,
  isQrCheckInOpen,
  parseWorkshopStart,
  seatsLeft,
} from '../lib/workshop-policy.js';

test('workshop start parsing rejects blank or invalid dates instead of silently scheduling later', () => {
  assert.throws(() => parseWorkshopStart(''), /valid start date/i);
  assert.throws(() => parseWorkshopStart('not-a-date'), /valid start date/i);
  assert.equal(parseWorkshopStart('2026-08-15T06:00:00.000Z').toISOString(), '2026-08-15T06:00:00.000Z');
});

test('workshop capacity exposes null for uncapped events and never negative seats', () => {
  assert.equal(seatsLeft(null, 100), null);
  assert.equal(seatsLeft(20, 4), 16);
  assert.equal(seatsLeft(20, 24), 0);
});

test('workshop registration closes at its deadline and at the start time', () => {
  const startsAt = new Date('2026-08-15T06:00:00.000Z');
  assert.equal(isRegistrationOpen({ startsAt, now: new Date('2026-08-15T05:59:59.000Z') }), true);
  assert.equal(isRegistrationOpen({ startsAt, registrationDeadline: '2026-08-15T05:00:00.000Z', now: new Date('2026-08-15T05:30:00.000Z') }), false);
  assert.equal(isRegistrationOpen({ startsAt, now: startsAt }), false);
});

test('QR check-in is open shortly before and after the workshop, not indefinitely', () => {
  const startsAt = new Date('2026-08-15T06:00:00.000Z');
  assert.equal(isQrCheckInOpen(startsAt, { now: new Date('2026-08-15T05:00:00.000Z') }), true);
  assert.equal(isQrCheckInOpen(startsAt, { now: new Date('2026-08-14T00:00:00.000Z') }), false);
  assert.equal(isQrCheckInOpen(startsAt, { now: new Date('2026-08-16T07:00:00.000Z') }), true);
  assert.equal(isQrCheckInOpen(startsAt, { now: new Date('2026-08-17T07:00:00.000Z') }), false);
});

test('attendance XP is zero on a duplicate scan', () => {
  assert.deepEqual(checkInAward({ alreadyCheckedIn: false, xpValue: 150 }), { xpAwarded: 150 });
  assert.deepEqual(checkInAward({ alreadyCheckedIn: true, xpValue: 150 }), { xpAwarded: 0 });
});
