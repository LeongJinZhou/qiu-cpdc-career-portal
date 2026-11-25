// Resume assembly + the §12.1 "Recheck" writing analyser.
//
// Two responsibilities, both deliberately kept out of the React component so
// they can be reasoned about (and later unit tested) on their own:
//
//   1. buildResume()  — turns one student record into the resume view of it.
//                       Auto entries are sourced from the same fields the
//                       workshop / logbook / FYP / diagnostics modules write,
//                       so the resume cannot drift from those modules.
//   2. analyseBullet() — a deterministic, on-device writing checker. There is
//                        NO language model behind this and the UI must not
//                        imply otherwise. Every score below is produced by
//                        inspecting the student's actual words.

import { tierFor } from '@/lib/xp';

/* ------------------------------------------------------------------ *
 * Templates
 * ------------------------------------------------------------------ */

export const CV_TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic ATS',
    blurb: 'Single column, no rules or shading. Safest for automated parsers.',
  },
  {
    id: 'impact',
    name: 'Impact',
    blurb: 'Same structure, with a crimson spine and heavier section headers.',
  },
  {
    id: 'compact',
    name: 'Compact',
    blurb: 'Tighter leading and inline dates — fits a longer record on one page.',
  },
];

export const MANUAL_SECTIONS = [
  { id: 'experience', label: 'Work experience' },
  { id: 'volunteering', label: 'Volunteering' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'education', label: 'Education' },
];

/* ------------------------------------------------------------------ *
 * Resume assembly
 * ------------------------------------------------------------------ */

function hoursFrom(entries = []) {
  return entries.reduce((total, entry) => total + Number(entry.hours || 0), 0);
}

/**
 * Auto-populated ("verified") entries.
 *
 * Each carries `source` + `sourceHref` because §9.3 forbids editing these on
 * the resume — the UI sends the student back to the module that owns the fact.
 */
export function verifiedEntries(student) {
  const entries = [];

  (student?.logbookEntries ?? []).forEach((log) => {
    entries.push({
      id: `log-${log.id}`,
      group: 'fieldwork',
      title: log.title,
      meta: `${log.date} • ${log.hours} logged hours • Supervisor: ${log.supervisor}`,
      detail: log.details,
      state: log.status === 'APPROVED' ? 'verified' : 'awaiting-approval',
      source: 'Logbook',
      sourceHref: '/logbook',
    });
  });

  const fyp = student?.fypSubmission;
  if (fyp) {
    entries.push({
      id: 'fyp',
      group: 'projects',
      title: `Final Year Project — ${fyp.title}`,
      meta: [fyp.supervisor && `Supervisor: ${fyp.supervisor}`, fyp.status?.replace(/_/g, ' ').toLowerCase()]
        .filter(Boolean)
        .join(' • '),
      detail: 'Submitted through the QIU FYP showcase.',
      state: fyp.status === 'APPROVED' ? 'verified' : 'awaiting-approval',
      source: 'FYP showcase',
      sourceHref: '/fyp',
    });
  }

  (student?.courses ?? []).forEach((course) => {
    entries.push({
      id: `course-${course.courseId}`,
      group: 'learning',
      title: course.title,
      meta: [course.provider, course.completedAt && new Date(course.completedAt).toLocaleDateString()]
        .filter(Boolean)
        .join(' • '),
      detail: 'External course completion synced to your record.',
      state: 'verified',
      source: 'Workshops & courses',
      sourceHref: '/workshops',
    });
  });

  (student?.workshopAttendance ?? []).forEach((attendance) => {
    entries.push({
      id: `workshop-${attendance.workshopId}`,
      group: 'learning',
      title: attendance.title,
      meta: attendance.attendedAt
        ? `Attended ${new Date(attendance.attendedAt).toLocaleDateString()}`
        : 'Attendance confirmed',
      detail: 'Attendance confirmed by QR check-in.',
      state: 'verified',
      source: 'Workshops & courses',
      sourceHref: '/workshops',
    });
  });

  const diagnostic = student?.diagnosticResult;
  if (diagnostic) {
    entries.push({
      id: 'diagnostic',
      group: 'learning',
      title: 'QIU skills diagnostic',
      meta: `Scored ${Math.round((diagnostic.score ?? 0) * 100)}%${
        diagnostic.completedAt ? ` • ${new Date(diagnostic.completedAt).toLocaleDateString()}` : ''
      }`,
      detail: diagnostic.gapTags?.length
        ? `Focus areas identified: ${diagnostic.gapTags.join(', ')}.`
        : 'Balanced baseline across the assessed skills.',
      state: 'verified',
      source: 'Diagnostics',
      sourceHref: '/diagnostics',
    });
  }

  (student?.badges ?? []).forEach((badge) => {
    entries.push({
      id: `badge-${badge.id}`,
      group: 'credentials',
      title: badge.title,
      meta: `${badge.category} • issued ${badge.date} • +${badge.xp} XP`,
      detail: '',
      state: 'verified',
      source: 'Badge ledger',
      sourceHref: '/dashboard',
    });
  });

  return entries;
}

