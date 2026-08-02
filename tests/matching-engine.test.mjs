import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMatch, rankByMatch } from '../lib/matching.js';

test('Context-Aware Recommendation Engine: strict discipline isolation for Medical vs Computing students', () => {
  const dataScienceWorkshop = {
    id: 'ws-ds-101',
    title: 'Advanced Data Science & Machine Learning Bootcamp',
    faculty: 'computing_engineering',
    programmes: ['Bachelor of Computer Science (Honours)', 'Bachelor of Data Science (Honours)'],
    tags: ['Artificial Intelligence', 'Python', 'Machine Learning'],
    summary: 'Deep practical session on machine learning pipelines and big data infrastructure.'
  };

  const medicalStudent = {
    facultyId: 'medicine',
    facultyName: 'Faculty of Medicine & Health Sciences',
    programme: 'Bachelor of Medicine & Bachelor of Surgery (MBBS)',
    year: 2,
    interests: 'clinical epidemiology patient care healthcare medicine',
    gapTags: ['Clinical Diagnostics', 'Patient Communication']
  };

  const matchResult = computeMatch(dataScienceWorkshop, medicalStudent);
  
  // Verify that a medical student never gets an inflated match score (e.g. 70%) for Data Science
  assert.equal(matchResult.matched.faculty, false, 'Faculty match should evaluate to false');
  assert.equal(matchResult.recommended, false, 'Should not be recommended for a medical student');
  assert.ok(matchResult.score <= 15, `Match score should be capped at <=15% for cross-faculty mismatch, got ${matchResult.score}%`);
});

test('Context-Aware Recommendation Engine: dynamic matching when switching study major to Medicine', () => {
  const clinicalWorkshop = {
    id: 'ws-clin-201',
    title: 'Clinical Research Methodology & Hospital Residency Prep',
    faculty: 'medicine',
    programmes: ['Bachelor of Medicine & Bachelor of Surgery (MBBS)'],
    tags: ['Clinical Skills', 'Research', 'Hospitality'],
    summary: 'Essential preparation for hospital clinical rotations and diagnostic trials.'
  };

  const codingWorkshop = {
    id: 'ws-code-301',
    title: 'Python Cloud Architecture & DevOps Masterclass',
    faculty: 'computing_engineering',
    programmes: ['Bachelor of Computer Science (Honours)'],
    tags: ['Cloud', 'Programming', 'DevOps'],
    summary: 'Deploying robust cloud server architectures for software engineering.'
  };

  // 1. Initial State: Student is in Computer Science
  const student = {
    facultyId: 'computing_engineering',
    facultyName: 'Faculty of Computing & Engineering',
    programme: 'Bachelor of Computer Science (Honours)',
    year: 3,
    interests: 'cloud systems development programming'
  };

  let ranked = rankByMatch([clinicalWorkshop, codingWorkshop], student);
  assert.equal(ranked[0].id, 'ws-code-301', 'Coding workshop should rank #1 for Computer Science student');
  assert.ok(ranked[0].score >= 70, `Coding workshop should be heavily recommended (score >= 70%), got ${ranked[0].score}%`);
  assert.ok(ranked[1].score <= 15, `Clinical workshop should be heavily dampened (<=15%), got ${ranked[1].score}%`);

  // 2. Switched State: Student switches major to Medicine (MBBS)
  const switchedStudent = {
    ...student,
    facultyId: 'medicine',
    facultyName: 'Faculty of Medicine & Health Sciences',
    programme: 'Bachelor of Medicine & Bachelor of Surgery (MBBS)',
    interests: 'hospital clinical rotations patient trials'
  };

  ranked = rankByMatch([clinicalWorkshop, codingWorkshop], switchedStudent);
  assert.equal(ranked[0].id, 'ws-clin-201', 'Clinical workshop should instantly rise to #1 rank upon switching to Medicine');
  assert.ok(ranked[0].score >= 70, `Clinical workshop match score should jump above 70%, got ${ranked[0].score}%`);
  assert.ok(ranked[1].score <= 15, `Coding workshop should instantly drop to <=15% upon switching to Medicine, got ${ranked[1].score}%`);
});

test('Context-Aware Recommendation Engine: open university-wide events remain accessible to all disciplines', () => {
  const openEvent = {
    id: 'evt-career-fair',
    title: 'Annual University Global Career Fair & Resume Clinic',
    faculty: 'all', // Open to all faculties
    tags: ['Career Planning', 'Resume', 'Networking'],
    summary: 'Campus-wide career fair featuring employers from all industries.'
  };

  const lawStudent = {
    facultyId: 'law_humanities',
    programme: 'Bachelor of Laws (Honours)',
    year: 3,
    interests: 'legal arbitration advocacy corporate law'
  };

  const result = computeMatch(openEvent, lawStudent);
  assert.ok(result.score >= 50, `Open university-wide event should maintain strong baseline score for all students, got ${result.score}%`);
});
