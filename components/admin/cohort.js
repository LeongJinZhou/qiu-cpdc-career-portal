// Demo cohort for the CPDC console.
//
// HONESTY RULE (blueprint §12.11): this console must never display an invented
// enrolment figure, placement rate or employability percentage for a real
// university. So there is exactly one source of student rows — the roster
// below — and every number the console renders is computed from it by the
// helpers in this file. The roster is labelled "demo cohort" everywhere it is
// surfaced, and its size is printed next to the aggregates so nobody can read
// a derived percentage as a university-wide statistic.
//
// When the Prisma-backed API lands, `buildCohort` is the single function that
// swaps to a fetch; the panels consuming it do not change.

import { FACULTIES, WORKSHOPS } from '@/lib/data/facultyData';
import { tierFor } from '@/lib/xp';

/** Milestones a student is expected to clear before graduating. */
export const TARGET_WORKSHOPS = 3;
export const RESUME_SECTIONS = 5; // profile, skills, experience, projects, links

/**
 * The demo roster. Programme strings are taken from the real QIU programme
 * registry in lib/data/facultyData.js so faculty scoping is exercised properly.
 */
export const COHORT = [
  {
    id: 'STU-2026-9812', name: 'Alex Thorne', facultyId: 'computing_engineering',
    programme: 'Bachelor of Computer Science (Honours)', year: 3, finalYear: 4, status: 'ACTIVE',
    xp: 3450, fyp: 'DRAFT', logbookHours: 28, logbookRequired: 100, resumeSections: 4,
    workshops: ['w1'], diagnostic: true, badges: 4,
  },
  {
    id: 'STU-2026-4412', name: 'Rachel Dupont', facultyId: 'business',
    programme: 'Bachelor of Finance (Honours)', year: 4, finalYear: 4, status: 'ACTIVE',
    xp: 4890, fyp: 'NONE', logbookHours: 120, logbookRequired: 120, resumeSections: 3,
    workshops: ['w2'], diagnostic: true, badges: 3,
  },
  {
    id: 'STU-2026-1109', name: 'Priya Nair', facultyId: 'medicine',
    programme: 'Bachelor of Medicine and Bachelor of Surgery (MBBS)', year: 4, finalYear: 5, status: 'ACTIVE',
    xp: 4520, fyp: 'SUBMITTED', logbookHours: 132, logbookRequired: 120, resumeSections: 5,
    workshops: ['w3', 'w1'], diagnostic: true, badges: 5,
  },
  {
    id: 'STU-2026-5930', name: 'Nurul Aziz', facultyId: 'education',
    programme: 'Bachelor of Arts (Honours) Teaching of English as a Second Language (TESL)', year: 4, finalYear: 4, status: 'ACTIVE',
    xp: 2180, fyp: 'DRAFT', logbookHours: 64, logbookRequired: 120, resumeSections: 2,
    workshops: [], diagnostic: false, badges: 2,
  },
  {
    id: 'STU-2026-7218', name: 'Daniel Wong', facultyId: 'lifesciences',
    programme: 'Bachelor of Science (Honours) in Biotechnology', year: 4, finalYear: 4, status: 'ACTIVE',
    xp: 3010, fyp: 'SUBMITTED', logbookHours: 96, logbookRequired: 120, resumeSections: 4,
    workshops: ['w1'], diagnostic: true, badges: 3,
  },
  {
    id: 'STU-2026-3345', name: 'Farah Idris', facultyId: 'pharmacy',
    programme: 'Bachelor of Pharmacy with Honours', year: 4, finalYear: 4, status: 'ACTIVE',
    xp: 5240, fyp: 'APPROVED', logbookHours: 140, logbookRequired: 120, resumeSections: 5,
    workshops: ['w4', 'w1'], diagnostic: true, badges: 6,
  },
  {
    id: 'STU-2026-2287', name: 'Marcus Lee', facultyId: 'business',
    programme: 'Bachelor of Business Administration (Honours)', year: 2, finalYear: 4, status: 'ACTIVE',
    xp: 980, fyp: 'NONE', logbookHours: 12, logbookRequired: 60, resumeSections: 2,
    workshops: ['w2'], diagnostic: false, badges: 1,
  },
  {
    id: 'STU-2026-6641', name: 'Chen Wei Ling', facultyId: 'computing_engineering',
    programme: 'Bachelor of Information Technology (Honours)', year: 4, finalYear: 4, status: 'ACTIVE',
    xp: 6120, fyp: 'APPROVED', logbookHours: 118, logbookRequired: 100, resumeSections: 5,
    workshops: ['w1', 'w2'], diagnostic: true, badges: 7,
  },
  {
    id: 'STU-2026-8890', name: 'Aisyah Rahman', facultyId: 'hospitality',
    programme: 'Bachelor of Hospitality Management (Honours)', year: 3, finalYear: 4, status: 'ACTIVE',
    xp: 1640, fyp: 'NONE', logbookHours: 48, logbookRequired: 80, resumeSections: 3,
    workshops: [], diagnostic: false, badges: 2,
  },
  {
    id: 'STU-2026-4478', name: 'Joshua Anand', facultyId: 'communication',
    programme: 'Bachelor of Mass Communication (Honours) Journalism', year: 4, finalYear: 4, status: 'PROBATION',
    xp: 720, fyp: 'NONE', logbookHours: 20, logbookRequired: 80, resumeSections: 1,
    workshops: [], diagnostic: false, badges: 1,
  },
  {
    id: 'STU-2026-9903', name: 'Tan Mei Xin', facultyId: 'education',
    programme: 'Bachelor of Psychology (Honours)', year: 2, finalYear: 4, status: 'ACTIVE',
    xp: 1320, fyp: 'NONE', logbookHours: 34, logbookRequired: 60, resumeSections: 3,
    workshops: ['w3'], diagnostic: true, badges: 2,
  },
  {
    id: 'STU-2026-5512', name: 'Hafiz Kamarudin', facultyId: 'medicine',
    programme: 'Bachelor of Biomedical Sciences (Honours)', year: 3, finalYear: 4, status: 'ACTIVE',
    xp: 2760, fyp: 'DRAFT', logbookHours: 72, logbookRequired: 100, resumeSections: 4,
    workshops: ['w3'], diagnostic: true, badges: 3,
  },
  {
    id: 'STU-2026-7734', name: 'Grace Lim', facultyId: 'lifesciences',
    programme: 'Bachelor in Food Science with Management (Honours)', year: 1, finalYear: 4, status: 'ACTIVE',
    xp: 320, fyp: 'NONE', logbookHours: 0, logbookRequired: 40, resumeSections: 1,
    workshops: [], diagnostic: false, badges: 0,
  },
  {
    id: 'STU-2026-1156', name: 'Ravi Subramaniam', facultyId: 'pharmacy',
    programme: 'Bachelor of Pharmacy with Honours', year: 2, finalYear: 4, status: 'LEAVE',
    xp: 540, fyp: 'NONE', logbookHours: 18, logbookRequired: 60, resumeSections: 2,
    workshops: ['w4'], diagnostic: false, badges: 1,
  },
];

