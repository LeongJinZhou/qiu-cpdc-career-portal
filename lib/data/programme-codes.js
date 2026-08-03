// Resolve a student's programme (and therefore faculty) from the short course
// code read out of their Google directory profile (Module 16), e.g. "BCS" ->
// "Bachelor of Computer Science (Honours)" in the Faculty of Computing.
//
// Pure functions over plain programme rows so the matching is unit-testable
// without a database. The route supplies the rows from Prisma.

// Words that carry no signal for an initialism.
const STOPWORDS = new Set(['of', 'the', 'and', 'in', 'with', 'a', 'for', 'to']);

/**
 * Derive a programme's initialism from its name, e.g.
 * "Bachelor of Computer Science (Honours)" -> "BCS".
 * Parentheticals and trailing qualifiers are dropped; stopwords are skipped.
 */
export function programmeInitials(name) {
  const cleaned = String(name ?? '')
    .replace(/\([^)]*\)/g, ' ') // drop "(Honours)", "(MBBS)", etc.
    .replace(/[^A-Za-z\s]/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned
    .split(/\s+/)
    .filter((word) => word && !STOPWORDS.has(word.toLowerCase()))
    .map((word) => word[0].toUpperCase())
    .join('');
}

function normalizeCode(value) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Find the single programme matching a course code.
 *   1. An explicit programme.code wins (authoritative QIU code).
 *   2. Otherwise the initials of the programme name, but only when EXACTLY one
 *      programme matches — an ambiguous initialism resolves to null rather than
 *      guessing wrong.
 * Returns the matched programme row, or null.
 *
 * @param {string} courseCode
 * @param {Array<{id:string,name:string,code?:string|null,facultyId:string}>} programmes
 */
export function matchProgrammeByCourseCode(courseCode, programmes = []) {
  const target = normalizeCode(courseCode);
  if (!target) return null;
  const rows = Array.isArray(programmes) ? programmes : [];

  const byExplicit = rows.filter((p) => p.code && normalizeCode(p.code) === target);
  if (byExplicit.length === 1) return byExplicit[0];
  if (byExplicit.length > 1) return null; // configured ambiguously; do not guess

  const byInitials = rows.filter((p) => normalizeCode(programmeInitials(p.name)) === target);
  return byInitials.length === 1 ? byInitials[0] : null;
}