/**
 * The base resume generated from the confirmed profile, before any manual
 * additions. Tier is derived via tierFor() so the badge printed on the PDF
 * always agrees with the sidebar.
 */
export function buildResume(student, activeFaculty) {
  const tier = tierFor(student?.xp ?? 0);
  const entries = verifiedEntries(student);

  return {
    header: {
      name: student?.name ?? '',
      programme: student?.programme ?? '',
      facultyName: activeFaculty?.name ?? '',
      facultyCode: activeFaculty?.code ?? '',
      email: student?.email ?? '',
      links: [student?.githubUrl, student?.linkedinUrl, student?.portfolioUrl].filter(Boolean),
      tier,
      xp: student?.xp ?? 0,
    },
    education: {
      institution: 'Quest International University',
      programme: student?.programme ?? '',
      faculty: activeFaculty?.name ?? '',
      year: student?.year ?? null,
    },
    totals: {
      loggedHours: hoursFrom(student?.logbookEntries),
      badgeCount: student?.badges?.length ?? 0,
      verifiedCount: entries.filter((entry) => entry.state === 'verified').length,
    },
    entries,
    skills: student?.skills ?? [],
  };
}

/** The seeded starting summary — plainly derived, no invented claims. */
export function defaultSummary(student, activeFaculty) {
  const tier = tierFor(student?.xp ?? 0);
  const hours = hoursFrom(student?.logbookEntries);
  const skills = (student?.skills ?? []).slice(0, 3).join(', ');
  const target = student?.careerTargets ? ` targeting ${student.careerTargets.toLowerCase()}` : '';

  return (
    `Year ${student?.year ?? ''} ${student?.programme ?? 'student'} at Quest International University ` +
    `(${activeFaculty?.code ?? 'QIU'})${target}. ` +
    `Holds ${student?.badges?.length ?? 0} verified QIU badges at ${tier.name} tier and has logged ` +
    `${hours} supervised fieldwork hours${skills ? `, working mainly in ${skills}` : ''}.`
  ).replace(/\s+/g, ' ');
}

/* ------------------------------------------------------------------ *
 * The Recheck analyser
 * ------------------------------------------------------------------ */

