import test from 'node:test';
import assert from 'node:assert/strict';

import { CAREER_PATHS, findMilestone, milestoneId } from '../lib/data/roadmaps.js';
import { canReviewStudent, reviewerWhere } from '../lib/fyp-review.js';

test('career registry contains eight faculty roadmaps with four years each', () => {
  const facultyIds = Object.keys(CAREER_PATHS).filter((id) => id !== 'default');
  assert.equal(facultyIds.length, 8);
  for (const facultyId of facultyIds) {
    assert.deepEqual(CAREER_PATHS[facultyId].map((stage) => stage.year), [1, 2, 3, 4]);
  }
});

test('career milestone IDs resolve deterministically to roadmap items', () => {
  const id = milestoneId('computing_engineering', 3, 1);
  const milestone = findMilestone('computing_engineering', id);

  assert.equal(milestone.year, 3);
  assert.equal(milestone.index, 1);
  assert.equal(milestone.item.label, 'Submit FYP milestone code for review');
  assert.equal(findMilestone('computing_engineering', 'unknown'), null);
});

test('Head of Programme review scope is limited to assigned programmes', () => {
  const actor = {
    role: 'HEAD_OF_PROGRAMME',
    demo: false,
    identity: {
      user: { role: 'HEAD_OF_PROGRAMME' },
      assignments: [{ role: 'HEAD_OF_PROGRAMME', scopeType: 'PROGRAMME', scopeValue: 'programme-1' }],
    },
  };

  assert.deepEqual(reviewerWhere(actor), { student: { programmeId: 'programme-1' } });
  assert.equal(canReviewStudent(actor, { programmeId: 'programme-1', facultyId: 'faculty-1' }), true);
  assert.equal(canReviewStudent(actor, { programmeId: 'programme-2', facultyId: 'faculty-1' }), false);
});

test('global reviewer role can review any student without a student profile', () => {
  const actor = {
    role: 'CPDC_ADMIN',
    demo: false,
    identity: { user: { role: 'CPDC_ADMIN' }, assignments: [] },
  };

  assert.deepEqual(reviewerWhere(actor), {});
  assert.equal(canReviewStudent(actor, { programmeId: 'programme-2', facultyId: 'faculty-1' }), true);
});

test('demo staff falls back to the seeded student scope instead of becoming global', () => {
  const actor = {
    role: 'HEAD_OF_PROGRAMME',
    demo: true,
    student: { programmeId: 'programme-demo', facultyId: 'faculty-demo' },
    identity: null,
  };

  assert.deepEqual(reviewerWhere(actor), { student: { programmeId: 'programme-demo' } });
  assert.equal(canReviewStudent(actor, { programmeId: 'programme-other', facultyId: 'faculty-demo' }), false);
});
