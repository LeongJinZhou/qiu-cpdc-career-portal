# QIU CPDC Career Portal
> Quest International University's career portal: students and staff sign in with Google, link LinkedIn, keep a
> career profile; graduates sign in with LinkedIn; CPDC tracks where alumni are now.

## Features (slice 1)
- Google sign-in for `@qiu.edu.my`, with the QIU directory profile (matric or staff number, faculty, title)
- Compulsory LinkedIn link at first sign-in; LinkedIn-only sign-in for alumni; graduate self-registration
- Career profile with LinkedIn PDF import (jobs, education, skills, about), optional GitHub link
- Alumni tracker: employment rate per faculty and year, names open each graduate's LinkedIn, CSV export
- Roles (super admin, CPDC admin, staff, student, alumni) checked on the server; audit log of personal-data access

## Tech stack
React · TypeScript · Vite · PHP 8.3 (no framework, PDO) · MySQL 8 · PHPUnit · Playwright

## Getting started (local)
Needs PHP 8.3 with `php-cgi`, Composer, Node 22+, MySQL 8.
```
cp .env.example .env            # fake local values only
cd api && composer install && cd ..
npm install
php api/bin/migrate.php && php api/bin/seed.php
npm run dev                     # http://127.0.0.1:5183, fake Google and LinkedIn on :8091
```
Tests: `npm run test:api` (uses the `<DB_NAME>_test` database), `npm run test:e2e`.

## Docs
`docs/SPEC.md` (what and why) · `docs/STATUS.md` (done and open) · `docs/RELEASE.md` (Render and Exabytes)