// Openers that hand the credit to someone else or describe a job description
// rather than a contribution. Ordered longest-first so "worked on" wins over
// "worked".
const WEAK_OPENERS = [
  { pattern: /^\s*(i\s+)?was\s+responsible\s+for\b/i, verb: 'Owned' },
  { pattern: /^\s*(i\s+)?responsible\s+for\b/i, verb: 'Owned' },
  { pattern: /^\s*(i\s+)?duties\s+included\b/i, verb: 'Delivered' },
  { pattern: /^\s*(i\s+)?was\s+in\s+charge\s+of\b/i, verb: 'Led' },
  { pattern: /^\s*(i\s+)?in\s+charge\s+of\b/i, verb: 'Led' },
  { pattern: /^\s*(i\s+)?was\s+tasked\s+with\b/i, verb: 'Delivered' },
  { pattern: /^\s*(i\s+)?tasked\s+with\b/i, verb: 'Delivered' },
  { pattern: /^\s*(i\s+)?(was\s+)?part\s+of\b/i, verb: 'Contributed to' },
  { pattern: /^\s*(i\s+)?(was\s+)?involved\s+in\b/i, verb: 'Drove' },
  { pattern: /^\s*(i\s+)?participated\s+in\b/i, verb: 'Contributed to' },
  { pattern: /^\s*(i\s+)?helped\s+(out\s+)?(with|to|on)\b/i, verb: 'Coordinated' },
  { pattern: /^\s*(i\s+)?helped\b/i, verb: 'Coordinated' },
  { pattern: /^\s*(i\s+)?assisted\s+(with|in|on)\b/i, verb: 'Supported' },
  { pattern: /^\s*(i\s+)?assisted\b/i, verb: 'Supported' },
  { pattern: /^\s*(i\s+)?worked\s+(on|with|in)\b/i, verb: 'Built' },
  { pattern: /^\s*(i\s+)?worked\b/i, verb: 'Built' },
  { pattern: /^\s*(i\s+)?attended\b/i, verb: 'Applied learning from' },
  { pattern: /^\s*(i\s+)?did\b/i, verb: 'Delivered' },
];

const STRONG_VERBS = new Set([
  'achieved', 'analysed', 'analyzed', 'audited', 'authored', 'automated', 'benchmarked',
  'built', 'calibrated', 'chaired', 'coached', 'collected', 'compiled', 'configured',
  'consolidated', 'coordinated', 'counselled', 'counseled', 'created', 'curated', 'cut',
  'debugged', 'delivered', 'deployed', 'designed', 'developed', 'diagnosed', 'dispensed',
  'documented', 'drafted', 'drove', 'engineered', 'established', 'evaluated', 'expanded',
  'facilitated', 'forecast', 'formulated', 'generated', 'grew', 'implemented', 'improved',
  'increased', 'initiated', 'integrated', 'introduced', 'launched', 'led', 'maintained',
  'managed', 'mapped', 'measured', 'mentored', 'migrated', 'modelled', 'modeled',
  'negotiated', 'operated', 'optimised', 'optimized', 'organised', 'organized', 'owned',
  'piloted', 'planned', 'presented', 'produced', 'prototyped', 'published', 'ran',
  'rebuilt', 'reduced', 'refactored', 'researched', 'resolved', 'restructured', 'reviewed',
  'scaled', 'scheduled', 'secured', 'simulated', 'streamlined', 'supervised', 'surveyed',
  'taught', 'tested', 'trained', 'translated', 'validated', 'wrote',
]);

// Nouns and quantifiers that tell a reviewer nothing on their own.
const VAGUE_TERMS = [
  { word: 'event', replacement: 'the specific event' },
  { word: 'events', replacement: 'the specific events' },
  { word: 'project', replacement: 'the named project' },
  { word: 'projects', replacement: 'the named projects' },
  { word: 'things', replacement: 'the specific deliverables' },
  { word: 'stuff', replacement: 'the specific deliverables' },
  { word: 'tasks', replacement: 'the specific tasks' },
  { word: 'activities', replacement: 'the specific activities' },
  { word: 'work', replacement: 'the specific work' },
  { word: 'system', replacement: 'the named system' },
  { word: 'people', replacement: 'the specific team or audience' },
];

// Padding quantifiers — always safe to delete from a rewrite.
const FILLER_WORDS = ['various', 'several', 'many', 'some', 'a lot of', 'lots of', 'multiple', 'different'];

const FILLER_ADVERBS = ['very', 'really', 'basically', 'actually', 'quite', 'just', 'literally', 'etc'];

