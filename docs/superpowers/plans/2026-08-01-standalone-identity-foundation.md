# Standalone Identity Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the demo-only identity seam with a standalone, Firebase-Google-ready identity system that supports admin allowlisting, role/scope management, canonical student records, audit logging, and future ACMS/SIS adapters.

**Architecture:** Keep PostgreSQL/Prisma as the standalone source of truth. Firebase Google OAuth is the external authentication provider when configured; a development-only demo provider remains available only when `AUTH_MODE=demo` and never in production. The server verifies identity, resolves role/scope, and enforces capabilities before every protected write. All modules consume the same identity service and student record.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma 6/PostgreSQL, Firebase Web SDK, Firebase Admin SDK, Zod, Node test runner, existing Tailwind token system.

## Global Constraints

- Use the user-confirmed student ID format `QIU-YYYYMM-NNNNNN`; `QIU-202404-007157` is a valid example.
- Google SSO is the only production login path; unknown Google emails must be rejected until an admin authorizes them.
- Permission checks live server-side, not only in the UI.
- There is exactly one canonical user/student identity record; modules must not create duplicate student records.
- Every retryable administrative write uses an idempotency key or a database uniqueness/transaction guard.
- Every identity, role, permission, settings, and protected domain write creates an immutable audit record.
- Do not commit Firebase credentials, service-account JSON, private keys, or real QIU data.
- Keep the existing light QIU design tokens and shared component patterns.
- No external ACMS/SIS call is made until credentials and contracts are supplied; keep the provider interface ready.
- Add tests for student-ID parsing, permission scope evaluation, auth allowlisting, and audit behavior before implementation claims.

---

