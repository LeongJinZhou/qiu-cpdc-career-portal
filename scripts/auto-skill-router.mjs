#!/usr/bin/env node

/**
 * Print the skill pack that should be loaded for a QIU CPDC task.
 *
 * Skills are instruction packs for the coding agent, not application runtime
 * dependencies. This router makes the selection deterministic and reviewable
 * before implementation starts. It intentionally routes relevant packs only;
 * activating unrelated domain skills would add noise and unsafe assumptions.
 */

import fs from "node:fs";
import path from "node:path";

const skillRoot = process.env.CPDC_SKILL_ROOT || "/Users/airdtechnologist/.agents/skills";
const rawArguments = process.argv.slice(2);
const wantsJson = rawArguments.includes("--json");
const wantsAll = rawArguments.includes("--all");
const taskText = rawArguments.filter((argument) => !argument.startsWith("--")).join(" ").trim();

const packs = {
  frontend: {
    label: "Frontend implementation",
    why: "React component structure, mobile-first behavior, performance, and accessible interaction.",
    skills: ["agency-engineering-frontend-developer", "core-frontend-react"],
    match: /react|jsx|tsx|component|frontend|page|button|table|interaction|performance|responsive/i,
  },
  uiUx: {
    label: "UI/UX and design system",
    why: "Role-specific information hierarchy, reusable tokens, responsive layouts, and finish-gate review.",
    skills: [
      "agency-design-ui-designer",
      "agency-design-ux-architect",
      "ui-ux-design-system",
      "ui-ux-ui-styling",
      "agency-design-ui-finish-gate-reviewer",
    ],
    match: /ui|ux|design|usability|dashboard|profile|resume|form|dialog|modal|role|student|alumni|employer|lecturer|cpdc|admin|mobile|theme/i,
  },
  backend: {
    label: "Backend and API contracts",
    why: "Server-side validation, stable error shapes, integration boundaries, and compatibility-safe APIs.",
    skills: ["agency-engineering-api-platform-engineer", "core-backend-api"],
    match: /api|backend|server|route|endpoint|schema|database|prisma|integration|acms|directory|notification/i,
  },
  identity: {
    label: "Identity and authorization",
    why: "Google SSO/session safety, server-side RBAC, role assignment, and auditable identity changes.",
    skills: ["agency-engineering-identity-access-engineer"],
    match: /auth|login|logout|google|sso|identity|session|permission|access|role|admin|gmail|email|student id/i,
  },
  quality: {
    label: "Quality, accessibility, and test automation",
    why: "Evidence-based review, WCAG keyboard/screen-reader checks, API security cases, and deterministic tests.",
    skills: [
      "agency-engineering-code-reviewer",
      "agency-testing-accessibility-auditor",
      "agency-testing-api-tester",
      "agency-testing-test-automation-engineer",
      "core-testing-testing",
    ],
    match: /test|debug|bug|broken|qa|quality|audit|verify|regression|accessib|wcag|security|release|monitor|log/i,
  },
  privacy: {
    label: "Privacy and personal-data governance",
    why: "Resume/profile minimization, retention, auditability, and safe handling of student/employer data.",
    skills: ["agency-data-privacy-officer", "agency-engineering-privacy-engineer"],
    match: /privacy|personal data|pii|retention|delete|export|consent|data subject|sensitive/i,
  },
  firebase: {
    label: "Firebase/GitHub release governance",
    why: "Sensitive-file checks, quality gates, memory updates, and deployment readiness for an explicit release request.",
    skills: ["agency-engineering-firebase-github-deployer"],
    match: /firebase|deploy|hosting|host|publish|github|production release|ship/i,
  },
};

const defaultPackOrder = ["frontend", "uiUx", "backend", "identity", "quality"];
const requestedText = taskText || "default QIU CPDC web-platform implementation";
const selectedPackNames = wantsAll
  ? Object.keys(packs)
  : Object.entries(packs)
      .filter(([, pack]) => pack.match.test(requestedText))
      .map(([name]) => name);

// A normal platform task always gets the core web quality pack, even when the
// request is short (for example, "run now" or "fix it").
const effectivePackNames = wantsAll
  ? selectedPackNames
  : [...new Set([...defaultPackOrder, ...selectedPackNames])];

const resolvedPacks = effectivePackNames.map((name) => {
  const pack = packs[name];
  const skills = pack.skills.map((skillName) => {
    const skillPath = path.join(skillRoot, skillName, "SKILL.md");
    return {
      name: skillName,
      path: skillPath,
      available: fs.existsSync(skillPath),
    };
  });
  return {
    name,
    label: pack.label,
    why: pack.why,
    skills,
  };
});

const missingSkills = resolvedPacks.flatMap((pack) =>
  pack.skills.filter((skill) => !skill.available).map((skill) => skill.name),
);

const result = {
  task: requestedText,
  mode: wantsAll ? "inventory" : "relevance-routed",
  loadOrder: ["frontend", "uiUx", "backend", "identity", "quality", "privacy", "firebase"],
  packs: resolvedPacks,
  missingSkills,
  note:
    "Read every selected SKILL.md completely before editing. Firebase/GitHub release governance is loaded only for an explicit release request; it does not deploy by itself.",
};

if (wantsJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log("QIU CPDC automatic skill routing");
  console.log(`Task: ${requestedText}`);
  console.log(`Mode: ${result.mode}`);
  console.log("");
  for (const pack of resolvedPacks) {
    console.log(`${pack.label}: ${pack.why}`);
    for (const skill of pack.skills) {
      console.log(`  ${skill.available ? "[load]" : "[missing]"} ${skill.name} — ${skill.path}`);
    }
  }
  if (missingSkills.length > 0) {
    console.log(`\nMissing skill files: ${missingSkills.join(", ")}`);
    process.exitCode = 1;
  }
  console.log("\nNext action: read each [load] SKILL.md in the listed order, then implement and verify.");
}
