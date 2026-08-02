import { FACULTIES, DEFAULT_STUDENT } from './data/facultyData.js';

const CANONICAL_IDENTITY_FIELDS = [
  'id',
  'databaseId',
  'matricNo',
  'facultyId',
  'programmeId',
  'programme',
  'year',
  'intakeYearMonth',
  'intakeSequence',
  'email',
  'name',
  'avatarUrl',
  'liveIdentity',
  'identityVerified',
];

function readTextSafely(res) {
  return res.text().catch(() => '');
}

async function readJsonSafely(res) {
  try {
    return JSON.parse(await readTextSafely(res));
  } catch {
    return null;
  }
}

function normalizeError(message, { status = 500, code = 'REQUEST_FAILED' } = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

async function handle(res) {
  const body = await readJsonSafely(res);

  if (!res.ok) {
    const message = body?.error || `Request failed (${res.status})`;
    throw normalizeError(message, {
      status: res.status,
      code: body?.code || 'REQUEST_FAILED',
    });
  }

  return body;
}

function cloneDefaultStudent() {
  return structuredClone(DEFAULT_STUDENT);
}

export function createUnauthenticatedStudentProjection() {
  return {
    ...cloneDefaultStudent(),
    id: null,
    databaseId: null,
    matricNo: null,
    facultyId: DEFAULT_STUDENT.facultyId ?? null,
    programmeId: null,
    programme: '',
    year: null,
    intakeYearMonth: null,
    intakeSequence: null,
    email: '',
    name: '',
    phone: '',
    xp: 0,
    level: '',
    careerTargets: '',
    industries: '',
    bio: '',
    skills: [],
    portfolioUrl: '',
    githubUrl: '',
    linkedinUrl: '',
    resumeSummary: '',
    resumeData: null,
    publicTalent: false,
    fypSubmission: null,
    diagnosticResult: null,
    workshopAttendance: [],
    courses: [],
    avatarUrl: null,
    badges: [],
    logbookEntries: [],
    liveIdentity: false,
    identityVerified: false,
    liveLogbookLoaded: false,
    liveLogbookError: null,
  };
}

function findFacultyById(facultyId) {
  return FACULTIES.find((faculty) => faculty.id === facultyId) ?? null;
}

function toCanonicalStudentProjection(identity, fallbackStudent) {
  const baseline = {
    ...cloneDefaultStudent(),
    ...(fallbackStudent ? structuredClone(fallbackStudent) : {}),
  };

  if (!identity?.student) {
    return {
      ...baseline,
      id: null,
      databaseId: null,
      matricNo: null,
      facultyId: identity?.faculty?.id ?? baseline.facultyId ?? DEFAULT_STUDENT.facultyId,
      programmeId: identity?.programme?.id ?? null,
      programme: identity?.programme?.name ?? baseline.programme ?? '',
      year: baseline.year ?? 1,
      email: identity?.user?.email ?? baseline.email ?? '',
      name: identity?.user?.name ?? baseline.name ?? '',
      avatarUrl: identity?.user?.avatarUrl ?? baseline.avatarUrl ?? null,
      phone: identity?.student?.phone ?? baseline.phone ?? '',
      bio: identity?.student?.bio ?? baseline.bio ?? '',
      careerTargets: identity?.student?.careerTargets ?? baseline.careerTargets ?? '',
      industries: identity?.student?.industries ?? baseline.industries ?? '',
      portfolioUrl: identity?.student?.portfolioUrl ?? baseline.portfolioUrl ?? '',
      githubUrl: identity?.student?.githubUrl ?? baseline.githubUrl ?? '',
      linkedinUrl: identity?.student?.linkedinUrl ?? baseline.linkedinUrl ?? '',
      resumeSummary: identity?.student?.resumeSummary ?? baseline.resumeSummary ?? '',
      resumeData: identity?.student?.resumeData ?? baseline.resumeData ?? null,
      logbookEntries: [],
      liveIdentity: false,
      identityVerified: Boolean(identity?.user?.id),
    };
  }

  return {
    ...baseline,
    id: identity.student.matricNo ?? baseline.id,
    databaseId: identity.student.id,
    matricNo: identity.student.matricNo ?? null,
    facultyId: identity.student.facultyId ?? baseline.facultyId,
    programmeId: identity.student.programmeId ?? null,
    programme: identity.programme?.name ?? baseline.programme ?? '',
    year: Number(identity.student.academicYear ?? baseline.year ?? 1),
    intakeYearMonth: identity.student.intakeYearMonth ?? baseline.intakeYearMonth ?? null,
    intakeSequence: identity.student.intakeSequence ?? baseline.intakeSequence ?? null,
    email: identity.user?.email ?? baseline.email ?? '',
    name: identity.user?.name ?? baseline.name ?? '',
    avatarUrl: identity.user?.avatarUrl ?? baseline.avatarUrl ?? null,
    phone: identity.student.phone ?? baseline.phone ?? '',
    bio: identity.student.bio ?? baseline.bio ?? '',
    careerTargets: identity.student.careerTargets ?? baseline.careerTargets ?? '',
    industries: identity.student.industries ?? baseline.industries ?? '',
    portfolioUrl: identity.student.portfolioUrl ?? baseline.portfolioUrl ?? '',
    githubUrl: identity.student.githubUrl ?? baseline.githubUrl ?? '',
    linkedinUrl: identity.student.linkedinUrl ?? baseline.linkedinUrl ?? '',
    resumeSummary: identity.student.resumeSummary ?? baseline.resumeSummary ?? '',
    resumeData: identity.student.resumeData ?? baseline.resumeData ?? null,
    logbookEntries: [],
    liveIdentity: true,
    identityVerified: true,
  };
}

export function normalizeLogbookEntry(entry) {
  return {
    id: entry.id,
    date: entry.entryDate ? new Date(entry.entryDate).toISOString().split('T')[0] : null,
    entryDate: entry.entryDate ?? null,
    facultyId: entry.facultyId ?? null,
    hours: Number(entry.hours ?? 0),
    status: entry.status ?? 'PENDING',
    supervisor: entry.approval?.supervisorName ?? 'No supervisor assigned',
    title: entry.title ?? 'Untitled logbook entry',
    details: entry.details ?? '',
    live: true,
    verified: entry.status === 'APPROVED' || entry.approval?.decision === 'APPROVED',
    approval: entry.approval
      ? {
        supervisorName: entry.approval.supervisorName ?? null,
        supervisorEmail: entry.approval.supervisorEmail ?? null,
        decision: entry.approval.decision ?? null,
        comment: entry.approval.comment ?? null,
        usedAt: entry.approval.usedAt ?? null,
      }
      : null,
  };
}

export function mergeCanonicalStudentLogbookEntries(student, entries) {
  const loadedEntries = Array.isArray(entries) ? entries : [];

  if (!student) {
    return student;
  }

  return {
    ...student,
    logbookEntries: loadedEntries.map(normalizeLogbookEntry),
    liveLogbookError: null,
    liveLogbookLoaded: true,
  };
}

export function applyCanonicalLogbookFailure(student, message) {
  if (!student) {
    return student;
  }

  return {
    ...student,
    logbookEntries: [],
    liveLogbookError: message || 'Your live logbook entries could not be loaded.',
    liveLogbookLoaded: false,
  };
}

export function shouldRenderAuthenticatedPortalChrome({ demoMode = false, identity = null } = {}) {
  return Boolean(demoMode || identity?.user?.id);
}

export function normalizeCanonicalIdentity({
  identity,
  fallbackStudent = DEFAULT_STUDENT,
  demoRole = null,
  authMode = 'firebase-google',
} = {}) {
  const demoMode = authMode === 'demo' && !identity?.user?.id;
  const resolvedStudent = identity
    ? toCanonicalStudentProjection(identity, fallbackStudent)
    : demoMode
      ? structuredClone(fallbackStudent)
      : createUnauthenticatedStudentProjection();

  const activeFaculty = findFacultyById(
    identity?.faculty?.id
      ?? identity?.student?.facultyId
      ?? resolvedStudent?.facultyId
      ?? DEFAULT_STUDENT.facultyId,
  ) ?? FACULTIES[0];

  if (identity?.user?.id) {
    return {
      identity,
      student: resolvedStudent,
      currentRole: identity.role ?? identity.user.role ?? 'STUDENT',
      activeFaculty,
      demoMode: false,
      hasLiveIdentity: true,
    };
  }

  return {
    identity: null,
    student: resolvedStudent,
    currentRole: demoMode && typeof demoRole === 'string' ? demoRole : 'STUDENT',
    activeFaculty,
    demoMode,
    hasLiveIdentity: false,
  };
}

export function preserveCanonicalStudentFields(nextStudent, canonicalStudent) {
  if (!canonicalStudent || !nextStudent) {
    return nextStudent;
  }

  const preserved = { ...nextStudent };

  for (const field of CANONICAL_IDENTITY_FIELDS) {
    preserved[field] = canonicalStudent[field] ?? null;
  }

  return preserved;
}

export async function fetchCanonicalIdentity() {
  const res = await fetch('/api/identity/me', { cache: 'no-store' });
  return handle(res);
}

/** Resolve a student's database id + faculty/programme from their matric number. */
export async function fetchStudentByMatric(matricNo) {
  const res = await fetch(`/api/students/by-matric/${encodeURIComponent(matricNo)}`, { cache: 'no-store' });
  return handle(res);
}

/**
 * Fetch the acting student's logbook entries, newest first. studentId is
 * optional — the server resolves the student from the session (or, in demo, the
 * seeded student), so demo mode works without a client-side database id.
 */
export async function fetchLogbookEntries(studentId) {
  const query = studentId ? `?studentId=${encodeURIComponent(studentId)}` : '';
  const res = await fetch(`/api/logbook${query}`, { cache: 'no-store' });
  return handle(res);
}

/** Submit a new logbook entry and mint the supervisor's magic-link approval. */
export async function submitLogbookEntry(payload) {
  const res = await fetch('/api/logbook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

/** Record a supervisor's decision against a magic-link token. */
export async function submitApprovalDecision(token, decision, comment) {
  const res = await fetch(`/api/approvals/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, comment: comment ?? null }),
  });
  return handle(res);
}

// The "View as" role in demo mode lives in the client; staff-only endpoints
// (e.g. the FYP approval queue) read it from this header. Under real auth the
// server ignores the header and trusts the session, so it is harmless to send.
function demoRoleHeaders(role) {
  return role ? { 'x-demo-role': role } : {};
}

/** Live operational metrics and scoped student rows for staff workspaces. */
export async function fetchAdminOverview(role) {
  const res = await fetch('/api/admin/overview', {
    cache: 'no-store',
    headers: { ...demoRoleHeaders(role) },
  });
  return handle(res);
}

/** Admin data explorer: a paged, searchable window onto a raw entity table. */
export async function fetchAdminData(entity, { page = 1, q = '', pageSize = 25 } = {}, role) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (q) params.set('q', q);
  const res = await fetch(`/api/admin/data/${entity}?${params.toString()}`, {
    cache: 'no-store',
    headers: { ...demoRoleHeaders(role) },
  });
  return handle(res);
}

/** Load the acting user's durable in-app notifications. */
export async function fetchNotifications({ unread = false, limit = 25 } = {}, role) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (unread) params.set('unread', '1');
  const res = await fetch(`/api/notifications?${params.toString()}`, {
    cache: 'no-store',
    headers: { ...demoRoleHeaders(role) },
  });
  return handle(res);
}

/** Mark one notification, or the whole inbox, as read. */
export async function markNotificationsRead({ notificationId, markAllRead = false } = {}, role) {
  const res = await fetch('/api/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...demoRoleHeaders(role) },
    body: JSON.stringify({ notificationId, markAllRead }),
  });
  return handle(res);
}

/** The acting student's live XP total + tier, summed from the ledger (Module 1). */
export async function fetchXpSummary() {
  const res = await fetch('/api/xp', { cache: 'no-store' });
  return handle(res);
}

/** Read the database-derived university XP leaderboard. */
export async function fetchLeaderboard() {
  const res = await fetch('/api/xp/leaderboard', { cache: 'no-store' });
  return handle(res);
}

/** The acting student's completed career milestone ids (Module 3). */
export async function fetchMilestoneCompletions() {
  const res = await fetch('/api/career/milestones', { cache: 'no-store' });
  return handle(res);
}

/** Toggle a career milestone; completing awards +100 XP once (Module 3). */
export async function toggleMilestone(milestoneId, completed) {
  const res = await fetch('/api/career/milestones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ milestoneId, completed }),
  });
  return handle(res);
}

/** Live internship lifecycle state and recorded automation events. */
export async function fetchLifecycleStatus() {
  const res = await fetch('/api/career-path/lifecycle', { cache: 'no-store' });
  return handle(res);
}

/** Re-evaluate actual approved logbook hours; never fabricates completion. */
export async function refreshLifecycleStatus() {
  const res = await fetch('/api/career-path/lifecycle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return handle(res);
}

/** List published workshops from the database (Module 5). */
export async function fetchWorkshops() {
  const res = await fetch('/api/workshops', { cache: 'no-store' });
  return handle(res);
}

/** Employer host requests and CPDC review queue (Module 5). */
export async function fetchWorkshopRequests(role) {
  const res = await fetch('/api/workshops/requests', {
    cache: 'no-store',
    headers: { ...demoRoleHeaders(role) },
  });
  return handle(res);
}

/** Save an employer's workshop proposal for CPDC review. */
export async function submitWorkshopRequest(payload, role) {
  const res = await fetch('/api/workshops/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...demoRoleHeaders(role) },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

/** Review an employer host request. */
export async function decideWorkshopRequest(requestId, status, reviewNote, role) {
  const res = await fetch('/api/workshops/requests', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...demoRoleHeaders(role) },
    body: JSON.stringify({ requestId, status, reviewNote: reviewNote ?? null }),
  });
  return handle(res);
}

/** Publish a workshop to the database (staff action, Module 5). */
export async function publishWorkshop(payload, role) {
  const res = await fetch('/api/workshops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...demoRoleHeaders(role) },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

/** RSVP (or cancel) a seat for a workshop (Module 5). */
export async function rsvpWorkshop(workshopId, going) {
  const res = await fetch('/api/workshops/rsvp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workshopId, going }),
  });
  return handle(res);
}

/**
 * Check in to a workshop; awards the workshop's XP once (Module 5).
 * Pass { qrSecret } for a real scan, or { workshopId } for a demo simulated scan.
 */
export async function checkInWorkshop({ qrSecret, workshopId } = {}) {
  const res = await fetch('/api/workshops/check-in', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrSecret, workshopId }),
  });
  return handle(res);
}

/** The acting student's FYP project record, or null (Module 2). */
export async function fetchFypProject() {
  const res = await fetch('/api/fyp', { cache: 'no-store' });
  return handle(res);
}

/** Create or update the acting student's FYP submission (Module 2). */
export async function saveFypProject(payload) {
  const res = await fetch('/api/fyp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

/** Head-of-Programme approval queue of FYP projects (Module 2). */
export async function fetchFypApprovals(role) {
  const res = await fetch('/api/fyp/approvals', {
    cache: 'no-store',
    headers: { ...demoRoleHeaders(role) },
  });
  return handle(res);
}

/** Record an approval decision on a student's FYP project (Module 2). */
export async function decideFypProject(projectId, status, reviewNote, role) {
  const res = await fetch(`/api/fyp/${encodeURIComponent(projectId)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...demoRoleHeaders(role) },
    body: JSON.stringify({ status, reviewNote: reviewNote ?? null }),
  });
  return handle(res);
}

/** The acting student's diagnostic history, latest attempt, and baseline (Module 7). */
export async function fetchDiagnostics() {
  const res = await fetch('/api/diagnostics', { cache: 'no-store' });
  return handle(res);
}

/** Load assessments visible to the current student or staff role. */
export async function fetchAssessments(role) {
  const res = await fetch('/api/assessments', {
    cache: 'no-store',
    headers: { ...demoRoleHeaders(role) },
  });
  return handle(res);
}

/** Load the standalone faculty/programme catalogue for scoped staff forms. */
export async function fetchFaculties() {
  const res = await fetch('/api/faculties', { cache: 'no-store' });
  return handle(res);
}

/** Start a server-timed assessment attempt. */
export async function startAssessmentAttempt(assessmentId) {
  const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start' }),
  });
  return handle(res);
}

