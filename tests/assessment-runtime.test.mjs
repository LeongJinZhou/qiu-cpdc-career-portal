import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canAuthorAssessments,
  canReadAssessments,
  parseAssessmentText,
  scoreAssessment,
} from '../lib/assessment.js';

test('runtime assessment import keeps explicit metadata and answer keys', () => {
  const assessment = parseAssessmentText(`
    Title: Medicine Communication Baseline
    Instructions: Choose one answer for every question.
    Time: 20 minutes
    Pass mark: 70%
    1. Category: Clinical Communication
    A patient asks a difficult question. You should:
    A. Use dense jargon.
    B. Give a clear, empathetic explanation.
    C. Avoid the question.
    Answer: B
    2. Which statement is true?
    A. True
    B. False
    Answer: A
  `);

  assert.equal(assessment.title, 'Medicine Communication Baseline');
  assert.equal(assessment.passMark, 0.7);
  assert.equal(assessment.timeLimitMinutes, 20);
  assert.equal(assessment.questions.length, 2);
  assert.equal(assessment.questions[0].correctOptionIndexes[0], 1);
  assert.equal(assessment.questions[0].category, 'Clinical Communication');
  assert.equal(assessment.questions[1].type, 'TRUE_FALSE');
});

test('runtime assessment import refuses a missing explicit answer', () => {
  assert.throws(
    () => parseAssessmentText('1. Pick one\nA. First\nB. Second'),
    (error) => error.code === 'ASSESSMENT_PARSE_FAILED' && /Answer/i.test(error.details?.[0] ?? error.message),
  );
});

test('assessment scoring uses points and returns no correct answer text', () => {
  const questions = [
    { id: 'q1', points: 2, correctOptionIndexes: [1] },
    { id: 'q2', points: 1, correctOptionIndexes: [0] },
  ];
  const result = scoreAssessment(questions, { q1: 1, q2: 1 });
  assert.equal(result.score, 2 / 3);
  assert.equal(result.earned, 2);
  assert.equal(result.points, 3);
  assert.equal(result.breakdown[0].correct, true);
  assert.equal(result.breakdown[1].correct, false);
  assert.equal('correctOptionIndexes' in result.breakdown[0], false);
});

test('assessment roles are explicit: students read published work, staff author', () => {
  assert.equal(canAuthorAssessments('CPDC_ADMIN'), true);
  assert.equal(canAuthorAssessments('ACADEMIC_SUPERVISOR'), true);
  assert.equal(canAuthorAssessments('STUDENT'), false);
  assert.equal(canReadAssessments('STUDENT'), true);
  assert.equal(canReadAssessments('EMPLOYER'), false);
});
