/**
 * Point-in-time off/on compare (#95, PR A).
 *
 * Why: the owner clears the live point-in-time switch on this compare's numbers, so
 *   the diff must be right, the run must write nothing, an unapplied read-only mode
 *   must abort it, and the public summary must name no tool.
 * What: `diffListBoards()` on hand-built boards; `executeCompare()` over the checked-in
 *   fixture (expected moves, fallback, skipped leaves, coverage, no tool identity in the
 *   summary or default JSON); an empty history (every tool falls back, no rank moves);
 *   a spy port (no write method called); and the error arm (a driver whose transaction
 *   is not read-only: exit 1, no file).
 * Test: `npx vitest run tests/unit/point-in-time-compare-95.test.ts`. No database.
 */

import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { diffListBoards, comparePeriod } from "../../lib/rankings/point-in-time-compare";
import {
  createReadOnlyComparePersistence,
  type ReadOnlyTransactionDriver,
  verifiedReadOnlyRunner,
} from "../../lib/rankings/point-in-time-compare-source";
import { resolvePublishScoring } from "../../lib/rankings/publish-active";
import { loadCheckedInScoringProfiles } from "../../lib/scoring-profiles";
import type { RankingEntry } from "../../lib/services/ranking-generation.service";
import { type CompareFixture, executeCompare, fixtureDriver } from "../../scripts/compare-point-in-time";

vi.mock("@/lib/cache/invalidation.service", () => ({ invalidateRankingsCache: vi.fn() }));

const FIXTURE_PATH = "tests/fixtures/point-in-time-compare-95.json";
const FIXTURE = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as CompareFixture;
const SCORING = resolvePublishScoring(loadCheckedInScoringProfiles());
const NOW = new Date("2026-11-02T00:00:00Z");

function entry(id: string, rank: number, score: number): RankingEntry {
  return {
    tool_id: id,
    tool_name: id,
    tool_slug: id,
    rank,
    score,
    tier: "A",
    factor_scores: {},
    category: "c",
    status: "active",
    movement: { previous_position: null, change: 0, direction: "same" },
  };
}

describe("diffListBoards (#95)", () => {
  it("identical boards: every move and change count is zero", () => {
    const board = [entry("a", 1, 90), entry("b", 2, 80)];
    const { diff } = diffListBoards("harness", board, board);
    expect(diff).toMatchObject({ compared: 2, moved: 0, maxAbsRankDelta: 0, medianAbsRankDelta: 0, scoreChanged: 0 });
    expect(diff.top10).toEqual({ overlap: 2, entered: 0, left: 0, positionChanges: 0 });
  });

  it("counts rank moves, score moves, and top-10 entries and exits", () => {
    const off = Array.from({ length: 11 }, (_, i) => entry(`t${i + 1}`, i + 1, 100 - i));
    // t11 jumps from 11th to 1st (+10 points); everyone else drops one place, score unchanged.
    const on = [entry("t11", 1, 100.5), ...off.slice(0, 10).map((r) => entry(r.tool_id, r.rank + 1, r.score))];
    const { diff, tools } = diffListBoards("harness", off, on);

    expect(diff).toMatchObject({
      compared: 11,
      onlyOff: 0,
      onlyOn: 0,
      moved: 11,
      maxAbsRankDelta: 10,
      medianAbsRankDelta: 1,
      scoreChanged: 1,
      scoreOverThreshold: 1,
      maxAbsScoreDelta: 10.5,
    });
    expect(diff.top10).toEqual({ overlap: 9, entered: 1, left: 1, positionChanges: 10 });
    expect(tools[0]).toEqual({ slug: "t11", rankOff: 11, rankOn: 1, scoreOff: 90, scoreOn: 100.5 });
  });

  it("a tool on one board only is counted, not compared", () => {
    const { diff, tools } = diffListBoards("model", [entry("a", 1, 50), entry("b", 2, 40)], [entry("a", 1, 50), entry("c", 2, 30)]);
    expect(diff).toMatchObject({ compared: 1, onlyOff: 1, onlyOn: 1, moved: 0 });
    expect(tools.map((t) => t.slug).sort()).toEqual(["a", "b", "c"]);
  });
});

