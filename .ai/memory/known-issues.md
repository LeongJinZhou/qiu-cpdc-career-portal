# Known Issues

Fixed 2026-08-02 (persistence pass 2 — software-testing feedback Modules 6-16):
- Module 7 (Diagnostics): `DiagnosticResult` model + `/api/diagnostics`. Every
  attempt persisted (radar/gap survive refresh); first attempt = longitudinal
  baseline overlay (dotted vs latest). Diagnostic XP+badge awarded once on first
  pass (dedupeKey `diagnostic:<studentId>`).
- Module 13 (Talent Feed): public `/api/talent` serves APPROVED + publicOptIn
  FYPProjects; TalentFeed merges them ahead of the static showcase + real
  "Contact student" mailto and repo/demo links.
- Module 15 (feature toggles): admin module toggles now hide nav AND guard
  routes. Two root causes fixed: (1) `recordWhere` in settings/policy.js passed
  the Prisma compound unique as a positional ARRAY — throws on Prisma 6, so
  EVERY settings read/write failed and silently fell back to all-enabled
  defaults; now object form. (2) settings GET is demo-aware (resolveActor) so
  students/demo can READ toggles for enforcement; writes stay admin-gated.
- Module 14 (Help/tour): already complete — FAQ search + "Take the product
  tour" replay button dispatching `qiu:start-tour`.
- Module 11 (Employers): `Company`+`JobPosting`+`Application` models
  (ApplicationStage enum), `Student.searchable`/`skillTags`. `/api/jobs` (list
  open + publish), `/api/applications` (apply idempotent, employer list, PATCH
  ATS stage), `/api/profile/visibility` (opt-in, hidden by default). New
  Vacancies tab `components/employer/VacanciesBoard.jsx`.
- Module 8 (CV): `/api/cv` returns live approved logbook hours, badges, FYP,
  skills, ledger XP/tier (was DEFAULT_STUDENT fixtures). PDF export rewritten
  from html2canvas screenshot (image-only, fails ATS) to real jsPDF TEXT layout
  (selectable/parseable). html2canvas dropped.
- Module 1 streak (parallel session): `/api/xp` now derives the login streak
  from real AuditLog LOGIN_SUCCESS events via buildXpSummary (lib/xp-summary).
- STILL PENDING (heavier / external-service dependent): M6 Learning (course
  enrol/complete persist + skill tags — CourseEnrolment model already added),
  M9 AI Suite (Gemini — seam only), M10 Alumni (mentor register/request persist;
  email+calendar external), M12 Admin (bulk CSV import + real at-risk radar),
  M16 Auth (request-access form; SIS connector external).

Fixed 2026-08-02 (persistence pass — software-testing feedback on Modules 1-5):
- Root cause across Dashboard/Career/Workshops/FYP: state lived in the browser
  (React + sessionStorage), never the DB. Added a DEMO-AWARE persistence layer so
  the SAME DB reads/writes run in both auth modes:
  - `lib/auth/actor.js` `resolveActor(request)` — real session identity under
    firebase-google, or the seeded student (alex.thorne@student.qiu.edu.my) in
    demo mode. Demo is refused in production by getAuthMode(), so the demo branch
    can't run on a live site. New/updated routes use this; real-auth capability
    checks are preserved (skipped only in demo).
  - `lib/xp-ledger.js` `sumStudentXp` + `awardXpOnce` (idempotent via dedupeKey).
  - `lib/xp-events.js` emit/onXpUpdated — live XP sync across dashboard + sidebar.
- Module 1: dashboard + sidebar XP now summed from XpEvent ledger (`/api/xp`), not
  DEFAULT_STUDENT.xp. Removed the fake "+150 simulate" button and fake roadmap
  task XP (they contradicted the ledger). Verified: UI shows 2050 (ledger), not
  3450 (hardcoded).
- Module 3: career milestones persist (`MilestoneCompletion` + idempotent +100
  `CAREER_MILESTONE` XpEvent) via `/api/career/milestones`. Milestone ids derived
  as `<facultyId>:<year>:<index>` (milestoneId/findMilestone in roadmaps.js).
- Module 5: workshops persist + real QR check-in (`/api/workshops`,
  `/workshops/check-in`, `/workshops/rsvp`). Check-in validates qrSecret (demo may
  pass workshopId — dev-only), writes WorkshopAttendance + idempotent +XP. Publish
  and RSVP (capacity-enforced) persist. WorkshopHub loads from DB.
