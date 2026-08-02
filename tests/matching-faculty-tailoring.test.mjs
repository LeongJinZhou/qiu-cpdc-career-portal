import test from 'node:test';
import assert from 'node:assert/strict';

import { computeMatch, profileFromStudent, RECOMMENDED_THRESHOLD } from '../lib/matching.js';

/**
 * Faculty tailoring regression suite.
 *
 * The reported defect: a Medicine student saw "70% match" on a Data Science
 * masterclass. A cross-faculty item must never reach recommendation strength,
 * or the score stops meaning anything and students stop trusting the badge.
 *
 * These assert the property across every faculty rather than the one reported
 * pairing, because the bug is a whole-engine property, not a Medicine quirk.
 */

const FACULTIES = [
  { id: 'computing_engineering', name: 'Faculty of Computing and Engineering', code: 'FITE', programme: 'Bachelor of Computer Science (Honours)' },
  { id: 'medicine', name: 'Faculty of Medicine', code: 'FOM', programme: 'Bachelor of Medicine & Bachelor of Surgery (MBBS)' },
  { id: 'pharmacy', name: 'Faculty of Pharmacy', code: 'FPH', programme: 'Bachelor of Pharmacy (Honours)' },
  { id: 'lifesciences', name: 'Faculty of Integrated Life Sciences', code: 'FILS', programme: 'Bachelor of Biomedical Science (Honours)' },
  { id: 'business', name: 'Faculty of Business', code: 'FOB', programme: 'Bachelor of Business Administration (Honours)' },
  { id: 'education', name: 'Faculty of Education & Social Sciences', code: 'FESS', programme: 'Bachelor of Psychology (Honours)' },
  { id: 'hospitality', name: 'Faculty of Hospitality & Tourism', code: 'FHT', programme: 'Bachelor of Hospitality Management (Honours)' },
  { id: 'communication', name: 'Communication Programme Area', code: 'CPA', programme: 'Bachelor of Communication (Honours)' },
];

/** One faculty-targeted event per faculty, so every cross pairing is testable. */
function eventForFaculty(faculty) {
  return {
    title: `${faculty.code} discipline masterclass`,
    faculty: faculty.id,
    tags: ['Discipline specific'],
    summary: `Run by ${faculty.name}.`,
  };
}

function studentOf(faculty, overrides = {}) {
  return profileFromStudent(
    { programme: faculty.programme, year: 3, skills: [], careerTargets: '', industries: '', ...overrides },
    faculty,
  );
}

test('a faculty-targeted event is strongly matched for its own faculty', () => {
  for (const faculty of FACULTIES) {
    const match = computeMatch(eventForFaculty(faculty), studentOf(faculty));
    assert.ok(
      match.score >= RECOMMENDED_THRESHOLD,
      `${faculty.code} should match its own event strongly, got ${match.score}%`,
    );
    assert.equal(match.matched.faculty, true);
  }
});

test('no cross-faculty event ever reaches recommendation strength', () => {
  for (const owner of FACULTIES) {
    const event = eventForFaculty(owner);
    for (const viewer of FACULTIES) {
      if (viewer.id === owner.id) continue;
      const match = computeMatch(event, studentOf(viewer));
      assert.ok(
        match.score < RECOMMENDED_THRESHOLD,
        `${viewer.code} viewing a ${owner.code} event scored ${match.score}% — a cross-faculty item must never look tailored`,
      );
      assert.equal(match.recommended, false);
    }
  }
});

test('the reported case: Medicine sees a Data Science masterclass as a low-scoring elective', () => {
  const dataScience = {
    title: 'Applied AI & Data Science Masterclass',
    faculty: 'computing_engineering',
    tags: ['Artificial Intelligence', 'Python', 'Deep Learning'],
  };
  const medic = studentOf(FACULTIES.find((f) => f.id === 'medicine'));
  const match = computeMatch(dataScience, medic);

  assert.ok(match.score <= 25, `expected an elective-level score, got ${match.score}%`);
  assert.equal(match.recommended, false);
  // It must still be visible and explained — matching ranks, it never hides.
  assert.match(match.why, /\S/);
  assert.equal(match.matched.faculty, false);
});

test('a shared interest lifts a cross-faculty item slightly but not into "recommended"', () => {
  const dataScience = {
    title: 'Applied AI & Data Science Masterclass',
    faculty: 'computing_engineering',
    tags: ['Artificial Intelligence', 'Python'],
  };
  const medicine = FACULTIES.find((f) => f.id === 'medicine');
  const curiousMedic = studentOf(medicine, { careerTargets: 'Clinical informatics and artificial intelligence' });

  const plain = computeMatch(dataScience, studentOf(medicine));
  const curious = computeMatch(dataScience, curiousMedic);

  assert.ok(curious.score >= plain.score, 'a declared interest should not lower the score');
  assert.ok(curious.score < RECOMMENDED_THRESHOLD, 'interest alone must not make it look tailored');
});

test('an event open to all faculties stays broadly relevant for everyone', () => {
  const openEvent = { title: 'CV clinic and interview practice', tags: ['Career'], summary: 'Open to all students.' };
  for (const faculty of FACULTIES) {
    const match = computeMatch(openEvent, studentOf(faculty));
    assert.ok(match.score > 25, `${faculty.code} should not see an open event as irrelevant, got ${match.score}%`);
  }
});

test('programme targeting distinguishes two programmes inside one faculty', () => {
  const mechatronics = {
    title: 'Robotics and control systems lab',
    faculty: 'computing_engineering',
    programmes: ['Bachelor of Mechatronics Engineering (Honours)'],
  };
  const csStudent = studentOf(FACULTIES.find((f) => f.id === 'computing_engineering'));
  const mechStudent = profileFromStudent(
    { programme: 'Bachelor of Mechatronics Engineering (Honours)', year: 3 },
    FACULTIES.find((f) => f.id === 'computing_engineering'),
  );

  const forMech = computeMatch(mechatronics, mechStudent);
  const forCs = computeMatch(mechatronics, csStudent);

  assert.equal(forMech.matched.programme, true);
  assert.equal(forCs.matched.programme, false);
  assert.ok(
    forMech.score > forCs.score,
    `programme targeting must separate two programmes in one faculty (${forMech.score}% vs ${forCs.score}%)`,
  );
});
