/**
 * #95 slice 2: the unattended metrics-history gap check.
 *
 * Why: the check runs monthly with nobody watching, in a public log. It must
 *   check the right month, fail on a dead collector even when the ledger says
 *   ok, fail on a database error instead of passing, only WARN on coverage and
 *   flat values, and never print a tool or a metric value.
 * What: drives `resolveCheckDate`, `renderMetricsHistoryReport` and the
 *   script's `executeCheck` with a fake read-only runner (no database).
 * Test: `npx vitest run tests/unit/metrics-check-report-95.test.ts`
 */

import { describe, expect, it } from "vitest";
import { GITHUB_URL_PATHS } from "../../lib/metrics-collectors/github";
import { HF_METRICS_KEY } from "../../lib/metrics-collectors/huggingface";
import { COLLECTOR_PARTS, SHARD_COUNTS } from "../../lib/metrics-collectors/registry";
import {
  CHECKED_PARTS,
  COVERAGE_FLOOR,
  type LedgerRow,
  parseCoverageFloors,
  type ReportInput,
  renderMetricsHistoryReport,
  resolveCheckDate,
} from "../../lib/metrics-history/check-report";
import { assertSelectOnly } from "../../lib/ranking-snapshot-diff";
import { executeCheck, QUERIES, type RunReadOnly, type Statement } from "../../scripts/check-metrics-history";

const ok = (collector: string, shard: number): LedgerRow => ({
  collector,
  shard,
  shard_count: SHARD_COUNTS[collector as keyof typeof SHARD_COUNTS],
  status: "ok",
  attempted: 10,
  recorded: 4,
  flagged: 0,
  not_found: 6,
  failed: 0,
  skipped_timeout: 0,
});
const allOk = COLLECTOR_PARTS.flatMap((part) => [...Array(SHARD_COUNTS[part]).keys()].map((s) => ok(part, s)));

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  date: "2026-11-01",
  rowsPerDate: [{ collected_date: "2026-11-01", rows: 40 }],
  ledger: allOk,
  coverage: { tools: 50, rows: 40 },
  previousDate: null,
  flat: [],
  partCoverage: [],
  ...over,
});

describe("#95 resolveCheckDate", () => {
  it.each([
    ["2026-11-01T06:00:00Z", "2026-11-01"],
    ["2026-11-02T00:30:00Z", "2026-11-01"],
    ["2026-11-02T06:00:00Z", "2026-11-01"],
    ["2026-11-30T23:59:00Z", "2026-11-01"],
    ["2026-12-01T06:00:00Z", "2026-12-01"],
  ])("--scheduled at %s checks %s", (now, expected) => {
    expect(resolveCheckDate(["node", "script", "--scheduled"], new Date(now))).toBe(expected);
  });

  it("keeps --date, the today default, and rejects a bad --date or both flags", () => {
    const now = new Date("2026-11-02T06:00:00Z");
    expect(resolveCheckDate(["--date=2026-10-01"], now)).toBe("2026-10-01");
    expect(resolveCheckDate([], now)).toBe("2026-11-02");
    expect(() => resolveCheckDate(["--date=2026-1-1"], now)).toThrow("--date must be YYYY-MM-DD");
    expect(() => resolveCheckDate(["--scheduled", "--date=2026-10-01"], now)).toThrow("not both");
  });
});

