import test from 'node:test';
import assert from 'node:assert/strict';

import { alumniCsv, summarizeAlumni, toAlumniRow } from '../../lib/admin/alumni.js';

const NOW = new Date('2026-11-25T00:00:00Z');

function studentRecord(overrides = {}) {
  return {
    matricNo: 'QIU-202001-000001',
    alumniEligibleAt: new Date('2026-06-01'),
    lifecycleStatus: 'INTERNSHIP_COMPLETE',
    programme: { name: 'BSc Computer Science' },
    faculty: { name: 'Computing' },
    user: {
      name: 'Aina Rahman',
      email: 'aina@qiu.edu.my',
      role: 'ALUMNI',
      personalEmail: 'aina@gmail.com',
      linkedinLastSeenAt: new Date('2026-11-01'),
      lastSignInAt: new Date('2026-11-01'),
    },
    connectedAccounts: [
      { provider: 'LINKEDIN', method: 'OAUTH', providerUserId: 'li1', profileUrl: 'https://www.linkedin.com/in/aina' },
    ],
    ...overrides,
  };
}

test('maps a student record to an alumni row', () => {
  assert.deepEqual(toAlumniRow(studentRecord()), {
    name: 'Aina Rahman',
    matricNo: 'QIU-202001-000001',
    programme: 'BSc Computer Science',
    faculty: 'Computing',
    status: 'Alumni',
    qiuEmail: 'aina@qiu.edu.my',
    personalEmail: 'aina@gmail.com',
    linkedinLinked: true,
    linkedinUrl: 'https://www.linkedin.com/in/aina',
    linkedinLastSeenAt: '2026-11-01T00:00:00.000Z',
    lastSignInAt: '2026-11-01T00:00:00.000Z',
  });
});

test('a pasted LinkedIn link does not count as linked, and an eligible student is "Ready to graduate"', () => {
  const row = toAlumniRow(studentRecord({
    user: { name: 'B', email: 'b@qiu.edu.my', role: 'STUDENT' },
    connectedAccounts: [{ provider: 'LINKEDIN', method: 'VERIFIED_URL', profileUrl: 'https://www.linkedin.com/in/b' }],
  }));
  assert.equal(row.linkedinLinked, false);
  assert.equal(row.linkedinUrl, 'https://www.linkedin.com/in/b');
  assert.equal(row.status, 'Ready to graduate');
  assert.equal(row.personalEmail, null);
});

test('summary counts alumni, LinkedIn links and recent contact', () => {
  const rows = [
    toAlumniRow(studentRecord()),
    toAlumniRow(studentRecord({ connectedAccounts: [], user: { name: 'C', email: 'c@qiu.edu.my', role: 'ALUMNI' } })),
  ];
  assert.deepEqual(summarizeAlumni(rows, NOW), { total: 2, alumni: 2, linkedinLinked: 1, seenLast12Months: 1 });
});

test('CSV quotes every field and neutralises spreadsheet formulas', () => {
  const csv = alumniCsv([
    toAlumniRow(studentRecord({ user: { name: '=HYPERLINK("http://evil")', email: 'x@qiu.edu.my', role: 'ALUMNI', personalEmail: '+1 "quoted"' } })),
  ]);
  const [header, line] = csv.trim().split('\r\n');
  assert.match(header, /^"Name","Matric no"/);
  assert.match(line, /^"'=HYPERLINK\(""http:\/\/evil""\)"/);
  assert.match(line, /"'\+1 ""quoted"""/);
});
