# Project Information

Name: QIU CPDC Platform (repo: cpdc-platform) — "QIU Career Hub"

Purpose: Single Apple-style portal for Quest International University career
development — workshops, skills diagnostics, auto-CV, FYP showcase, Coursera
learning, alumni network, employer marketplace, faculty fieldwork logbooks with
passwordless external-supervisor sign-off, and CPDC/superadmin tracking.
Built against a 16-module blueprint (see the requirements brief).

Tech Stack: Next.js 15 (App Router) · React 19 · Tailwind v4 (@theme tokens) ·
Prisma 6 + PostgreSQL · lucide-react · jspdf/html2canvas (CV PDF export) ·
canvas-confetti. Fonts: Inter (body) + Outfit (headings).

UI system: "Apple Elegance" LIGHT theme — canvas #f5f5f7, white surfaces, ink
#1d1d1f, QIU crimson #e50914 used only as a restrained accent (primary buttons +
active state). Design tokens live in app/globals.css @theme + :root. This
replaced the earlier dark charcoal + crimson "Netflix" theme (2026-08-01).

Status: Prototype. UI-complete across all modules and now on the light system.
Logbook + supervisor magic-link is the only fully DB-backed flow; most other
modules render from fixtures in lib/data/facultyData.js with in-memory state.
Real work added 2026-08-01: Skills Diagnostic Tests module (Module 8) and the
dashboard "Next Best Action" card (Module 2).

Completion pass 2026-08-01: wired route-level modules for Career Path, Talent
Feed, Help, Settings, and Loading; added role-aware CPDC/FACULTY_COORDINATOR
admin views, profile editing, employer job-description ranking, FYP approval
status, explainable workshop matching, diagnostic radar feedback, CV inline
recheck/version controls, and supplied QIU brand lockups (horizontal, stacked,
light and dark generated assets). Demo state persists through PortalProvider's
session storage seam; this is still not production authentication or database
persistence for the client modules.

Run: `npm run dev` (port 3000). DB: `npm run db:push` then `npm run db:seed`.
Requires DATABASE_URL + MAGIC_LINK_SECRET in .env.