const OUTCOME_SIGNALS = /\b(result(ed|ing)?|so that|enabling|leading to|which\s+\w+ed|reduc\w*|increas\w*|improv\w*|sav\w*|cut|grew|faster|higher|lower|accuracy|uptime|conversion|retention|satisfaction|score)\b/i;

const PASSIVE = /\b(was|were|been|being|is|are)\s+(\w+ed|written|built|made|given|taken|held|run|led|shown|sent|kept)\b/i;

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'over', 'under', 'your',
  'their', 'about', 'other', 'role', 'roles', 'work', 'working', 'career', 'careers',
]);

/** Meaningful keyword tokens from the student's stated targets and skills. */
export function targetKeywords(student) {
  const raw = [student?.careerTargets ?? '', student?.industries ?? '', ...(student?.skills ?? [])].join(' ');
  return Array.from(
    new Set(
      raw
        .toLowerCase()
        .split(/[^a-z0-9+#]+/)
        .filter((token) => token.length > 3 && !STOPWORDS.has(token)),
    ),
  );
}

function words(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function stripTrailingPunctuation(text) {
  return text.replace(/[.;,\s]+$/, '');
}

function toSentence(text) {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Severity band. Shared red/amber/green scale with the diagnostics module. */
export function severityFor(score) {
  if (score >= 80) return { id: 'strong', label: 'Strong', tone: 'emerald' };
  if (score >= 55) return { id: 'fair', label: 'Needs work', tone: 'amber' };
  return { id: 'weak', label: 'Weak', tone: 'rose' };
}

/**
 * Analyse one bullet or paragraph.
 *
 * Returns { score, severity, findings[], suggestion, projectedScore }.
 * Every finding names what was actually found in the text, so two different
 * bullets never produce the same feedback.
 */
export function analyseBullet(text, options = {}) {
  const { student = null, isSummary = false, projection = false } = options;
  const source = String(text ?? '');
  const trimmed = source.trim();

  if (!trimmed) {
    return {
      text: source,
      score: 0,
      severity: severityFor(0),
      findings: [{ id: 'empty', tone: 'rose', label: 'Empty', message: 'Nothing to check yet — write a line first.' }],
      suggestion: null,
      projectedScore: null,
    };
  }

  const wordList = words(trimmed);
  const lower = trimmed.toLowerCase();
  const findings = [];
  let penalty = 0;

  // 1. Weak opener -------------------------------------------------------
  const weak = WEAK_OPENERS.find((entry) => entry.pattern.test(trimmed));
  let core = trimmed;
  let verb = null;

  if (weak && !isSummary) {
    const matched = trimmed.match(weak.pattern)[0].trim();
    penalty += 25;
    verb = weak.verb;
    core = trimmed.replace(weak.pattern, '').trim();
    findings.push({
      id: 'weak-opener',
      tone: 'rose',
      label: 'Vague opener',
      message: `"${matched}" hands the credit to whoever you were helping. Open with what you personally did.`,
    });
  }

  // 2. Action verb -------------------------------------------------------
  const firstWord = wordList[0]?.toLowerCase().replace(/[^a-z]/g, '');
  const startsStrong = STRONG_VERBS.has(firstWord);
  if (!weak && !startsStrong && !isSummary) {
    penalty += 15;
    findings.push({
      id: 'no-action-verb',
      tone: 'amber',
      label: 'No action verb',
      message: `"${wordList[0]}" is not an action verb. Reviewers scan the first word of every bullet — start with one (built, led, reduced, coordinated).`,
    });
    verb = 'Delivered';
  }

  // 3. Quantification ----------------------------------------------------
  const hasNumber = /\d/.test(trimmed);
  if (!hasNumber) {
    penalty += 15;
    findings.push({
      id: 'no-numbers',
      tone: 'amber',
      label: 'No scale',
      message: 'There is no number anywhere in this line — hours, people, percentage, budget, records. Scale is what separates a claim from evidence.',
    });
  }

  // 4. Vague nouns -------------------------------------------------------
  const vagueHits = VAGUE_TERMS.filter((term) => new RegExp(`\\b${term.word}\\b`, 'i').test(trimmed));
  if (vagueHits.length) {
    penalty += Math.min(12, vagueHits.length * 8);
    findings.push({
      id: 'vague-nouns',
      tone: 'amber',
      label: 'Unspecific',
      message: `${vagueHits.map((hit) => `"${hit.word}"`).join(', ')} could mean anything. Name it — a reviewer cannot picture what you did.`,
    });
  }

  const fillerHits = FILLER_WORDS.filter((word) => lower.includes(word));
  if (fillerHits.length) {
    penalty += 6;
    findings.push({
      id: 'filler-quantifier',
      tone: 'amber',
      label: 'Padding',
      message: `${fillerHits.map((hit) => `"${hit}"`).join(', ')} takes the place of a real figure. Replace with the count.`,
    });
  }

  const adverbHits = FILLER_ADVERBS.filter((word) => new RegExp(`\\b${word}\\b`, 'i').test(trimmed));
  if (adverbHits.length) {
    penalty += 5;
    findings.push({
      id: 'filler-adverb',
      tone: 'amber',
      label: 'Filler word',
      message: `${adverbHits.map((hit) => `"${hit}"`).join(', ')} adds length without adding information.`,
    });
  }

  // 5. Length ------------------------------------------------------------
  if (wordList.length < 6) {
    penalty += 12;
    findings.push({
      id: 'too-short',
      tone: 'rose',
      label: 'Too short',
      message: `${wordList.length} words. A reviewer cannot tell what you did, for whom, or what changed.`,
    });
  } else if (wordList.length < 9) {
    penalty += 6;
    findings.push({
      id: 'thin',
      tone: 'amber',
      label: 'Thin',
      message: `${wordList.length} words — there is room to say what changed as a result.`,
    });
  } else if (wordList.length > (isSummary ? 90 : 34)) {
    penalty += 10;
    findings.push({
      id: 'too-long',
      tone: 'amber',
      label: 'Too long',
      message: `${wordList.length} words. Long lines get skimmed — split this into two, or cut to the outcome.`,
    });
  }

  // 6. Outcome — only meaningful once the line has room for one -----------
  const hasOutcome = OUTCOME_SIGNALS.test(trimmed);
  if (!hasOutcome && wordList.length >= 6) {
    penalty += 8;
    findings.push({
      id: 'no-outcome',
      tone: 'amber',
      label: 'No result',
      message: 'This says what you did but not what changed because of it. Close with the effect.',
    });
  }

  // 7. Voice -------------------------------------------------------------
  if (PASSIVE.test(trimmed)) {
    const matched = trimmed.match(PASSIVE)[0];
    penalty += 10;
    findings.push({
      id: 'passive',
      tone: 'amber',
      label: 'Passive voice',
      message: `"${matched}" hides who acted. Say it in the active voice.`,
    });
  }

  if (/\b(i|my|me)\b/i.test(trimmed) && !isSummary) {
    penalty += 6;
    findings.push({
      id: 'first-person',
      tone: 'amber',
      label: 'First person',
      message: 'Resume bullets drop "I" and "my" — the whole page is already about you.',
    });
  }

  // 8. Relevance to the student's stated target --------------------------
  const keywords = targetKeywords(student);
  const matchedKeywords = keywords.filter((keyword) => lower.includes(keyword));
  if (keywords.length && !matchedKeywords.length) {
    penalty += 5;
    findings.push({
      id: 'off-target',
      tone: 'amber',
      label: 'Off-target',
      message: `Nothing here connects to your stated target (${
        student?.careerTargets || student?.industries
      }). If this line is relevant, use the language that target uses.`,
    });
  } else if (matchedKeywords.length) {
    findings.push({
      id: 'on-target',
      tone: 'emerald',
      label: 'On target',
      message: `Picks up ${matchedKeywords.slice(0, 3).map((k) => `"${k}"`).join(', ')} from your stated target — keep that.`,
    });
  }

  if (startsStrong) {
    findings.push({
      id: 'strong-verb',
      tone: 'emerald',
      label: 'Strong opener',
      message: `Opens on "${wordList[0]}" — an action verb. That is exactly right.`,
    });
  }
  if (hasNumber) {
    findings.push({
      id: 'quantified',
      tone: 'emerald',
      label: 'Quantified',
      message: 'Contains a figure, so the scale of the work is checkable.',
    });
  }
  if (hasOutcome) {
    findings.push({
      id: 'has-outcome',
      tone: 'emerald',
      label: 'Shows impact',
      message: 'States what changed as a result, not just what was done.',
    });
  }

  const score = Math.max(25, Math.min(100, 100 - penalty));
  const result = {
    text: source,
    score,
    severity: severityFor(score),
    findings,
    suggestion: null,
    projectedScore: null,
  };

  // A projection pass must not recurse.
  if (projection || score >= 85) return result;

  // 9. Build the rewrite from the student's own words ---------------------
  let rebuilt = core;

  vagueHits.forEach((hit) => {
    rebuilt = rebuilt.replace(new RegExp(`\\b${hit.word}\\b`, 'gi'), `[${hit.replacement}]`);
  });
  FILLER_WORDS.forEach((filler) => {
    rebuilt = rebuilt.replace(new RegExp(`\\b${filler}\\b`, 'gi'), '');
  });
  FILLER_ADVERBS.forEach((adverb) => {
    rebuilt = rebuilt.replace(new RegExp(`\\b${adverb}\\b`, 'gi'), '');
  });
  if (!isSummary) {
    rebuilt = rebuilt.replace(/\b(i|my|me)\b\s*/gi, '');
  }
  // "a project" -> "a [the named project]" would read badly; drop the article.
  rebuilt = rebuilt.replace(/\b(a|an|the)\s+(?=\[)/gi, '');
  rebuilt = stripTrailingPunctuation(rebuilt.replace(/\s+/g, ' ').trim());

  const openWith = verb && !startsStrong ? verb : null;
  let suggestion = openWith ? `${openWith} ${rebuilt}`.trim() : toSentence(rebuilt);

  if (!hasNumber) {
    suggestion += ' for [number — attendees, hours, records, or %]';
  }
  if (!hasOutcome) {
    suggestion += ', [state what measurably changed]';
  }
  if (keywords.length && !matchedKeywords.length && student?.skills?.length) {
    suggestion += `, applying ${student.skills[0]}`;
  }
  suggestion = `${toSentence(stripTrailingPunctuation(suggestion.replace(/\s+/g, ' ')))}.`;

  // Score the rewrite as it would read once the bracketed slots are filled,
  // so the "before -> after" figure shown in the UI is a real measurement and
  // not a decorative number.
  const filled = suggestion.replace(/\[[^\]]*\]/g, '120 participants, cutting turnaround by 30%');
  const projected = analyseBullet(filled, { student, isSummary, projection: true });

  result.suggestion = suggestion;
  result.projectedScore = projected.score;
  return result;
}

/** Run the checker over every editable line. */
export function analyseResume({ summary, manualEntries = [], student }) {
  const items = [];

  items.push({
    key: 'summary',
    section: 'Professional summary',
    ...analyseBullet(summary, { student, isSummary: true }),
  });

  manualEntries.forEach((entry) => {
    (entry.bullets ?? []).forEach((bullet, index) => {
      items.push({
        key: `${entry.id}:${index}`,
        entryId: entry.id,
        bulletIndex: index,
        section: entry.title || 'Manual entry',
        ...analyseBullet(bullet, { student }),
      });
    });
  });

  const overall = items.length
    ? Math.round(items.reduce((total, item) => total + item.score, 0) / items.length)
    : 0;

  return { items, overall, checkedAt: new Date().toISOString() };
}
