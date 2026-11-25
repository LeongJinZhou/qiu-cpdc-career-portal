# SPEC: QIU CPDC Career Portal (rebuild)

Status: approved by the founder 2026-11-25 (plan B: full rebuild in React + PHP + MySQL).
The old Next.js portal (repo `qiu-cpdc-career-portal`) is the reference for modules and look; it stays on Render
until this rebuild replaces it.

## 1. What it is
One career portal for Quest International University's Career and Professional Development Centre (CPDC).
Students, staff and alumni sign in; CPDC tracks every student's professional profile from the first day to years
after graduation, using LinkedIn as the long-lived link to the person.

Who uses it:
- Students (all faculties): sign in with Google, link LinkedIn, keep a career profile, use the career modules.
- Staff (all faculties): sign in with Google, link LinkedIn, supervise and review in the modules.
- Alumni: sign in with LinkedIn only (their QIU Google account closes at graduation).
- CPDC admins: track students and alumni, export, run the modules.
- Super admin (`SUPERADMIN_EMAIL`, today ai@qiu.edu.my): everything, including roles and settings.

Problem it solves: after graduation the university loses contact with its students. Tracer studies chase people by
email that no longer works. Here, every student links LinkedIn while still enrolled; after graduation the same
LinkedIn account signs them in, and CPDC sees each graduate's current job, company and LinkedIn profile in one list.

Success:
- 90%+ of active students have a linked LinkedIn account within one semester of launch.
- 70%+ of each graduating cohort sign in as alumni at least once in their first year.
- CPDC can answer "employment rate per faculty and graduation year" from the alumni tracker, without a survey.

## 2. Rules (the server enforces every one)
1. Google sign-in is the only sign-in for students and staff. Accepted: a verified Google account whose `hd`
   claim and email domain are in setting `google_hosted_domains` (default `["qiu.edu.my"]`). Everyone else is
   refused with a generic message and a `login_log` row.
2. On every Google sign-in the directory profile is read (same scopes and mapping as sld-orientation): name,
   photo, matric number or employee ID, employee type, department (faculty), job title. Non-empty directory values
   overwrite stored ones. Tokens are never stored.
3. Role on first sign-in: `SUPERADMIN_EMAIL` -> superadmin (forced at every sign-in, one per organisation);
   employee type in setting `student_employee_types` -> student; anyone else -> staff. Admins change roles later.
4. LinkedIn is compulsory for students and staff: until a LinkedIn account is linked by LinkedIn sign-in
   (OpenID Connect), the only screens open are onboarding and sign-out. Pasting a URL alone never counts.
5. One LinkedIn account belongs to one portal user (unique LinkedIn `sub`). Linking an account that another user
   holds is refused.
