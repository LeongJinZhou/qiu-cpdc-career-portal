import test from 'node:test';
import assert from 'node:assert/strict';

import { parseLinkedInLines } from '../../lib/profile/linkedin-pdf.js';

// Lines as the extractor produces them from LinkedIn's "Save to PDF" layout:
// a narrow left sidebar (Contact, Top Skills, Languages, Certifications,
// Honors-Awards) and a main column (name, headline, location, Summary,
// Experience, Education). Sizes follow LinkedIn's typography: name 26,
// section headings 15-16, company 12, role title 11.5, body 10.5.
const side = (text, size = 10.5) => ({ text, size, column: 'side' });
const main = (text, size = 10.5) => ({ text, size, column: 'main' });

const PROFILE = [
  side('Contact', 13),
  side('aina@example.com'),
  side('www.linkedin.com/in/aina-rahman (LinkedIn)'),
  side('Top Skills', 13),
  side('Python'),
  side('Data Analysis'),
  side('Public Speaking'),
  side('Languages', 13),
  side('Malay (Native or Bilingual)'),
  side('English (Professional Working Proficiency)'),
  side('Certifications', 13),
  side('Google Data Analytics Certificate'),
  side('Honors-Awards', 13),
  side("Dean's List 2023"),

  main('Aina Rahman', 26),
  main('Computer Science student at QIU | Data and AI', 12),
  main('Ipoh, Perak, Malaysia', 10.5),
  main('Summary', 16),
  main('I build data tools for small businesses.'),
  main('Looking for a data internship in 2026.'),
  main('Experience', 16),
  main('Petronas', 12),
  main('2 years 1 month', 10.5),
  main('Data Intern', 11.5),
  main('June 2025 - Present (6 months)', 10.5),
  main('Kuala Lumpur, Malaysia', 10.5),
  main('Built dashboards for the operations team.'),
  main('Student Assistant', 11.5),
  main('January 2024 - May 2025 (1 year 5 months)', 10.5),
  main('Helped run lab sessions.'),
  main('QIU Robotics Club', 12),
  main('President', 11.5),
  main('2023 - 2024 (1 year)', 10.5),
  main('Led a team of 20 members.'),
  main('Education', 16),
  main('Quest International University', 12),
  main('Bachelor of Computer Science, Artificial Intelligence · (2022 - 2026)', 10.5),
  main('SMK Ipoh', 12),
  main('SPM · (2016 - 2021)', 10.5),
  main('Page 1 of 2', 9),
];

test('reads name, headline and location from the header', () => {
  const parsed = parseLinkedInLines(PROFILE);
  assert.equal(parsed.name, 'Aina Rahman');
  assert.equal(parsed.headline, 'Computer Science student at QIU | Data and AI');
  assert.equal(parsed.location, 'Ipoh, Perak, Malaysia');
});

test('reads the summary as one paragraph', () => {
  assert.equal(
    parseLinkedInLines(PROFILE).summary,
    'I build data tools for small businesses. Looking for a data internship in 2026.',
  );
});

test('reads the sidebar lists', () => {
  const parsed = parseLinkedInLines(PROFILE);
  assert.deepEqual(parsed.skills, ['Python', 'Data Analysis', 'Public Speaking']);
  assert.deepEqual(parsed.languages, ['Malay (Native or Bilingual)', 'English (Professional Working Proficiency)']);
  assert.deepEqual(parsed.certifications, ['Google Data Analytics Certificate']);
  assert.deepEqual(parsed.honors, ["Dean's List 2023"]);
});

test('reads every role, including two roles at one company', () => {
  const { experience } = parseLinkedInLines(PROFILE);
  assert.deepEqual(experience, [
    {
      title: 'Data Intern',
      organisation: 'Petronas',
      startDate: 'June 2025',
      endDate: 'Present',
      description: 'Built dashboards for the operations team.',
    },
    {
      title: 'Student Assistant',
      organisation: 'Petronas',
      startDate: 'January 2024',
      endDate: 'May 2025',
      description: 'Helped run lab sessions.',
    },
    {
      title: 'President',
      organisation: 'QIU Robotics Club',
      startDate: '2023',
      endDate: '2024',
      description: 'Led a team of 20 members.',
    },
  ]);
});

test('reads education entries with degree and years', () => {
  assert.deepEqual(parseLinkedInLines(PROFILE).education, [
    { title: 'Bachelor of Computer Science, Artificial Intelligence', organisation: 'Quest International University', startDate: '2022', endDate: '2026', description: '' },
    { title: 'SPM', organisation: 'SMK Ipoh', startDate: '2016', endDate: '2021', description: '' },
  ]);
});

test('a page that is not a LinkedIn profile yields an empty result, not a throw', () => {
  const parsed = parseLinkedInLines([main('Invoice #123', 14), main('Total: RM 50')]);
  assert.equal(parsed.looksLikeLinkedIn, false);
  assert.deepEqual(parsed.experience, []);
  assert.equal(parseLinkedInLines([]).looksLikeLinkedIn, false);
});

test('a long About is cut to the 1200-character bio limit at a word boundary', () => {
  const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
  const parsed = parseLinkedInLines([main('Aina Rahman', 26), main('Summary', 16), main(words)]);
  assert.ok(parsed.summary.length <= 1200, String(parsed.summary.length));
  assert.match(parsed.summary, /word\d+$/);
});

test('a job title that wraps onto two lines stays one title under the right company', () => {
  const { experience } = parseLinkedInLines([
    main('Aina Rahman', 26),
    main('Experience', 16),
    main('Old Co', 12),
    main('Intern', 11.5),
    main('2022 - 2023 (1 year)'),
    main('Did things.'),
    main('Petronas', 12),
    main('Senior Data Analytics Intern, Upstream', 11.5),
    main('Operations', 11.5),
    main('June 2025 - Present (6 months)'),
    main('Built dashboards.'),
  ]);
  assert.equal(experience.length, 2);
  assert.equal(experience[0].description, 'Did things.');
  assert.equal(experience[1].organisation, 'Petronas');
  assert.equal(experience[1].title, 'Senior Data Analytics Intern, Upstream Operations');
});

test('a short first description line is kept unless it looks like a place', () => {
  const { experience } = parseLinkedInLines([
    main('Aina Rahman', 26),
    main('Experience', 16),
    main('Petronas', 12),
    main('Data Intern', 11.5),
    main('June 2025 - Present (6 months)'),
    main('Built dashboards for ops'),
    main('Cut report time by half.'),
  ]);
  assert.equal(experience[0].description, 'Built dashboards for ops Cut report time by half.');
});

test('the real profile is recognised', () => {
  assert.equal(parseLinkedInLines(PROFILE).looksLikeLinkedIn, true);
});
