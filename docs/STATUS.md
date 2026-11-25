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

<!-- ---- slice 2a (logbook, showcase, assessments): begin ---- -->
## Done: slice 2a, 2026-11-26 (branch `claude/mod-logbook-396638`, not merged)
- Internship logbook with supervisor approval by single-use emailed link (no login), CPDC intern progress.
- FYP showcase (project, technologies, links, checked picture upload) and talent feed for staff and CPDC.
- Self-assessments: CPDC editor with points and result bands, students and alumni take them, server scoring,
  latest results on the profile.
- Checks: 148 PHPUnit tests (44 new), Vitest for the new screen logic, PHPStan, ESLint, PHPCS with no warnings,
  build, 2 Playwright specs (new: `e2e/logbook-showcase-assessment.spec.ts`), gitleaks on history.
- Open from 2a: production mail needs `MAIL_DRIVER=mail` and `MAIL_FROM` on Exabytes (Render has no sendmail: keep
  `log` there or add SMTP later). `api/bin/seed.php` does not clear the 2a tables (orphan rows after a reseed are
  hidden by joins). The shell nav overflows sideways once every module adds items: needs a grouped menu.
<!-- ---- slice 2a: end ---- -->

<!-- slice 2b (start) -->
## Done: slice 2b, 2026-11-26 (branch `claude/mod-employers-413367`, not merged)
- Employers and jobs: CPDC employer directory, jobs and internships with skill levels, applicants per job, one
  application with profile, note and CV, status changes (audited). Students and alumni: open jobs with search,
  type and location filters, apply with note and optional CV PDF, withdraw, "My applications".
- Skills: self-rating 1-5 in 8 areas, kept over time (progress table), gap view against an open job.
- Learning: courses and certificates with link or PDF proof; CPDC "Learning checks" verify or decline with a note.
- Screens: `/jobs`, `/skills`, `/learning`, `/employers`, `/learning-checks`; checked on desktop and phone.
- Checks: 143 PHPUnit tests (39 new), PHPStan level 8, ESLint, PHPCS clean, build, `e2e/jobs-skills-learning.spec.ts`.

## Open (slice 2b)
- Render's disk is lost on restart: uploaded CVs and certificate PDFs vanish there. Exabytes keeps them. Before
  real users on Render: a persistent disk or object storage.
- `api/bin/seed.php` does not clear the slice 2b tables (outside this slice's files): add them at merge.
- No screen to edit skill areas; no employer self-service; no email when an application status changes.
<!-- slice 2b (end) -->