export const FYP_LABELS = {
  NONE: 'Not started',
  DRAFT: 'Draft only',
  SUBMITTED: 'Awaiting review',
  APPROVED: 'Approved',
};

export const STATUS_LABELS = {
  ACTIVE: 'Active',
  PROBATION: 'Academic probation',
  LEAVE: 'On leave',
};

/** Faculty lookup used by every panel. */
export function facultyOf(facultyId) {
  return FACULTIES.find((faculty) => faculty.id === facultyId);
}

/**
 * Merge the live portal student over their roster row.
 *
 * The signed-in demo student (Alex Thorne) is also row 1 of the cohort. Reading
 * their real state means an FYP submitted in the student view, a workshop
 * attended, or a Superadmin identity override all move the console's numbers
 * immediately — which is the point of §12.11.
 */
function mergeLiveStudent(row, student) {
  if (!student || student.id !== row.id) return row;

  const fypStatus = student.fypSubmission?.status;
  const fyp = fypStatus === 'APPROVED' ? 'APPROVED'
    : fypStatus === 'NEEDS_CHANGES' ? 'DRAFT'
      : fypStatus ? 'SUBMITTED'
        : row.fyp;

  const loggedHours = (student.logbookEntries ?? [])
    .filter((entry) => entry.status !== 'REJECTED')
    .reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);

  // Resume completeness is counted, not guessed: one point per section the
  // student has actually filled in.
  const resumeSections = [
    Boolean(student.bio),
    (student.skills ?? []).length > 0,
    (student.logbookEntries ?? []).length > 0,
    Boolean(student.fypSubmission) || (student.badges ?? []).length > 0,
    Boolean(student.githubUrl || student.linkedinUrl || student.portfolioUrl),
  ].filter(Boolean).length;

  return {
    ...row,
    facultyId: student.facultyId ?? row.facultyId,
    programme: student.programme ?? row.programme,
    year: student.year ?? row.year,
    xp: Number(student.xp) || row.xp,
    fyp,
    logbookHours: loggedHours || row.logbookHours,
    resumeSections,
    workshops: (student.workshopAttendance ?? []).length
      ? student.workshopAttendance.map((item) => item.workshopId ?? item.id ?? item)
      : row.workshops,
    diagnostic: student.diagnosticResult ? true : row.diagnostic,
    badges: (student.badges ?? []).length || row.badges,
    live: true,
  };
}

