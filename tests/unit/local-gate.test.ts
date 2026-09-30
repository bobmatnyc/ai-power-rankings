/**
 * Coverage for the local gate (scripts/local-gate.mjs): its pure helpers and its CLI arms.
 *
 * Why: The gate posts a commit status under the fleet CI ruling (Actions for release
 * builds only). A wrong owner/repo posts nowhere useful, a wrong state reports a failing
 * head as green, and a gate that silently skips its checks exits 0 with nothing run.
 * What: The helper tests call parseGitHubRemote()/summarizeResults() directly. The CLI
 * tests spawn the script against a throwaway `git init` repo, with stub `gh`, `npx` and
 * `npm` executables and a private `git` symlink as the only PATH entries; each stub
 * appends its argv to a log file, and exit codes come from env vars.
 * Test: Runs under `npm run test:unit`. No network and no real `gh`.
 */

import { spawnSync } from "node:child_process";
import {
  accessSync,
  chmodSync,
  constants,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseGitHubRemote, summarizeResults } from "../../scripts/local-gate.mjs";

const SCRIPT = fileURLToPath(new URL("../../scripts/local-gate.mjs", import.meta.url));

describe("parseGitHubRemote", () => {
  it.each([
    ["git@github.com:bobmatnyc/ai-power-rankings.git", "bobmatnyc/ai-power-rankings"],
    ["https://github.com/bobmatnyc/ai-power-rankings.git", "bobmatnyc/ai-power-rankings"],
    ["https://github.com/bobmatnyc/ai-power-rankings", "bobmatnyc/ai-power-rankings"],
    ["ssh://git@github.com/bobmatnyc/ai-power-rankings.git\n", "bobmatnyc/ai-power-rankings"],
    ["git@gitlab.com:bobmatnyc/ai-power-rankings.git", null],
    ["not a url", null],
  ])("parses %j as %j", (url, expected) => {
    expect(parseGitHubRemote(url)).toBe(expected);
  });
});

describe("summarizeResults", () => {
  it("reports success only when every check passed", () => {
    expect(
      summarizeResults([
        { name: "tsc --noEmit", ok: true },
        { name: "vitest", ok: true },
      ])
    ).toEqual({ state: "success", description: "passed: tsc --noEmit, vitest" });
  });

  it("names each failed check in the description", () => {
    expect(
      summarizeResults([
        { name: "tsc --noEmit", ok: false },
        { name: "vitest", ok: true },
      ])
    ).toEqual({ state: "failure", description: "failed: tsc --noEmit" });
  });
});

// Stubs use shell builtins only: PATH holds nothing but the stub and git directories.
const GH_STUB = `#!/bin/sh
echo "gh $*" >> "$STUB_LOG"
case "$1" in
  --version) exit 0 ;;
  auth) exit "\${GH_AUTH_EXIT:-0}" ;;
  repo) echo "acme/widgets"; exit 0 ;;
  api)
    case "$*" in
      *statuses*) [ "\${GH_POST_EXIT:-0}" = 0 ] || echo "HTTP 500: stub post failure" >&2; exit "\${GH_POST_EXIT:-0}" ;;
      *) exit "\${GH_COMMIT_EXIT:-0}" ;;
    esac ;;
esac
exit 99
`;
const NPX_STUB = `#!/bin/sh
echo "npx $*" >> "$STUB_LOG"
exit "\${TSC_EXIT:-0}"
`;
const NPM_STUB = `#!/bin/sh
echo "npm $*" >> "$STUB_LOG"
exit "\${VITEST_EXIT:-0}"
`;

function findGit(): string {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const candidate = join(dir, "git");
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // not in this PATH entry
    }
  }
  throw new Error("git not found on PATH");
}

