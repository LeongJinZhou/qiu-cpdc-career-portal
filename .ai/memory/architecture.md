# Architecture Decisions

- **Module registry** (`lib/modules.js`): every feature area is declared once
  (roles, faculties, enabled, primary). Sidebar, mobile bar, route guard and
  admin toggles all read from it — add/retire a module in one edit. New route =
  registry entry + `app/(portal)/<id>/page.jsx`. Skills Diagnostics was added
  this way (2026-08-01).
- **Route-per-module** under `app/(portal)/` share `PortalProvider` (session)
  + `PortalShell` (chrome) + `RoleGuard`. Back button / deep links work.
- **Session is canonical server identity in production**: `PortalProvider` reads
  `/api/identity/me` after Firebase Google sign-in, while explicit
  `AUTH_MODE=demo` remains a local-only sessionStorage fallback for UI work.
  Production role and scope come from the server; URL `demoRole` values never
  grant access. Onboarding profile preferences use `qiu.portal.profile` and are
  still client-only until their API contract is implemented.
- **RoleGuard is client-side only** — a usability guard, not security. Server
  authorization now protects identity, logbook, admin, audit, and governed
  settings routes; RoleGuard remains a UX layer, not the authority.
- **XP = append-only ledger** (`XpEvent` with `dedupeKey`) in the DB, tier math
  in `lib/xp.js`. NOTE: the UI's `student.xp` (in-memory) and the DB ledger are
  two separate sources that don't reconcile — known gap.
- **Faculty logbook fields are JSON-driven** (`Faculty.logFields`) so each
  faculty renders a different schema without code changes.
- **UI tokens** in `app/globals.css` (@theme + :root). Light "Apple Elegance"
  system: semantic classes `.surface`, `.glass-panel`, `.crimson-btn`. Re-skin =
  token edit. Components use `bg-canvas`/`bg-surface`/`text-[#1d1d1f]`/`text-muted`
  and `border-black/10`; avoid reintroducing dark-assuming `text-white` /
  `border-white/*` / `bg-black/40` fills (those were swept out on 2026-08-01).
- **Client-only demo actions are guarded locally**: roadmap tasks and QR scans
  now dedupe within their component state, and FYP submission is an explicit
  action. Real persistence still belongs in API/database flows before launch.
- **Live demo state flows through PortalProvider**: profile fields, public
  talent consent, FYP submission status, diagnostic result, workshop attendance,
  and course certificates are updated via `setStudent`; session storage keeps
  profile/session choices across refreshes. Route pages consume the same state
  instead of owning separate copies.
- **Explainable matching is pure**: `lib/matching.js` scores workshops from
  faculty, programme, year, interests and diagnostic gaps using configurable
  `matchWeights`; the UI also renders the reasons behind each score.
- **Brand assets are derived once**: `scripts/build-brand-assets.mjs` creates
  horizontal/stacked/mark dark and light files under `public/brand`; `QiuLogo`
  chooses variant and tone so headers, loading, login and dark footer surfaces
  do not invent a second logo system.
- **Role-aware operations have a server boundary**: `FACULTY_COORDINATOR` and
  `HEAD_OF_PROGRAMME` are in the Prisma enum, module registry, and admin view.
  Identity/admin/settings writes enforce server-side roles and scopes; the
  remaining analytics and feature-management cards can still be fixture-backed.
- **Governed settings are database-backed**: `lib/settings.js` remains the
  tuple-compatible client seam (`[settings, updateSettings]`), but its source of
  truth is now `GET/PATCH /api/admin/settings`, not localStorage. The hook keeps
  a clearly surfaced fallback state only for loading/error conditions.
- **Settings authorization checks both role and scope**: `SUPER_ADMIN` alone may
  write platform/global settings. Faculty/programme settings require an explicit
  admin role assignment (`CPDC_ADMIN`, `FACULTY_COORDINATOR`, or
  `HEAD_OF_PROGRAMME`) matching the target scope. A scope-looking value without
  the right role does not authorize the write.
- **Integration boundary is explicit**: `lib/integrations/acms-sis.js` is a
  contract-only adapter with `NOT_CONFIGURED` behavior until real provider
  details and credentials exist. No local mode should call live ACMS/SIS.
- **Three responsive tiers, not two** (`PortalShell`): `<768` phone (drawer +
  bottom tab bar), `768–1023` split-screen (persistent 72px icon rail, no
  bottom bar), `>=1024` desktop (256px labelled sidebar). One nav tree renders
  all three, so active state and ordering cannot drift between breakpoints.
  Rail links carry `aria-label`/`title` because the label is hidden there.
  The sticky top bar is offset with **margin** (`md:ml-[72px] lg:ml-64`), not
  padding — full-bleed padding let its translucent background paint over the
  sidebar and hide the QIU mark.
- **Marketing header collapses at `lg`, not `md`**: the horizontal lockup is
  ~6.3:1, so logo + 4 nav links + CTA do not fit below 1024px.
- **Initials avatars** (`components/ui/Avatar.jsx`): colour is hashed from the
  name so a person keeps one colour across dashboard, leaderboard and
  directory. Replaces hotlinked Unsplash portraits of real people that had been
  standing in for QIU students and alumni.
- **Role model is spec-derived** (2026-08-02): `ROLE_MODULE_ACCESS` in
  `lib/modules.js` declares module access **role-first**, exactly as the roles
  specification lists it; each module's `roles` array is derived from it, never
  authored. To change who sees what, edit that one map.
- **11 account roles**, not 12. `EXTERNAL_SUPERVISOR` is deliberately absent
  from both `ROLES` and the Prisma `Role` enum: an off-campus preceptor holds no
  account and acts only through a hashed, single-use, expiring logbook token.
  Making it assignable would grant the standing access the design forbids. It
  exists as a token-scoped actor in `student-profile-visibility.js` only.
- **Two-question authorization**. (1) *May this actor reach this student?* —
  scope, in `lib/auth/permissions.js`. (2) *Which fields do they get?* — layers,
  in `lib/auth/student-profile-visibility.js` (the 7-layer matrix). Keep them
  separate; a new surface must call both, and the projection fails closed.
- **GPS is gated separately from the logbook layer** — it is the most sensitive
  field in the record, so a Registrar reading placement hours for clearance does
  not get coordinates, while the tokenised supervisor does (for their one entry).
- **Capability and scope must come from the same role.** `hasCapability` filters
  granted roles to those holding the capability *before* testing scope;
  previously one role could supply the permission while another supplied the
  reach (a lecturer also enrolled as a student could approve their own FYP).
