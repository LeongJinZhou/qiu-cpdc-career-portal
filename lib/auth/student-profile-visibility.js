/**
 * Field-level visibility for a student profile.
 *
 * The access matrix specifies a student record as seven layers, and states for
 * every role which layers it may see. This module is the single place that
 * decision is made, so a new surface (an admin table, an export, a talent card)
 * cannot accidentally widen it by picking its own fields.
 *
 * Two separate questions, deliberately kept apart:
 *
 *   1. *May this actor reach this student at all?* — a scope question, owned by
 *      ./permissions.js (`hasCapability('student.read', { studentId, facultyId,
 *      programmeId })`). A faculty coordinator for Computing must not resolve a
 *      Medicine student, regardless of which layers they could otherwise read.
 *   2. *Given that they may, which fields do they get?* — this file.
 *
 * Call `buildStudentProfileView` with the answer to (1) already established.
 * It will not re-derive scope, and it fails closed: an unknown role gets
 * nothing rather than everything.
 */

/** The seven layers of a student record, in the order the matrix lists them. */
export const STUDENT_PROFILE_LAYERS = Object.freeze({
  IDENTITY: 'identity',
  GAMIFICATION: 'gamification',
  LOGBOOK: 'logbook',
  CV: 'cv',
  DIAGNOSTICS: 'diagnostics',
  FYP: 'fyp',
  CAREER_TARGETS: 'careerTargets',
});

const ALL_LAYERS = Object.freeze(Object.values(STUDENT_PROFILE_LAYERS));

/**
 * Layers each role may read, from the access matrix.
 *
 * `EXTERNAL_SUPERVISOR` is present here even though it is not an account role,
 * because a tokenised sign-off still renders a (very small) profile view. It is
 * reached only via a logbook token, never via a session.
 */
const ROLE_LAYERS = Object.freeze({
  STUDENT: ALL_LAYERS,
  SUPER_ADMIN: ALL_LAYERS,
  CPDC_ADMIN: ALL_LAYERS,
  FACULTY_COORDINATOR: ALL_LAYERS,
  HEAD_OF_PROGRAMME: ALL_LAYERS,

  // Assigned mentees only (scope enforced upstream). Sees the placement record
  // they supervise and the academic context around it — not the student's
  // private career targets or CV drafts.
  ACADEMIC_SUPERVISOR: [
    STUDENT_PROFILE_LAYERS.IDENTITY,
    STUDENT_PROFILE_LAYERS.LOGBOOK,
    STUDENT_PROFILE_LAYERS.DIAGNOSTICS,
    STUDENT_PROFILE_LAYERS.FYP,
  ],

  // Industrial training: placements and who is hosting them.
  PLACEMENT_OFFICER: [
    STUDENT_PROFILE_LAYERS.IDENTITY,
    STUDENT_PROFILE_LAYERS.LOGBOOK,
    STUDENT_PROFILE_LAYERS.CAREER_TARGETS,
  ],

  // Career counselling: CV, diagnostics and targets. No logbook, so no GPS —
  // a counsellor has no reason to know where a student physically was.
  CAREER_COUNSELOR: [
    STUDENT_PROFILE_LAYERS.IDENTITY,
    STUDENT_PROFILE_LAYERS.CV,
    STUDENT_PROFILE_LAYERS.DIAGNOSTICS,
    STUDENT_PROFILE_LAYERS.CAREER_TARGETS,
    STUDENT_PROFILE_LAYERS.GAMIFICATION,
  ],

  // Graduation clearance: hours completed and the co-curricular transcript.
  UNIVERSITY_REGISTRAR: [
    STUDENT_PROFILE_LAYERS.IDENTITY,
    STUDENT_PROFILE_LAYERS.LOGBOOK,
    STUDENT_PROFILE_LAYERS.CV,
    STUDENT_PROFILE_LAYERS.GAMIFICATION,
  ],

  // Opt-in showcase only, and only layers 1, 4, 6, 7 per the matrix.
  EMPLOYER: [
    STUDENT_PROFILE_LAYERS.IDENTITY,
    STUDENT_PROFILE_LAYERS.CV,
    STUDENT_PROFILE_LAYERS.FYP,
    STUDENT_PROFILE_LAYERS.CAREER_TARGETS,
  ],
  ALUMNI: [
    STUDENT_PROFILE_LAYERS.IDENTITY,
    STUDENT_PROFILE_LAYERS.CV,
    STUDENT_PROFILE_LAYERS.FYP,
    STUDENT_PROFILE_LAYERS.CAREER_TARGETS,
  ],

  EXTERNAL_SUPERVISOR: [
    STUDENT_PROFILE_LAYERS.IDENTITY,
    STUDENT_PROFILE_LAYERS.LOGBOOK,
  ],
});

/** Roles that only ever see a student who opted into the public talent feed. */
const PUBLIC_ONLY_ROLES = new Set(['EMPLOYER', 'ALUMNI']);

/**
 * Roles that may see raw GPS coordinates on a logbook entry.
 *
 * Split out from the logbook layer because location is the most sensitive field
 * in the record. An external supervisor sees the coordinates for the single
 * entry they were sent — that is the point of the check-in — but nobody reaches
 * a student's movement history without a staff scope.
 */
const GPS_ROLES = new Set([
  'STUDENT',
  'SUPER_ADMIN',
  'CPDC_ADMIN',
  'FACULTY_COORDINATOR',
  'HEAD_OF_PROGRAMME',
  'ACADEMIC_SUPERVISOR',
  'PLACEMENT_OFFICER',
  'EXTERNAL_SUPERVISOR',
]);

