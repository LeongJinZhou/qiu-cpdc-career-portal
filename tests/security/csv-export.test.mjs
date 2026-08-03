import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCsv, csvCell } from '../../lib/csv.js';

test('CSV export quotes cells and neutralizes spreadsheet formulas', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('Name, Faculty'), '"Name, Faculty"');
  assert.equal(csvCell('=HYPERLINK("https://evil.test")'), '"\'=HYPERLINK(""https://evil.test"")"');
  assert.equal(csvCell('  +SUM(A1:A2)'), "'  +SUM(A1:A2)");
});

test('CSV export uses friendly headers and preserves row order', () => {
  assert.equal(
    buildCsv(['name', 'score'], [{ name: 'Alex', score: '=1+1' }], { name: 'Name', score: 'Score' }),
    "Name,Score\nAlex,'=1+1",
  );
});
