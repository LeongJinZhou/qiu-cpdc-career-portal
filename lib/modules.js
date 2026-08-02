import {
  LayoutDashboard,
  FileText,
  Calendar,
  Users,
  BookOpen,
  Bot,
  Building2,
  Settings,
  FlaskConical,
  Brain,
  Route,
  HelpCircle,
  Sparkles,
  GraduationCap,
  ClipboardCheck,
} from 'lucide-react';

/**
 * Module registry — the plug-and-play surface of the platform.
 *
 * Every feature area is declared here once. Navigation (desktop sidebar and
 * mobile bar), route guards and the admin toggles all read from this list, so
 * adding or retiring a module is a single edit rather than a hunt through the
 * UI.
 *
 * Fields:
 *   roles      — derived from ROLE_MODULE_ACCESS below; do not author by hand.
 *   faculties  — 'all', or an array of faculty ids for faculty-specific tools.
 *   enabled    — false hides it everywhere without deleting the route, so a
 *                faculty can pilot a module before it goes university-wide.
 *   primary    — surfaced in the mobile bottom bar (space for ~5).
 */
/**
 * Which modules each role may open, transcribed from the roles specification's
 * "Allowed Modules" lists.
 *
 * Declared role-first rather than module-first because that is how the spec
 * reads and how it gets reviewed — "what can a Registrar see?" is answerable
 * from one line here, instead of grepping fifteen `roles:` arrays. The
 * module-first shape the registry needs is derived below, so the two can never
 * drift apart.
 *
 * This governs *navigation and route guarding only*. Field-level visibility
 * inside a module is a separate, server-enforced concern — see
 * lib/auth/student-profile-visibility.js. A role appearing here does not mean
 * it may see every student's data in that module.
 */
export const ROLE_MODULE_ACCESS = {
  STUDENT: [
    'dashboard', 'fyp', 'career-path', 'logbook', 'workshops', 'learning',
    'diagnostics', 'assessments', 'cv', 'ai-suite', 'network', 'employers', 'talent', 'help', 'settings',
  ],
  ALUMNI: ['network', 'workshops', 'learning', 'employers', 'talent', 'help', 'settings'],
  HEAD_OF_PROGRAMME: [
    'admin', 'fyp', 'career-path', 'logbook', 'workshops', 'learning',
    'diagnostics', 'assessments', 'employers', 'talent', 'help', 'settings',
  ],
  // 'diagnostics' is granted to the three roles that AUTHOR assessments as well
  // as sit them. A Head of Programme uploading a test paper needs the same
  // module a student takes it in — the screen branches on role, the route does
  // not need to be duplicated.
  FACULTY_COORDINATOR: ['admin', 'logbook', 'workshops', 'learning', 'diagnostics', 'assessments', 'employers', 'talent', 'help', 'settings'],
  ACADEMIC_SUPERVISOR: ['admin', 'logbook', 'workshops', 'assessments', 'help', 'settings'],
  PLACEMENT_OFFICER: ['admin', 'logbook', 'employers', 'workshops', 'help', 'settings'],
  // The spec's module list for CPDC_ADMIN omits /logbook, but its capability
  // matrix grants them a global view of logbook approvals. Nav follows the
  // capability, since an officer who cannot reach the module cannot exercise it.
  CPDC_ADMIN: [
    'admin', 'logbook', 'workshops', 'learning', 'diagnostics', 'assessments', 'network', 'employers', 'talent', 'help', 'settings',
  ],
  CAREER_COUNSELOR: ['admin', 'ai-suite', 'diagnostics', 'workshops', 'help', 'settings'],
  UNIVERSITY_REGISTRAR: ['admin', 'logbook', 'help', 'settings'],
  EMPLOYER: ['employers', 'workshops', 'talent', 'help', 'settings'],
  // Governance role: everything, by definition.
  SUPER_ADMIN: null,
};

/** module id -> roles, inverted from ROLE_MODULE_ACCESS. */
function rolesForModule(moduleId) {
  return Object.entries(ROLE_MODULE_ACCESS)
    .filter(([, ids]) => ids === null || ids.includes(moduleId))
    .map(([role]) => role);
}