/** Import a PDF, Word document, or text assessment into a staff draft. */
export async function importAssessment(formData, role) {
  const res = await fetch('/api/assessments', {
    method: 'POST',
    headers: { ...demoRoleHeaders(role) },
    body: formData,
  });
  return handle(res);
}

/** Publish, archive, or edit a staff assessment draft. */
export async function updateAssessment(assessmentId, payload, role) {
  const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...demoRoleHeaders(role) },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

/** Submit a student's answers; correct answers are never sent to the browser. */
export async function submitAssessmentAttempt(assessmentId, answers, attemptId) {
  const res = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'submit', attemptId, answers }),
  });
  return handle(res);
}

/** Persist a diagnostic attempt; awards Diagnostic XP once on first pass (Module 7). */
export async function saveDiagnostic(payload) {
  const res = await fetch('/api/diagnostics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

/** Public feed of approved, opted-in FYP projects (Module 13). */
export async function fetchTalentFeed() {
  const res = await fetch('/api/talent', { cache: 'no-store' });
  return handle(res);
}

/** Persist employer/alumni outreach against an approved talent project. */
export async function sendTalentOutreach(projectId, kind, message = null, role) {
  const res = await fetch('/api/talent/outreach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...demoRoleHeaders(role) },
    body: JSON.stringify({ projectId, kind, message }),
  });
  return handle(res);
}

/** Load outreach history for the signed-in recruiter, alumni or CPDC role. */
export async function fetchTalentOutreach(role) {
  const res = await fetch('/api/talent/outreach', { cache: 'no-store', headers: { ...demoRoleHeaders(role) } });
  return handle(res);
}

// ---- Employer marketplace (Module 11) ----

/** List open vacancies (with the acting student's application state). */
export async function fetchJobs() {
  const res = await fetch('/api/jobs', { cache: 'no-store' });
  return handle(res);
}

/** Publish a vacancy (employer/admin). */
export async function publishJob(payload, role) {
  const res = await fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...demoRoleHeaders(role) },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

/** Student applies to a vacancy. */
export async function applyToJob(jobPostingId) {
  const res = await fetch('/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobPostingId }),
  });
  return handle(res);
}

