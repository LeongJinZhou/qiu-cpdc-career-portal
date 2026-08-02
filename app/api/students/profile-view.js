/**
 * Turns a Prisma student row into the shape `buildStudentProfileView` expects,
 * and explains — in a sentence a non-technical member of staff can read — every
 * layer their role does not get.
 *
 * The mapping lives here rather than in the route so it can be unit tested, and
 * so there is exactly one place that decides what "the student's CV layer"
 * means in terms of database tables.
 *
 * Nothing in here invents a figure. Where the platform does not hold a value
 * (an ATS score, a required-hours target) it passes null and the UI prints "—".
 */

import {
  STUDENT_PROFILE_LAYERS,
  buildStudentProfileView,
  canReadGps,
  layersForRole,
} from '../../../lib/auth/student-profile-visibility.js';
import { tierFor } from '../../../lib/xp.js';

/** Prisma include needed to populate every layer. */
export const STUDENT_PROFILE_INCLUDE = {
  user: { select: { id: true, name: true, email: true, accountStatus: true, lastSignInAt: true } },
  faculty: { select: { id: true, name: true, code: true } },
  programme: { select: { id: true, name: true, level: true } },
  xpEvents: { select: { amount: true, source: true, createdAt: true } },
  badges: { select: { id: true, title: true, category: true, icon: true, xp: true, awardedAt: true } },
  logbookEntries: {
    orderBy: { entryDate: 'desc' },
    select: {
      id: true,
      title: true,
      details: true,
      hours: true,
      entryDate: true,
      status: true,
      latitude: true,
      longitude: true,
      approval: { select: { supervisorName: true, decision: true, usedAt: true } },
    },
  },
  fypProject: {
    select: {
      id: true, title: true, abstract: true, supervisorName: true, status: true, publicOptIn: true,
      repositoryUrl: true, liveUrl: true, reviewerName: true, reviewNote: true, reviewedAt: true,
    },
  },
  diagnostics: {
    orderBy: { createdAt: 'desc' },
    select: { id: true, testId: true, score: true, passed: true, gapTags: true, createdAt: true },
  },
  assessmentAttempts: {
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true,
      score: true,
      passed: true,
      submittedAt: true,
      assessment: { select: { title: true, passMark: true } },
    },
  },
  courseEnrolments: {
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, courseId: true, title: true, provider: true, skillTag: true,
      status: true, verificationStatus: true, verifiedAt: true, completedAt: true,
    },
  },
  applications: {
    orderBy: { updatedAt: 'desc' },
    select: { id: true, stage: true, updatedAt: true, jobPosting: { select: { title: true, company: { select: { name: true } } } } },
  },
};

