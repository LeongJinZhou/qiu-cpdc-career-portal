# API Documentation

Endpoints (the only live server routes — everything else is client + fixtures):

- `GET /api/faculties` — faculties + programmes.
- `GET /api/students/by-matric/[matricNo]` — resolve student id/faculty/programme.
- `GET /api/logbook?studentId=` — a student's entries, newest first. Approval is
  selected WITHOUT tokenHash.
- `POST /api/logbook` — create entry + mint supervisor magic link. Returns the
  raw approvalUrl ONCE (only the hash is stored); caller delivers it (no SMS/email
  automation yet).
- `POST /api/approvals/[token]` — supervisor records decision. Gated by the
  unguessable token; single-use via guarded update; replayed/concurrent use
  returns 410; awards LOGBOOK_ONTIME XP.
- `GET /api/identity/me` — current canonical authenticated identity payload.
- `PATCH /api/identity/profile` — allowed self-service profile fields only.
- `GET /api/admin/users` / `POST /api/admin/users` / `PATCH /api/admin/users/[id]`
  — admin allowlisting, identity updates, role assignments, and scoped account
  management.
- `GET /api/admin/audit` — audit log visibility filtered by actor scope.
- `GET /api/admin/settings` — authenticated effective settings read. Default
  scope is platform/global; scoped reads require matching admin scope.
- `PATCH /api/admin/settings` / `PUT /api/admin/settings` — governed settings
  writes with Zod validation, optimistic concurrency (`expectedVersion` or
  `expectedUpdatedAt`), and an audit append in the same transaction.

`POST /api/logbook` rejects malformed JSON, missing identity fields, non-positive
or over-24-hour entries, invalid dates, and out-of-range coordinates before a
database write.

Contracts: client helpers in `lib/api.js` normalize all failures (incl. non-JSON
error pages) into a thrown Error with a readable message.

Auth/authorization:

- Unauthenticated requests return `401`.
- Authenticated but unauthorized requests return `403`.
- Canonical identity, logbook, admin, audit, and governed settings routes are
  now session-protected.
- Settings authorization is role + scope aware: `SUPER_ADMIN` is required for
  platform/global writes; scoped settings writes require an explicit
  `CPDC_ADMIN`, `FACULTY_COORDINATOR`, or `HEAD_OF_PROGRAMME` role assignment
  matching the target faculty/programme.

Client-only module state (profile, FYP, diagnostics, workshop/course sync and
talent consent) currently has no API contract. PortalProvider is the intended
seam for replacing the demo session with authenticated API reads/writes; do not
describe those flows as persisted until endpoints and authorization exist.
