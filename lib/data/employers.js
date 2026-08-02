// Employer Portal data layer (Module 12 + §9.9).
//
// ─────────────────────────────────────────────────────────────────────────────
// PRIVACY RULE — DO NOT REMOVE OR RELAX
//
// An employer must NEVER be able to browse a raw roster of QIU students, e.g.
// "everyone in Computing Year 4". Every candidate an employer can see, rank,
// shortlist or invite has to have EXPLICITLY opted in to the public Talent Feed
// AND been cleared by a coordinator.
//
// That gate lives in getOptedInCandidates() below — at the data layer, not in
// the UI. Components must call it and must not read TALENT_FEED (or any future
// student table) directly, because hiding a card in JSX is not a privacy
// control: the data would still be in the client bundle and in props.
//
// Two independent conditions are required, and both are checked here:
//   1. Opt-in     — the student chose to be discoverable (`publicTalent` on the
//                   profile / `publicOptIn` on the FYP submission).
//   2. Approval   — a CPDC coordinator approved the showcase entry
//                   (`approved` on a feed row / status APPROVED on a submission).
//
// Contact is also constrained: employers reach students only through the
// structured invite flow modelled in this file. There is no free-text channel
// to a student, and no student contact detail (email, phone, ID) is exposed by
// any function here — see toCandidate(), which deliberately does not copy one.
// ─────────────────────────────────────────────────────────────────────────────

import { TALENT_FEED } from '@/lib/data/talent';
import { FACULTIES } from '@/lib/data/facultyData';

export const FACULTY_NAME_BY_ID = FACULTIES.reduce((acc, faculty) => {
  acc[faculty.id] = faculty.name;
  return acc;
}, {});

/**
 * Shape an approved, opted-in feed row into the candidate record employers see.
 * Only discovery-relevant, student-published fields are copied. Contact details,
 * student IDs, GPA and internal records are intentionally NOT included.
 */
function toCandidate(entry) {
  return {
    id: entry.id,
    name: entry.studentName,
    facultyId: entry.facultyId,
    faculty: FACULTY_NAME_BY_ID[entry.facultyId] ?? 'Quest International University',
    programme: entry.programme,
    gradYear: entry.gradYear ?? null,
    fypTitle: entry.title,
    fypAbstract: entry.abstract,
    skills: Array.isArray(entry.tech) ? entry.tech : [],
    badges: Array.isArray(entry.badges) ? entry.badges : [],
  };
}

/**
 * The ONLY source of employer-visible candidates.
 *
 * @param {object|null} student - the signed-in demo student profile, if any.
 * @returns {Array} candidates who opted in AND were coordinator-approved.
 */
export function getOptedInCandidates(student) {
  // Condition 2 (approval) for the seeded showcase rows. lib/data/talent.js only
  // ever contains entries the student published, so `approved` is the clearance.
  const candidates = TALENT_FEED.filter((entry) => entry.approved === true).map(toCandidate);

  // The signed-in student joins the employer-visible pool only when they have
  // opted in on their profile, opted in on the submission, AND the submission
  // was approved. A draft, a private submission or a pending review must never
  // become discoverable — remove any of these three checks and the module leaks.
  const submission = student?.fypSubmission;
  if (student?.publicTalent === true && submission?.publicOptIn === true && submission?.status === 'APPROVED') {
    candidates.unshift(
      toCandidate({
        id: `talent-${student.id}`,
        studentName: student.name,
        facultyId: student.facultyId,
        programme: student.programme,
        gradYear: 2027,
        title: submission.title || 'Final Year Project Showcase',
        abstract: student.bio || 'A QIU student project shared with coordinator approval.',
        tech: student.skills ?? [],
        badges: (student.badges ?? []).slice(0, 3).map((badge) => badge.title),
      }),
    );
  }

  return candidates;
}

