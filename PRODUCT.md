# PRODUCT: QIU CPDC Career Portal

Source of truth: docs/SPEC.md (approved by the founder 2026-11-25). This file is the design brief drawn from it.
Assumptions are marked; the founder was not interviewed (company rule: decide from the brief, show, correct).

## Who and where
- Students and staff of Quest International University (Ipoh, Malaysia): on phones between classes and on lab
  and office desktops. Most first visits are on a phone, right after "sign in with your QIU Google account".
- CPDC officers (career centre): at a desk, scanning lists of graduates, exporting for tracer reports.
- Alumni: months or years later, on a phone, from a LinkedIn sign-in; they come back rarely and briefly.

## What success looks like
- A student finishes sign-in, LinkedIn link and onboarding in under two minutes, on a phone, without help.
- An alumnus confirms their job in under thirty seconds.
- A CPDC officer answers "employment rate of the 2025 cohort per faculty" and opens any graduate's LinkedIn in
  two clicks.

## Personality
University-official, calm, trustworthy, quietly modern. A career office, not a startup. (Assumption, from the
founder accepting the old portal's light Apple-style theme.)

## Visual world (incumbent, kept)
Light theme: canvas #f5f5f7, white surfaces, ink #1d1d1f, muted #5c5d66, QIU crimson #b00013 (accessible
shade of the brand red) only for primary actions, the active state and focus. Inter for text, Outfit for
headings. Soft 18px panel corners. The QIU logo assets from the old portal.

## Mode per surface
- Sign-in, onboarding, graduate registration: Operate, at their most quiet. No motion beyond feedback.
- My profile: Operate. The LinkedIn PDF import preview is the product's own moment: a short reveal of what was
  found is allowed.
- Alumni tracker, people, registrations, audit: Operate, dense and scannable, tabular numerals.

## Never
- Emoji or unicode as icons (lucide only). Kicker labels above headings. Same-size icon cards as page structure.
- Anything that looks like LinkedIn's own sign-in page or branding beyond its name on a button.
