// Module 1 -- first-login onboarding policy.
//
// Two questions are answered here, and nowhere else:
//
//   1. Has this student already finished onboarding?  (confirm ONCE, never again)
//   2. Which professional accounts must this student connect before they can
//      continue, given their faculty and programme?
//
// Both are pure functions over plain data so they can be unit-tested without a
// database, and so the API route, the onboarding UI, and the portal gate all
// reach the same verdict from the same source. A policy that lives in three
// places is a policy that drifts.

/**
 * Revision of the first-run flow.
 *
 * A student whose `onboardingVersion` is >= this number is done and is never
 * shown the flow again. Raising this number is the ONLY supported way to
 * re-prompt an existing cohort -- e.g. if CPDC later makes ORCID compulsory for
 * Life Sciences. Do not raise it for cosmetic changes; every student in the
 * university sees the flow again.
 */
// 2 (2026-11-25): LinkedIn must be linked by signing in to LinkedIn (when the
// LinkedIn keys are set), so alumni can still sign in after their QIU email
// closes. Students who finished with a pasted link are asked once more.
export const ONBOARDING_VERSION = 2;

/** Provider metadata shared by the API and the UI, so labels never diverge. */
export const PROVIDERS = Object.freeze({
  LINKEDIN: {
    id: 'LINKEDIN',
    label: 'LinkedIn',
    // Why the student is being asked -- shown verbatim in the UI. A mandatory
    // step without a stated reason reads as bureaucracy.
    reason:
      'CPDC and your lecturers stay connected to you here after you graduate. This is how the university reaches alumni for mentoring, jobs, and references.',
    // Canonical form first -- normalizeProfileUrl rewrites every accepted
    // variant (my.linkedin.com, bare linkedin.com) to hostnames[0].
    hostnames: ['www.linkedin.com', 'linkedin.com'],
    // Public profile URLs only: /in/<vanity>. Company and school pages are a
    // common paste mistake and are not a personal profile.
    pathPattern: /^\/in\/[A-Za-z0-9\-_%]{3,100}\/?$/,
    signUpUrl: 'https://www.linkedin.com/signup',
    profileHelpUrl: 'https://www.linkedin.com/help/linkedin/answer/a522735',
    placeholder: 'https://www.linkedin.com/in/your-name',
  },
  GITHUB: {
    id: 'GITHUB',
    label: 'GitHub',
    reason:
      'For computing and engineering, your public repositories are your portfolio. Employers using the QIU talent feed look at it before they look at your CV.',
    hostnames: ['github.com', 'www.github.com'],
    // A user profile is a single path segment. Repository URLs (two segments)
    // are rejected: a repo is not a profile.
    pathPattern: /^\/[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/?$/,
    signUpUrl: 'https://github.com/signup',
    profileHelpUrl: 'https://docs.github.com/en/account-and-profile',
    placeholder: 'https://github.com/your-username',
  },
  ORCID: {
    id: 'ORCID',
    label: 'ORCID',
    reason:
      'A persistent researcher ID that keeps your publications attributed to you across institutions.',
    hostnames: ['orcid.org', 'www.orcid.org'],
    pathPattern: /^\/\d{4}-\d{4}-\d{4}-\d{3}[\dX]\/?$/,
    signUpUrl: 'https://orcid.org/register',
    profileHelpUrl: 'https://info.orcid.org/researchers/',
    placeholder: 'https://orcid.org/0000-0000-0000-0000',
  },
  BEHANCE: {
    id: 'BEHANCE',
    label: 'Behance',
    reason: 'A visual portfolio employers in media and communication expect to see.',
    hostnames: ['www.behance.net', 'behance.net'],
    pathPattern: /^\/[A-Za-z0-9_-]{2,60}\/?$/,
    signUpUrl: 'https://www.behance.net/',
    profileHelpUrl: 'https://help.behance.net/',
    placeholder: 'https://www.behance.net/your-name',
  },
  PORTFOLIO: {
    id: 'PORTFOLIO',
    label: 'Personal portfolio',
    reason: 'Your own site, if you have one.',
    // Any host: this is deliberately the one open-ended provider.
    hostnames: null,
    pathPattern: null,
    signUpUrl: null,
    profileHelpUrl: null,
    placeholder: 'https://your-site.com',
  },
});

export const PROVIDER_IDS = Object.freeze(Object.keys(PROVIDERS));

/**
 * University-wide requirement.
 *
 * LinkedIn is compulsory for every student in every faculty. It is the alumni
 * contact channel, and its value to CPDC is precisely that it has no gaps.
 */
const UNIVERSITY_REQUIRED = Object.freeze(['LINKEDIN']);

/**
 * Discipline-specific requirements, keyed by Faculty.id.
 *
 * The rule the university asked for: where a service IS the professional record
 * of that discipline, it is required of students in that discipline. Everywhere
 * else the same service stays available and encouraged, but never blocking --
 * a Business student connecting GitHub is a good outcome, not a policy breach.
 */
const FACULTY_REQUIRED = Object.freeze({
  // Computing & Engineering: a public repository history is the portfolio.
  computing_engineering: ['GITHUB'],
});

/**
 * Programme-level overrides, keyed by the QIU course code (Programme.code, or
 * the initials fallback). Checked before the faculty rule, so a computing-style
 * programme sitting administratively inside another faculty still gets GitHub.
 *
 * Kept as an explicit list rather than keyword-matching a programme name: a
 * mandatory blocking requirement must never be inferred from a fuzzy match.
 */
const PROGRAMME_REQUIRED = Object.freeze({
  BCS: ['GITHUB'], // Computer Science
  BIT: ['GITHUB'], // Information Technology
  BSE: ['GITHUB'], // Software Engineering
  BAI: ['GITHUB'], // Artificial Intelligence
  BDS: ['GITHUB'], // Data Science
});

/**
 * Suggested-but-optional providers per faculty. These are surfaced in the flow
 * as "also worth connecting" and never block the Continue button.
 */
const FACULTY_SUGGESTED = Object.freeze({
  lifesciences: ['ORCID', 'GITHUB'],
  medicine: ['ORCID'],
  pharmacy: ['ORCID'],
  communication: ['BEHANCE', 'PORTFOLIO'],
  education: ['PORTFOLIO'],
  business: ['PORTFOLIO'],
  hospitality: ['PORTFOLIO'],
  computing_engineering: ['PORTFOLIO'],
});

function dedupe(list) {
  return [...new Set(list.filter(Boolean))];
}

/**
 * Which providers must this student connect before onboarding can complete?
 *
 * @param {{facultyId?: string|null, programmeCode?: string|null}} student
 * @returns {string[]} provider ids, LinkedIn always first (it is asked first).
 */
export function requiredProvidersFor({ facultyId = null, programmeCode = null } = {}) {
  const code = typeof programmeCode === 'string' ? programmeCode.trim().toUpperCase() : null;
  const fromProgramme = (code && PROGRAMME_REQUIRED[code]) || [];
  const fromFaculty = (facultyId && FACULTY_REQUIRED[facultyId]) || [];

  return dedupe([...UNIVERSITY_REQUIRED, ...fromProgramme, ...fromFaculty]);
}

/** Optional providers we surface to this student. Never blocking. */
export function suggestedProvidersFor({ facultyId = null, programmeCode = null } = {}) {
  const required = new Set(requiredProvidersFor({ facultyId, programmeCode }));
  const suggested = (facultyId && FACULTY_SUGGESTED[facultyId]) || ['PORTFOLIO'];

  // Every provider is offered to everyone -- the faculty list only controls the
  // ORDER of the suggestions, so a Business student can still attach GitHub.
  const rest = PROVIDER_IDS.filter((id) => !suggested.includes(id));

  return dedupe([...suggested, ...rest]).filter((id) => !required.has(id));
}

/**
 * The single verdict the portal gate, the API and the UI all read.
 *
 * @param {object} student  A Student row (or a projection carrying the same
 *   fields). `connectedAccounts` may be omitted when only the version check
 *   matters, but then `missingProviders` cannot be trusted -- hence the
 *   explicit `evaluated` flag rather than a silently empty array.
 */
export function evaluateOnboarding(student, { signInRequired = [] } = {}) {
  if (!student) {
    return {
      required: [],
      missingProviders: [],
      connectedProviders: [],
      brokenProviders: [],
      identityConfirmed: false,
      complete: false,
      needsOnboarding: false, // no student context => nothing to gate
      reason: 'NO_STUDENT',
    };
  }

  const programmeCode = student.courseCode ?? student.programme?.code ?? null;
  const required = requiredProvidersFor({
    facultyId: student.facultyId ?? student.faculty?.id ?? null,
    programmeCode,
  });

  const accounts = Array.isArray(student.connectedAccounts) ? student.connectedAccounts : [];
  // A connection whose profile later 404'd does not count as connected. The row
  // is kept so the UI can say "your LinkedIn link no longer resolves" instead of
  // silently resetting a step the student remembers completing.
  // A provider in `signInRequired` counts only when the student signed in to
  // it (OAUTH): that stable account id is what lets an alumnus sign in with
  // LinkedIn after the QIU Google account is gone. A pasted link proves nothing.
  const live = accounts.filter((account) => (
    account
    && !account.brokenAt
    && (!signInRequired.includes(account.provider) || (account.method === 'OAUTH' && account.providerUserId))
  ));
  const connectedProviders = dedupe(live.map((account) => account.provider));
  const brokenProviders = dedupe(
    accounts.filter((account) => account?.brokenAt).map((account) => account.provider),
  );

  const missingProviders = required.filter((id) => !connectedProviders.includes(id));
  const identityConfirmed = Boolean(student.identityConfirmedAt);

  // The "confirm once" contract. A student who completed the current flow
  // revision is finished -- we do not re-derive it from the individual steps,
  // because a policy change must not retroactively un-complete someone.
  const versionCurrent = (student.onboardingVersion ?? 0) >= ONBOARDING_VERSION;
  const complete = Boolean(student.onboardingCompletedAt) && versionCurrent;

  let reason = 'COMPLETE';
  if (!complete) {
    if (!identityConfirmed) reason = 'IDENTITY_UNCONFIRMED';
    else if (missingProviders.length > 0) reason = 'CONNECTIONS_REQUIRED';
    else if (!versionCurrent) reason = 'POLICY_UPDATED';
    else reason = 'NOT_FINISHED';
  }

  return {
    required,
    missingProviders,
    connectedProviders,
    brokenProviders,
    identityConfirmed,
    complete,
    needsOnboarding: !complete,
    reason,
  };
}

/** Can the student finish the flow right now? */
export function canCompleteOnboarding(student, options = {}) {
  const verdict = evaluateOnboarding(student, options);
  return verdict.identityConfirmed && verdict.missingProviders.length === 0;
}