// ── Job-description matching ────────────────────────────────────────────────
//
// Deterministic and explainable, in the same spirit as workshopMatch() in
// lib/matching.js. workshopMatch is not reused directly because it scores a
// *workshop against a student profile* on faculty/programme/year/interest —
// different inputs and different facets from ranking a *candidate against
// pasted job-description text*. The tokenizer and the "score + reasons" contract
// are kept identical so both matchers explain themselves the same way.

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'you', 'our', 'are', 'will', 'have', 'has', 'this', 'that',
  'from', 'who', 'was', 'were', 'been', 'their', 'they', 'them', 'your', 'about', 'into',
  'role', 'work', 'working', 'team', 'teams', 'join', 'looking', 'seeking', 'hiring',
  'candidate', 'candidates', 'applicant', 'applicants', 'job', 'position', 'company',
  'must', 'should', 'able', 'ability', 'strong', 'good', 'great', 'excellent', 'plus',
  'experience', 'years', 'year', 'skills', 'skill', 'knowledge', 'understanding',
  'responsibilities', 'requirements', 'preferred', 'degree', 'graduate', 'graduates',
  'student', 'students', 'intern', 'internship', 'opportunity', 'salary', 'benefits',
  'per', 'not', 'all', 'any', 'can', 'may', 'use', 'using', 'well', 'other', 'more',
]);