- Module 2: `FYPProject` model + `FypStatus` enum. Student submit persists +250
  once; edits reset to PENDING_REVIEW. Head-of-Programme queue
  `components/admin/FypApprovalQueue.jsx` (in Admin > Approvals) reads/decides via
  `/api/fyp/approvals`; decisions propagate to the student's own FYP view.
- Module 4: logbook is now demo-aware (was auth-only → blocked in demo). Added
  `/api/logbook/[id]` PATCH to edit supervisor + resend a fresh magic link for
  PENDING entries (fixes "stuck on wrong email"), retiring the old token. Email
  seam `lib/email.js` (Resend if RESEND_API_KEY, else returns the link).
- Client-demo bug fixed: `getPublicAuthMode()` read `env.NEXT_PUBLIC_AUTH_MODE`
  through an aliased `env=process.env` default, which Next does NOT inline in the
  browser → demo chrome never engaged (portal showed "Sign in required"). Now
  reads `process.env.NEXT_PUBLIC_AUTH_MODE` directly. Local `.env` set to
  AUTH_MODE=demo / NEXT_PUBLIC_AUTH_MODE=demo so the prototype runs against Postgres.
- Schema via `prisma db push` (no migrations dir): added MilestoneCompletion,
  FYPProject, WorkshopRsvp, Workshop.coverImage/category/tags/capacity,
  CAREER_MILESTONE XpSource, FypStatus enum.
- STILL OUT OF SCOPE (needs external services): object storage for FYP posters /
  workshop covers (currently data-URL inline); real SMTP delivery (seam only);
  live daily login streak (still static). Cross-session role scoping for HoP is
  demo-level (one seeded user acts as all roles).

Fixed 2026-08-01:
- Logbook showed "No supervisor assigned" — seed didn't create SupervisorApproval
  rows. Now upserts them separately.
- AdminSuperDashboard enrolment used `Math.random()` inside render (reshuffled
  every re-render) → now deterministic `enrolledFor(faculty)`.
- DEFAULT_STUDENT.level "Diamond I" contradicted tierFor(3450)=Silver → aligned.
- Dark-theme remnants (status pills, low-contrast colored text) normalized for
  the light theme.
- Role-aware demo sign-in now routes students, CPDC officers, and employers to
  the correct home; onboarding career preferences persist in session storage;
  sign-out clears the demo session. The selected role is also carried as a
  `demoRole` query fallback for locked-down browsers where sessionStorage is
  unavailable.
- Light-theme/mobile accessibility pass: tabs expose selection semantics, staff
  workshop publishing is role-gated, dialogs and errors are labelled, roadmap
  rewards cannot be clicked twice, and reduced-motion styling is available.
- FYP XP is awarded only after an explicit submit; GPS capture uses browser
  geolocation instead of fabricated coordinates; logbook API validates hours,
  dates, and coordinates and reports approval-link replays as gone.
- The dev server must not run concurrently with `next build`: both write
  `.next`, which can leave a stale webpack chunk and produce a false
  `Cannot find module './<chunk>.js'` runtime error. Stop dev, rebuild, then
  restart it from the fresh output.
- ESLint is now configured with `eslint-config-next`; `npm run lint` passes.
  Remaining `@next/next/no-img-element` messages are performance warnings, not
  lint failures.

Historical audit snapshot (superseded by the completion pass below; production gaps remain):
- **No auth anywhere** except the magic-link token. Role is self-selected; all
  data API routes are unauthenticated. Highest-priority gap.
- **XP split-brain**: in-memory `student.xp` vs DB `XpEvent` ledger never
  reconcile; DB XP is invisible in the UI, UI XP never persists.
- **CV uses stale mock logs** (`DEFAULT_STUDENT.logbookEntries`), not the live
  DB logbook; certifications section is hardcoded JSX.
- **Mostly fixtures**: workshops, courses, alumni, employer candidates, admin
  analytics, roadmaps are static; QR check-in is a setTimeout (schema's
  WorkshopAttendance/dedupeKey unused by any route).