async function runFixture(argv: string[], fixture: CompareFixture = FIXTURE) {
  const writeFile = vi.fn<(path: string, content: string) => void>();
  const result = await executeCompare({
    argv: ["--period=2026-11", "--date=2026-11-02", "--fixtures=f.json", ...argv],
    now: NOW,
    connectionString: undefined,
    readFile: () => JSON.stringify(fixture),
    writeFile,
    resolveScoring: async () => SCORING,
  });
  return { ...result, writeFile };
}

const IDENTITIES = FIXTURE.tools.flatMap((t) => [String(t["id"]), String(t["name"]), String(t["slug"])]);

describe("executeCompare over the fixture (#95)", () => {
  it("reports the history-driven moves, fallback, skipped leaves and coverage", async () => {
    const { exitCode, stderr, writeFile } = await runFixture(["--out=o.json"]);
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(writeFile).toHaveBeenCalledTimes(1);
    const [path, content] = writeFile.mock.calls[0]!;
    expect(path).toBe("o.json");
    const report = JSON.parse(content);
    const [p] = report.periods;

    expect(p.freshness).toEqual({ status: "fresh", latestCollectedDate: "2026-11-01", reason: null });
    // dune (harness) and november-model have no history; bravo's flagged leaf is skipped.
    expect(p.pointInTime).toEqual({ applied: true, snapshotTools: 6, fallbackTools: 2, skippedLeaves: 1 });
    expect(p.ledger.parts.npm).toEqual({ attempted: 9, recorded: 3, flagged: 1, not_found: 6, failed: 0, skipped_timeout: 0 });
    const byList = Object.fromEntries(p.lists.map((l: { list: string }) => [l.list, l]));
    // Harness: charlie rises from 4th to 1st, alpha drops; productivity: oscar and papa swap.
    expect(byList.harness).toMatchObject({ toolsOn: 4, moved: 4, maxAbsRankDelta: 3, scoreChanged: 2, fallbackTools: 1 });
    expect(byList.harness.historyCoverage).toEqual({ github: 0, pypi: 0, npm: 1, vscode: 2 });
    expect(byList.model).toMatchObject({ toolsOn: 2, moved: 0, scoreChanged: 0, fallbackTools: 1 });
    expect(byList.productivity).toMatchObject({ toolsOn: 2, moved: 2, maxAbsRankDelta: 1, fallbackTools: 0 });
    expect(report.tools).toBeUndefined();
  });

  it("the summary and the default JSON name no tool", async () => {
    const { stdout, writeFile } = await runFixture([]);
    const json = writeFile.mock.calls[0]![1];
    expect(stdout).toContain("| harness | 4/4 | 4 | 3 |");
    for (const identity of IDENTITIES) {
      expect(stdout).not.toContain(identity);
      expect(json).not.toContain(identity);
    }
  });

  it("--per-tool adds each tool's off/on rank to the JSON only", async () => {
    const { stdout, writeFile } = await runFixture(["--per-tool"]);
    const report = JSON.parse(writeFile.mock.calls[0]![1]);
    expect(report.tools["2026-11"].harness[0]).toMatchObject({ slug: "charlie", rankOff: 4, rankOn: 1 });
    expect(stdout).not.toContain("charlie");
  });

  it("an empty history: every tool falls back and no rank moves", async () => {
    const { writeFile, exitCode } = await runFixture([], { ...FIXTURE, history: [], ledger: [] });
    expect(exitCode).toBe(0);
    const [p] = JSON.parse(writeFile.mock.calls[0]![1]).periods;
    expect(p.pointInTime).toEqual({ applied: true, snapshotTools: 0, fallbackTools: 8, skippedLeaves: 0 });
    expect(p.freshness.status).toBe("stale");
    for (const list of p.lists) expect(list).toMatchObject({ moved: 0, scoreChanged: 0, maxAbsRankDelta: 0 });
  });

  it("rejects a malformed period before any read", async () => {
    const readFile = vi.fn();
    const result = await executeCompare({ argv: ["--period=2026-13"], now: NOW, connectionString: "x", readFile });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--period must be YYYY-MM");
    expect(readFile).not.toHaveBeenCalled();
  });
});