6. Onboarding also asks for: the public LinkedIn profile URL (`https://www.linkedin.com/in/<name>`; LinkedIn's
   sign-in does not supply it), a tick "I follow Quest International University on LinkedIn" after the button
   that opens the university page (LinkedIn offers no way to check a follow: the tick is the person's word), and
   consent to CPDC keeping and using the career profile (PDPA notice). GitHub linking is optional.
7. Career details come from the person's own LinkedIn PDF ("Save to PDF" on their LinkedIn profile): headline,
   about, location, every job (title, company, dates, location, description), education, skills, and the profile
   URL. The import fills a preview; nothing is saved until the person confirms. Manual entry and editing are
   always possible. The portal never fetches LinkedIn pages and never asks for a LinkedIn password.
8. Alumni sign in with LinkedIn only, and only when the LinkedIn `sub` is linked to a portal user whose role is
   alumni. A LinkedIn session ends at once if the role stops being alumni.
9. A LinkedIn sign-in that matches no user offers "Register as a QIU graduate": name and LinkedIn data from
   LinkedIn, plus matric number, programme and graduation year typed by the person. The account is `pending`
   until a CPDC admin approves it as alumni (graduates from before this portal).
10. Admins turn students into alumni one by one or by uploading a list of matric numbers with graduation year.
    The change keeps everything the student entered.
11. Alumni are asked to confirm or update their job on sign-in when it was last confirmed more than
    setting `alumni_job_confirm_days` (default 180) ago.
12. Anyone can change their LinkedIn later: sign in to LinkedIn again (same or a different account), change the
    profile URL, or import a new PDF. Every change is in the audit log with old and new value.
13. Everywhere a person's name is listed for staff or admins, the name links to their LinkedIn profile URL
    (opens in a new tab). No URL yet: plain name with a "no LinkedIn link" mark.
14. Only the person, CPDC admins and the super admin see a full career profile. Staff see name, faculty and
    LinkedIn link. The alumni tracker and its CSV are admin-only and every view and export is audited.
15. The personal (non-QIU) email comes only from LinkedIn's verified email, or typed by the person; a
    `*qiu.edu.my` address is never stored as the personal email.

## 3. Roles
| Role | Who | Sees |
|---|---|---|
| superadmin | `SUPERADMIN_EMAIL` | everything; roles, settings, audit |
| admin | CPDC officers (set by superadmin) | all profiles, alumni tracker, exports, approvals |
| staff | QIU staff not students | own profile; names + LinkedIn links of students in modules they serve |
| student | directory employee type in `student_employee_types` | own profile and modules |
| alumni | set by admin, or approved registration | own profile, job confirmation, alumni modules |
| pending | unapproved graduate registration | a "waiting for CPDC" page only |
Finer staff roles of the old portal (coordinator, supervisor, placement officer, counsellor, registrar, employer)
come back with the slice whose module needs them, as permissions in `role_permission`.

## 4. Look
The old portal's light "Apple-style" theme: canvas #f5f5f7, white surfaces, ink #1d1d1f, QIU crimson #e50914
only for the primary button and the active state. Inter body, Outfit headings, drawn icons (lucide), never emoji.
Motion only for feedback (saved, linked, approved) and the alumni confirmation moment; none on sign-in, forms and
settings. Every screen works on a phone first.

## 5. Stack and hosting
React + TypeScript (Vite) SPA; plain PHP 8.3 API (front controller, PDO, no framework), MySQL 8. Same structure
and libraries as sld-orientation (`api/`, `web/`, `shared/`). Production: Exabytes cPanel (`api/public` as web
root, built SPA copied there, `.env` and `storage/` above `public_html`). Test copy: Render Docker web service +
an external MySQL over TLS.

## 6. Data model (slice 1, after the architect review of 2026-11-25)
All tables: InnoDB, utf8mb4, `organisation_id` on owned rows with a FK, UTC `DATETIME(3)`, FKs on every
`user_id`, indexes on foreign keys and filter columns.
- `organisation`, `setting`, `rate_limit`, `audit_log`: as sld-orientation.
- `login_log`: as sld-orientation plus `provider` ENUM(google, linkedin) and `linkedin_sub` NULL.
- `role_permission`: as sld-orientation but `role` is VARCHAR(40), so slice 2 can add roles without a migration
  of every ENUM. `user_role_grant` (organisation_id, user_id, role_key VARCHAR(40), PK user_id + role_key):
  extra roles on top of the base role (a staff member who is supervisor and coordinator).
- `user`: id, organisation_id, google_sub (unique per org, NULL allowed), email (QIU email, unique per org),
  display_name, picture_url, matric_no (UNIQUE per org, NULL allowed), employee_id, employee_type, department,
  job_title, role ENUM(superadmin, admin, staff, student, alumni, pending) = base role, active, onboarded_at,
  consent_at, consent_version, alumni_since, last_sign_in_at, superadmin_guard (generated, unique),
  created_at, updated_at. CHECK (email IS NOT NULL OR role IN ('pending', 'alumni')).
- `linkedin_account`: user_id (PK, FK), organisation_id, linkedin_sub (UNIQUE per org), name, profile_url,
  follow_confirmed_at, linked_at, last_sign_in_at, updated_at. (LinkedIn's email goes to
  `career_profile.personal_email`, its photo to `user.picture_url`; not stored twice.)
- `github_account`: user_id (PK), organisation_id, github_id (UNIQUE per org), login, profile_url, linked_at.
- `career_profile`: user_id (PK), organisation_id, headline, about, location, industry, personal_email
  (CHECK not like '%qiu.edu.my'), faculty, programme, graduation_year SMALLINT (CHECK 1990-2100),
  employment_status ENUM(employed, self_employed, further_study, seeking, not_seeking, unknown), current_title,
  current_company, current_since (DATE), job_confirmed_at, last_pdf_import_at, updated_at.
  Indexes (organisation_id, faculty, graduation_year, employment_status), (organisation_id, job_confirmed_at).
  `faculty` is copied from `user.department` when a student becomes alumni, or picked at registration approval.
- `job_confirmation`: id, organisation_id, user_id, employment_status, title, company, confirmed_at. One row per
  confirmation, so "employment rate at 6 / 12 months after graduation" can be answered later. Index
  (organisation_id, confirmed_at), (user_id, confirmed_at).
- `career_experience`: id, organisation_id, user_id, title, company, location, start_month (DATE, day 1),
  end_month (DATE NULL = current), description, source ENUM(pdf, manual), position, created_at.
  Index (user_id, position).
- `career_education`: id, organisation_id, user_id, school, degree, field, start_year, end_year, source, position.
  Index (user_id, position).
- `career_skill`: organisation_id, user_id, skill (VARCHAR 80), PRIMARY KEY (user_id, skill).
- `graduate_registration`: id, organisation_id, user_id (FK ON DELETE SET NULL), matric_no (index, not unique),
  name, programme, faculty, graduation_year, matched_user_id (FK NULL), status ENUM(waiting, approved, refused),
  decided_by (FK user), decided_at, created_at, waiting_guard (generated, UNIQUE with user_id: one waiting row
  per user).
  - Approve with a matching student row (same matric_no): one transaction moves `linkedin_account` to the
    student row, makes it alumni, deletes the pending user.
  - Approve without a match: the pending user becomes alumni with its own career_profile.
  - Refuse: the pending user and its `linkedin_account` are deleted (the LinkedIn account is free again); the
    registration row stays with user_id NULL for the audit trail.

Definitions:
- Employment rate = (employed + self_employed + further_study) / (alumni whose status is not `unknown`).
  `unknown` is shown as its own count next to the rate.
- An alumnus whose QIU Google account still works may also sign in with Google.
- Converting a student without a linked LinkedIn to alumni warns the admin ("cannot sign in after graduation")
  and the tracker flags them.
- Changing `SUPERADMIN_EMAIL` demotes the old holder to admin in the same transaction as the new one's sign-in.

## 7. Slices
1. Foundation: sign-in (Google, LinkedIn link, alumni LinkedIn sign-in, graduate registration), onboarding,
   career profile with LinkedIn PDF import, admin people and roles, alumni tracker with CSV and employment rate,
   audit log, settings. Render test copy.
2. Modules that save data in the old portal: logbook with supervisor email approval, employers (jobs,
   applications), skills diagnostics, learning certificates, FYP showcase and talent feed, assessments.
3. Modules that were sample-only: workshops with RSVP and check-in, CV builder saved on the server, alumni
   network and mentors (built on the alumni data of slice 1), career path, AI interview practice.
Each slice is shown to the founder before the next starts.

## 8. Decisions
- 2026-11-25: Firebase removed. Google sign-in is server side (authorization code + PKCE), as in sld-orientation.
- 2026-11-25: plain PHP, not Laravel: same structure as the founder's sld-orientation project, which already runs
  on Exabytes-style hosting and Render; one way of working across projects.
- 2026-11-25: no "Verified on LinkedIn" partner tier (founder). Job history comes from the LinkedIn PDF only.
  The portal never scrapes LinkedIn (account-ban risk, against LinkedIn's terms).
- 2026-11-25: "follow the QIU LinkedIn page" is a required tick, not a check: LinkedIn's API cannot tell.

<!-- ---- slice 2a (logbook, showcase, assessments): begin ---- -->
## 9. Slice 2a: internship logbook, FYP showcase, self-assessments
Permissions (migration 0103): `logbook.own`, `showcase.own` (student); `assessment.take` (student, alumni);
`logbook.track`, `assessment.manage` (admin, superadmin); `showcase.browse` (staff, admin, superadmin).

Internship logbook
- A student records one internship (company, supervisor name and work email, start and end date) and one entry per
  week (Monday of the week, hours 0-80, what they did, what they learned). Only started weeks inside the internship.
- Draft or returned weeks can be changed; "send" emails the supervisor a link and locks the week.
- The supervisor has no account. The link holds a 256-bit random secret (43 characters); only its SHA-256 is stored
  (`logbook_review_link`). It works once, for `logbook_review_link_days` (14), only while the week waits. Sending
  again or changing the supervisor's email voids the old links. Returning a week needs a comment. The student gets
  an email with the decision. The review page shows the student's name and company, never email or matric number.
- Email: `Mailer` interface; `MAIL_DRIVER=log` writes to `STORAGE_DIR/logs/mail.log` (local, tests, Render test copy),
  `MAIL_DRIVER=mail` uses the host's PHP mail() with `MAIL_FROM` (Exabytes). No paid service.
- CPDC (`/internships`) sees every intern: weeks approved over weeks started, waiting, returned, approved hours; one
  intern's weeks read-only (each view audited `logbook.view`).

FYP showcase and talent feed
- One project per student: title, summary, technologies (up to 12), year, https code and demo links, published flag.
  Faculty comes from the directory. Picture: PNG, JPEG or WebP by its bytes (getimagesize), at most
  `showcase_image_max_bytes` (2 MB) and 6000 px a side, stored under a random name in `STORAGE_DIR/showcase`, served
  only through the API to its student or (when published) to `showcase.browse`.
- Staff and CPDC (`/showcase`) browse published projects, filter by technology, faculty, year and text. Names link
  to LinkedIn (rule 13).

Self-assessments
- CPDC writes an assessment: single-choice questions (2-6 answers, 0-10 points each) and result bands (start % and
  name; one starts at 0). Draft, published, archived. Questions freeze once anyone has taken it (archive instead).
- Students and alumni take published ones; the server checks every question is answered once and scores it
  (score, best possible, percent, band). Points never reach the taker. The latest result per assessment shows on
  the person's profile. CPDC sees attempts, people and average per assessment.

Data (migrations 0100-0102): `internship` (unique student), `logbook_entry` (unique internship + week),
`logbook_review_link`, `showcase_project` (unique student), `showcase_tech`, `assessment` (bands as JSON),
`assessment_question`, `assessment_option`, `assessment_attempt`, `assessment_answer`.
<!-- ---- slice 2a: end ---- -->
