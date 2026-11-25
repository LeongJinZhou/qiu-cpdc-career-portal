# Project: QIU CPDC Career Portal

## What it is
Quest International University's career portal for CPDC. Students and staff sign in with QIU Google and must link
LinkedIn; graduates sign in with LinkedIn; CPDC tracks alumni (current job, LinkedIn, employment rate). Rebuild of
the old Next.js portal (`qiu-cpdc-career-portal`, reference only).

## Tech stack
- Frontend: React + TypeScript (Vite), `web/`
- Backend: PHP 8.3 (PSR-12), no framework, parameterised PDO, `api/` (structure of the founder's sld-orientation)
- Database: MySQL 8, forward-only migrations in `api/migrations/`
- Tests: Vitest (frontend), PHPUnit (backend, real test database `<DB_NAME>_test`), Playwright (e2e)
- Hosting: Exabytes (production, cPanel) and Render (test copy, Docker) - docs/RELEASE.md

## Commands
- Run: npm run dev (API :8090 and fake Google/LinkedIn :8091 via tools/php-dev-server.mjs, web :5183)
- Lint: npm run lint | Types: npm run typecheck
- Test: npm test | E2E: npm run test:e2e
- Never `php -S` on Windows here: it stops accepting connections after a while.

## Roles and permissions (source of truth: docs/SPEC.md section 3)
superadmin (SUPERADMIN_EMAIL), admin (CPDC), staff, student, alumni, pending. Permissions in `role_permission`;
`Cpdc\Auth\Access` is the only place that answers "may this user do X". Deny by default.

## Skills (chosen by the lead from the skill map, shown in the plan)
| Kind of work | Skill | File | Used by |
|---|---|---|---|
| UI look and feel | impeccable | ~/.claude/plugins/cache/impeccable/impeccable/4.11.0/skills/impeccable/SKILL.md | lead, frontend-dev, ux-reviewer |
| Screens | frontend-standards | ~/.claude/skills/frontend-standards/SKILL.md | lead, frontend-dev |
| Server code | backend-standards | ~/.claude/skills/backend-standards/SKILL.md | lead, backend-dev |
| Security | security-checklist | ~/.claude/skills/security-checklist/SKILL.md | lead, security-reviewer |

## Key docs
docs/SPEC.md · docs/STATUS.md (both in git: they are the project's memory). PRODUCT.md (design brief).
docs/HISTORY.md (in git): older rounds moved out of docs/STATUS.md, unchanged.
Read it only when a task needs it, never at the start. What is still open stays in docs/STATUS.md.
docs/RELEASE.md (hosting).