- **Missing modules**: Settings/feature-toggle engine (16), Help/guide + tour
  (14), FACULTY_COORDINATOR role + real permission enforcement (15), superadmin
  identity override + at-risk radar (13), FYP approval + public talent feed (5).
- Roadmaps exist for only 3 of 8 faculties (+ default) and aren't clickable
  links to modules; tiers are Novice→Diamond vs blueprint's Bronze→Platinum.

Added 2026-08-01: Skills Diagnostic Tests (Module 8, `/diagnostics`) and the
dashboard Next Best Action card (Module 2) — both functional, in-memory state.

Completion pass 2026-08-01:
- The former “missing modules” list is now implemented as a frontend prototype:
  `/career-path`, `/talent`, `/help`, `/settings`, branded `/loading`, and the
  faculty coordinator role are wired into the registry and shell.
- FYP submissions now carry PENDING_REVIEW / APPROVED / NEEDS_CHANGES state in
  the demo provider; the approval queue updates it, and Talent Feed only exposes
  approved + explicitly opted-in projects.
- Workshop matching, diagnostic radar/gap summary, employer job-description
  ranking, profile settings, CV recheck/version controls, and role-scoped admin
  controls are implemented for demo state.
- A clean `npm run lint`, `npx prisma generate`, and `npm run build` completed;
  route HTTP smoke checks returned 200 for all current marketing, portal and
  API-backed pages, including `/learning` and `/privacy`. A fresh browser
  smoke pass verified dashboard, admin, employer marketplace, learning and
  privacy views with no new console errors. Build reports only the existing
  `@next/next/no-img-element` warnings.
- Employer marketplace props are now defensive (`candidates`, shortlist and
  invite state default safely), so a role/session hydration edge cannot crash
  the faculty filter before candidate data is available.
- Before local UI testing, stop all existing `next dev` processes and run only
  one server. Concurrent dev/build writes to `.next` and causes false chunk or
  React client-manifest failures.

Remaining production blockers after Saturday, August 1, 2026:

- Real Firebase/Google login still depends on live credentials and environment
  setup; do not claim end-to-end Google sign-in was verified without them.
- ACMS/SIS remains a contract-only adapter: `NOT_CONFIGURED` is expected until
  provider, endpoint, and credentials are supplied.
- Many product modules are still fixture-backed or in-memory (analytics,
  workshops publishing/archive data, alumni, employer records, talent fixtures,
  parts of FYP/profile/preferences). Distinguish these from the completed
  identity/settings foundation.
- Local demo mode (`AUTH_MODE=demo`) remains a development-only fallback and is
  not production authorization.

Identity/settings foundation completed on Saturday, August 1, 2026:

- Server-side session authorization now protects identity, logbook, admin,
  audit, and governed settings routes.
- Governed settings now read/write through authenticated API routes with
  optimistic concurrency and transactional audit logging.
- Platform settings authorization now checks both role and scope:
  `SUPER_ADMIN` for platform/global; only explicit scoped admin roles for
  faculty/programme settings.

Verification pass 2026-08-01 (later): independent `next build` PASSES across 22
routes (retry-clean). The `/_not-found` "Cannot find module for page" error seen
on a first build is transient Next 15.5 page-data-collection flakiness, not a
code fault — a clean rebuild succeeds. Browser-verified: landing (real logo +
dynamic rotating portal-preview), branded loading tab on route transitions,
Career Path (all faculties, reprioritisation banner, readiness %), Learning Hub
(match % + "why"), and the auto-launching 5-step onboarding tour. Logo renders
via QiuLogo → public/brand assets; `LoadingScreen` depends on the
`.qiu-loading-bar`/`.qiu-float-in`/`.qiu-aurora` keyframes in globals.css.
NOTE: six helper subagents were spawned but hit the account session limit and
mostly failed mid-run; the prior completion pass had already delivered the work,
so no rebuild was needed — verify-and-integrate was the correct path.

Fixed 2026-08-02 (UI/responsive pass):
- **Portal hung on "Checking your identity"**: `next dev` was started over a
  `.next` left by `next build`, so `main-app.js` 404'd and client JS never
  booted — no console error, just a permanent splash. Always stop dev, `rm -rf
  .next`, then start exactly one server. `PortalProvider` was also hardened:
  the pre-`try` fallback setup now runs inside the guarded block, so a throw
  there degrades to "signed out" instead of loading forever.
