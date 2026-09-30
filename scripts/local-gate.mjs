#!/usr/bin/env node
/**
 * Local PR/push gate: typecheck + unit tests, reported as a GitHub commit status.
 *
 * Why: Under the fleet CI ruling (Actions for release builds only), ci.yml runs only
 *   for `v*` tags and manual dispatch. PR and push checks run here, on the developer's
 *   host, and post one informational `local-gate` commit status so a PR still shows
 *   whether its head passed. Nothing makes that status required.
 * What: Runs `npx tsc --noEmit` and `npm run test:unit` (both always run, so the report
 *   shows both results). By default it then posts ONE status for HEAD via
 *   `gh api repos/{owner}/{repo}/statuses/<sha>`. Before running anything it refuses
 *   (exit 2) when the tree is dirty, `gh` is missing or unauthenticated, owner/repo
 *   cannot be resolved, or GitHub does not know the HEAD commit (not pushed). It
 *   re-checks HEAD and the tree after the checks, and prints a "posted" line only after
 *   `gh` confirms the post. `--no-status` (or LOCAL_GATE_NO_STATUS=1) runs the checks
 *   only, with no post and no clean/pushed requirement.
 *   Exit codes: 0 all checks passed (and, unless --no-status, the status posted);
 *   1 a check failed; 2 the status was refused or its post failed.
 * Test: `npx vitest run tests/unit/local-gate.test.ts` covers the pure helpers and,
 *   with stub `gh`/`npx`/`npm` over a temp repo, every CLI arm: pass and post, failing
 *   check, failing post, each refusal, and invocation through a symlinked path.
 */

import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const STATUS_CONTEXT = "local-gate";

// GitHub rejects commit-status descriptions longer than 140 characters.
const MAX_DESCRIPTION = 140;

export const CHECKS = [
  { name: "tsc --noEmit", cmd: "npx", args: ["tsc", "--noEmit"] },
  { name: "vitest", cmd: "npm", args: ["run", "test:unit"] },
];

/**
 * Extracts `owner/repo` from a GitHub remote URL (ssh, scp-style, or https).
 * Returns null for anything that is not a github.com remote.
 */
export function parseGitHubRemote(url) {
  const match = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(url.trim());
  return match ? `${match[1]}/${match[2]}` : null;
}

/**
 * Maps check results to the commit status payload.
 * `results` is `[{ name, ok }]`; state is `success` only when every check passed.
 */
export function summarizeResults(results) {
  const failed = results.filter((r) => !r.ok).map((r) => r.name);
  const state = failed.length === 0 ? "success" : "failure";
  const description =
    failed.length === 0
      ? `passed: ${results.map((r) => r.name).join(", ")}`
      : `failed: ${failed.join(", ")}`;
  return { state, description: description.slice(0, MAX_DESCRIPTION) };
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", ...opts });
}

function git(args) {
  const res = run("git", args);
  return res.status === 0 ? res.stdout.trim() : null;
}

function refuse(message) {
  console.error(`local-gate: REFUSED — ${message}`);
  console.error("local-gate: no commit status was posted.");
  console.error("local-gate: run `npm run gate:local -- --no-status` to run the checks only.");
  process.exit(2);
}

function isDirty() {
  const porcelain = git(["status", "--porcelain"]);
  return porcelain === null || porcelain.length > 0;
}

// Resolves owner/repo from the origin remote, falling back to `gh repo view`.
function resolveRepo() {
  const url = git(["remote", "get-url", "origin"]);
  const fromRemote = url ? parseGitHubRemote(url) : null;
  if (fromRemote) return fromRemote;
  const view = run("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
  return view.status === 0 && view.stdout.trim() ? view.stdout.trim() : null;
}

// Every precondition for posting, checked before the (slow) checks run.
function preflight() {
  const sha = git(["rev-parse", "HEAD"]);
  if (!sha) refuse("could not read the HEAD commit.");
  if (isDirty()) {
    refuse("the working tree has uncommitted or untracked changes, so the results would not describe HEAD.");
  }
  const ghVersion = run("gh", ["--version"]);
  if (ghVersion.error || ghVersion.status !== 0) refuse("the `gh` CLI is not installed or not on PATH.");
  if (run("gh", ["auth", "status"]).status !== 0) {
    refuse("`gh` is not authenticated (run `gh auth login`).");
  }
  const repo = resolveRepo();
  if (!repo) refuse("could not resolve owner/repo from the origin remote or `gh repo view`.");
  const known = run("gh", ["api", `repos/${repo}/commits/${sha}`, "--silent"]);
  if (known.status !== 0) {
    refuse(`GitHub does not know commit ${sha.slice(0, 12)} in ${repo}; push it first.`);
  }
  return { sha, repo };
}

function runChecks() {
  return CHECKS.map(({ name, cmd, args }) => {
    console.log(`\nlocal-gate: running ${name} ...`);
    const res = run(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
    const ok = res.status === 0;
    console.log(`local-gate: ${name} — ${ok ? "PASS" : "FAIL"}`);
    return { name, ok };
  });
}

function postStatus({ sha, repo }, { state, description }) {
  const res = run("gh", [
    "api",
    "--method",
    "POST",
    `repos/${repo}/statuses/${sha}`,
    "-f",
    `state=${state}`,
    "-f",
    `context=${STATUS_CONTEXT}`,
    "-f",
    `description=${description}`,
    "--silent",
  ]);
  if (res.status !== 0) {
    console.error(`local-gate: FAILED to post the ${STATUS_CONTEXT} status: ${res.stderr.trim()}`);
    return false;
  }
  console.log(`local-gate: posted ${STATUS_CONTEXT}=${state} to ${repo}@${sha.slice(0, 12)}`);
  return true;
}

function main() {
  const noStatus = process.argv.includes("--no-status") || process.env.LOCAL_GATE_NO_STATUS === "1";
  const target = noStatus ? null : preflight();

  const results = runChecks();
  const summary = summarizeResults(results);
  const checksExit = summary.state === "success" ? 0 : 1;

  console.log("\nlocal-gate: results");
  for (const r of results) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}`);

  if (noStatus) {
    console.log("local-gate: --no-status given; no commit status posted.");
    process.exit(checksExit);
  }

  // The checks take minutes; a commit or edit made meanwhile would make the status lie.
  if (git(["rev-parse", "HEAD"]) !== target.sha || isDirty()) {
    console.error("local-gate: REFUSED — HEAD moved or the tree changed while the checks ran.");
    console.error("local-gate: no commit status was posted.");
    process.exit(checksExit || 2);
  }

  const posted = postStatus(target, summary);
  process.exit(checksExit || (posted ? 0 : 2));
}

// Only run when invoked directly, not when imported by tests. Node builds import.meta.url
// from the entry file's realpath, percent-encoded, so compare real filesystem paths: a
// string compare against argv[1] is false through a symlink or for a path with a space,
// and the gate would exit 0 without running any check.
function isEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}
if (isEntryPoint()) main();