### Task 1: Canonical identity schema and student-ID service

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/data/facultyData.js`
- Modify: `prisma/seed.mjs`
- Create: `lib/identity/student-id.js`
- Create: `lib/identity/provider.js`
- Create: `lib/audit/index.js`
- Create: `tests/identity/student-id.test.mjs`
- Create: `tests/audit/audit-shape.test.mjs`
- Modify: `package.json`

**Interfaces:**
- `parseStudentId(value)` returns `{ intakeYearMonth, sequence }` or throws a typed validation error.
- `formatStudentId({ intakeYearMonth, sequence })` returns `QIU-YYYYMM-NNNNNN`.
- `isStudentId(value)` returns a boolean.
- `IdentityProvider` exposes `resolveExternalIdentity(input)`, `provisionOrLinkIdentity(input)`, and `syncIdentity(userId)`.
- `createAuditEntry({ actorUserId, action, resourceType, resourceId, before, after, requestId, metadata })` writes an append-only `AuditLog` record through the supplied Prisma transaction.

- [ ] **Step 1: Write failing student-ID and audit-shape tests.**

Test valid `QIU-202404-007157`, reject four-digit suffixes, reject invalid months, reject wrong prefixes, and assert that an audit payload never includes token or password fields.

- [ ] **Step 2: Run the focused tests and verify they fail.**

Run: `node --test tests/identity/student-id.test.mjs tests/audit/audit-shape.test.mjs`

Expected: FAIL because the identity and audit modules do not exist yet.

- [ ] **Step 3: Add Prisma identity, scope, snapshot, audit, setting, and outbox models.**

Add nullable Firebase UID, normalized email, login allowlist flag, account status, last sign-in, and identity source fields to `User`. Add intake year/month and numeric sequence to `Student`. Add `RoleAssignment`, `IdentitySnapshot`, `AuditLog`, `PlatformSetting`, and `OutboxEvent` models with unique constraints and indexes. Keep existing role compatibility while allowing scoped assignments.

- [ ] **Step 4: Implement the ID formatter/parser and audit sanitization.**

Use the exact regex `^QIU-(20\\d{2}(0[1-9]|1[0-2]))-(\\d{6})$`. Normalize audit JSON recursively and redact keys matching `token`, `password`, `secret`, `privateKey`, or `credential`.

- [ ] **Step 5: Update fixture and seed identity values.**

Change the demo student matric number to `QIU-202404-007157`, set `intakeYearMonth` to `202404`, `intakeSequence` to `7157`, and make the seed upsert the linked student by `userId` so an old `STU-*` value is updated instead of creating a second student.

- [ ] **Step 6: Run the focused tests and Prisma validation.**

Run: `node --test tests/identity/student-id.test.mjs tests/audit/audit-shape.test.mjs` and `npx prisma validate`.

Expected: all focused tests pass and Prisma reports a valid schema.

- [ ] **Step 7: Commit the task.**

Run: `git add prisma/schema.prisma prisma/seed.mjs lib/data/facultyData.js lib/identity lib/audit tests package.json package-lock.json && git commit -m "feat: add canonical identity foundation"`

### Task 2: Firebase Google authentication and secure sessions

**Files:**
- Modify: `package.json`
- Create: `lib/auth/config.js`
- Create: `lib/auth/firebase-client.js`
- Create: `lib/auth/firebase-admin.js`
- Create: `lib/auth/session.js`
- Create: `app/api/auth/session/route.js`
- Modify: `app/login/page.jsx`
- Create: `.env.example`
- Create: `tests/auth/session-policy.test.mjs`

**Interfaces:**
- `getAuthMode()` returns `firebase-google` or `demo`, with production rejecting `demo`.
- `verifyGoogleIdToken(idToken)` returns normalized `{ firebaseUid, email, name, avatarUrl }`.
- `createSessionCookie(idToken)` and `readSessionCookie(cookie)` manage the HTTP-only server session.
- `POST /api/auth/session` accepts `{ idToken }` and returns the normalized session user.
- `GET /api/auth/session` returns the current server session or `401`.
- `DELETE /api/auth/session` clears the server session.

- [ ] **Step 1: Write failing auth-policy tests.**

Cover production rejection of demo mode, normalized email matching, unknown-email denial, suspended-account denial, and safe session payload fields.

- [ ] **Step 2: Run the focused auth tests and verify they fail.**

Run: `node --test tests/auth/session-policy.test.mjs`

Expected: FAIL because the auth policy modules are not present.

- [ ] **Step 3: Add Firebase dependencies and environment documentation.**

Install `firebase`, `firebase-admin`, and `zod`. Add only variable names and safe descriptions to `.env.example`; never add values.

- [ ] **Step 4: Implement Firebase client/admin adapters and signed session handling.**

Use Firebase Web `GoogleAuthProvider` and popup/redirect on the client. Use Firebase Admin verification on the server. Create an HTTP-only, secure-in-production session cookie. In development, allow the explicit `AUTH_MODE=demo` provider only for local UI smoke tests.

- [ ] **Step 5: Implement the session route.**

Verify the token, normalize email, find the local user by Firebase UID or email, require `loginAllowed=true` and `status=ACTIVE`, update the Firebase UID/last sign-in, and write a `LOGIN_SUCCESS` audit event. Return `401` for invalid tokens and `403` for unknown or suspended users.

- [ ] **Step 6: Replace the login page’s demo selector with Google sign-in.**

Keep a visible development-only configuration notice when Firebase variables are absent. Remove the role selector from the production path; roles come from the server session. Preserve the QIU-branded layout and clear error states.

- [ ] **Step 7: Run auth tests and lint.**

Run: `node --test tests/auth/session-policy.test.mjs` and `npm run lint`.

- [ ] **Step 8: Commit the task.**

Run: `git add package.json package-lock.json .env.example lib/auth app/api/auth app/login/page.jsx tests/auth && git commit -m "feat: add firebase google session auth"`

### Task 3: Server-side permissions and identity API

**Files:**
- Create: `lib/auth/permissions.js`
- Create: `lib/auth/identity.js`
- Create: `app/api/identity/me/route.js`
- Create: `app/api/identity/profile/route.js`
- Modify: `app/api/students/by-matric/[matricNo]/route.js`
- Modify: `app/api/logbook/route.js`
- Create: `tests/auth/permissions.test.mjs`

**Interfaces:**
- `getAuthenticatedIdentity(request)` returns `{ user, student, assignments, scopes }` or a typed HTTP error.
- `hasCapability(identity, capability, resourceScope)` returns a boolean.
- `requireCapability(identity, capability, resourceScope)` throws a structured `403` error.
- `GET /api/identity/me` returns the single canonical identity payload.
- `PATCH /api/identity/profile` changes only allowed self-service fields and writes an audit record.

- [ ] **Step 1: Write failing permission tests.**

Test a student’s own profile access, denial of another student’s record, Head of Programme access to only its programme, Faculty Coordinator access to only its faculty, and Superadmin access to university-wide identity management.

- [ ] **Step 2: Run the permission tests and verify failure.**

Run: `node --test tests/auth/permissions.test.mjs`

- [ ] **Step 3: Implement the centralized capability and scope evaluator.**

Keep role/scope rules in one pure module. Do not add role checks directly to individual route handlers except through this evaluator.

- [ ] **Step 4: Implement the authenticated identity service and `/api/identity/me`.**

Resolve the user and linked student from the session cookie, include faculty/programme/role assignments, derive capabilities, and return no secrets or token fields.

- [ ] **Step 5: Protect existing identity and logbook endpoints.**

Require authentication for student lookup and logbook reads/writes. Students may use only their linked database student ID; staff access is checked by faculty/programme scope. Keep supervisor approval token routes separate and token-protected.

- [ ] **Step 6: Run focused tests, lint, and API checks.**

Run: `node --test tests/auth/permissions.test.mjs`, `npm run lint`, and verify unauthenticated requests return `401` while authorized test requests reach the handler.

- [ ] **Step 7: Commit the task.**

Run: `git add lib/auth app/api/identity app/api/students app/api/logbook tests/auth && git commit -m "feat: enforce server-side identity permissions"`

### Task 4: Admin user, role, identity, and audit management

**Files:**
- Create: `app/api/admin/users/route.js`
- Create: `app/api/admin/users/[id]/route.js`
- Create: `app/api/admin/audit/route.js`
- Create: `components/admin/IdentityManagement.jsx`
- Create: `components/admin/AuditLogPanel.jsx`
- Modify: `components/AdminControlCenter.jsx`
- Create: `tests/admin/admin-identity-policy.test.mjs`

**Interfaces:**
- `POST /api/admin/users` accepts normalized email, name, optional student profile, role assignments, and scope.
- `PATCH /api/admin/users/[id]` updates allowlist, status, identity fields, and scoped assignments according to the caller’s capability.
- `GET /api/admin/users` supports `query`, `role`, `status`, `facultyId`, and `programmeId` filters.
- `GET /api/admin/audit` supports actor/action/resource/date filters and pagination.

- [ ] **Step 1: Write failing policy tests.**

Cover admin-only creation, Superadmin-only identity/role escalation, programme/faculty scope enforcement, duplicate-email conflict, duplicate student-ID conflict, and audit creation for every successful mutation.

- [ ] **Step 2: Run the policy tests and verify failure.**

Run: `node --test tests/admin/admin-identity-policy.test.mjs`

- [ ] **Step 3: Implement transactional admin APIs.**

Validate request bodies with Zod, normalize emails, perform user/assignment/student writes in a Prisma transaction, use idempotency keys for create/retry requests, and append audit/outbox records in the same transaction.

- [ ] **Step 4: Build the identity-management panel.**

Add a searchable table and an accessible add/edit drawer with email allowlisting, role assignment, faculty/programme scope, student-ID validation, status controls, and clear save/error states. Reuse the existing light QIU surface/button tokens.

- [ ] **Step 5: Build the audit-log panel.**

Add filterable, paginated audit entries showing actor, action, resource, timestamp, and safe before/after summaries. Do not render secrets or raw Firebase tokens.

- [ ] **Step 6: Integrate both panels into the admin console and test.**

Run: `node --test tests/admin/admin-identity-policy.test.mjs`, `npm run lint`, and a browser smoke test for add, edit, suspend, role scope, and audit visibility.

- [ ] **Step 7: Commit the task.**

Run: `git add app/api/admin components/admin components/AdminControlCenter.jsx tests/admin && git commit -m "feat: add admin identity and audit management"`

### Task 5: Canonical client session and live logbook synchronization

**Files:**
- Modify: `components/portal/PortalProvider.jsx`
- Modify: `components/portal/RoleGuard.jsx`
- Modify: `lib/api.js`
- Modify: `components/ModularLogbook.jsx`
- Modify: `components/AutoCVEngine.jsx`
- Create: `tests/client/canonical-session-contract.test.mjs`

- [ ] **Step 1: Write a contract test for the canonical identity payload.**

Assert that the client consumes `user`, `student`, `faculty`, `programme`, `role`, `scopes`, and `capabilities` from `/api/identity/me`, with no module-specific student copy.

- [ ] **Step 2: Run the contract test and verify failure.**

Run: `node --test tests/client/canonical-session-contract.test.mjs`

- [ ] **Step 3: Load the authenticated identity in `PortalProvider`.**

Use the session API on mount, retain an explicit development fallback only when `AUTH_MODE=demo`, and expose `identityLoading`, `identityError`, and the canonical student object to every module.

- [ ] **Step 4: Remove URL role authority from client navigation.**

Keep deep links for navigation, but use the server-returned role/capability set as the authority. The existing role guard remains a UX guard while API routes enforce security.

- [ ] **Step 5: Map live logbook records into the canonical student projection.**

After identity load, fetch the authorized logbook entries and normalize them into the fields consumed by CV/dashboard modules. Do not use `DEFAULT_STUDENT.logbookEntries` when a live identity exists.

- [ ] **Step 6: Run tests, lint, build, and browser smoke.**

Run: `node --test tests/client/canonical-session-contract.test.mjs`, `npm run lint`, `npm run build`, and the existing route smoke suite with one dev server only.

- [ ] **Step 7: Commit the task.**

Run: `git add components/portal components/ModularLogbook.jsx components/AutoCVEngine.jsx lib/api.js tests/client && git commit -m "feat: use canonical live client identity"`

### Task 6: Settings, audit visibility, integration contract, and final verification

**Files:**
- Create: `app/api/admin/settings/route.js`
- Modify: `lib/settings.js`
- Modify: `components/SettingsEngine.jsx`
- Create: `lib/integrations/acms-sis.js`
- Create: `tests/settings/settings-policy.test.mjs`
- Modify: `README.md`
- Modify: `.ai/memory/api.md`
- Modify: `.ai/memory/architecture.md`
- Modify: `.ai/memory/database.md`

- [ ] **Step 1: Write failing settings policy tests.**

Test that only authorized admin roles can update settings, settings are scoped by platform/faculty/programme, changes are versioned, and each change creates an audit record.

- [ ] **Step 2: Run the settings tests and verify failure.**

Run: `node --test tests/settings/settings-policy.test.mjs`

- [ ] **Step 3: Implement database-backed settings reads/writes.**

Keep the current settings shape as the public contract, but replace browser-only persistence with authenticated API reads/writes. Use optimistic concurrency on a version field and show conflict/error states in the UI.

- [ ] **Step 4: Add the ACMS/SIS adapter contract.**

Define normalized request/response functions and explicit `NotConfigured` behavior. Do not make network calls without an enabled provider and configured endpoint.

- [ ] **Step 5: Update documentation and project memory.**

Document Firebase variables, local demo mode boundaries, student-ID format, protected endpoints, admin capabilities, audit behavior, and the future ACMS/SIS adapter.

- [ ] **Step 6: Run the complete verification gate.**

Run: `npm test` (the Node 26-compatible equivalent of running every file under `tests/`), `npm run lint`, `npx prisma validate`, stop the dev server, run `npm run build`, restart one dev server, smoke-test `/login`, `/dashboard`, `/admin`, `/settings`, `/logbook`, and verify protected API responses.

- [ ] **Step 7: Commit the task.**

Run: `git add app/api/admin/settings lib/settings.js components/SettingsEngine.jsx lib/integrations README.md .ai/memory tests && git commit -m "feat: make settings and integrations standalone-ready"`

## Self-review checklist

- The student ID example uses six digits after the final hyphen everywhere.
- No task allows an unknown Google email to auto-provision.
- No task treats client-side role selection as authorization.
- Every new admin mutation has a transaction, idempotency strategy, and audit entry.
- The local provider is explicit and production cannot silently fall back to it.
- No task requires ACMS/SIS credentials that are not available yet.
- The existing UI remains usable during the migration.
