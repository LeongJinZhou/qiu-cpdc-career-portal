// The student pathway spine.
//
// Every module in this portal answers "what can I do here?". Nothing answered
// "where am I, and what comes next?" -- so a student landed on a dashboard of
// sixteen equally-weighted tiles and had to work out their own route. This file
// derives that route from data the platform already holds.
//
// Pure functions over plain objects: no fetch, no Prisma, no React. The
// dashboard, the career-path page and the sidebar all read the same verdict, so
// a student is never told two different things about their own progress.
//
// One rule governs everything here, and it is the blueprint's: NOTHING IS EVER
// HIDDEN. The pathway orders and highlights; it never removes a module, never
// locks a route, and never prevents a Year 1 student from opening the FYP
// module out of curiosity. Guidance, not gatekeeping.

import { CAREER_PATHS, milestoneId } from './data/roadmaps.js';

/**
 * The five stages every QIU student moves through, independent of faculty.
 *
 * Deliberately NOT the four academic years. A Year 3 student who has never
 * taken the diagnostic is still at "Discover", and telling them otherwise
 * would be flattering rather than useful. Academic year decides which
 * milestones apply; evidence decides which stage they are actually in.
 */
export const PATHWAY_STAGES = Object.freeze([
  {
    id: 'setup',
    label: 'Set up',
    blurb: 'Confirm who you are and connect your professional profile.',
  },
  {
    id: 'discover',
    label: 'Discover',
    blurb: 'Find out where your skills stand and what your programme expects.',
  },
  {
    id: 'build',
    label: 'Build',
    blurb: 'Earn evidence: workshops, courses, placements, projects.',
  },
  {
    id: 'prove',
    label: 'Prove',
    blurb: 'Turn that evidence into a CV and a reviewed final-year project.',
  },
  {
    id: 'launch',
    label: 'Launch',
    blurb: 'Open yourself to employers and the alumni network.',
  },
]);

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const count = (value) => (Array.isArray(value) ? value.length : 0);

/**
 * The checkpoints that define the pathway.
 *
 * Each is a small, honest predicate over student state. `evidence` describes
 * what actually satisfied it, so the UI can tell the student WHY something is
 * ticked rather than showing an unexplained green check.
 */
function buildCheckpoints(student, { onboarding = null } = {}) {
  const badges = student?.badges ?? [];
  const logbook = student?.logbookEntries ?? [];
  const approvedLogs = logbook.filter((entry) => entry?.status === 'APPROVED');

  const hasDiagnostic = Boolean(
    student?.diagnosticResult
    || badges.some((badge) => badge?.category === 'Assessment'
      || String(badge?.title ?? '').toLowerCase().includes('diagnostic')),
  );

  return [
    {
      id: 'identity',
      stage: 'setup',
      label: 'Confirm your details',
      href: '/settings',
      done: onboarding ? Boolean(onboarding.identityConfirmed) : true,
      evidence: 'Confirmed at first sign-in',
    },
    {
      id: 'connections',
      stage: 'setup',
      label: 'Connect your professional profile',
      href: '/settings',
      done: onboarding ? (onboarding.missingProviders ?? []).length === 0 : true,
      evidence: onboarding
        ? `${(onboarding.connectedProviders ?? []).length} connected`
        : null,
    },
    {
      id: 'profile',
      stage: 'setup',
      label: 'Add your goals and bio',
      href: '/settings',
      done: hasText(student?.bio) && (hasText(student?.careerTargets) || hasText(student?.industries)),
      evidence: 'Career targets and bio saved',
      // Soft: useful, but never described as blocking. It shapes matching.
      soft: true,
    },
    {
      id: 'diagnostic',
      stage: 'discover',
      label: 'Take the skills diagnostic',
      href: '/diagnostics',
      done: hasDiagnostic,
      evidence: 'Diagnostic result recorded',
    },
    {
      id: 'roadmap',
      stage: 'discover',
      label: 'Review your year roadmap',
      href: '/career-path',
      done: count(student?.selfReportedMilestones) > 0,
      evidence: 'Roadmap milestones marked',
      soft: true,
    },
    {
      id: 'workshop',
      stage: 'build',
      label: 'Attend a CPDC workshop',
      href: '/workshops',
      done: count(student?.workshopAttendance) > 0,
      evidence: `${count(student?.workshopAttendance)} attended`,
    },
    {
      id: 'course',
      stage: 'build',
      label: 'Complete an external course',
      href: '/learning',
      done: badges.some((badge) => badge?.category === 'Course')
        || count(student?.verifiedCourses) > 0,
      evidence: 'Verified certificate on record',
    },
    {
      id: 'logbook',
      stage: 'build',
      label: 'Log verified placement hours',
      href: '/logbook',
      done: approvedLogs.length > 0,
      evidence: `${approvedLogs.length} approved ${approvedLogs.length === 1 ? 'entry' : 'entries'}`,
    },
    {
      id: 'cv',
      stage: 'prove',
      label: 'Generate your CV',
      href: '/cv',
      done: hasText(student?.resumeSummary) || Boolean(student?.resumeData),
      evidence: 'CV generated',
    },
    {
      id: 'fyp',
      stage: 'prove',
      label: 'Submit your final-year project',
      href: '/fyp',
      done: Boolean(student?.fypSubmission),
      evidence: 'FYP submitted for review',
      // Only meaningful from Year 3. Shown earlier as a preview, never as a
      // failure -- a Year 1 student is not behind for lacking an FYP.
      fromYear: 3,
    },
    {
      id: 'talent',
      stage: 'launch',
      label: 'Open your profile to employers',
      href: '/settings',
      done: Boolean(student?.publicTalent),
      evidence: 'Visible in the talent feed',
      fromYear: 3,
    },
    {
      id: 'network',
      stage: 'launch',
      label: 'Connect with an alumni mentor',
      href: '/network',
      done: count(student?.mentorConnections) > 0,
      evidence: 'Mentor conversation started',
      soft: true,
      fromYear: 2,
    },
  ];
}

