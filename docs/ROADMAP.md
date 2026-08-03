# QIU CPDC Platform — extension roadmap

Grounded in a full module-and-API audit and a UX/accessibility audit run on
2026-08-03, not in speculation. Everything below is either a gap those audits
found or a natural extension of something already built. Each item says what
exists today, so nobody has to re-derive it.

Ordered by value per unit of effort.

---

## Tier 1 — finish what is already half-built

### 1.1 Persist the Alumni Network (currently a shell)
**Today:** `components/AlumniNetwork.jsx` reads `ALUMNI_DIRECTORY` and
`FEED_POSTS` from `lib/data/facultyData`. There is no `app/api/network/` route.
`handleSendConnection` and `handleBookSlot` only call `setState` — a student
books a mentor, sees a success confirmation, and the booking is gone on refresh.

**Do:** `MentorProfile`, `MentorSlot`, `MentorBooking` tables; `POST
/api/network/bookings`; alumni-owned availability. The connect-accounts work
already gives every graduate a verified LinkedIn URL, which is exactly the join
key this module needs to become real.

**Why first:** it is the only module that actively misleads a student about
whether their action was saved.

### 1.2 Back the AI Career Suite (currently a shell)
**Today:** `components/AICareerSuite.jsx` reads fixtures; no backing API.
Credit where due — `handleStopRecording` refuses to fabricate a score and
returns `score: null` with "Connect an approved speech-analysis provider".
Keep that honesty.

**Do:** persist practice sessions (`InterviewSession`) so progress is visible
over time, and put the speech provider behind an adapter mirroring
`lib/integrations/acms-sis.js` — disabled and making no network calls until
explicitly configured.

### 1.3 Real cohort analytics
**Today:** `components/admin/cohort.js` synthesises a cohort from one seeded
student plus fixtures. The tab now says so out loud, which is honest but not
useful.

**Do:** aggregate from the XP ledger, logbook and enrolments. The People, Audit
and Analytics tabs already read Postgres; this is the last fixture in the admin
console.

### 1.4 Notification preferences on the account
**Today:** `NotificationPreferences` persists to `localStorage`.
`Student.notificationPrefs Json?` already exists in the schema and is unused.

**Do:** thread it through `PATCH /api/identity/profile`. Small, and it deletes
a caveat from the UI.

---

## Tier 2 — strengthen what works

### 2.1 Provider APIs for the learning catalogue
**Today:** `npm run catalog:sync` verifies URLs by probing them. That is
genuinely live, but it can only ever answer "does this page still exist".

**Do:** add a provider adapter alongside the liveness check so the catalogue can
also refresh titles, durations and prices, and discover NEW courses rather than
only validating curated ones. Coursera has no free public catalogue API — this
needs partner/affiliate credentials. The adapter seam belongs in
`lib/learning/`, with `liveness.js` untouched.

### 2.2 Cohort-level pathway analytics
**Today:** `lib/pathway.js` computes one student's stage and next step.

**Do:** run the same pure function across a cohort to answer the question CPDC
actually has — *"how many Year 2 Computing students are stuck before the
diagnostic?"* The logic already exists and is tested; this is an aggregation
endpoint plus a chart, not new rules.

### 2.3 Employer-side match transparency
**Today:** `lib/matching.js` scores students against roles, and students see
"Recommended for you · 99% match" with a reason.

**Do:** give employers the same explanation. A stated reason is what keeps a
match score from reading as an opaque ranking.

### 2.4 Connection health checks
**Today:** `ConnectedAccount.brokenAt` exists and the UI renders a "this link no
longer opens" state, but nothing ever sets it.

**Do:** a scheduled job reusing `probeProfile()` from
`lib/onboarding/connections.js`, on the same conservative rules as the course
liveness check — only an unambiguous 404/410 marks a link broken, never a
LinkedIn anti-bot 999.

---

## Tier 3 — new capability

