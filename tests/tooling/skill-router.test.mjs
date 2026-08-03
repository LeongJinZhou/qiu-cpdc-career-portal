import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const routerPath = path.join(projectRoot, "scripts/auto-skill-router.mjs");

function route(task) {
  const output = execFileSync(process.execPath, [routerPath, "--json", task], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  return JSON.parse(output);
}

test("automatic routing activates the full default CPDC web quality pack", () => {
  const result = route("make the student role UI easier to use");
  const skills = result.packs.flatMap((pack) => pack.skills.map((skill) => skill.name));

  assert.deepEqual(
    result.packs.map((pack) => pack.name),
    ["frontend", "uiUx", "backend", "identity", "quality"],
  );
  assert.ok(skills.includes("agency-design-ui-designer"));
  assert.ok(skills.includes("agency-design-ux-architect"));
  assert.ok(skills.includes("agency-testing-accessibility-auditor"));
  assert.ok(skills.includes("agency-engineering-identity-access-engineer"));
  assert.deepEqual(result.missingSkills, []);
});

test("release governance is opt-in for Firebase deployment requests", () => {
  const normal = route("fix the employer profile card");
  const release = route("prepare Firebase deployment");
  const normalSkills = normal.packs.flatMap((pack) => pack.skills.map((skill) => skill.name));
  const releaseSkills = release.packs.flatMap((pack) => pack.skills.map((skill) => skill.name));

  assert.equal(normalSkills.includes("agency-engineering-firebase-github-deployer"), false);
  assert.equal(releaseSkills.includes("agency-engineering-firebase-github-deployer"), true);
  assert.equal(release.missingSkills.includes("agency-engineering-firebase-github-deployer"), false);
});
