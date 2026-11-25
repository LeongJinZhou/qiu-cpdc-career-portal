# STATUS

## Done: slice 1, 2026-11-25 (foundation)
- Rebuild as React + TypeScript (Vite) + plain PHP 8.3 + MySQL 8, structure of sld-orientation. Firebase removed.
- Google sign-in (server side, PKCE, `google_hosted_domains`, directory profile: matric/staff no, faculty, title).
- LinkedIn: compulsory link for students and staff (onboarding gate), follow-QIU tick, profile URL, PDPA consent;
  alumni-only LinkedIn sign-in; "Register as a QIU graduate" with CPDC approval and merge by matric number.
- Career profile: headline, about, location, personal email, status and current job, jobs, education, skills.
  LinkedIn PDF import (read once, preview, save; file never kept). Optional GitHub link.
- Admin: People (search, role change rules), person detail (audited), Alumni tracker (employment rate per faculty
  and year, filters, CSV with formula escaping, "make alumni" by matric list), Graduate sign-ups, Audit log.
- Alumni job confirmation every `alumni_job_confirm_days` (180), history in `job_confirmation`.
- Checks: 104 PHPUnit tests (unit + integration through the real pipeline with fake Google/LinkedIn), PHPStan level 8,
  ESLint, TypeScript, 1 Playwright spec of the main path (`e2e/student-onboarding.spec.ts`).
- Hosting files: `Dockerfile` + `render.yaml` (Render test copy), `deploy/exabytes/` and `docs/RELEASE.md`.

## Open
- Founder: create the MySQL database for Render (Aiven free plan or similar), fill Render values, register the new
  callback URLs at Google and LinkedIn (docs/RELEASE.md). Exabytes upload when ready.
- Slice 2: logbook with supervisor email approval, employers (jobs, applications), skills diagnostics, learning
  certificates, FYP showcase and talent feed, assessments (port from the old portal, which saves these).
- Slice 3: workshops (RSVP, check-in), CV builder saved on the server, alumni network, career path, AI interview
  practice (sample-only in the old portal).
- Settings screen for `google_hosted_domains`, `student_employee_types`, `qiu_linkedin_page_url` (today in the DB).
- LinkedIn photo links expire after weeks: refreshed at each LinkedIn sign-in; initials shown when broken.
- PHP CodeSniffer: 58 line-length warnings (no errors).
- Local dev on Windows: `php -S` hangs after a while; `tools/php-dev-server.mjs` (php-cgi per request) replaces it.
- No production sweep yet ("production" before real students use it).

## Next step
Founder sets up the Render database and keys; then the lead checks sign-in live. Slices 2 and 3 can run as
parallel sessions, one module group each, on top of `main`.

<!-- slice 3a (workshops, CV, career path): begin -->
## Done: slice 3a, 2026-11-26 (branch claude/mod-workshops-acffda, not merged)
- Workshops: CPDC creates, edits, cancels (Malaysia time in, UTC stored); RSVP with seats and waitlist under a row
  lock; no RSVP or cancel after the start; check-in by code (30 minutes before to the end) or CPDC's tick list;
  attendance CSV (formula-escaped). Screens: /workshops (list, form, check-in desk).
- CV builder: /cv, built on the career profile plus extra sections, saved on the server, A4 print styles.
- Career path: /career-path, paths per programme written by CPDC, skills matched to the profile, ticked steps.
- Migrations 0300-0303. Checks: 31 new PHPUnit tests (135 total), PHPStan level 8, ESLint, TypeScript,
  e2e `e2e/workshops-cv-careerpath.spec.ts`.
- Open (slice 3a): `api/bin/seed.php` does not clear the slice 3a tables (they keep rows of deleted fake users
  locally); the top navigation no longer fits on desktop once all slices add items (needs a grouped nav);
  PHPStan's parallel workers hang on this laptop while other sessions run (`--debug` runs it serially).
<!-- slice 3a: end -->