- **Split-screen used phone chrome**: a half-width desktop window got the
  bottom tab bar. Added the 72px icon rail tier (see architecture.md).
- **Marketing header collided with the logo at 768–1023px** and wrapped both
  "Employers & Alumni" and the CTA onto second lines.
- **Dashboard hero misaligned at 375px**: avatar + name + two pills on one row
  squeezed the text block; faculty/programme wrapped into narrow columns. Now
  stacks and centres below `sm`.
- **XP flashed a wrong total**: chrome rendered the fixture projection (3,450)
  before the ledger answered (1,450). The figure is now withheld until the
  ledger responds rather than guessed.
- **Fabricated industry ties removed**: fixtures had invented graduates at
  Google/Goldman Sachs/Mayo Clinic and a "PwC & EY" bootcamp — reads as claimed
  QIU partnerships. Demo orgs are now plainly fictional; see the header comment
  in `lib/data/facultyData.js` for the rule.

Open:
- `git status` in this workspace does not reflect edits made this session
  (files show as clean while HEAD already contains them, and `public/brand` is
  neither tracked nor listed as untracked). Nothing was committed — the repo
  state needs a human look before trusting any commit here.
- `lib/data/facultyData.js` still defines 8 faculties; the blueprint specifies 6
  (Hospitality/Tourism belongs under Business, Communication under Education &
  Social Sciences). The seeded database has 8 to match.

Fixed 2026-08-02 (roles/governance pass):
- Added ACADEMIC_SUPERVISOR, PLACEMENT_OFFICER, CAREER_COUNSELOR and
  UNIVERSITY_REGISTRAR to the Prisma Role enum, module registry, capability
  table, scope resolution and demo role switcher (`prisma db push` applied).
- Privilege bug closed in `hasCapability` (capability/scope role mismatch).
- Fabricated admin figures removed: "14,850 enrolled students" and a "96.4%
  preceptor approval rate" were shown as live operational data on a console
  real CPDC staff would read. Now derived or marked as awaiting SIS sync.
- The 8-vs-6 faculty question is settled: the access matrix specifies **8**
  faculties, which matches the fixtures and the seeded database. No change.

Open:
- The per-role *feature surfaces* for the four new roles are not built — a
  Career Counselor's CV annotation tools, the Registrar's transcript export,
  the Placement Officer's agreement records, the Academic Supervisor's
  endorsement queue. They route and are scoped correctly, but land on the
  existing shared admin console.
- `buildStudentProfileView` is not yet wired into a scoped
  `GET /api/students/[id]/profile` route; it is unit-tested but unused.
- Faculty deployment matrix in AdminSuperDashboard still shows deterministic
  demo enrolment per faculty (disclosed on-page as demo fixtures).

2026-08-02 (matching + course depth):
- Faculty tailoring is now a *tested property*, not a patch:
  `tests/matching-faculty-tailoring.test.mjs` asserts across all 8 faculties
  (56 cross pairings) that no cross-faculty item reaches RECOMMENDED_THRESHOLD.
  The reported "Medicine sees Data Science at 70%" case now scores 15%.
  Root cause was the missing isolation cap in `computeMatch`, already added;
  `matchScore` fields still sitting in WORKSHOPS fixtures are dead data.
- Course catalogue deepened: every one of the 17 courses now carries `url`
  (canonical only where genuinely known), `instructor` (only where a public
  fact — Andrew Ng, David J. Malan, Robert Shiller, Barbara Oakley), `effort`,
  `prerequisite` and CPDC-authored `outcomes`. `courseLink()` degrades to a
  clearly-labelled provider *search* when no canonical URL is held, rather than
  guessing a deep link that 404s.
- New `components/learning/CourseDetail.jsx`: the catalogue could previously
  only list courses, never open one.

Open (explicitly NOT done — do not report these as complete):
- Depth parity for the other modules. Workshops still lack the speaker-bio /
  agenda / host detail the course sheet now has; the admin Event Builder is
  still create-only (no agenda, host, speaker profile, materials).
- No study-path graph visualisation on /career-path (it is a checklist).
- No cross-module automation rules engine (e.g. alumni completes internship ->
  auto-update CV + XP + roadmap). XP awards are wired per-action only.
- The four enterprise roles still have no bespoke UI surfaces.
