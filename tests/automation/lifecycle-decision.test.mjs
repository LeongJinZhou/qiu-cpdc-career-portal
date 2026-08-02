import test from 'node:test';
import assert from 'node:assert/strict';

import { lifecycleDecision } from '../../lib/automation.js';

test('lifecycle automation waits for the configured verified-hours threshold', () => {
  const result = lifecycleDecision({ approvedHours: 99.9, lifecycleStatus: 'ACTIVE_STUDENT' });
  assert.equal(result.eligible, false);
  assert.equal(result.shouldTransition, false);
});

test('lifecycle automation transitions once at the threshold and is idempotent afterward', () => {
  const first = lifecycleDecision({ approvedHours: 100, lifecycleStatus: 'ACTIVE_STUDENT' });
  const repeat = lifecycleDecision({ approvedHours: 140, lifecycleStatus: 'INTERNSHIP_COMPLETE' });
  assert.equal(first.shouldTransition, true);
  assert.equal(repeat.eligible, true);
  assert.equal(repeat.shouldTransition, false);
});