describe("#95 renderMetricsHistoryReport checks", () => {
  it("fails a part that attempted tools but recorded none, though every ledger row is ok", () => {
    const ledger = allOk.map((r) => (r.collector === "vscode" ? { ...r, recorded: 0 } : r));
    const { exitCode, report } = renderMetricsHistoryReport(input({ ledger }));
    expect(exitCode).toBe(3);
    expect(report).toContain("vscode: attempted=40 recorded=0 DEAD (recorded none)");
    expect(report).toContain("Result: FAIL (1 dead collector(s))");
  });

  it("does not call a part dead when it attempted nothing", () => {
    const ledger = allOk.map((r) => (r.collector === "github" ? { ...r, attempted: 0, recorded: 0 } : r));
    expect(renderMetricsHistoryReport(input({ ledger })).exitCode).toBe(0);
  });

  // #95 PR C: this test changed on purpose. The single all-tools floor (null, WARN only) is
  // replaced by a per-part floor over eligible tools; the all-tools line is informational.
  it("does not fail on low all-tools coverage: a tool with no identifier is not a miss", () => {
    const { exitCode, report } = renderMetricsHistoryReport(input({ coverage: { tools: 50, rows: 1 } }));
    expect(exitCode).toBe(0);
    expect(report).toContain("Coverage: 1 of 50 tools have a history row (2%)");
    expect(report).toContain("github: 0 of 0 eligible (n/a) no eligible tools");
    expect(report).toMatch(/Result: PASS$/);
  });

  it("fails a part whose recorded share of eligible tools is under its floor", () => {
    // The 2026-11-01 github shape once its URLs are eligible: 4 recorded of (say) 120.
    const partCoverage = [
      { part: "github", eligible: 120, recorded: 4 },
      { part: "npm", eligible: 159, recorded: 150 },
    ];
    const { exitCode, report } = renderMetricsHistoryReport(input({ partCoverage }));
    expect(exitCode).toBe(3);
    expect(report).toContain("github: 4 of 120 eligible (3%) FAIL under the floor of 80%");
    expect(report).toContain("npm: 150 of 159 eligible (94%) ok, floor 90%");
    expect(report).toContain("Result: FAIL (1 part(s) under the coverage floor)");

    const off = { ...COVERAGE_FLOOR, github: null };
    const unfloored = renderMetricsHistoryReport(input({ partCoverage, coverageFloor: off }));
    expect(unfloored.exitCode).toBe(0);
    expect(unfloored.report).toContain("github: 4 of 120 eligible (3%) no floor");
  });

  it("passes at exactly the floor", () => {
    const partCoverage = [{ part: "pypi", eligible: 10, recorded: 9 }];
    expect(renderMetricsHistoryReport(input({ partCoverage })).exitCode).toBe(0);
    const below = [{ part: "pypi", eligible: 10, recorded: 8 }];
    expect(renderMetricsHistoryReport(input({ partCoverage: below })).exitCode).toBe(3);
  });

  it("parses METRICS_COVERAGE_FLOOR", () => {
    expect(parseCoverageFloors(undefined)).toEqual(COVERAGE_FLOOR);
    expect(parseCoverageFloors("  ")).toEqual(COVERAGE_FLOOR);
    // #184: `off` also turns off the open-weight key's floor.
    expect(parseCoverageFloors("off")).toEqual({ github: null, pypi: null, npm: null, vscode: null, huggingface: null });
    expect(parseCoverageFloors("github=0.5, npm=off")).toEqual({ ...COVERAGE_FLOOR, github: 0.5, npm: null });
    expect(() => parseCoverageFloors("rubygems=0.5")).toThrow("METRICS_COVERAGE_FLOOR");
    expect(() => parseCoverageFloors("github=1.5")).toThrow("from 0 to 1");
    expect(() => parseCoverageFloors("github")).toThrow("METRICS_COVERAGE_FLOOR");
  });

  it("WARNs per part on flat values without failing, and says so on the first month", () => {
    const { exitCode, report } = renderMetricsHistoryReport(
      input({
        previousDate: "2026-10-01",
        flat: [
          { part: "npm", compared: 4, unchanged: 3 },
          { part: "pypi", compared: 4, unchanged: 1 },
        ],
      })
    );
    expect(exitCode).toBe(0);
    expect(report).toContain("previous collected_date: 2026-10-01");
    expect(report).toContain("npm: 3 of 4 tools unchanged WARN");
    expect(report).toContain("pypi: 1 of 4 tools unchanged\n");
    expect(report).toContain("github: 0 of 0 tools unchanged\n");
    expect(report).toMatch(/Result: PASS$/);

    expect(renderMetricsHistoryReport(input()).report).toContain("no previous month");
  });
});

// Recognisable private data the fake database smuggles into every row set.
const SLUG = "zz-private-tool-slug";
const NAME = "Zz Private Tool";
const ID = "11111111-2222-3333-4444-555555555555";
const VALUE = 987654321;
const CONN = "postgres://user:pw@db.invalid/x";
const poison = { tool_slug: SLUG, slug: SLUG, name: NAME, tool_id: ID, id: ID, value: VALUE, metrics: { stars: { value: VALUE } } };