const MODULE_DEFINITIONS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    longLabel: 'Home',
    description: 'Your next step, your progress, and what is coming up.',
    href: '/dashboard',
    icon: LayoutDashboard,
    faculties: 'all',
    enabled: true,
    primary: true,
  },
  {
    id: 'fyp',
    label: 'FYP',
    longLabel: 'My Final Year Project',
    description: 'Upload your FYP and choose whether employers can see it.',
    href: '/fyp',
    icon: FlaskConical,
    faculties: 'all',
    enabled: true,
    primary: true,
  },
  {
    id: 'career-path',
    label: 'Career Path',
    longLabel: 'My Career Path',
    description: 'What to do each year, from Year 1 to graduation.',
    href: '/career-path',
    icon: Route,
    faculties: 'all',
    enabled: true,
    primary: false,
  },
  {
    id: 'logbook',
    label: 'Hours',
    longLabel: 'My Placement Hours',
    description: 'Record hours from your placement and get your supervisor to sign them off.',
    href: '/logbook',
    icon: BookOpen,
    faculties: 'all',
    enabled: true,
    primary: true,
  },
  {
    id: 'workshops',
    label: 'Workshops',
    longLabel: 'Workshops & Events',
    description: 'Book CPDC workshops and check in with a QR code when you arrive.',
    href: '/workshops',
    icon: Calendar,
    faculties: 'all',
    enabled: true,
    primary: true,
  },
  {
    id: 'learning',
    label: 'Learning',
    longLabel: 'Online Courses',
    description: 'Coursera and edX courses picked for your programme, plus CPDC learning paths.',
    href: '/learning',
    icon: GraduationCap,
    faculties: 'all',
    enabled: true,
    primary: false,
  },
  {
    id: 'diagnostics',
    label: 'Skills',
    longLabel: 'Skills Check',
    description: 'A short test that shows what you are good at and what to work on next.',
    href: '/diagnostics',
    icon: Brain,
    faculties: 'all',
    enabled: true,
    primary: false,
  },
  {
    id: 'assessments',
    label: 'Assessments',
    longLabel: 'Assessments & Tests',
    description: 'Take a published test, or upload and publish one for your class.',
    href: '/assessments',
    icon: ClipboardCheck,
    faculties: 'all',
    enabled: true,
    primary: false,
  },
  {
    id: 'cv',
    label: 'My CV',
    longLabel: 'My CV',
    description: 'A CV that builds itself from what you complete. Download it as a PDF.',
    href: '/cv',
    icon: FileText,
    faculties: 'all',
    enabled: true,
    primary: true,
  },
  {
    id: 'ai-suite',
    label: 'Practice',
    longLabel: 'Interview Practice',
    description: 'Practise interview answers and see where your skills have gaps.',
    href: '/ai-suite',
    icon: Bot,
    faculties: 'all',
    enabled: true,
    primary: false,
  },
  {
    id: 'network',
    label: 'Network',
    longLabel: 'Alumni Network',
    description: 'Find QIU graduates who have offered to give advice, and message them.',
    href: '/network',
    icon: Users,
    faculties: 'all',
    enabled: true,
    primary: false,
  },
  {
    id: 'employers',
    label: 'Employers',
    longLabel: 'Jobs & Employers',
    description: 'Job and internship openings, and employers looking for QIU students.',
    href: '/employers',
    icon: Building2,
    faculties: 'all',
    enabled: true,
    primary: false,
  },
  {
    id: 'admin',
    label: 'Admin',
    longLabel: 'Staff Console',
    description: 'Student records, approvals and reporting for your role.',
    href: '/admin',
    icon: Settings,
    faculties: 'all',
    enabled: true,
    primary: false,
  },
  {
    id: 'talent',
    label: 'Showcase',
    longLabel: 'Talent Showcase',
    description: 'Approved student projects that employers can browse.',
    href: '/talent',
    icon: Sparkles,
    faculties: 'all',
    enabled: true,
    primary: false,
  },
  {
    id: 'help',
    label: 'Help',
    longLabel: 'Help & Guides',
    description: 'Step-by-step guides for everything on this platform.',
    href: '/help',
    icon: HelpCircle,
    faculties: 'all',
    enabled: true,
    primary: false,
  },
  {
    id: 'settings',
    label: 'Settings',
    longLabel: 'My Profile & Settings',
    description: 'Update your details, links and privacy choices.',
    href: '/settings',
    icon: Settings,
    faculties: 'all',
    enabled: true,
    primary: false,
  },
];

/**
 * The registry the rest of the app reads. `roles` is derived, never authored —
 * edit ROLE_MODULE_ACCESS above to change who sees what.
 */
export const MODULES = MODULE_DEFINITIONS.map((mod) => ({
  ...mod,
  roles: rolesForModule(mod.id),
}));

/** Modules visible to a given role and faculty. */
export function modulesFor(role, facultyId, settings) {
  return MODULES.filter((mod) => {
    if (!mod.enabled) return false;
    if (settings?.featureToggles?.[mod.id] === false) return false;
    if (!mod.roles.includes(role)) return false;
    if (mod.faculties === 'all') return true;
    return mod.faculties.includes(facultyId);
  });
}

