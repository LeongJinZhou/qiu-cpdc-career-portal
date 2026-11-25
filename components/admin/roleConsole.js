/**
 * Role framing for the staff console.
 *
 * The blueprint asks that a member of staff opening the console immediately
 * sees their own job, not a generic administrator dashboard. So each role gets:
 *
 *   - the name of the desk they are sitting at,
 *   - one sentence saying what they are here to do,
 *   - the tab they land on, and the order the remaining tabs appear in,
 *   - two or three concrete next actions, phrased as tasks not features.
 *
 * Nothing here grants access. Which tabs actually render is decided by the
 * capability checks in AdminControlCenter, and what a record shows is decided
 * server-side by lib/auth/student-profile-visibility.js. This file only decides
 * what the screen is *about*.
 */

const FALLBACK = {
  eyebrow: 'Staff console',
  title: 'Student records',
  purpose: 'Find a student and read the part of their record your role is responsible for.',
  defaultTab: 'records',
  tabOrder: ['records', 'overview', 'students', 'approvals', 'analytics'],
  tasks: [{ label: 'Search for a student by name or matric number.', href: '/admin?tab=records' }],
};

export const ROLE_CONSOLES = {
  UNIVERSITY_REGISTRAR: {
    eyebrow: 'Registry',
    title: 'Graduation clearance desk',
    purpose: 'Check that each student has the verified fieldwork hours and records they need before they graduate.',
    defaultTab: 'records',
    tabOrder: ['records', 'overview', 'analytics', 'data'],
    tasks: [
      { label: 'Look up a student and confirm their approved fieldwork hours.', href: '/admin?tab=records' },
      { label: 'Review readiness before the clearance meeting.', href: '/admin?tab=analytics' },
      { label: 'Flag students whose records are still incomplete.', href: '/admin?tab=overview' },
    ],
  },
  CAREER_COUNSELOR: {
    eyebrow: 'Career counselling',
    title: 'Coaching caseload',
    purpose: 'Read a student’s CV, skills and diagnostic results before a coaching session, and see who has gaps to work on.',
    defaultTab: 'records',
    tabOrder: ['records', 'overview', 'analytics'],
    tasks: [
      { label: 'Open a student before their appointment and review their skill gaps.', href: '/admin?tab=records' },
      { label: 'Review the readiness signals that need a check-in.', href: '/admin?tab=analytics' },
      { label: 'See the live coaching workload and audit trail.', href: '/admin?tab=overview' },
    ],
  },
  PLACEMENT_OFFICER: {
    eyebrow: 'Industrial training',
    title: 'Placement desk',
    purpose: 'Track who is on placement, how many approved hours they have logged, and which supervisors have signed off.',
    defaultTab: 'records',
    tabOrder: ['records', 'overview', 'approvals', 'analytics'],
    tasks: [
      { label: 'Check which students have no approved hours yet.', href: '/admin?tab=records' },
      { label: 'Review logbook entries waiting on a decision.', href: '/admin?tab=approvals' },
      { label: 'Review placement workload and outstanding actions.', href: '/admin?tab=analytics' },
    ],
  },
  FACULTY_COORDINATOR: {
    eyebrow: 'Faculty coordination',
    title: 'Your faculty’s students',
    purpose: 'Watch your faculty’s cohort for students falling behind, and step in before it becomes a problem.',
    defaultTab: 'records',
    tabOrder: ['records', 'students', 'approvals', 'overview', 'analytics'],
    tasks: [
      { label: 'Start with students marked “Needs urgent follow-up”.', href: '/admin?tab=students' },
      { label: 'Open a record to see exactly what is missing.', href: '/admin?tab=records' },
      { label: 'Review logbook entries waiting on your decision.', href: '/admin?tab=approvals' },
    ],
  },
  HEAD_OF_PROGRAMME: {
    eyebrow: 'Programme leadership',
    title: 'Programme review desk',
    purpose: 'Approve Final Year Projects and keep your programme’s cohort on track.',
    defaultTab: 'approvals',
    tabOrder: ['approvals', 'records', 'students', 'overview', 'analytics'],
    tasks: [
      { label: 'Clear the Final Year Project queue.', href: '/admin?tab=approvals' },
      { label: 'Open a student record to check progress before you decide.', href: '/admin?tab=records' },
      { label: 'Review who on your programme still has no approved hours.', href: '/admin?tab=students' },
    ],
  },
  ACADEMIC_SUPERVISOR: {
    eyebrow: 'Academic supervision',
    title: 'Your assigned students',
    purpose: 'Follow the students assigned to you: their fieldwork records and the diagnostic results relevant to supervision.',
    defaultTab: 'records',
    tabOrder: ['records', 'approvals', 'overview'],
    tasks: [
      { label: 'Read the latest logbook entries from your students.', href: '/admin?tab=records' },
      { label: 'Endorse entries that are waiting on you.', href: '/admin?tab=approvals' },
    ],
  },
  CPDC_ADMIN: {
    eyebrow: 'CPDC operations',
    title: 'University-wide operations',
    purpose: 'Keep the whole employability pipeline moving: approvals, at-risk students and cohort health across every faculty.',
    defaultTab: 'overview',
    tabOrder: ['overview', 'records', 'students', 'approvals', 'alumni', 'analytics', 'people', 'audit', 'data'],
    tasks: [
      { label: 'Clear anything sitting in the approvals queues.', href: '/admin?tab=approvals' },
      { label: 'Search the full student directory.', href: '/admin?tab=records' },
      { label: 'Check which faculties have students needing follow-up.', href: '/admin?tab=students' },
    ],
  },
  SUPER_ADMIN: {
    eyebrow: 'Governance',
    title: 'Platform governance',
    purpose: 'Oversee accounts, roles and the audit trail — and read any student record when an escalation needs it.',
    defaultTab: 'people',
    tabOrder: ['people', 'audit', 'records', 'alumni', 'overview', 'students', 'approvals', 'analytics', 'data'],
    tasks: [
      { label: 'Review recent role changes in the audit trail.', href: '/admin?tab=audit' },
      { label: 'Check for accounts still waiting on an invitation.', href: '/admin?tab=people' },
      { label: 'Open a student record only when an escalation requires it.', href: '/admin?tab=records' },
    ],
  },
};

/**
 * Roles that get the student directory tab. Mirrors DIRECTORY_ROLES in
 * app/api/students/student-scope.js — the server is still the authority, this
 * only decides whether the tab is worth rendering.
 */
export const DIRECTORY_ROLES = new Set(Object.keys(ROLE_CONSOLES));

export function consoleForRole(role) {
  return ROLE_CONSOLES[role] ?? FALLBACK;
}

/** Order a set of tab ids by the role's priority, keeping unlisted tabs last. */
export function orderTabsForRole(role, tabs) {
  const order = consoleForRole(role).tabOrder;
  return [...tabs].sort((a, b) => {
    const ai = order.indexOf(a.id);
    const bi = order.indexOf(b.id);
    return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
  });
}
