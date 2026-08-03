import test from 'node:test';
import assert from 'node:assert/strict';

import { PATHWAY_STAGES, buildPathway, yearMilestones } from '../lib/pathway.js';

const faculty = { id: 'computing_engineering', name: 'Faculty of Computing and Engineering' };

const freshStudent = { year: 1 };

const completeOnboarding = {
  identityConfirmed: true,
  missingProviders: [],
  connectedProviders: ['LINKEDIN', 'GITHUB'],
};

test('a brand-new student is at Set up, with a real next step', () => {
  const pathway = buildPathway({
    student: freshStudent,
    activeFaculty: faculty,
    onboarding: { identityConfirmed: false, missingProviders: ['LINKEDIN'], connectedProviders: [] },
  });

  assert.equal(pathway.currentStageId, 'setup');
  assert.equal(pathway.nextStep.id, 'identity');
  assert.equal(pathway.percent, 0);
});

test('finishing onboarding moves the student to Discover', () => {
  const pathway = buildPathway({
    student: freshStudent,
    activeFaculty: faculty,
    onboarding: completeOnboarding,
  });

  assert.equal(pathway.currentStageId, 'discover');
  assert.equal(pathway.nextStep.id, 'diagnostic', 'the diagnostic is the first hard step after setup');
});

test('a soft checkpoint never holds the student back a stage', () => {
  // "Add your goals and bio" is unset, but it is soft — the student should be
  // advanced to Discover rather than parked in Set up over an optional field.
  const pathway = buildPathway({
    student: { year: 1, bio: '', careerTargets: '' },
    activeFaculty: faculty,
    onboarding: completeOnboarding,
  });

  assert.equal(pathway.currentStageId, 'discover');
  assert.notEqual(pathway.nextStep.id, 'profile');
});

test('a soft checkpoint IS offered once nothing substantive is outstanding', () => {
  const pathway = buildPathway({
    student: {
      year: 4,
      diagnosticResult: { score: 70 },
      workshopAttendance: [{ id: 'w1' }],
      badges: [{ category: 'Course', title: 'Applied ML' }],
      logbookEntries: [{ status: 'APPROVED' }],
      resumeSummary: 'Final-year computer science student',
      fypSubmission: { title: 'Thing' },
      publicTalent: true,
    },
    activeFaculty: faculty,
    onboarding: completeOnboarding,
  });

  assert.ok(pathway.nextStep, 'still suggests something');
  assert.equal(pathway.nextStep.soft, true, 'and what remains is a soft item');
});

test('a Year 1 student is not held to the FYP', () => {
  const pathway = buildPathway({
    student: freshStudent,
    activeFaculty: faculty,
    onboarding: completeOnboarding,
  });

  const fyp = pathway.stages
    .flatMap((stage) => stage.items)
    .find((item) => item.id === 'fyp');

  assert.equal(fyp.upcoming, true, 'shown as coming up, not outstanding');
  // And it must not drag the completion percentage down.
  const applicable = pathway.total;
  assert.ok(applicable < pathway.stages.flatMap((s) => s.items).length);
});

test('a Year 3 student IS held to the FYP', () => {
  const pathway = buildPathway({
    student: { ...freshStudent, year: 3 },
    activeFaculty: faculty,
    onboarding: completeOnboarding,
  });

  const fyp = pathway.stages.flatMap((stage) => stage.items).find((item) => item.id === 'fyp');
  assert.equal(fyp.upcoming, false);
});

test('a fully evidenced student reaches Launch at 100%', () => {
  const pathway = buildPathway({
    student: {
      year: 4,
      bio: 'Final-year student',
      careerTargets: 'Software engineer',
      diagnosticResult: { score: 80 },
      workshopAttendance: [{ id: 'w1' }],
      badges: [{ category: 'Course', title: 'Applied ML' }],
      logbookEntries: [{ status: 'APPROVED' }],
      resumeSummary: 'Summary',
      fypSubmission: { title: 'Capstone' },
      publicTalent: true,
      mentorConnections: [{ id: 'm1' }],
    },
    activeFaculty: faculty,
    onboarding: completeOnboarding,
    selfReportedMilestones: ['computing_engineering-4-0'],
  });

  assert.equal(pathway.currentStageId, 'launch');
  assert.equal(pathway.percent, 100);
  assert.equal(pathway.nextStep, null);
});

test('stages report their own progress and exactly one is current', () => {
  const pathway = buildPathway({
    student: freshStudent,
    activeFaculty: faculty,
    onboarding: completeOnboarding,
  });

  assert.equal(pathway.stages.length, PATHWAY_STAGES.length);
  assert.equal(pathway.stages.filter((stage) => stage.current).length, 1);
  // Set up is PAST but not COMPLETE: its hard checkpoints are met, while the
  // soft "add your goals and bio" is still open. The two flags are deliberately
  // different — a student moves on without being told they finished something
  // they did not, and the outstanding soft item stays visible inside the
  // collapsed stage rather than being erased.
  assert.equal(pathway.stages[0].past, true, 'collapses by default');
  assert.equal(pathway.stages[0].complete, false, 'but is not claimed as complete');
  assert.equal(pathway.stages[0].done, 2);
  assert.equal(pathway.stages[0].total, 3);
  assert.equal(pathway.stages[1].current, true);
  assert.equal(pathway.stages[1].past, false);
});

test('the pathway degrades gracefully with no data at all', () => {
  const pathway = buildPathway();
  assert.equal(pathway.year, 1);
  assert.ok(Array.isArray(pathway.stages));
  assert.equal(pathway.stages.length, PATHWAY_STAGES.length);
});

test('year milestones resolve against the real faculty roadmap', () => {
  const result = yearMilestones('computing_engineering', 1, []);
  assert.ok(result.total > 0, 'the computing Year 1 stage has items');
  assert.equal(result.done, 0);
  assert.ok(result.items.every((item) => typeof item.id === 'string' && item.id.length > 0));
  assert.ok(result.items.every((item) => typeof item.href === 'string'));
});

test('self-reported milestones are reflected', () => {
  const first = yearMilestones('computing_engineering', 1, []).items[0];
  const result = yearMilestones('computing_engineering', 1, [first.id]);
  assert.equal(result.done, 1);
  assert.equal(result.items[0].done, true);
});

test('an unknown faculty does not throw', () => {
  const result = yearMilestones('not_a_faculty', 1, []);
  assert.equal(result.total, 0);
  assert.equal(result.stage, null);
});