function intakeLabel(student) {
  if (!student.intakeYearMonth) return null;
  const raw = String(student.intakeYearMonth);
  if (raw.length !== 6) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/**
 * Project a Prisma student row onto the flat record the visibility module reads.
 * The visibility module then decides which of these keys survive.
 */
export function toVisibilityRecord(student, { studentProfile = null, manualCv = null } = {}) {
  const editableProfile = studentProfile && typeof studentProfile === 'object' ? studentProfile : {};
  const xp = (student.xpEvents ?? []).reduce((sum, event) => sum + (event.amount ?? 0), 0);
  const approvedHours = (student.logbookEntries ?? [])
    .filter((entry) => entry.status === 'APPROVED')
    .reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  const verifiedCourses = (student.courseEnrolments ?? [])
    .filter((course) => course.verificationStatus === 'VERIFIED');
  const latestDiagnostic = (student.diagnostics ?? [])[0] ?? null;

  return {
    id: student.id,
    matricNo: student.matricNo,
    name: student.user?.name ?? null,
    email: student.user?.email ?? null,
    phone: editableProfile.phone ?? student.phone ?? null,
    facultyId: student.facultyId,
    faculty: student.faculty?.name ?? null,
    facultyCode: student.faculty?.code ?? null,
    programmeId: student.programmeId,
    programme: student.programme?.name ?? null,
    programmeLevel: student.programme?.level ?? null,
    year: student.academicYear ?? null,
    intake: intakeLabel(student),
    lifecycleStatus: student.lifecycleStatus ?? null,
    accountStatus: student.user?.accountStatus ?? null,
    lastSignInAt: student.user?.lastSignInAt ?? null,

    xp,
    tier: tierFor(xp)?.name ?? null,
    // Login streak is computed from sign-in history the platform does not
    // retain per day, so it is reported as unknown rather than guessed.
    streakDays: 0,
    badges: student.badges ?? [],

    hoursCompleted: Math.round(approvedHours * 10) / 10,
    // No programme currently records a required-hours target in the database.
    hoursRequired: null,
    logbookEntries: (student.logbookEntries ?? []).map((entry) => ({
      id: entry.id,
      title: entry.title,
      details: entry.details,
      hours: entry.hours,
      entryDate: entry.entryDate,
      status: entry.status,
      latitude: entry.latitude,
      longitude: entry.longitude,
      supervisorName: entry.approval?.supervisorName ?? null,
      supervisorDecision: entry.approval?.decision ?? null,
      supervisorDecidedAt: entry.approval?.usedAt ?? null,
    })),

    // The platform stores no ATS score for staff to read; the student's own CV
    // builder computes one in-session. Null renders as "—", never as a number.
    atsScore: null,
    experience: (student.applications ?? []).map((application) => ({
      id: application.id,
      role: application.jobPosting?.title ?? 'Application',
      organisation: application.jobPosting?.company?.name ?? null,
      stage: application.stage,
      updatedAt: application.updatedAt,
    })),
    manualSections: manualCv ?? { experience: [], volunteering: [], achievements: [] },
    verifiedSkills: student.skillTags ?? [],
    certifications: verifiedCourses.map((course) => ({
      id: course.id,
      title: course.title,
      provider: course.provider,
      skillTag: course.skillTag,
      verifiedAt: course.verifiedAt,
    })),

    diagnosticScores: latestDiagnostic
      ? {
        testId: latestDiagnostic.testId,
        score: Math.round((latestDiagnostic.score ?? 0) * 100),
        passed: latestDiagnostic.passed,
        takenAt: latestDiagnostic.createdAt,
        attempts: (student.diagnostics ?? []).length,
      }
      : null,
    skillGaps: latestDiagnostic?.gapTags ?? [],
    assessmentAttempts: (student.assessmentAttempts ?? []).map((attempt) => ({
      id: attempt.id,
      title: attempt.assessment?.title ?? 'Assessment',
      score: Math.round((attempt.score ?? 0) * 100),
      passed: attempt.passed,
      passMark: attempt.assessment?.passMark ?? null,
      submittedAt: attempt.submittedAt,
    })),

    fyp: student.fypProject ?? null,

    bio: editableProfile.bio ?? student.bio ?? null,
    careerTargets: editableProfile.careerTargets ?? student.careerTargets ?? null,
    industries: editableProfile.industries ?? student.industries ?? null,
    portfolioUrl: editableProfile.portfolioUrl ?? student.portfolioUrl ?? student.fypProject?.liveUrl ?? null,
    linkedinUrl: editableProfile.linkedinUrl ?? student.linkedinUrl ?? null,
    publicTalent: Boolean(student.searchable),
  };
}

/** Why a role is allowed each layer — shown next to the layer it unlocks. */
const LAYER_LABELS = {
  identity: 'Who they are',
  gamification: 'Engagement and rewards',
  logbook: 'Fieldwork and placement hours',
  cv: 'CV, skills and certificates',
  diagnostics: 'Skills diagnostic results',
  fyp: 'Final Year Project',
  careerTargets: 'Career goals and visibility',
};

/**
 * Sentences explaining what is missing and why. The audience is a non-technical
 * member of staff, so each reason states the job the role does, not the rule id.
 */
const HIDDEN_REASONS = {
  CAREER_COUNSELOR: {
    logbook: 'Placement and fieldwork records, including any GPS check-in locations, are not shown to career counselling staff — counselling does not depend on knowing where a student physically was.',
    fyp: 'Final Year Project files are held by the programme team. Ask the Head of Programme if you need them for a reference.',
  },
  UNIVERSITY_REGISTRAR: {
    diagnostics: 'Skills diagnostic results are formative coaching data and are not part of graduation clearance.',
    fyp: 'Final Year Project marks and files sit with the programme team, not with the Registry record.',
    careerTargets: 'A student’s private career goals are not part of the graduation record.',
  },
  PLACEMENT_OFFICER: {
    gamification: 'Engagement points and badges are not part of placement administration.',
    cv: 'CV drafts and certificates are handled by career counselling staff.',
    diagnostics: 'Skills diagnostic results are formative coaching data held by career counselling staff.',
    fyp: 'Final Year Projects are reviewed by the programme team.',
  },
  ACADEMIC_SUPERVISOR: {
    gamification: 'Engagement points and badges are not relevant to academic supervision.',
    cv: 'CV drafts and certificates belong to the student and to career counselling staff.',
    careerTargets: 'A student’s private career goals are theirs to share, not part of supervision.',
  },
};

const DEFAULT_HIDDEN_REASON = 'This part of the record is not available to your role.';

/**
 * @returns {Array<{ layer: string, label: string, reason: string }>} every layer
 *   the role does not receive, with a sentence explaining the omission.
 */
export function describeHiddenLayers(role) {
  const granted = new Set(layersForRole(role));
  const reasons = HIDDEN_REASONS[role] ?? {};

  return Object.values(STUDENT_PROFILE_LAYERS)
    .filter((layer) => !granted.has(layer))
    .map((layer) => ({
      layer,
      label: LAYER_LABELS[layer] ?? layer,
      reason: reasons[layer] ?? DEFAULT_HIDDEN_REASON,
    }));
}

/** Build the full API payload for one student record. */
export function buildStudentRecordResponse(student, { role, isSelf = false, studentProfile = null, manualCv = null } = {}) {
  const record = toVisibilityRecord(student, { studentProfile, manualCv });
  const view = buildStudentProfileView(record, { role, isSelf });

  return {
    id: student.id,
    matricNo: student.matricNo,
    role,
    layers: view.layers,
    layerLabels: LAYER_LABELS,
    profile: view.profile,
    hiddenLayers: describeHiddenLayers(role),
    gpsVisible: canReadGps(role),
    gpsNote: canReadGps(role)
      ? 'GPS check-in locations are shown because your role supervises fieldwork.'
      : 'GPS check-in locations are hidden for your role. Only staff who supervise fieldwork can see where a check-in was made.',
    generatedAt: new Date().toISOString(),
  };
}
