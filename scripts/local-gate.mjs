#!/usr/bin/env node
/**
 * Local PR/push gate: typecheck + unit tests, reported as a GitHub commit status.
 *
 * Why: Under the fleet CI ruling (Actions for release builds only), ci.yml runs only
 *   for `v*` tags and manual dispatch. PR and push checks run here, on the developer's
 *   host, and post one informational `local-gate` commit status so a PR still shows
 *   whether its head passed. Nothing makes that status required.
 * What: Runs `npx tsc --noEmit`, `npm run test:unit`, `npm run build:next` and a gitleaks
 *   secret scan (all always run, so the report shows every result). By default it then posts ONE status for HEAD via
 *   `gh api repos/{owner}/{repo}/statuses/<sha>`. Before running anything it refuses
 *   (exit 2) when the tree is dirty, `gh` is missing or unauthenticated, owner/repo
 *   cannot be resolved, or GitHub does not know the HEAD commit (not pushed). It
 *   re-checks HEAD and the tree after the checks, and prints a "posted" line only after
 *   `gh` confirms the post. `--no-status` (or LOCAL_GATE_NO_STATUS=1) runs the checks
 *   only, with no post and no clean/pushed requirement.
 *   Exit codes: 0 all checks passed (and, unless --no-status, the status posted);
 *   1 a check failed; 2 the status was refused or its post failed.
 *   The gitleaks check (#460) needs gitleaks GITLEAKS_VERSION on PATH and fails without it.
 *   It scans the files git sees (tracked plus untracked, not ignored) and the commits in
 *   merge-base(origin/main, HEAD)..HEAD, never full history. Output is redacted.
 * Test: `npx vitest run tests/unit/local-gate.test.ts` covers the pure helpers and,
 *   with stub `gh`/`npx`/`npm`/`gitleaks` over a temp repo, every CLI arm: pass and post,
 *   failing check, failing post, each refusal, invocation through a symlinked path, and
 *   gitleaks missing, at the wrong version, reporting a finding, and clean.
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const STATUS_CONTEXT = "local-gate";

// GitHub rejects commit-status descriptions longer than 140 characters.
const MAX_DESCRIPTION = 140;

export const CHECKS = [
  { name: "tsc --noEmit", cmd: "npx", args: ["tsc", "--noEmit"] },
  { name: "vitest", cmd: "npm", args: ["run", "test:unit"] },
  // #293: `tsc --noEmit` does not check Next's route-export types (e.g. `GET(request?: Request)`),
  // so only `next build` catches them before Vercel does. `build:next` is `next build` alone;
  // `npm run build` would also rewrite the tracked changelog and category generator outputs.
  { name: "next build", cmd: "npm", args: ["run", "build:next"] },
  // #460: the secret scan runs here, not in Actions (fleet CI ruling: Actions for release builds only).
  { name: "gitleaks", run: () => runGitleaks() },
];

// #460: the one place the gitleaks version is pinned.
export const GITLEAKS_VERSION = "8.30.1";
const GITLEAKS_INSTALL = `install gitleaks ${GITLEAKS_VERSION} with \`brew install gitleaks\` (then check \`gitleaks version\`) or from https://github.com/gitleaks/gitleaks/releases/tag/v${GITLEAKS_VERSION}`;
const GITLEAKS_BASE_REF = "origin/main";

/**
 * Checks a `gitleaks version` spawn result against GITLEAKS_VERSION.
 * Returns null when it matches, else a message naming the problem and how to install.
 */
export function gitleaksVersionProblem(res) {
  if (res.error || res.status === null) {
    return `gitleaks is not installed or not on PATH; ${GITLEAKS_INSTALL}.`;
  }
  const found = (res.stdout ?? "").trim().replace(/^v/, "");
  if (res.status !== 0 || found !== GITLEAKS_VERSION) {
    return `gitleaks ${found || "(unknown version)"} found, ${GITLEAKS_VERSION} required; ${GITLEAKS_INSTALL}.`;
  }
  return null;
}

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