/**
 * Readiness score.
 *
 * Five equally weighted components, each already a percentage, averaged. The
 * formula is written down here (and shown in the UI) so the number is
 * inspectable rather than a black box.
 */
export function readinessOf(row) {
  const fypScore = { APPROVED: 100, SUBMITTED: 70, DRAFT: 35, NONE: 0 }[row.fyp] ?? 0;
  const logbookScore = row.logbookRequired > 0
    ? Math.min(100, Math.round((row.logbookHours / row.logbookRequired) * 100))
    : 100;
  const resumeScore = Math.min(100, Math.round((row.resumeSections / RESUME_SECTIONS) * 100));
  const workshopScore = Math.min(100, Math.round((row.workshops.length / TARGET_WORKSHOPS) * 100));
  const diagnosticScore = row.diagnostic ? 100 : 0;

  const components = [
    { id: 'fyp', label: 'Final year project', value: fypScore },
    { id: 'logbook', label: 'Logbook hours', value: logbookScore },
    { id: 'resume', label: 'Resume completeness', value: resumeScore },
    { id: 'workshops', label: 'Workshop attendance', value: workshopScore },
    { id: 'diagnostic', label: 'Skills diagnostic', value: diagnosticScore },
  ];

  const score = Math.round(components.reduce((sum, part) => sum + part.value, 0) / components.length);
  return { score, components };
}

/**
 * At-risk flags. Each flag carries its own label and icon name — never colour
 * alone — because a red pill is invisible to a colour-blind coordinator.
 */
export function flagsOf(row) {
  const isFinalYear = row.year >= row.finalYear;
  const flags = [];

  if (isFinalYear && (row.fyp === 'NONE' || row.fyp === 'DRAFT')) {
    flags.push({
      id: 'fyp',
      icon: 'FlaskConical',
      label: row.fyp === 'NONE' ? 'No FYP submitted' : 'FYP still a draft',
      detail: 'Final-year students must have an FYP under review.',
    });
  }
  if (row.logbookHours < row.logbookRequired) {
    flags.push({
      id: 'logbook',
      icon: 'BookOpen',
      label: `Logbook short by ${row.logbookRequired - row.logbookHours} h`,
      detail: `${row.logbookHours} of ${row.logbookRequired} required hours signed off.`,
    });
  }
  if (row.resumeSections < RESUME_SECTIONS) {
    flags.push({
      id: 'resume',
      icon: 'FileText',
      label: 'Resume incomplete',
      detail: `${row.resumeSections} of ${RESUME_SECTIONS} CV sections filled in.`,
    });
  }
  if (row.status === 'PROBATION') {
    flags.push({
      id: 'status',
      icon: 'AlertTriangle',
      label: 'Academic probation',
      detail: 'Flagged by the faculty; coordinate with the academic advisor.',
    });
  }

  const risk = isFinalYear && flags.length >= 2 ? 'high'
    : (isFinalYear && flags.length === 1) || flags.length >= 3 ? 'medium'
      : flags.length > 0 ? 'watch'
        : 'clear';

  return { flags, risk, isFinalYear };
}

export const RISK_LABELS = {
  high: 'High — intervene now',
  medium: 'Medium — follow up',
  watch: 'Watch',
  clear: 'On track',
};