/**
 * Which faculty roadmap milestones apply to this student's current year, and
 * which have been self-reported.
 */
export function yearMilestones(facultyId, year, selfReportedIds = []) {
  const path = CAREER_PATHS[facultyId] ?? [];
  const stage = path.find((entry) => entry.year === Number(year)) ?? path[0] ?? null;
  if (!stage) return { stage: null, items: [], done: 0, total: 0 };

  const reported = new Set(selfReportedIds);
  const items = (stage.items ?? []).map((item, index) => {
    const id = milestoneId(facultyId, stage.year, index);
    return { ...id ? { id } : {}, ...item, id, done: reported.has(id) };
  });

  return {
    stage,
    items,
    done: items.filter((item) => item.done).length,
    total: items.length,
  };
}

/**
 * The full pathway verdict.
 *
 * @param {object} input.student      Portal student projection.
 * @param {object} input.activeFaculty
 * @param {object} input.onboarding   /api/onboarding state, if loaded.
 * @param {string[]} input.selfReportedMilestones
 */
export function buildPathway({
  student = {},
  activeFaculty = {},
  onboarding = null,
  selfReportedMilestones = [],
} = {}) {
  const year = Math.min(12, Math.max(1, Number(student.year) || 1));
  const all = buildCheckpoints({ ...student, selfReportedMilestones }, { onboarding });

  // A checkpoint below its `fromYear` is shown as "coming up", never as
  // outstanding. Counting an FYP against a first-year student would make the
  // pathway a source of anxiety rather than direction.
  const checkpoints = all.map((checkpoint) => ({
    ...checkpoint,
    upcoming: Boolean(checkpoint.fromYear && year < checkpoint.fromYear),
  }));

  const applicable = checkpoints.filter((checkpoint) => !checkpoint.upcoming);
  const done = applicable.filter((checkpoint) => checkpoint.done);

  // Current stage = the earliest stage with an unfinished non-soft checkpoint.
  // Soft items never hold a student back a stage; they are enrichment.
  const blocking = applicable.find((checkpoint) => !checkpoint.done && !checkpoint.soft);
  const currentStageId = blocking?.stage ?? PATHWAY_STAGES[PATHWAY_STAGES.length - 1].id;
  const currentIndex = PATHWAY_STAGES.findIndex((stage) => stage.id === currentStageId);

  const stages = PATHWAY_STAGES.map((stage, index) => {
    const items = checkpoints.filter((checkpoint) => checkpoint.stage === stage.id);
    const stageApplicable = items.filter((checkpoint) => !checkpoint.upcoming);
    const stageDone = stageApplicable.filter((checkpoint) => checkpoint.done);

    return {
      ...stage,
      items,
      done: stageDone.length,
      total: stageApplicable.length,
      complete: stageApplicable.length > 0 && stageDone.length === stageApplicable.length,
      current: index === currentIndex,
      // Past stages are collapsed by default; the current one is open.
      past: index < currentIndex,
    };
  });

  const milestones = yearMilestones(activeFaculty?.id, year, selfReportedMilestones);

  return {
    year,
    facultyName: activeFaculty?.name ?? 'your faculty',
    stages,
    currentStageId,
    currentStage: stages[currentIndex] ?? null,
    // The single next thing. Soft items are only offered once nothing
    // substantive is outstanding, so the prompt is never trivial while
    // something real is waiting.
    nextStep: blocking ?? applicable.find((checkpoint) => !checkpoint.done) ?? null,
    completed: done.length,
    total: applicable.length,
    percent: applicable.length === 0 ? 0 : Math.round((done.length / applicable.length) * 100),
    milestones,
  };
}
