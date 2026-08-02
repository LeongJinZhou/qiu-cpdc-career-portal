# Complete QIU CPDC Modules 1–5

## Context

The repository already contains a committed persistence pass in `66406f8` for
Modules 1–5. This plan closes the remaining contract, UI, security, and audit
gaps from the attached requirements without touching the unrelated dirty
Modules 6+, 11, and 15 work currently present in the working tree.

## Global Constraints

- Keep the standalone-first architecture: Postgres/Prisma is the source of
  truth now; ACMS/SIS, Firebase Storage, and email providers remain replaceable
  seams.
- Preserve Google/Firebase session authorization and the exact canonical
  student ID format `QIU-YYYYMM-NNNNNN`, including `QIU-202404-007157`.
- Every student-facing mutation must resolve the acting student server-side;
  client role headers are demo-only and cannot grant real permissions.
- XP is append-only and idempotent through `XpEvent.dedupeKey`; no client-side
  total or simulated award may become authoritative.
- Mutations that change user-visible records must append sanitized audit data
  transactionally where the existing audit infrastructure supports it.
- Do not edit or revert the current dirty files outside Modules 1–5 (including
  the parent-level agent configuration files, employer/job/visibility work,
  and any other files reported dirty by `git status`), except when a shared
  interface change is strictly required and can be kept backward compatible.

## Tasks

### Task 1: Make Dashboard XP and Next Best Action truthful

Write focused tests first for an XP summary contract and a deterministic next-
best-action selector. Extend `GET /api/xp` to return
`{ totalXp, tier, streakDays, ledger }` (retain compatible aliases only when
needed), derive the total from `XpEvent`, derive consecutive login days from
recorded login audit events, and return a sanitized chronological ledger.
Replace dashboard hardcoded action/streak assumptions with a small pure rules
module driven by the available student activity state and live XP summary.
Keep loading/error states friendly and ensure the XP update event refreshes the
summary rather than trusting a client-supplied total.

### Task 2: Complete FYP and Career Path API contracts

Write route/helper tests before code. Preserve the existing persistent FYP and
milestone behavior, add the requested FYP status endpoint and a stable
`/api/career-path/milestones` compatibility route, support draft/review status
transitions explicitly, validate ownership and reviewer scope server-side, and
append audit records for submissions, milestone changes, and review decisions.
Keep the eight faculty roadmaps and stable milestone IDs, and make milestone
completion/XP idempotent under retries.

### Task 3: Finish Logbook supervisor edit/resend

Write tests for the supervisor update contract and email seam. Expose the
requested `/api/logbook/[id]/supervisor` mutation while retaining the existing
client-compatible path, enforce student ownership or permitted staff scope,
update the pending entry and approval token atomically, audit the change, and
send through a provider-neutral email adapter. Escape interpolated email HTML,
make the no-provider behavior explicit for standalone development, and wire
the existing logbook UI to show success/failure without losing local form data.

### Task 4: Harden Workshops/Event Hub persistence and UX

Write tests for publish validation, capacity-aware RSVP, and idempotent QR
check-in/XP. Ensure workshop list/publish, RSVP/cancel, and check-in routes use
the database, record auditable mutations, reject invalid/expired QR secrets,
and never award attendance XP twice. Wire the Event Hub to the live API with
clear loading, empty, RSVP, and check-in states while preserving the seeded
standalone catalogue.

### Task 5: Verify and hand off

Run the focused new tests, the existing suite, Prisma validation/generation,
lint, production build, and HTTP smoke checks in both demo and secure Firebase
configuration modes. Inspect the final diff to confirm Modules 6+ remain
untouched, document any environment-dependent gaps (Firebase credentials,
session secret, email provider, storage bucket), and report module-by-module
completion honestly.

## Verification commands

```bash
npm test
npx prisma validate
npx prisma generate
npm run lint
npm run build
```