/** Employer: applicants for a vacancy. */
export async function fetchApplicants(jobPostingId, role) {
  const res = await fetch(`/api/applications?jobPostingId=${encodeURIComponent(jobPostingId)}`, {
    cache: 'no-store',
    headers: { ...demoRoleHeaders(role) },
  });
  return handle(res);
}

/** Employer: advance an application through the ATS stages. */
export async function setApplicationStage(applicationId, stage, role) {
  const res = await fetch('/api/applications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...demoRoleHeaders(role) },
    body: JSON.stringify({ applicationId, stage }),
  });
  return handle(res);
}

/** Persist a student's external-course evidence for staff review. */
export async function submitCourseEnrolment(payload) {
  const res = await fetch('/api/learning/enrolments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handle(res).then((data) => data.record ?? data);
}

/** Load student records or the staff verification queue. */
export async function fetchCourseEnrolments(role) {
  const res = await fetch('/api/learning/enrolments', {
    cache: 'no-store',
    headers: { ...demoRoleHeaders(role) },
  });
  return handle(res);
}

/** Record a staff verification decision for a course completion. */
export async function decideCourseEnrolment(enrolmentId, decision, role, reviewNote = null) {
  const res = await fetch('/api/learning/enrolments', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...demoRoleHeaders(role) },
    body: JSON.stringify({ enrolmentId, decision, reviewNote }),
  });
  return handle(res);
}

