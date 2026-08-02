// Shared, explainable match scoring.
//
// One scorer for every "is this relevant to this student?" question in the
// platform: workshops and events (Module 3), external courses (Module 6),
// employer/candidate matching (Module 10). It is deliberately deterministic —
// a student can always be shown exactly why something was recommended, and an
// admin can retune the weights from Settings without touching a component.
//
// The rule the blueprint sets (§9.2): matching **ranks and explains**, it never
// hides. Callers should sort by `score` and surface `why`, not filter.
//
// ---------------------------------------------------------------------------
// PUBLIC API (stable — other modules depend on this)
// ---------------------------------------------------------------------------
//
//   computeMatch(target, profile, options?) -> MatchResult
//   rankByMatch(targets, profile, options?) -> Array<target & { match }>
//   profileFromStudent(student, faculty?)   -> MatchProfile
//   workshopMatch(workshop, legacyOptions?) -> MatchResult   (legacy wrapper)
//   DEFAULT_MATCH_WEIGHTS, RECOMMENDED_THRESHOLD
//
// Target (an event, course, job — any subset of these fields):
//   {
//     facultyId | faculty | facultyIds: string | string[]  // empty = open to all
//     programmes: string[]        // eligible programme names, empty = any
//     years: number[]             // eligible study years, empty = any
//     tags: string[]
//     title, summary, category, level
//   }
//
// Profile (the student the target is being scored against):
//   {
//     facultyId, facultyName, facultyCode,
//     programme: string,
//     year: number,
//     interests: string | string[],   // free text is fine
//     gapTags: string[],              // from the skills diagnostic
//     skills: string[],
//   }
//
// MatchResult:
//   {
//     score: number,          // 1-99
//     recommended: boolean,   // strong enough to badge "Recommended for you"
//     reasons: string[],      // short phrases, e.g. "your faculty"
//     why: string,            // one-line sentence built from the real inputs
//     signals: Signal[],      // per-dimension detail, see below
//     matched: { faculty, programme, year, interest }  // booleans
//   }
//
// Signal:
//   { key, label, matched, weight, detail, terms: string[] }
//
// ---------------------------------------------------------------------------

/** Fallback weights when Settings has not been configured. Read as percentages. */
export const DEFAULT_MATCH_WEIGHTS = { faculty: 40, programme: 30, year: 20, interest: 10 };

/** At or above this score, with at least one real signal, we badge it as recommended. */
export const RECOMMENDED_THRESHOLD = 70;

/** Score given to a dimension that misses — a miss dampens, it never zeroes. */
const MISS_BASELINE = { faculty: 38, programme: 42, year: 65, interest: 45 };

/** Score for a dimension the target leaves open (no faculty/year restriction). */
const OPEN_BASELINE = { faculty: 62, programme: 58, year: 78, interest: 45 };

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'your', 'you', 'our', 'are', 'was',
  'bachelor', 'honours', 'honors', 'master', 'degree', 'programme', 'program',
  'workshop', 'session', 'talk', 'series', 'university', 'student', 'students',
]);

