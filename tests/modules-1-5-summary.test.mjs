import test from 'node:test';
import assert from 'node:assert/strict';

import { buildXpSummary, computeLoginStreakDays, serializeXpLedger } from '../lib/xp-summary.js';
import { nextBestAction } from '../lib/next-best-action.js';

const NOW = new Date('2026-08-02T03:00:00.000Z');

test('XP summary counts a consecutive login streak from recorded activity', () => {
  const streakDays = computeLoginStreakDays([
    { createdAt: '2026-08-02T02:00:00.000Z' },
    { createdAt: '2026-08-01T02:00:00.000Z' },
    { createdAt: '2026-07-31T02:00:00.000Z' },
    { createdAt: '2026-07-29T02:00:00.000Z' },
  ], { now: NOW, timeZone: 'Asia/Kuala_Lumpur' });

  assert.equal(streakDays, 3);
});

test('XP summary keeps yesterday active when the student has not logged in today', () => {
  const streakDays = computeLoginStreakDays([
    { createdAt: '2026-08-01T02:00:00.000Z' },
    { createdAt: '2026-07-31T02:00:00.000Z' },
  ], { now: NOW, timeZone: 'Asia/Kuala_Lumpur' });

  assert.equal(streakDays, 2);
});

test('XP ledger serialization exposes safe history without dedupe or student internals', () => {
  const ledger = serializeXpLedger([
    {
      id: 'xp-2',
      amount: 150,
      source: 'WORKSHOP_ATTENDANCE',
      note: 'AI workshop',
      dedupeKey: 'workshop:student-1:w1',
      studentId: 'student-1',
      createdAt: new Date('2026-08-02T02:00:00.000Z'),
    },
  ]);

  assert.deepEqual(ledger, [{
    id: 'xp-2',
    amount: 150,
    source: 'WORKSHOP_ATTENDANCE',
    note: 'AI workshop',
    createdAt: '2026-08-02T02:00:00.000Z',
  }]);
});

test('XP summary exposes the required dashboard contract', () => {
  assert.deepEqual(buildXpSummary({
    totalXp: 1500,
    ledger: [],
    loginEvents: [],
    now: NOW,
    timeZone: 'Asia/Kuala_Lumpur',
  }), {
    totalXp: 1500,
    tier: 'Silver',
    streakDays: 0,
    ledger: [],
  });
});

test('next-best-action prioritizes missing profile data before engagement tasks', () => {
  const action = nextBestAction({
    student: { year: 3, bio: '', careerTargets: '', diagnosticResult: null },
    activeFaculty: { name: 'Computing & Engineering' },
  });

  assert.equal(action.id, 'profile');
  assert.equal(action.tab, 'settings');
});

test('next-best-action sends an upper-year student without a project to FYP', () => {
  const action = nextBestAction({
    student: {
      year: 4,
      bio: 'Ready',
      careerTargets: 'Research',
      diagnosticResult: { score: 0.8 },
      fypSubmission: null,
    },
    activeFaculty: { name: 'Computing & Engineering' },
  });

  assert.equal(action.id, 'fyp');
  assert.equal(action.tab, 'fyp');
});

test('next-best-action recommends a workshop when profile and diagnostic are complete', () => {
  const action = nextBestAction({
    student: {
      year: 2,
      bio: 'Ready',
      careerTargets: 'Research',
      diagnosticResult: { score: 0.8 },
      workshopAttendance: [],
      logbookEntries: [{ status: 'APPROVED' }],
    },
    activeFaculty: { name: 'Computing & Engineering' },
  });

  assert.equal(action.id, 'workshop');
  assert.equal(action.tab, 'workshops');
});
