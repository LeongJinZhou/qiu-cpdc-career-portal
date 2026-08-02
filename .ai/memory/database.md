# Database Notes

Schema (`prisma/schema.prisma`, PostgreSQL):
- Faculty → Programme → Student hierarchy; User(role) 1:1 Student.
- XpEvent (append-only ledger, unique `dedupeKey` guards double-award).
- Badge, LogbookEntry(status, fieldValues JSON, GPS), SupervisorApproval,
  Workshop(qrSecret), WorkshopAttendance(unique per student/workshop).
- Roles enum: STUDENT, CPDC_ADMIN, SUPER_ADMIN, EMPLOYER, ALUMNI,
  FACULTY_COORDINATOR. A distinct external-supervisor role is still not
  modelled; supervisors use single-use approval links instead.

Migrations: none committed — uses `prisma db push` (schema-sync), not migrate.
Seed: `npm run db:seed` (`prisma/seed.mjs`), idempotent via upsert. Seeds 8
faculties / 53 programmes, demo student QIU-202404-007157, 4 workshops. Logbook
entries each upsert a SupervisorApproval separately (keyed by logbookEntryId) so
re-seeding backfills supervisor names — fixed 2026-08-01 (was showing
"No supervisor assigned").

Fresh standalone bootstrap: `BOOTSTRAP_SUPER_ADMIN_EMAIL=... npm run
db:bootstrap-admin` creates or promotes the initial active `SUPER_ADMIN` and
writes a `BOOTSTRAP_SUPER_ADMIN` audit row. Remove the bootstrap variable after
the one-time run; subsequent allowlisting belongs in the admin console.

Security:
- Supervisor magic-link tokens: only the SHA-256 hash is stored; single-use;
  expiring. Good.
- Protected identity, logbook, admin, audit, and governed settings routes now
  enforce authenticated session access server-side.

Platform settings:

- `PlatformSetting` now supports scoped governance with
  `@@unique([key, scopeType, scopeValue])` plus an integer `version` field for
  optimistic concurrency.
- Existing fields `key`, `value`, `description`, and `updatedByUserId` remain
  compatible.
- `prisma validate`, `prisma generate`, and `prisma db push --accept-data-loss`
  were safe on Saturday, August 1, 2026 because the live `PlatformSetting`
  table was empty before the new composite uniqueness was applied.

Identity notes:

- Canonical student IDs use the exact regex-backed shape
  `QIU-YYYYMM-NNNNNN` with a six-digit suffix.
- Example: `QIU-202404-007157`.
