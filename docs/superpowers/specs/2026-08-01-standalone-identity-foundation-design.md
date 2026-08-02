# Standalone Identity Foundation Design

## Goal

Make the QIU CPDC platform standalone-first and integration-ready: users authenticate with Google SSO through Firebase, only admin-authorized email addresses can enter, every module reads one canonical identity record, administrators can manage roles and student records, and important actions are recorded in an immutable audit trail.

## Scope of this slice

This slice establishes the platform foundation used by every later module. It does not pretend to connect to ACMS/SIS before QIU provides credentials and data contracts. A local database identity provider is the source of truth now; a future ACMS/SIS provider will implement the same adapter interface later.

## Architecture

The browser signs in with Firebase Google OAuth and sends the Firebase ID token to the Next.js server. The server verifies the token with Firebase Admin, resolves the normalized email against the local allowlist, and issues a signed, HTTP-only session cookie. Role, faculty, programme, year, and permission scope are resolved server-side from the database on every protected request.

The database keeps one `User` record per person and one optional linked `Student` record. Module records reference the canonical student ID; modules do not create their own student copies. Identity edits, role changes, sign-in events, and administrative actions create audit records. A provider interface separates local identity from a later ACMS/SIS adapter.

## Student identity format

The authoritative student number format is:

```text
QIU-YYYYMM-NNNNNN
```

Example: `QIU-202404-007157`.

`YYYYMM` is the intake year and month. `NNNNNN` is a six-digit sequence allocated per intake month. The database enforces uniqueness and the application validates the format at API boundaries.

## Core data additions

- User authentication fields: Firebase UID, normalized email, active/suspended status, last sign-in.
- Student identity fields: intake year/month, six-digit sequence, mentor/Head of Programme reference where available.
- Scoped role assignments: role plus optional faculty, school, and programme scope, with active dates.
- Identity history: timestamped snapshots of identity fields and source (`LOCAL_ADMIN`, `FIREBASE`, or future `ACMS_SIS`).
- Audit log: actor, action, resource, resource ID, before/after JSON, request ID, IP/user-agent metadata, and timestamp.
- Platform settings: versioned key/value configuration with scope and actor metadata.

## Access model

The permission engine evaluates `(actor, capability, resource, scope)` on the server. Client-side route guards remain useful for navigation, but they are not security. Students can read and edit only their own allowed profile fields. Head of Programme users are limited to their programme. Faculty Coordinators are limited to their faculty. CPDC Staff and Superadmins have broader capabilities, with Superadmin-only identity and permission overrides.

The initial capability set is:

- `identity.read.self`
- `identity.edit.self`
- `identity.manage`
- `role.assign`
- `audit.read`
- `settings.read`
- `settings.manage`
- `module.read`
- `module.manage`

## Authentication behavior

- Firebase Google sign-in is the only production login path.
- An administrator can pre-authorize a Gmail address before first login.
- An unknown Google email is rejected and is never auto-provisioned.
- A first authorized login creates or links the local user record by normalized email and Firebase UID.
- Suspended users cannot create a session.
- Firebase configuration is supplied through environment variables; no keys or service-account material are committed.
- Until Firebase configuration is supplied, tests use a deterministic mock token verifier. The UI shows a configuration message rather than silently claiming that Google sign-in succeeded.

## Integration seam

```js
IdentityProvider.resolveExternalIdentity(token)
IdentityProvider.provisionOrLinkIdentity(externalIdentity)
IdentityProvider.syncIdentity(userId)
```

The first implementation uses Firebase plus the local database. A future `QiuAcmsSisIdentityProvider` will map ACMS/SIS responses into the same normalized identity shape and record the source and sync timestamp.

## Monitoring

Every protected write runs inside a transaction that includes its audit record. Replayed writes use an idempotency key when a request can be retried. The admin console receives an audit view with filters for actor, action, resource, role, and date range. Later event-driven module work will extend the same audit/event conventions.

## Failure handling

- Invalid Firebase tokens return `401`.
- Valid but unapproved emails return `403` with a safe, user-readable message.
- Suspended accounts return `403`.
- Database identity conflicts return a structured `409`.
- Missing Firebase configuration is a visible configuration error in development and a generic authentication failure in production.
- No private token, password, or service credential is logged.

## Testing strategy

- Unit tests for student-ID parsing/generation and permission scope evaluation.
- Route tests for session creation, unauthorized access, unknown-email rejection, suspended-user rejection, admin role changes, and audit writes.
- Database tests for unique student IDs and idempotent audit/event writes.
- Browser smoke tests for Google-login states, admin user management, role-aware navigation, and sign-out.

## Design decisions

1. Firebase Google OAuth is the production authentication provider because the future deployment target is Firebase.
2. The local PostgreSQL/Prisma database remains the application source of truth until ACMS/SIS integration is available.
3. Student IDs use the user-confirmed six-digit suffix, not the earlier four-digit draft.
4. Admin authorization is an allowlist, not open Google self-registration.
5. Audit records are append-only and created at the same transaction boundary as administrative writes.