/**
 * Build the console's working dataset: roster rows, live student merged in,
 * Superadmin identity overrides applied, scoped to a faculty when the viewer
 * is a coordinator.
 *
 * Overrides are applied before derivation so a reassignment immediately moves
 * the student's readiness, at-risk flags and every faculty aggregate — the
 * console must not show a stale number after an override.
 */
export function buildCohort({ student, facultyId, overrides } = {}) {
  return COHORT
    .map((row) => mergeLiveStudent(row, student))
    .map((row) => (overrides?.[row.id] ? { ...row, ...overrides[row.id], overridden: true } : row))
    .map((row) => {
      const { score, components } = readinessOf(row);
      const { flags, risk, isFinalYear } = flagsOf(row);
      return { ...row, readiness: score, components, flags, risk, isFinalYear, tier: tierFor(row.xp).name };
    })
    .filter((row) => !facultyId || row.facultyId === facultyId);
}

/** Average of a numeric field, or 0 for an empty scope (never NaN in the UI). */
export function averageOf(rows, pick) {
  if (rows.length === 0) return 0;
  return Math.round(rows.reduce((sum, row) => sum + pick(row), 0) / rows.length);
}

/** Readiness per faculty, only for faculties that actually have rows in scope. */
export function readinessByFaculty(rows) {
  return FACULTIES
    .map((faculty) => {
      const inFaculty = rows.filter((row) => row.facultyId === faculty.id);
      return {
        id: faculty.id,
        label: faculty.code,
        fullLabel: faculty.name,
        count: inFaculty.length,
        value: averageOf(inFaculty, (row) => row.readiness),
      };
    })
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.value - a.value);
}

/** XP distribution across the tier ladder in lib/xp.js. */
export function xpDistribution(rows) {
  const buckets = new Map();
  rows.forEach((row) => {
    buckets.set(row.tier, (buckets.get(row.tier) ?? 0) + 1);
  });
  // Every tier is rendered, including empty ones — a gap in the ladder is
  // itself information for the operator.
  return ['Novice', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond']
    .map((name) => ({ id: name, label: name, count: buckets.get(name) ?? 0 }));
}

/** Share of the scoped cohort that has cleared each tracked milestone. */
export function milestoneCompletion(rows) {
  const total = rows.length || 1;
  const share = (predicate) => Math.round((rows.filter(predicate).length / total) * 100);
  return [
    { id: 'fyp', label: 'FYP approved', value: share((row) => row.fyp === 'APPROVED') },
    { id: 'logbook', label: 'Logbook hours met', value: share((row) => row.logbookHours >= row.logbookRequired) },
    { id: 'resume', label: 'Resume complete', value: share((row) => row.resumeSections >= RESUME_SECTIONS) },
    { id: 'diagnostic', label: 'Diagnostic taken', value: share((row) => row.diagnostic) },
    { id: 'workshop', label: 'Attended a workshop', value: share((row) => row.workshops.length > 0) },
  ];
}

/**
 * Attendance per published workshop, in date order — the console's only trend
 * line. Counts come from the roster's attendance lists, so a workshop nobody
 * attended honestly reads zero.
 */
export function attendanceByWorkshop(rows) {
  return WORKSHOPS.map((workshop) => ({
    id: workshop.id,
    label: workshop.title,
    shortLabel: workshop.date.split(' ')[0].slice(5),
    facultyId: workshop.faculty,
    count: rows.filter((row) => row.workshops.includes(workshop.id)).length,
  }));
}

/** CSV for the export button — same rows the operator is looking at. */
export function cohortToCsv(rows) {
  const header = ['student_id', 'name', 'faculty', 'programme', 'year', 'status', 'xp', 'tier', 'readiness', 'fyp', 'logbook_hours', 'logbook_required', 'risk', 'flags'];
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const body = rows.map((row) => [
    row.id, row.name, facultyOf(row.facultyId)?.code ?? row.facultyId, row.programme, row.year,
    row.status, row.xp, row.tier, row.readiness, row.fyp, row.logbookHours, row.logbookRequired,
    row.risk, row.flags.map((flag) => flag.label).join('; '),
  ].map(escape).join(','));
  return [header.join(','), ...body].join('\n');
}
