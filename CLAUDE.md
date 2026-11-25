# Project: <PROJECT NAME>

## What it is
<2-3 sentences: who uses it and what it does. Filled from SPEC.md.>

## Tech stack
The default. Change these lines when docs/SPEC.md names another stack; the
README and .github/workflows/ci.yml must then say the same.
- Frontend: React + TypeScript
- Backend: PHP 8+ (PSR-12), parameterised PDO
- Database: MySQL
- Tests: Vitest (frontend), PHPUnit (backend), Playwright (e2e)
- Hosting: Exabytes

## Commands
- Run: npm run dev
- Lint: npm run lint | Types: npm run typecheck
- Test: npm test | E2E: npm run test:e2e

## Roles and permissions (source of truth: docs/SPEC.md)

## Skills (chosen by the lead from the skill map, shown in the plan)
The lead reads these before building and hands the paths to any worker. Add a row when the work needs a skill that is not here.
| Kind of work | Skill | File | Used by |
|---|---|---|---|
| <UI look and feel> | <impeccable> | <full path to SKILL.md#Heading> | <frontend-dev, ux-reviewer> |

## Key docs
docs/SPEC.md · docs/STATUS.md (both in git: they are the project's memory).
docs/HISTORY.md (in git): older rounds moved out of docs/STATUS.md, unchanged.
Read it only when a task needs it, never at the start. What is still open
stays in docs/STATUS.md.
Only when the project has them: docs/ARCHITECTURE.md · docs/API.md ·
docs/PLAN.md · docs/RELEASE.md