function fakeDb(results: unknown[] | Error) {
  const calls: Statement[][] = [];
  const connect = (): RunReadOnly => async (statements) => {
    calls.push(statements);
    if (results instanceof Error) throw results;
    return results;
  };
  return { calls, connect };
}

const goodResults = () => [
  [
    { collected_date: "2026-11-01", rows: 40, ...poison },
    { collected_date: "2026-10-01", rows: 38, ...poison },
  ],
  allOk.map((r) => ({ ...r, ...poison, error: `${SLUG} returned ${VALUE}` })),
  [{ tools: 50, rows: 40, ...poison }],
  [{ part: "npm", compared: 4, unchanged: 3, ...poison }],
  [{ part: "npm", eligible: 4, recorded: 4, ...poison }],
];

const run = (results: unknown[] | Error, argv = ["--scheduled"]) => {
  const db = fakeDb(results);
  const out = executeCheck({ argv, now: new Date("2026-11-02T06:00:00Z"), connectionString: CONN, connect: db.connect });
  return { db, out };
};

describe("#95 executeCheck", () => {
  it("prints counts only: no slug, name, id or metric value reaches the output", async () => {
    const { out } = run(goodResults());
    const { exitCode, stdout, stderr } = await out;
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Coverage: 40 of 50 tools");
    expect(stdout).toContain("npm: 3 of 4 tools unchanged WARN");
    for (const secret of [SLUG, NAME, ID, String(VALUE), CONN]) {
      expect(stdout + stderr).not.toContain(secret);
    }
  });

  it("checks the scheduled month in one read-only batch of SELECTs", async () => {
    const { db, out } = run(goodResults());
    expect((await out).stdout).toContain("check for collected_date 2026-11-01");
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].map((s) => s.text)).toEqual([...QUERIES]);
    for (const s of db.calls[0]) expect(() => assertSelectOnly(s.text)).not.toThrow();
    expect(db.calls[0][1].params).toEqual(["2026-11-01"]);
    // #95: the part-coverage query reads the collector's own GitHub URL fields.
    // #184: and covers the open-weight key, passed as $4.
    expect(db.calls[0][4].params).toEqual(["2026-11-01", [...CHECKED_PARTS], [...GITHUB_URL_PATHS], HF_METRICS_KEY]);
  });

  it("reports per-part coverage and errors on a malformed METRICS_COVERAGE_FLOOR before any query", async () => {
    expect((await run(goodResults()).out).stdout).toContain("npm: 4 of 4 eligible (100%) ok, floor 90%");
    const db = fakeDb(goodResults());
    const bad = await executeCheck({
      argv: ["--scheduled"],
      now: new Date("2026-11-02T06:00:00Z"),
      connectionString: CONN,
      coverageFloorSpec: "github=2",
      connect: db.connect,
    });
    expect(bad.exitCode).toBe(1);
    expect(bad.stderr).toContain("from 0 to 1");
    expect(db.calls).toHaveLength(0);
  });

  it.each([
    ["a query that throws", new Error(`relation missing near ${SLUG} ${VALUE} ${CONN}`)],
    ["a transaction with no results", [] as unknown[]],
    ["a coverage query with no row", [[], [], [], [], []]],
    ["a coverage count that is not a number", [[], [], [{ tools: "x", rows: 1 }], [], []]],
    ["a part-coverage count that is not a number", [[], [], [{ tools: 1, rows: 1 }], [], [{ part: "npm", eligible: "x", recorded: 1 }]]],
  ])("fails the job on %s instead of passing", async (_label, results) => {
    const { exitCode, stdout, stderr } = await run(results).out;
    expect(exitCode).toBe(1);
    expect(stdout).toBe("Result: ERROR\n");
    for (const secret of [SLUG, String(VALUE), CONN]) expect(stderr).not.toContain(secret);
  });

  it("errors without a connection string, before any query", async () => {
    const db = fakeDb(goodResults());
    const result = await executeCheck({ argv: [], now: new Date(), connectionString: undefined, connect: db.connect });
    expect(result.exitCode).toBe(1);
    expect(db.calls).toHaveLength(0);
  });
});