/**
 * The handful of modules that fit in the mobile bottom bar.
 *
 * `primary` was chosen for the student journey, so a role like EMPLOYER — whose
 * only module is not marked primary — would otherwise get an empty bar. Fall
 * back to that role's first few modules so the bar is never blank.
 */
export function primaryModulesFor(role, facultyId, settings) {
  const available = modulesFor(role, facultyId, settings);
  const flagged = available.filter((mod) => mod.primary);
  return flagged.length > 0 ? flagged.slice(0, 5) : available.slice(0, 5);
}

/** The module owning a pathname, or undefined for non-module routes. */
export function moduleForPath(pathname) {
  return MODULES.find((mod) => pathname === mod.href || pathname.startsWith(`${mod.href}/`));
}

/**
 * Whether a role may open a path.
 *
 * Paths that belong to no module (profile pages, settings) are allowed — this
 * guards modules, it is not a general firewall.
 */
export function canAccess(role, facultyId, pathname, settings) {
  const mod = moduleForPath(pathname);
  if (!mod) return true;
  return modulesFor(role, facultyId, settings).some((allowed) => allowed.id === mod.id);
}

/**
 * The eleven account roles, plus the scope each one is bound to.
 *
 * `EXTERNAL_SUPERVISOR` is deliberately absent. The roles specification lists
 * it twelfth, but its whole point is that an off-campus preceptor needs no
 * account: they act through a single hashed, expiring, single-use logbook
 * token on /approve/[token]. Adding it here — or to the Prisma `Role` enum —
 * would make it assignable to a real signed-in User, which is exactly the
 * standing access the design says it must never have. It is modelled as a
 * token-scoped actor instead; see lib/magic-link.js and STUDENT_PROFILE_LAYERS
 * in lib/auth/student-profile-visibility.js.
 *
 * `scope` documents the boundary the *server* must enforce. It is descriptive
 * here; lib/auth/permissions.js is what actually gates data.
 */
export const ROLES = [
  { id: 'STUDENT', label: 'Student', desc: 'Undergraduate or postgraduate', home: '/dashboard', scope: 'SELF' },
  { id: 'ALUMNI', label: 'Alumni Mentor', desc: 'Verified QIU graduate', home: '/network', scope: 'PUBLIC_TALENT' },
  { id: 'HEAD_OF_PROGRAMME', label: 'Head of Programme', desc: 'Programme lead / senior lecturer', home: '/admin', scope: 'PROGRAMME' },
  { id: 'FACULTY_COORDINATOR', label: 'Faculty Coordinator', desc: 'Faculty academic lead', home: '/admin', scope: 'FACULTY' },
  { id: 'ACADEMIC_SUPERVISOR', label: 'Academic Supervisor', desc: 'Internship lecturer, assigned mentees', home: '/admin', scope: 'MENTEES' },
  { id: 'PLACEMENT_OFFICER', label: 'Placement Officer', desc: 'Industrial training placements', home: '/admin', scope: 'FACULTY' },
  { id: 'CPDC_ADMIN', label: 'CPDC Officer', desc: 'Career services staff', home: '/admin', scope: 'GLOBAL' },
  { id: 'CAREER_COUNSELOR', label: 'Career Counselor', desc: 'CV reviews and mock interviews', home: '/admin', scope: 'GLOBAL' },
  { id: 'UNIVERSITY_REGISTRAR', label: 'Registrar', desc: 'Academic clearance and transcripts', home: '/admin', scope: 'GLOBAL' },
  { id: 'SUPER_ADMIN', label: 'Super-Admin', desc: 'Platform governance', home: '/admin', scope: 'GLOBAL' },
  { id: 'EMPLOYER', label: 'Employer', desc: 'Verified corporate partner', home: '/employers', scope: 'PUBLIC_TALENT' },
];

export const ROLE_IDS = ROLES.map((role) => role.id);

/**
 * Landing route for a role. Every role needs somewhere to go: an EMPLOYER has
 * no dashboard, so sending them to /dashboard on sign-in or after a role
 * switch would bounce them straight into a redirect loop.
 *
 * Each role declares its own home, because registry order is a navigation
 * concern — falling back to "first visible module" would drop CPDC officers on
 * the workshop list instead of their admin console. The declared home is still
 * verified against the role's real access before it is used.
 */
export function homeFor(role, facultyId, settings) {
  const declared = ROLES.find((r) => r.id === role)?.home;
  if (declared && canAccess(role, facultyId, declared, settings)) return declared;

  const [first] = modulesFor(role, facultyId, settings);
  return first?.href ?? '/';
}
