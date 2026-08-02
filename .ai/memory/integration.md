# QIU Integration & Institutional Structure (blueprint §13–17)

Source of truth for how this prototype must eventually connect to QIU's real
systems, plus the confirmed org structure. Most of this is BACKEND integration
work blocked on QIU ICT data access — capture the plan, don't fake the data.

## Existing systems to CONNECT to, not rebuild (§13, §16)
- **Student Information System** (`gomycampus`) — true source of identity:
  name, student ID, faculty, programme, intake, semester, mentor. This is the
  read-only source for Module 1 auto-detect. Sync one-way (nightly or event-
  driven); Superadmin identity override is the exception handler, not the intake.
- **ACMS** (`acms.qiu.edu.my`) — current career/resume/internship system. ~60%
  of our data model already exists there. Patterns observed:
  - Session identity: `$_SESSION['std']` set once on login, reused everywhere
    (readonly prefill) — this IS the "auto-detect" we want, already built.
  - Normalized data: one student core record + child tables (`cv3` co-curric,
    `cv4` curricular/FYP, `cv5` work experience).
  - Working API pattern: `Student_api.php?FN=InternInfoExist`,
    `Internship_Satisfaction_api.php?FN=StudentSearch` → JSON {Status,Result,Err}.
    EXTEND this `FN=`-router style (e.g. `FN=GetWorkshopMatches`, `FN=GetXPBalance`,
    `FN=SubmitFYP`) rather than inventing a second API style.
  - Form handlers POST to `*_bg.php`. No modern frontend yet.
- **Student Advisement System** (`sa.qiu.edu.my`) — mentor/advising records.
- **Online CCA System** (`cca.qiu.edu.my`) — co-curricular records (second
  source for the resume co-curricular section).

### ACMS page → our module map
- profile.php / eResume.php (9-step wizard) → Module 4 Resume + Module 5 FYP
  (biggest reuse; "Curricular Activities = FYP" field already exists).
- Self_Assessment.php (9 Likert traits + radar + PDF) → Module 8 Diagnostics
  (reuse rubric; replace static PDF with live gap analysis → recommendations).
- yearlySurvey.php (7-section satisfaction) → Module 13 analytics feed.
- vacancy.php / applyHis.php (job board + history) → Module 12 Employer Portal
  (add reverse direction: employers browsing opted-in students).
- Internship_Form.php / Internship_Satisfaction.php → Module 10 logbook; the HR/
  supervisor contact fields are the seed for the passwordless magic-link sign-off.

### Genuinely missing in ACMS → build new: workshops+matching (M3), XP/badges (M9),
Coursera (M6), Career Path page (M7, highest-value), Alumni (M11), AI recheck/
polish/gap-summaries, magic-link approval workflow, settings/feature-flags (M16).

### First blocker: get read access / data dictionary for SIS + ACMS from QIU ICT.
Interim bridge if not available day one: manual CSV import.

## Real QIU structure (§14) — adopt when Registrar confirms
Faculties (current public naming — 7, differs from our fixture's 8):
Business and Management · Computing and Engineering · Integrated Life Sciences ·
Social Sciences (contains Education, Psychology, Communication) · Medicine ·
Pharmacy · (+ Centre for General Studies for MPU).
IMPORTANT nesting: **Faculty → School → Programme → Year** (not just Faculty →
Programme). Schools exist (SoC, SoE, SoMBaS under Computing & Engineering; School
of Business/Accounting&Finance/Hospitality/ACCA under Business; etc.).
Our fixture `lib/data/facultyData.js` currently uses 8 faculties incl. standalone
Hospitality & Communication — this is a KNOWN divergence; do not restructure the
taxonomy until Registrar confirms current naming (faculty names get reshuffled).
Programme has its own level/duration/intakes — Career Path (M7) MUST be per-
programme, not per-faculty (a 1-yr Foundation path ≠ a 3–4 yr Bachelor path).
Subject-by-subject curriculum is NOT public — get it from each Faculty's Academic
Affairs Division (exists for MQA accreditation). Real CS subject list already
visible in ACMS resume data → use as the first per-programme Career Path pilot.

## New role: Head of Programme / Lecturer (§15) — IMPLEMENTED (demo-scoped)
Hierarchy: Superadmin → CPDC Staff → Faculty Coordinator → **Head of Programme**
(one per programme) → Students. Wired 2026-08-01: added `HEAD_OF_PROGRAMME` to the
Prisma Role enum, `ROLES` (home `/admin`), the module registry (same visibility as
FACULTY_COORDINATOR), and the login demo-account selector.
Scope (intended): view/approve only its OWN programme; owns that programme's
Career Path curriculum→career mapping; flags at-risk students up to the
coordinator. CANNOT touch other programmes, platform settings, XP rules, identity
override, employer/alumni management. Deep per-programme DATA scoping in the admin
console is still demo-level — enforce for real once auth + a programme dimension
on staff accounts exist.

## Event module (§17) — target spec for EventBuilder / WorkshopHub
Every event needs an uploaded cover image (not placeholder), title, date, start/
end time, location (room or link), organizer, target faculty/programme/year tags
for match-scoring, capacity, short+long description. Editing is live and role-
scoped (creator/CPDC edit until start; notify RSVP'd students on change). Past
events keep their page: cover image + recap + photos/materials/recording link.
Image upload = drag-drop with auto crop to the shared card ratio so staff phone
photos never break layout.
STATUS (implemented 2026-08-01): cover-image upload with drag-drop + preview is
LIVE in `components/WorkshopHub.jsx`'s staff publisher; the image rides on the
published workshop object (`coverImage`) and renders as a full-bleed card banner
in the student feed. "Recap"/"Photos" added to the post-event archive types. NOTE:
`components/workshops/EventBuilder.jsx` + `EventCard.jsx` are a richer publisher
that is NOT wired in (orphan from an earlier pass) — they also got the cover-image
treatment, but WorkshopHub's own inline publisher is what actually renders.

## §14 faculty restructure — IMPLEMENTED behind existing IDs (2026-08-01)
`lib/data/facultyData.js` now uses the real faculty names (Faculty of Business and
Management, Faculty of Social Sciences, Faculty of Computing and Engineering, etc.)
and each entry carries `faculty`/`school`/`schools` (and `parentFaculty` +
`isSchool` for Hospitality→Business and Communication→Social Sciences). IDs were
NOT changed (business, education, medicine, pharmacy, lifesciences,
computing_engineering, hospitality, communication) so roadmaps/matching/logbook
fields/admin cohorts keep working. Real 6–7 faculty umbrella; Hospitality &
Communication are represented as schools of their parent faculty.