/** Live CV source data (approved logbook hours, badges, FYP, skills) — Module 8. */
export async function fetchCvData() {
  const res = await fetch('/api/cv', { cache: 'no-store' });
  return handle(res);
}

/** Read/toggle the acting student's employer-search visibility (Module 11). */
export async function fetchVisibility() {
  const res = await fetch('/api/profile/visibility', { cache: 'no-store' });
  return handle(res);
}
export async function setVisibility(searchable) {
  const res = await fetch('/api/profile/visibility', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ searchable }),
  });
  return handle(res);
}

/** Load the signed-in student's editable contact/profile/resume fields. */
export async function fetchStudentProfile() {
  const res = await fetch('/api/student/profile', { cache: 'no-store' });
  return handle(res);
}

/** Persist editable personal details and resume content. */
export async function saveStudentProfile(payload) {
  const res = await fetch('/api/student/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

/** Edit a pending logbook entry's supervisor and re-mint the approval link (Module 4). */
export async function updateLogbookSupervisor(entryId, supervisor) {
  const res = await fetch(`/api/logbook/${encodeURIComponent(entryId)}/supervisor`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ supervisor }),
  });
  return handle(res);
}

/** Load the scoped internal logbook review queue for staff. */
export async function fetchLogbookReviews(role) {
  const res = await fetch('/api/logbook/reviews', {
    cache: 'no-store',
    headers: { ...demoRoleHeaders(role) },
  });
  return handle(res);
}

/** Record an internal academic/placement logbook decision. */
export async function decideLogbookReview(entryId, status, role, comment = null) {
  const res = await fetch('/api/logbook/reviews', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...demoRoleHeaders(role) },
    body: JSON.stringify({ entryId, status, comment }),
  });
  return handle(res);
}