### 3.1 Alumni outcome tracking
The point of compulsory LinkedIn is reaching graduates later. Nothing yet closes
that loop: no graduate-destination survey, no employment-outcome reporting, no
"where are they now" for CPDC. This is the highest-value *new* module, and the
data collection for it is already in place.

### 3.2 Employer-verified skill endorsements
Skill tags today come from verified certificates. An employer endorsement after
a placement would make them far stronger evidence, and the `TalentOutreach`
relation is already there to build on.

### 3.3 Faculty-configurable required connections
`lib/onboarding/policy.js` hardcodes LinkedIn (all) and GitHub (computing).
Faculties will eventually want their own — ORCID for Life Sciences, Behance for
Communication. `Faculty.requiredConnections String[]` plus an admin editor turns
a code change into a CPDC decision. **Note:** `ONBOARDING_VERSION` is the
mechanism for re-prompting an existing cohort, and bumping it re-prompts
*everyone* — so a per-faculty version would be needed first.

---

## Known defects not yet fixed

Carried from the 2026-08-03 audits. Ranked; none are blockers.

| # | Defect | Where |
| --- | --- | --- |
| 1 | `SESSION_SECRET` unset locally, so real (non-demo) auth returns 503 | `.env` |
| 2 | Mobile drawer sets `aria-modal` but does not trap or restore focus — `DismissibleDialog` already does this correctly and should be reused | `PortalShell.jsx:406-462` |
| 3 | Role switcher uses `role="menu"` with non-menuitem children, no arrow keys, no Escape; it is a disclosure, not a menu | `PortalShell.jsx:294-386` |
| 4 | Diagnostic quiz has no focus management or live region between questions, and answers cannot be changed; `aria-valuenow` is off by one | `DiagnosticTests.jsx:182-246` |
| 5 | Logbook resend flow: placeholder-only labels, 26px buttons | `ModularLogbook.jsx:576-621` |
| 6 | Six module pages start at `<h2>` with no `<h1>`; `AutoCVEngine`'s only `<h1>` is the student's name inside the CV preview | multiple |
| 7 | Tap targets under 44px across tab bars, filter chips and modal close buttons | multiple |
| 8 | CV template selector conveys selection by colour only, no `aria-pressed` | `AutoCVEngine.jsx:374` |
| 9 | `alert()` on PDF failure; 794px fixed-width CV preview unreadable on mobile | `AutoCVEngine.jsx:196,386` |
| 10 | Duplicate client fetches per dashboard load (`/api/xp` ×3, `/api/onboarding` ×2) | `PortalProvider` / page effects |
| 11 | `/api/admin/settings` GET readable by STUDENT and EMPLOYER — may be intentional for feature toggles, but the PATCH side is strictly gated, so decide deliberately | `app/api/admin/settings` |
| 12 | `animate-fadeIn` used in 8+ components and never defined in `globals.css` | multiple |
| 13 | CareerPath toast at `bottom-6` sits behind the mobile tab bar | `CareerPath.jsx:194` |
| 14 | Redundant year navigation: node matrix and sticky chips do the same thing | `CareerPath.jsx:263-323, 446-471` |

## What the audits found genuinely solid

Worth recording so it does not get "improved" by accident:

- **Authorization.** Across 3 roles and 35 endpoints: no route leaked data to a
  role that should not see it, and none over-refused. The scope model in
  `permissions.js` and the field layers in `student-profile-visibility.js` are
  actually implemented, not just documented.
- **Honest empty states.** `talent` and `employers` say "no students have opted
  in yet" rather than rendering fake candidates.
- **`components/ui/DismissibleDialog.jsx`** — correct focus trap, restore,
  scroll lock, Escape. Best-in-repo; reuse it rather than rewriting it.
- **`components/ui/useAccessibleTabs.js`** — textbook APG roving tabindex.
- **`LearningHub.jsx`** — strongest module: correct tab wiring, `aria-pressed`
  on every filter, `role="status"` notices, 44px throughout, and a visible
  "nothing is hidden" note.
- **`AdminControlCenter` "What to do here"** — the clearest next-action
  affordance in the product. Worth replicating at the top of other modules.
