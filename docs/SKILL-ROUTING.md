# Automatic Skill Routing

The QIU CPDC platform has many installed skills, but skills are agent instruction packs—not code that can be loaded into the Next.js runtime. A skill counts as **used** only when its `SKILL.md` is read and its workflow is applied to the task.

## How routing works

Run the router with the task description before implementation:

```bash
npm run skills:route -- "improve the student resume and role-specific UI"
npm run skills:route -- "debug Google SSO and audit the admin API"
npm run skills:route -- "prepare Firebase deployment" 
npm run skills:route -- --json "run all tests"
```

Every normal web task receives the core platform pack:

1. Frontend implementation
2. UI/UX and design system
3. Backend/API contracts
4. Identity and authorization
5. Quality, accessibility, and test automation

Keyword matching adds privacy governance or Firebase/GitHub release governance when those concerns are present. Deployment governance is intentionally not activated for ordinary coding or test requests.

## Pack ownership

| Pack | Main responsibility | Typical QIU CPDC work |
| --- | --- | --- |
| Frontend | React, responsive implementation, performance | role dashboards, dedicated detail pages, profiles |
| UI/UX | visual hierarchy, tokens, interaction model, finish gate | student/lecturer/CPDC/employer/admin workflows |
| Backend | contracts, validation, API compatibility | directory integration, notifications, assessment uploads |
| Identity | Google SSO, session, RBAC, audit trail | allowed Gmail, role assignment, student IDs |
| Quality | code review, accessibility, API, deterministic E2E | regression checks and release gates |
| Privacy | minimization and retention | resumes, profile photos, student records |
| Firebase | secret scan, tests, memory, release | explicit deploy/publish requests only |

## Evidence rule

The agent should record the active pack in the task notes or project memory, and the final handoff should distinguish:

- installed/available skills;
- skills actually read and applied;
- tools and commands used;
- deferred skills that were not relevant to the requested change.

This is why the exhaustive list in [`SKILLS-INVENTORY.md`](./SKILLS-INVENTORY.md) is separate from the “used” list. Activating every unrelated skill (for example finance, GIS, or slide generation) would not improve a university career platform and could introduce conflicting assumptions.