function words(value) {
  return String(value ?? '')
    .toLowerCase()
    .split(/[^a-z0-9+#.-]+/)
    .filter((word) => word.length > 2);
}

function keywords(value) {
  return words(value).filter((word) => !STOPWORDS.has(word));
}

/**
 * Does a named skill/badge/phrase appear in the job description?
 * Single- and two-word phrases must match every significant word (so "machine
 * learning" is not satisfied by "learning" alone); longer phrases match on half
 * their words, since job ads rarely repeat a badge title verbatim.
 */
function phraseHit(phrase, jdText, jdTokens) {
  const parts = keywords(phrase);
  if (!parts.length) return false;
  if (jdText.includes(String(phrase).toLowerCase())) return true;
  const hits = parts.filter((part) => jdTokens.has(part));
  if (parts.length <= 2) return hits.length === parts.length;
  return hits.length / parts.length >= 0.5;
}

// Facet weights. They sum to 100 so the returned score reads directly as a
// percentage, and each facet's contribution is reported back in `reasons`.
const FACET_WEIGHTS = { skills: 45, project: 25, badges: 20, programme: 10 };

/**
 * Score one opted-in candidate against pasted job-description text.
 * Returns { score, reasons, matchedSkills, matchedBadges, matchedTerms, coverage }.
 * Nothing here is random: the same JD and candidate always produce the same
 * number, and every point is attributable to a named match.
 */
export function rankCandidateAgainstJD(candidate, jobDescription) {
  const jdText = String(jobDescription ?? '').toLowerCase();
  const jdKeywords = keywords(jdText);
  const jdTokens = new Set(jdKeywords);
  const uniqueJdTerms = [...jdTokens];

  if (!uniqueJdTerms.length) {
    return { score: 0, reasons: [], matchedSkills: [], matchedBadges: [], matchedTerms: [], coverage: 0, jdTermCount: 0 };
  }

  const skills = candidate.skills ?? [];
  const badges = candidate.badges ?? [];

  const matchedSkills = skills.filter((skill) => phraseHit(skill, jdText, jdTokens));
  const matchedBadges = badges.filter((badge) => phraseHit(badge, jdText, jdTokens));

  const projectTokens = new Set(keywords(`${candidate.fypTitle} ${candidate.fypAbstract}`));
  const matchedTerms = uniqueJdTerms.filter((term) => projectTokens.has(term));

  const programmeTokens = new Set(keywords(`${candidate.programme} ${candidate.faculty}`));
  const programmeHits = uniqueJdTerms.filter((term) => programmeTokens.has(term));

  const skillRatio = skills.length ? matchedSkills.length / skills.length : 0;
  const badgeRatio = badges.length ? matchedBadges.length / badges.length : 0;
  // Four solid abstract/title term hits is treated as a full-strength topic
  // match; beyond that, extra hits are noise rather than added signal.
  const projectRatio = Math.min(1, matchedTerms.length / 4);
  const programmeRatio = Math.min(1, programmeHits.length / 2);

  const score = Math.round(
    FACET_WEIGHTS.skills * skillRatio
    + FACET_WEIGHTS.project * projectRatio
    + FACET_WEIGHTS.badges * badgeRatio
    + FACET_WEIGHTS.programme * programmeRatio,
  );

  const reasons = [];
  if (matchedSkills.length) {
    reasons.push({
      facet: 'Skills',
      detail: `${matchedSkills.length} of ${skills.length} listed skills appear in the job description: ${matchedSkills.join(', ')}.`,
      points: Math.round(FACET_WEIGHTS.skills * skillRatio),
    });
  }
  if (matchedTerms.length) {
    reasons.push({
      facet: 'Final Year Project',
      detail: `Their project write-up mentions ${matchedTerms.slice(0, 5).join(', ')}.`,
      points: Math.round(FACET_WEIGHTS.project * projectRatio),
    });
  }
  if (matchedBadges.length) {
    reasons.push({
      facet: 'Verified badges',
      detail: `Coordinator-verified: ${matchedBadges.join(', ')}.`,
      points: Math.round(FACET_WEIGHTS.badges * badgeRatio),
    });
  }
  if (programmeHits.length) {
    reasons.push({
      facet: 'Programme',
      detail: `${candidate.programme} lines up with "${programmeHits.slice(0, 3).join(', ')}" in the description.`,
      points: Math.round(FACET_WEIGHTS.programme * programmeRatio),
    });
  }

  const coveredTerms = new Set([
    ...matchedTerms,
    ...programmeHits,
    ...[...matchedSkills, ...matchedBadges].flatMap((phrase) => keywords(phrase).filter((part) => jdTokens.has(part))),
  ]);

  return {
    score: Math.min(100, score),
    reasons,
    matchedSkills,
    matchedBadges,
    matchedTerms,
    coverage: coveredTerms.size,
    jdTermCount: uniqueJdTerms.length,
  };
}

/** Extract the keywords a JD actually contributes, for the "we read this" chip row. */
export function jobDescriptionKeywords(jobDescription, limit = 14) {
  const counts = new Map();
  keywords(jobDescription).forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

// ── Demo fixtures ───────────────────────────────────────────────────────────
//
// CONTENT RULE: QIU is a real university. Every organisation below is an
// obviously fictional demo partner and is labelled as such, so nothing here can
// be mistaken for a real hiring partner, a real placement statistic, or a real
// testimonial. Do not swap in real company names for "realism".

export const DEMO_EMPLOYER_PROFILE = {
  id: 'emp-northgate',
  name: 'Northgate Analytics (demo partner)',
  monogram: 'NA',
  industry: 'Data & analytics consulting',
  size: '50–200 people',
  location: 'Ipoh, Perak · hybrid',
  website: 'northgate.example',
  verified: true,
  description:
    'Fictional demo employer used to exercise the QIU employer portal. Northgate Analytics is described as a mid-size analytics consultancy hiring graduate data analysts, junior engineers and placement interns.',
  hiringFor: ['Graduate Data Analyst', 'Junior Data Engineer', 'Analytics Placement Intern'],
};

// Opportunities shown to STUDENT / ALUMNI viewers. Fictional employers only.
export const DEMO_OPPORTUNITIES = [
  {
    id: 'opp-1',
    role: 'Graduate Data Analyst',
    employer: 'Northgate Analytics (demo partner)',
    type: 'Graduate role',
    location: 'Ipoh · hybrid',
    closes: '2026-09-15',
    facultyIds: ['computing_engineering', 'business'],
    skills: ['SQL', 'Python', 'Power BI', 'Stakeholder communication'],
    summary: 'Demo listing: work on client reporting pipelines and dashboards alongside a senior analyst.',
  },
  {
    id: 'opp-2',
    role: 'Software Engineering Intern',
    employer: 'Kestrel Systems (demo partner)',
    type: 'Internship · 12 weeks',
    location: 'Kuala Lumpur · on-site',
    closes: '2026-08-30',
    facultyIds: ['computing_engineering'],
    skills: ['JavaScript', 'Git', 'Testing', 'REST APIs'],
    summary: 'Demo listing: join a platform squad building internal tooling; mentored code reviews weekly.',
  },
  {
    id: 'opp-3',
    role: 'Clinical Research Assistant',
    employer: 'Bright Harbour Health (demo partner)',
    type: 'Placement',
    location: 'Perak · on-site',
    closes: '2026-10-01',
    facultyIds: ['medicine', 'pharmacy', 'lifesciences'],
    skills: ['Data collection', 'Lab safety', 'Report writing'],
    summary: 'Demo listing: support data collection and documentation for a community health study.',
  },
  {
    id: 'opp-4',
    role: 'Communications & Content Assistant',
    employer: 'Larkspur Media (demo partner)',
    type: 'Part-time',
    location: 'Remote',
    closes: '2026-09-05',
    facultyIds: ['communication', 'education', 'hospitality'],
    skills: ['Copywriting', 'Social media', 'Editing'],
    summary: 'Demo listing: draft campaign copy and schedule content for a small in-house team.',
  },
];

// The employer's OWN activity — the only analytics an employer may see.
// No university-wide or cross-employer figures are exposed here.
export const DEMO_EMPLOYER_ACTIVITY = {
  events: [
    { id: 'ev-1', title: 'Analytics careers open house', date: '2026-06-18', status: 'COMPLETED', registered: 42, attended: 31 },
    { id: 'ev-2', title: 'Dashboard design clinic', date: '2026-07-09', status: 'COMPLETED', registered: 28, attended: 24 },
  ],
  // Historical invites this employer sent, before the current session.
  pastInvites: [
    { id: 'inv-h1', kind: 'interview', status: 'ACCEPTED' },
    { id: 'inv-h2', kind: 'interview', status: 'DECLINED' },
    { id: 'inv-h3', kind: 'coffee', status: 'ACCEPTED' },
    { id: 'inv-h4', kind: 'interview', status: 'PENDING' },
    { id: 'inv-h5', kind: 'coffee', status: 'PENDING' },
  ],
};

// CPDC-side view: the employer relationship desk. Fictional partners only.
export const DEMO_EMPLOYER_CRM = [
  {
    id: 'crm-1',
    name: 'Northgate Analytics (demo partner)',
    industry: 'Data & analytics consulting',
    status: 'VERIFIED',
    contact: 'Partnerships desk',
    openRoles: 3,
    lastActivity: '2026-07-28',
  },
  {
    id: 'crm-2',
    name: 'Kestrel Systems (demo partner)',
    industry: 'Software & platform engineering',
    status: 'VERIFIED',
    contact: 'Campus recruiting',
    openRoles: 1,
    lastActivity: '2026-07-21',
  },
  {
    id: 'crm-3',
    name: 'Bright Harbour Health (demo partner)',
    industry: 'Healthcare services',
    status: 'PENDING_VERIFICATION',
    contact: 'Clinical placements',
    openRoles: 1,
    lastActivity: '2026-07-30',
  },
  {
    id: 'crm-4',
    name: 'Larkspur Media (demo partner)',
    industry: 'Media & communications',
    status: 'VERIFIED',
    contact: 'Editorial team',
    openRoles: 1,
    lastActivity: '2026-07-12',
  },
];

// Session requests waiting on CPDC. The approval side lives in the admin
// console (another module); this file only models the request state.
export const DEMO_HOST_REQUESTS = [
  {
    id: 'req-1',
    employer: 'Northgate Analytics (demo partner)',
    title: 'Breaking into analytics: portfolio clinic',
    date: '2026-09-12 · campus + virtual',
    status: 'PENDING_CPDC',
    submitted: '2026-07-30',
  },
  {
    id: 'req-2',
    employer: 'Kestrel Systems (demo partner)',
    title: 'Code review culture in industry',
    date: '2026-10-02 · campus',
    status: 'APPROVED',
    submitted: '2026-07-04',
  },
];

// Invites a STUDENT viewer has received, so the student half of the module is
// not empty. Fictional employers; no real student data.
export const DEMO_STUDENT_INVITES = [
  {
    id: 'sinv-1',
    employer: 'Northgate Analytics (demo partner)',
    kind: 'interview',
    role: 'Graduate Data Analyst',
    when: '2026-08-14 · 10:00, virtual',
    status: 'PENDING',
    note: 'Demo invitation: we saw your public FYP showcase and would like to talk it through.',
  },
  {
    id: 'sinv-2',
    employer: 'Larkspur Media (demo partner)',
    kind: 'coffee',
    role: 'Informal chat',
    when: '2026-08-20 · 16:00, campus café',
    status: 'ACCEPTED',
    note: 'Demo invitation: a 30-minute chat about content and communications careers.',
  },
];
