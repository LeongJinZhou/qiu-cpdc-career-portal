import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeFypSaveStatus, FYP_REVIEW_STATUSES, canTransitionFypStatus } from '../lib/fyp-status-policy.js';

test('FYP saves default to review while allowing an explicit draft', () => {
  assert.equal(normalizeFypSaveStatus(undefined), 'PENDING_REVIEW');
  assert.equal(normalizeFypSaveStatus('DRAFT'), 'DRAFT');
  assert.equal(normalizeFypSaveStatus('PENDING_REVIEW'), 'PENDING_REVIEW');
});

test('FYP review status policy includes the full persisted lifecycle', () => {
  assert.deepEqual(FYP_REVIEW_STATUSES, ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'NEEDS_CHANGES']);
});

test('FYP review transitions do not let an approved project silently move backwards', () => {
  assert.equal(canTransitionFypStatus('PENDING_REVIEW', 'APPROVED'), true);
  assert.equal(canTransitionFypStatus('APPROVED', 'DRAFT'), false);
  assert.equal(canTransitionFypStatus('APPROVED', 'NEEDS_CHANGES'), false);
  assert.equal(canTransitionFypStatus('NEEDS_CHANGES', 'PENDING_REVIEW'), true);
});