// #460: copies the files git would commit (tracked + untracked, not ignored) into `dir`.
// `gitleaks dir .` on the checkout itself also reads node_modules/.next/tmp, GBs in a dev tree.
// Fails closed: throws on any error but ENOENT (a file deleted since the listing), and on an
// empty listing or zero files copied, so the scan never passes on an empty directory.
function snapshotTree(root, dir) {
  // #460: read the -z listing raw; git()'s trim() would cut a leading space off the first path.
  const res = run("git", ["-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"]);
  if (res.error || res.status !== 0) throw new Error("`git ls-files` failed; cannot list the working-tree files.");
  const files = res.stdout.split("\0").filter((rel) => rel !== "");
  if (files.length === 0) throw new Error("`git ls-files` listed no files to scan.");
  let copied = 0;
  for (const rel of files) {
    const src = join(root, rel);
    try {
      if (!lstatSync(src).isFile()) continue; // symlinks and submodules; gitleaks dir skips symlinks too
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      copyFileSync(src, join(dir, rel));
      copied += 1;
    } catch (error) {
      if (error?.code === "ENOENT" && !existsSync(src)) continue; // deleted since the listing
      throw new Error(`could not copy ${JSON.stringify(rel)} for the scan: ${error?.code ?? error}`);
    }
  }
  if (copied === 0) throw new Error("no working-tree files were copied for the scan.");
}

// #460: scans the working tree, then this branch's commits; any finding fails the check.
// Spawned with argv arrays (no shell) and always with --redact, so no secret is printed.
function runGitleaks() {
  const problem = gitleaksVersionProblem(run("gitleaks", ["version"]));
  if (problem) {
    console.error(`local-gate: gitleaks — ${problem}`);
    return false;
  }
  const root = git(["rev-parse", "--show-toplevel"]);
  if (!root) {
    console.error("local-gate: gitleaks — could not resolve the repository root.");
    return false;
  }
  const flags = ["--config", join(root, ".gitleaks.toml"), "--redact", "--no-banner"];

  // #460: the snapshot is built inside try/finally, so the temp dir is removed on every path
  // and a snapshot error fails the step instead of crashing the gate.
  let treeOk;
  let snapshot;
  try {
    snapshot = mkdtempSync(join(tmpdir(), "local-gate-gitleaks-"));
    snapshotTree(root, snapshot);
    console.log("local-gate: gitleaks — scanning the working tree (tracked + untracked, not ignored)");
    treeOk = run("gitleaks", ["dir", ".", ...flags], { cwd: snapshot, stdio: "inherit" }).status === 0;
  } catch (error) {
    console.error(`local-gate: gitleaks — working-tree snapshot failed: ${error?.message ?? error}`);
    return false;
  } finally {
    if (snapshot) rmSync(snapshot, { recursive: true, force: true });
  }

  const base = git(["merge-base", GITLEAKS_BASE_REF, "HEAD"]);
  if (!base) {
    console.error(`local-gate: gitleaks — no merge-base with ${GITLEAKS_BASE_REF}; run \`git fetch origin\`.`);
    return false;
  }
  const range = `${base}..HEAD`;
  if (git(["rev-list", "--count", range]) === "0") {
    console.log(`local-gate: gitleaks — no commits in ${base.slice(0, 12)}..HEAD; commit scan skipped.`);
    return treeOk;
  }
  console.log(`local-gate: gitleaks — scanning commits ${base.slice(0, 12)}..HEAD`);
  const commits = run("gitleaks", ["git", ".", ...flags, `--log-opts=${range}`], {
    cwd: root,
    stdio: "inherit",
  });
  return treeOk && commits.status === 0;
}

function runChecks() {
  return CHECKS.map(({ name, cmd, args, run: runCheck }) => {
    console.log(`\nlocal-gate: running ${name} ...`);
    const ok = runCheck
      ? runCheck()
      : run(cmd, args, { stdio: "inherit", shell: process.platform === "win32" }).status === 0;
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