describe("the compare writes nothing (#95)", () => {
  it("no write method of the port is called on either run", async () => {
    const port = createReadOnlyComparePersistence(verifiedReadOnlyRunner(fixtureDriver(FIXTURE)));
    const spies = [vi.spyOn(port, "saveSnapshot"), vi.spyOn(port, "saveListSnapshots"), vi.spyOn(port, "saveDraft")];
    await comparePeriod({ persistence: port, period: "2026-11", now: NOW, scoring: SCORING });
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe("read-only mode not applied (#95 error arm)", () => {
  it("aborts with exit 1 and writes no file", async () => {
    // A database driver whose transaction answers transaction_read_only = off.
    const driver: ReadOnlyTransactionDriver = async (statements) =>
      statements.map((_, i) => (i === 0 ? [{ read_only: "off" }] : [{ id: "leak", name: "Leak", slug: "leak", status: "active" }]));
    const writeFile = vi.fn();
    const result = await executeCompare({
      argv: ["--period=2026-11"],
      now: NOW,
      connectionString: "postgres://user:secret@host/db",
      connect: () => driver,
      writeFile,
      resolveScoring: async () => SCORING,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("Result: ERROR\n");
    expect(result.stderr).toContain("read-only mode did not apply");
    expect(result.stderr).not.toContain("secret");
    expect(writeFile).not.toHaveBeenCalled();
  });
});

// #95: the workflow prints the step summary to the step log too (the job summary needs a browser login).
describe("compare workflow step log (#95)", () => {
  const WORKFLOW = readFileSync(".github/workflows/compare-point-in-time.yml", "utf8");

  /** The `run:` script of the "Compare (read-only)" step. */
  function compareScript(): string {
    const after = WORKFLOW.slice(WORKFLOW.indexOf("- name: Compare (read-only)"));
    const body = after.slice(after.indexOf("run: |\n") + "run: |\n".length);
    return body
      .split("\n")
      .map((line) => line.replace(/^ {10}/, ""))
      .join("\n");
  }

  it("prints text identical to the step summary, with no tool identity or env value", async () => {
    const { stdout, writeFile } = await runFixture(["--out=o.json"]);
    const dir = mkdtempSync(join(tmpdir(), "pit-log-95-"));
    try {
      // A stub `npx` replaces `tsx scripts/compare-point-in-time.ts`: it emits the real
      // script's stdout and writes its real JSON report to the --out path.
      writeFileSync(join(dir, "stdout.md"), stdout);
      writeFileSync(join(dir, "report.json"), writeFile.mock.calls[0]![1]);
      writeFileSync(
        join(dir, "npx"),
        '#!/bin/bash\nfor a in "$@"; do case "$a" in --out=*) cp "$STUB_DIR/report.json" "${a#--out=}";; esac; done\ncat "$STUB_DIR/stdout.md"\n'
      );
      chmodSync(join(dir, "npx"), 0o755);
      writeFileSync(join(dir, "run.sh"), compareScript());
      const summaryFile = join(dir, "step-summary.md");
      writeFileSync(summaryFile, "");
      const res = spawnSync("bash", [join(dir, "run.sh")], {
        cwd: dir,
        encoding: "utf8",
        env: {
          PATH: `${dir}:${process.env["PATH"]}`,
          STUB_DIR: dir,
          GITHUB_STEP_SUMMARY: summaryFile,
          DATABASE_URL: "postgres://user:s3cret-95@host/db",
          PERIODS: "2026-11",
          SCORING_DATE: "2026-11-02",
        },
      });
      const summary = readFileSync(summaryFile, "utf8");
      expect(res.status).toBe(0);
      expect(summary).toContain("## Point-in-time metrics off vs on");
      expect(res.stdout).toBe(summary);
      for (const identity of IDENTITIES) expect(res.stdout).not.toContain(identity);
      expect(res.stdout).not.toContain("s3cret-95");
      expect(res.stdout).not.toContain("postgres://");
      expect(compareScript()).not.toContain("--per-tool");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