/** Layers a role may read. Unknown roles get nothing. */
export function layersForRole(role) {
  return ROLE_LAYERS[role] ?? [];
}

export function canReadLayer(role, layer) {
  return layersForRole(role).includes(layer);
}

export function canReadGps(role) {
  return GPS_ROLES.has(role);
}

/** Strip coordinates from logbook entries for roles that may not see them. */
function projectLogbookEntries(entries, role) {
  const list = Array.isArray(entries) ? entries : [];
  if (canReadGps(role)) return list;
  return list.map(({ latitude, longitude, ...rest }) => rest);
}

/**
 * Build the profile projection a role is allowed to see.
 *
 * @param {object} student  The full student record.
 * @param {object} options
 * @param {string} options.role          Viewer's role.
 * @param {boolean} [options.isSelf]     Viewer is the student themselves.
 * @param {string} [options.logbookEntryId] For EXTERNAL_SUPERVISOR: the single
 *   entry the token authorises. Any other entry is dropped.
 * @returns {{ role: string, layers: string[], profile: object }}
 */
export function buildStudentProfileView(student, { role, isSelf = false, logbookEntryId = null } = {}) {
  if (!student) {
    throw new Error('buildStudentProfileView requires a student record');
  }

  // A student reads their own record in full; against anyone else's they have
  // no staff scope and so see nothing. Resolving this here means a caller
  // cannot pass role: 'STUDENT' and read a peer.
  const effectiveLayers = role === 'STUDENT' && !isSelf ? [] : layersForRole(role);

  // Opt-in is a property of the *student*, not of the viewer, so it is checked
  // here rather than left to each caller's WHERE clause. A recruiter must never
  // see a record whose owner did not publish it, even if the query that found
  // them was wrong.
  if (PUBLIC_ONLY_ROLES.has(role) && !student.publicTalent) {
    return { role, layers: [], profile: null, reason: 'NOT_PUBLIC' };
  }

  const has = (layer) => effectiveLayers.includes(layer);
  const profile = {};

  if (has(STUDENT_PROFILE_LAYERS.IDENTITY)) {
    profile.identity = {
      matricNo: student.matricNo ?? null,
      name: student.name ?? null,
      avatarUrl: student.avatarUrl ?? null,
      facultyId: student.facultyId ?? null,
      programmeId: student.programmeId ?? null,
      programme: student.programme ?? null,
      year: student.year ?? null,
      intake: student.intake ?? null,
      // Contact details are internal. A recruiter reaches a student through the
      // invite system, never by email address lifted off a talent card.
      email: PUBLIC_ONLY_ROLES.has(role) ? null : (student.email ?? null),
      phone: PUBLIC_ONLY_ROLES.has(role) ? null : (student.phone ?? null),
    };
  }

  if (has(STUDENT_PROFILE_LAYERS.GAMIFICATION)) {
    profile.gamification = {
      xp: student.xp ?? 0,
      tier: student.tier ?? null,
      streakDays: student.streakDays ?? 0,
      badges: student.badges ?? [],
    };
  }

  if (has(STUDENT_PROFILE_LAYERS.LOGBOOK)) {
    let entries = student.logbookEntries ?? [];
    if (role === 'EXTERNAL_SUPERVISOR') {
      // The token authorises exactly one entry, so the rest of the placement
      // history is not theirs to read.
      entries = entries.filter((entry) => entry.id === logbookEntryId);
    }
    profile.logbook = {
      hoursCompleted: student.hoursCompleted ?? 0,
      hoursRequired: student.hoursRequired ?? null,
      entries: projectLogbookEntries(entries, role),
    };
  }

  if (has(STUDENT_PROFILE_LAYERS.CV)) {
    profile.cv = {
      atsScore: student.atsScore ?? null,
      experience: student.experience ?? [],
      verifiedSkills: student.verifiedSkills ?? student.skills ?? [],
      certifications: student.certifications ?? [],
      manualSections: student.manualSections ?? { experience: [], volunteering: [], achievements: [] },
    };
  }

  if (has(STUDENT_PROFILE_LAYERS.DIAGNOSTICS)) {
    profile.diagnostics = {
      scores: student.diagnosticScores ?? null,
      gaps: student.skillGaps ?? [],
      assessmentAttempts: student.assessmentAttempts ?? [],
    };
  }

  if (has(STUDENT_PROFILE_LAYERS.FYP)) {
    const fyp = student.fyp ?? student.fypSubmission ?? null;
    // Outsiders see a project only once a programme lead has approved it —
    // an unreviewed draft is not showcase material.
    const visibleToOutsiders = fyp?.status === 'APPROVED';
    profile.fyp = !fyp || (PUBLIC_ONLY_ROLES.has(role) && !visibleToOutsiders) ? null : fyp;
  }

  if (has(STUDENT_PROFILE_LAYERS.CAREER_TARGETS)) {
    profile.careerTargets = {
      bio: student.bio ?? null,
      targetRoles: student.careerTargets ?? null,
      industries: student.industries ?? null,
      portfolioUrl: student.portfolioUrl ?? null,
      linkedinUrl: student.linkedinUrl ?? null,
      publicTalent: Boolean(student.publicTalent),
    };
  }

  return { role, layers: effectiveLayers, profile };
}
