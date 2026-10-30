import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * #101 — the v7.9 vs v7.10 compare script fails closed and names its clock.
 *
 * Why: the workflow publishes stdout to the job summary on exit 0, and the
 *   owner clears the v7.10 release from that table. An empty table or a
 *   silently rolled-over date must not reach the summary as a pass.
 * What: runs `scripts/compare-ranking-versions.ts --fixtures=…` with tsx and
 *   checks the exit status and stdout for an empty source, an impossible
 *   `--date`, and a normal run. No database; DATABASE_URL is unset.
 * Test: `npx vitest run tests/unit/compare-ranking-versions-script-101.test.ts`
 */

// Tests spawn child processes or shell scripts, which can pass 5000 ms on a loaded machine.
vi.setConfig({ testTimeout: 60_000 });

const projectRoot = join(__dirname, "..", "..");
const tsx = join(projectRoot, "node_modules", ".bin", "tsx");
const script = join(projectRoot, "scripts", "compare-ranking-versions.ts");
const FIXTURE = join(projectRoot, "tests", "fixtures", "ranking-compare-101.json");
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== "DATABASE_URL"));

function compare(...args: string[]) {
  const res = spawnSync(tsx, [script, ...args], { cwd: projectRoot, encoding: "utf8", env });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

let dir: string;
let emptyFixture: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "compare-ranking-101-"));
  emptyFixture = join(dir, "empty.json");
  writeFileSync(emptyFixture, "[]");
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("compare-ranking-versions script (#101)", () => {
  it("exits non-zero with no table when the source returns zero tools", () => {
    const run = compare(`--fixtures=${emptyFixture}`, "--date=2026-10-01");
    expect(run.status).not.toBe(0);
    expect(run.stdout).toBe("");
    expect(run.stderr).toMatch(/compare-ranking-versions: failed: .*0 tools/);
  });

  it("exits non-zero on an impossible --date instead of rolling it over", () => {
    const run = compare(`--fixtures=${FIXTURE}`, "--date=2026-02-30");
    expect(run.status).not.toBe(0);
    expect(run.stdout).toBe("");
    expect(run.stderr).toMatch(/invalid --date: 2026-02-30/);
  });

  it("prints the scoring date and tool count on stdout above the table", () => {
    const run = compare(`--fixtures=${FIXTURE}`, "--date=2026-10-01");
    expect(run.status).toBe(0);
    const lines = run.stdout.split("\n");
    expect(lines[0]).toMatch(/^Scoring date 2026-10-01 \(UTC\), \d+ tools\.$/);
    expect(lines[1]).toMatch(/^\| Tool \| Old rank/);
  }, 30_000);
});
