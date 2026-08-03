# Codex Instructions

Use:

~/AI-Engineering-OS

Before implementation:

1. Understand requirements
2. Create architecture plan
3. Load required skills
4. Review implementation
5. Update project memory

## Automatic skill routing

Before each implementation or debugging pass, run:

```bash
npm run skills:route -- "<the task in one sentence>"
```

Read every selected `SKILL.md` completely before changing files. The default QIU CPDC web pack is frontend, UI/UX/design system, backend/API, identity/authorization, and quality/accessibility/test automation. Privacy governance and Firebase/GitHub release governance are added by matching keywords; Firebase deployment rules are only used for an explicit release request.

The router is relevance-based by design. Installed skills are not runtime plugins, and loading unrelated domains into every task does not make the product better. Record the selected pack and the verification evidence in the handoff. See `docs/SKILL-ROUTING.md` and `docs/SKILLS-INVENTORY.md` for the routing map and installed/used distinction.