// Each case spawns ~10 short processes; ~0.5s on an idle host, but several seconds
// under load, so the default 5s timeout would fail a correct gate.
describe("local-gate CLI", { timeout: 30_000 }, () => {
  let root: string;
  let repo: string;
  let stubBin: string;
  let gitBin: string;
  let log: string;
  let sha: string;

  function baseEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
    return {
      PATH: [stubBin, gitBin].join(delimiter),
      HOME: root,
      GIT_CONFIG_NOSYSTEM: "1",
      STUB_LOG: log,
      ...extra,
    };
  }

  function git(args: string[]): string {
    const res = spawnSync("git", args, { cwd: repo, env: baseEnv(), encoding: "utf8" });
    if (res.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${res.stderr}`);
    return res.stdout.trim();
  }

  function gate(args: string[], env: Record<string, string> = {}, script = SCRIPT) {
    const res = spawnSync(process.execPath, [script, ...args], {
      cwd: repo,
      env: baseEnv(env),
      encoding: "utf8",
    });
    const calls = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean) : [];
    const posts = calls.filter((c) => c.includes("/statuses/"));
    return { code: res.status, out: `${res.stdout}${res.stderr}`, calls, posts };
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "local-gate-"));
    repo = join(root, "repo");
    stubBin = join(root, "stub-bin");
    gitBin = join(root, "git-bin");
    log = join(root, "stub.log");
    for (const dir of [repo, stubBin, gitBin]) mkdirSync(dir);
    symlinkSync(findGit(), join(gitBin, "git"));
    for (const [name, body] of [
      ["gh", GH_STUB],
      ["npx", NPX_STUB],
      ["npm", NPM_STUB],
    ]) {
      writeFileSync(join(stubBin, name), body);
      chmodSync(join(stubBin, name), 0o755);
    }
    git(["init", "-q"]);
    git(["remote", "add", "origin", "git@github.com:acme/widgets.git"]);
    writeFileSync(join(repo, "README.md"), "fixture\n");
    git(["add", "README.md"]);
    git(["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", "commit", "-q", "-m", "init"]);
    sha = git(["rev-parse", "HEAD"]);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("passes, then posts exactly one success status for HEAD", () => {
    const r = gate([]);
    expect(r.code).toBe(0);
    expect(r.calls).toContain("npx tsc --noEmit");
    expect(r.calls).toContain("npm run test:unit");
    expect(r.posts).toHaveLength(1);
    expect(r.posts[0]).toContain(`repos/acme/widgets/statuses/${sha}`);
    expect(r.posts[0]).toContain("state=success");
    expect(r.posts[0]).toContain("context=local-gate");
    expect(r.out).toContain("posted local-gate=success");
  });

  it("exits 1 and posts failure when a check fails", () => {
    const r = gate([], { TSC_EXIT: "2" });
    expect(r.code).toBe(1);
    expect(r.calls).toContain("npm run test:unit");
    expect(r.posts).toHaveLength(1);
    expect(r.posts[0]).toContain("state=failure");
    expect(r.posts[0]).toContain("description=failed: tsc --noEmit");
  });

  it("exits non-zero and never prints 'posted' when the post fails", () => {
    const r = gate([], { GH_POST_EXIT: "1" });
    expect(r.code).toBe(2);
    expect(r.posts).toHaveLength(1);
    expect(r.out).toContain("FAILED to post");
    expect(r.out).not.toContain("posted local-gate");
  });

  it.each([
    ["the tree is dirty", {}, () => writeFileSync(join(repo, "untracked.txt"), "x\n"), "uncommitted or untracked"],
    ["gh is unauthenticated", { GH_AUTH_EXIT: "1" }, () => {}, "not authenticated"],
    ["gh is absent", {}, () => rmSync(join(stubBin, "gh")), "not installed"],
    ["GitHub does not know HEAD", { GH_COMMIT_EXIT: "1" }, () => {}, "push it first"],
  ])("refuses with exit 2 and runs nothing when %s", (_label, env, arrange, message) => {
    arrange();
    const r = gate([], env as Record<string, string>);
    expect(r.code).toBe(2);
    expect(r.out).toContain(message);
    expect(r.out).toContain("no commit status was posted");
    expect(r.posts).toHaveLength(0);
    expect(r.calls.some((c) => c.startsWith("npx") || c.startsWith("npm"))).toBe(false);
  });

  it("runs the checks when invoked through a symlinked path containing a space", () => {
    const linkDir = join(root, "link dir");
    mkdirSync(linkDir);
    const link = join(linkDir, "local gate.mjs");
    symlinkSync(SCRIPT, link);
    const r = gate(["--no-status"], {}, link);
    expect(r.code).toBe(0);
    expect(r.calls).toContain("npx tsc --noEmit");
    expect(r.calls).toContain("npm run test:unit");
    expect(r.posts).toHaveLength(0);
  });
});
