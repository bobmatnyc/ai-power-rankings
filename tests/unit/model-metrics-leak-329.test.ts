/**
 * #329: the metrics loader's error paths leak no figure, and its tracked-file guard fails closed.
 *
 * Why: the loader's output reaches the public Actions log, and JSON.parse's own message quotes
 *   the text near a syntax error, so a malformed file could print a licensed figure. A guard that
 *   treats "git could not run" as "untracked" would let a tracked copy of the figures through.
 * What: a synthetic metrics document with a trailing comma right after the row holding a figure
 *   (V8 then quotes the figure) must throw, and the loader run as a process must print, a
 *   message without that figure. `isTrackedByGit` must
 *   throw on a spawn error or an unexpected exit, and keep exit 1 and 128 (outside a repository,
 *   as the workflow's RUNNER_TEMP file is) as untracked.
 * Test: `npx vitest run tests/unit/model-metrics-leak-329.test.ts`. No database, no network.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseModelMetricsSeed } from "../../lib/db/repositories/model-metrics-seed.repository";
import { isTrackedByGit } from "../../scripts/load-model-metrics";

// Synthetic, not a leaderboard value.
const FIGURE = "47.3";
const TRAILING_COMMA = `{"checked_at":"2026-10-21","metrics":[{"slug":"glm","field":"terminal_bench","value": ${FIGURE}},]}`;

describe("metrics parse errors (#329)", () => {
  it("a JSON syntax error right after a figure throws a message without the figure", () => {
    let message = "";
    try {
      parseModelMetricsSeed(TRAILING_COMMA, new Set(["glm"]));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/^metrics seed: not valid JSON/);
    expect(message).not.toContain(FIGURE);
  });

  it("the loader prints no figure when the metrics file is malformed", () => {
    const dir = mkdtempSync(join(tmpdir(), "metrics-leak-329-"));
    try {
      const file = join(dir, "metrics.json");
      writeFileSync(file, TRAILING_COMMA);
      const res = spawnSync("npx", ["tsx", "scripts/load-model-metrics.ts", "--metrics-file", file, "--hide-values"], {
        encoding: "utf8",
        env: { PATH: process.env["PATH"] ?? "", HOME: process.env["HOME"] ?? "", NODE_ENV: "test" },
        timeout: 60_000,
      });
      const out = `${res.stdout}${res.stderr}`;
      expect(res.status).toBe(1);
      expect(out).toContain("metrics validation failed");
      expect(out).not.toContain(FIGURE);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 90_000);
});

describe("isTrackedByGit fails closed (#329)", () => {
  const fake = (result: { status: number | null; error?: Error }) => () => result;

  it("throws when git cannot be spawned", () => {
    expect(() => isTrackedByGit("metrics.json", fake({ status: null, error: new Error("spawn git ENOENT") }))).toThrow(/refusing to run/);
  });

  it("throws on an unexpected exit status", () => {
    expect(() => isTrackedByGit("metrics.json", fake({ status: 2 }))).toThrow(/refusing to run/);
  });

  it("reads 0 as tracked, and 1 and 128 (outside any repository) as untracked", () => {
    expect(isTrackedByGit("metrics.json", fake({ status: 0 }))).toBe(true);
    expect(isTrackedByGit("metrics.json", fake({ status: 1 }))).toBe(false);
    expect(isTrackedByGit("/runner/temp/model-metrics.json", fake({ status: 128 }))).toBe(false);
  });

  it("with the real git, a file outside the repository is untracked and a committed file is tracked", () => {
    expect(isTrackedByGit(join(tmpdir(), "no-such-metrics-329.json"))).toBe(false);
    expect(isTrackedByGit("package.json")).toBe(true);
  });
});
