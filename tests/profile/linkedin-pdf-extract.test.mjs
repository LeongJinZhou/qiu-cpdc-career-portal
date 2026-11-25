import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';

import { extractLinkedInLines, parseLinkedInLines } from '../../lib/profile/linkedin-pdf.js';

// Builds an A4 PDF with LinkedIn's two-column layout and runs the real
// extractor on it, so column split, line grouping and font sizes are covered
// end to end. A real LinkedIn export should still be tried by hand.
function buildProfilePdf() {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let sideY = 60;
  let mainY = 60;
  const side = (text, size = 10.5) => { doc.setFontSize(size); doc.text(text, 30, sideY); sideY += size + 8; };
  const main = (text, size = 10.5) => { doc.setFontSize(size); doc.text(text, 220, mainY); mainY += size + 8; };

  side('Contact', 13);
  side('aina@example.com');
  side('Top Skills', 13);
  side('Python');
  side('SQL');

  main('Aina Rahman', 26);
  main('Data student at QIU', 12);
  main('Ipoh, Malaysia');
  main('Summary', 16);
  main('I build data tools.');
  main('Experience', 16);
  main('Petronas', 12);
  main('Data Intern', 11.5);
  main('June 2025 - Present (6 months)');
  main('Built dashboards for operations.');
  main('Education', 16);
  main('Quest International University', 12);
  main('Bachelor of Computer Science · (2022 - 2026)');
  return Buffer.from(doc.output('arraybuffer'));
}

test('extracts and parses a two-column profile PDF', async () => {
  const parsed = parseLinkedInLines(await extractLinkedInLines(buildProfilePdf()));
  assert.equal(parsed.looksLikeLinkedIn, true);
  assert.equal(parsed.name, 'Aina Rahman');
  assert.equal(parsed.headline, 'Data student at QIU');
  assert.equal(parsed.summary, 'I build data tools.');
  assert.deepEqual(parsed.skills, ['Python', 'SQL']);
  assert.deepEqual(parsed.experience, [{
    title: 'Data Intern',
    organisation: 'Petronas',
    startDate: 'June 2025',
    endDate: 'Present',
    description: 'Built dashboards for operations.',
  }]);
  assert.equal(parsed.education[0].organisation, 'Quest International University');
  assert.equal(parsed.education[0].endDate, '2026');
});