/** Lower-cased, de-noised word list. Keeps `c++`, `.net`, `ai` style tokens. */
function words(value) {
  const source = Array.isArray(value) ? value.join(' ') : value;
  return String(source ?? '')
    .toLowerCase()
    .split(/[^a-z0-9+#.-]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

function unique(list) {
  return [...new Set(list)];
}

/**
 * "Bachelor of Computer Science (Honours)" -> "Computer Science".
 * Used in the "why this matches you" sentence, which has to read like a person
 * wrote it rather than like a database row.
 */
export function shortProgrammeName(programme) {
  return String(programme ?? '')
    .replace(/\(hons?\.?\)|\(honours\)|\(honors\)/gi, '')
    .replace(/^(bachelor|master|diploma|foundation|doctor)\s+(of|in)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The faculty ids a target is aimed at. Empty array = open to every faculty. */
function targetFaculties(target) {
  return unique([
    ...toArray(target.facultyIds),
    ...toArray(target.facultyId),
    ...toArray(target.faculty),
    ...toArray(target.alsoFor),
  ].filter((id) => typeof id === 'string'));
}

/** All free text on a target that a tag/interest can legitimately match against. */
function targetText(target) {
  return [
    target.title,
    target.summary,
    target.description,
    target.category,
    ...toArray(target.tags),
    ...toArray(target.programmes),
  ].filter(Boolean).join(' ');
}

/** Title-case a matched token back into something presentable in a sentence. */
function pretty(term) {
  return String(term).charAt(0).toUpperCase() + String(term).slice(1);
}

/**
 * Score one target against one profile.
 *
 * @param {object} target  event / course / job — see the field list at the top.
 * @param {object} profile student profile — see the field list at the top.
 * @param {{weights?: object}} [options] weights normally come from
 *        `settings.matchWeights`; missing keys fall back to the defaults.
 * @returns {object} MatchResult
 */
export function computeMatch(target = {}, profile = {}, options = {}) {
  const weights = { ...DEFAULT_MATCH_WEIGHTS, ...(options.weights ?? {}) };
  const totalWeight =
    Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0) || 1;

  const text = targetText(target);
  const textWords = words(text);
  const textWordSet = new Set(textWords);

  // --- faculty -------------------------------------------------------------
  const faculties = targetFaculties(target);
  const facultyOpen = faculties.length === 0 || faculties.includes('all');
  const facultyMatch = !facultyOpen && Boolean(profile.facultyId) && faculties.includes(profile.facultyId);

  // --- programme -----------------------------------------------------------
  const programme = String(profile.programme ?? '');
  const programmeWords = new Set(words(programme));
  const listedProgrammes = toArray(target.programmes).map((p) => String(p).toLowerCase());
  const programmeListed = listedProgrammes.length > 0;
  const programmeExact = programmeListed && listedProgrammes.some((p) => {
    const a = p.trim();
    const b = programme.toLowerCase().trim();
    return Boolean(a) && Boolean(b) && (a === b || a.includes(b) || b.includes(a));
  });
  const programmeTerms = textWords.filter((word) => programmeWords.has(word));
  const programmeMatch = programmeExact || (!programmeListed && programmeTerms.length > 0);

  // --- year ----------------------------------------------------------------
  const year = Number(profile.year);
  const listedYears = toArray(target.years).map(Number).filter((n) => !Number.isNaN(n));
  const yearListed = listedYears.length > 0;
  const seniorSignal = /(career|interview|placement|industry|advanced|masterclass|professional|graduate|postgraduate|research)/i.test(text);
  const yearMatch = yearListed
    ? (!Number.isNaN(year) && listedYears.includes(year))
    : (!Number.isNaN(year) && year >= 3 && seniorSignal);

  // --- interests & diagnostic gaps ----------------------------------------
  const gapTags = toArray(profile.gapTags);
  const gapTerms = unique(
    gapTags.filter((tag) => words(tag).some((word) => textWordSet.has(word))),
  );
  const interestWordSet = new Set(words([
    ...toArray(profile.interests),
    ...toArray(profile.skills),
  ].join(' ')));
  const interestTerms = unique(textWords.filter((word) => interestWordSet.has(word)));
  const interestMatch = gapTerms.length > 0 || interestTerms.length > 0;

  // --- weighted score ------------------------------------------------------
  const dimension = (key, matched, open) => {
    if (open) return OPEN_BASELINE[key];
    return matched ? 100 : MISS_BASELINE[key];
  };

  const raw = (
    dimension('faculty', facultyMatch, facultyOpen) * weights.faculty
    + dimension('programme', programmeMatch, false) * weights.programme
    + dimension('year', yearMatch, !yearListed && Number.isNaN(year)) * weights.year
    + dimension('interest', interestMatch, false) * weights.interest
  ) / totalWeight;

  let score = Math.max(1, Math.min(99, Math.round(raw)));

  // Strict Context-Aware Faculty & Discipline Isolation:
  // Prevent misleading match percentages (e.g. showing a Medical student a 70% match for Data Science).
  // When an item is explicitly assigned to specific faculties and the student's active faculty misses,
  // cap the match score so it clearly reads as an interdisciplinary elective rather than a tailored course.
  if (!facultyMatch && !facultyOpen && Boolean(profile.facultyId)) {
    const maxScore = interestMatch ? 25 : 15;
    score = Math.min(score, maxScore);
  }

  // --- signals -------------------------------------------------------------
  const facultyLabel = profile.facultyName || profile.facultyCode || 'your faculty';
  const signals = [
    {
      key: 'faculty',
      label: 'Faculty',
      matched: facultyMatch,
      open: facultyOpen,
      weight: weights.faculty,
      terms: faculties,
      detail: facultyOpen
        ? 'Open to every faculty'
        : facultyMatch
          ? `Run for ${facultyLabel}`
          : 'Hosted by another faculty — still open to you',
    },
    {
      key: 'programme',
      label: 'Programme',
      matched: programmeMatch,
      open: false,
      weight: weights.programme,
      terms: programmeExact ? [programme] : programmeTerms,
      detail: programmeMatch
        ? `Aimed at ${shortProgrammeName(programme) || 'your programme'}`
        : 'Not programme-specific',
    },
    {
      key: 'year',
      label: 'Year',
      matched: yearMatch,
      open: !yearListed,
      weight: weights.year,
      terms: listedYears.map(String),
      detail: yearListed
        ? `For Year ${listedYears.join(', ')}`
        : yearMatch
          ? `Suited to Year ${year} timing`
          : 'All years welcome',
    },
    {
      key: 'interest',
      label: 'Interests',
      matched: interestMatch,
      open: false,
      weight: weights.interest,
      terms: [...gapTerms, ...interestTerms],
      detail: interestMatch
        ? `Covers ${[...gapTerms, ...interestTerms.map(pretty)].slice(0, 2).join(' and ')}`
        : 'No overlap with your listed interests yet',
    },
  ];

  // --- short reason phrases (kept for existing callers) --------------------
  const reasons = [];
  if (facultyMatch) reasons.push('your faculty');
  else if (facultyOpen) reasons.push('open to every faculty');
  if (programmeMatch) reasons.push('your programme');
  if (gapTerms.length) reasons.push(`your ${gapTerms.slice(0, 2).join(' / ')} growth area`);
  else if (interestTerms.length) reasons.push(`your ${interestTerms.slice(0, 2).map(pretty).join(' / ')} focus`);
  if (yearMatch) reasons.push(Number.isNaN(year) ? 'your study stage' : `Year ${year} timing`);
  if (!reasons.length) reasons.push('your broader career journey');

  // --- the one-line "why this matches you" --------------------------------
  const clauses = [];
  const shortProgramme = shortProgrammeName(programme);
  if ((programmeMatch || facultyMatch) && shortProgramme) {
    clauses.push(
      Number.isNaN(year)
        ? `you're studying ${shortProgramme}`
        : `you're in ${shortProgramme} Year ${year}`,
    );
  } else if (facultyMatch) {
    clauses.push(`it's run by ${facultyLabel}`);
  }
  if (gapTerms.length) {
    clauses.push(`your last diagnostic test flagged ${gapTerms.slice(0, 2).join(' and ')} as a growth area`);
  } else if (interestTerms.length) {
    clauses.push(`you listed ${interestTerms.slice(0, 2).map(pretty).join(' and ')} among your interests`);
  }
  if (!clauses.length && yearMatch && !Number.isNaN(year)) {
    clauses.push(`it is scheduled for Year ${year} students`);
  }

  const why = clauses.length
    ? `Matched because: ${clauses.join(', and ')}.`
    : facultyOpen
      ? 'Open to every student — no faculty, programme or year filter is applied to this event.'
      : 'Shown because the full catalogue is always visible; nothing in your profile lines up with this one yet.';

  const recommended = score >= RECOMMENDED_THRESHOLD
    && (facultyMatch || programmeMatch || interestMatch);

  return {
    score,
    recommended,
    reasons,
    why,
    signals,
    matched: {
      faculty: facultyMatch,
      programme: programmeMatch,
      year: yearMatch,
      interest: interestMatch,
    },
  };
}

/**
 * Score a list and sort best-first, keeping every item.
 *
 * The sort is stable for equal scores (original order wins) so a catalogue does
 * not reshuffle on every render.
 *
 * @returns {Array} each input object spread with `{ match, score }`.
 */
export function rankByMatch(targets = [], profile = {}, options = {}) {
  return targets
    .map((target, index) => {
      const match = computeMatch(target, profile, options);
      return { ...target, match, score: match.score, _index: index };
    })
    .sort((a, b) => (b.score - a.score) || (a._index - b._index))
    .map(({ _index, ...rest }) => rest);
}

/**
 * Build a MatchProfile from the app's student object + active faculty.
 * Keeps every caller reading the same fields off the student record.
 */
export function profileFromStudent(student = {}, faculty = null) {
  return {
    facultyId: faculty?.id ?? student.facultyId,
    facultyName: faculty?.name,
    facultyCode: faculty?.code,
    programme: student.programme,
    year: student.year,
    interests: [student.careerTargets, student.industries].filter(Boolean).join(' '),
    gapTags: student.diagnosticResult?.gapTags ?? [],
    skills: student.skills ?? [],
  };
}

/**
 * Legacy wrapper kept so existing callers keep working unchanged.
 * Prefer `computeMatch(target, profile, { weights })` in new code.
 */
export function workshopMatch(workshop, { facultyId, programme, year, interests, gapTags, weights } = {}) {
  return computeMatch(
    workshop,
    { facultyId, programme, year, interests, gapTags },
    { weights },
  );
}
