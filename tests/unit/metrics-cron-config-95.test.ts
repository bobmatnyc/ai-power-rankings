/**
 * #95: the cron schedule for the metrics-history shards, and the read-only check.
 *
 * Why: every shard is its own vercel.json entry. A missing or duplicated shard
 *   leaves tools uncollected or collected twice, and a shard still running at
 *   08:00 on the 1st would overlap the monthly-summary and regen crons.
 * What: parses vercel.json and checks, per part, that the collect-metrics
 *   entries name shards exactly 0..of-1 with `of` = SHARD_COUNTS[part], each on
 *   the 1st, each starting early enough that its 300 s maxDuration ends before
 *   `0 8 1 * *`; that the total stays within Vercel's 100-cron cap; and that
 *   the check workflow runs on one monthly schedule and by dispatch, read
 *   only; and the check report fails on a missing or not-ok shard while
 *   printing counts only.
 * Test: `npx vitest run tests/unit/metrics-cron-config-95.test.ts`
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COLLECTOR_PARTS, SHARD_COUNTS } from "../../lib/metrics-collectors/registry";
import { type LedgerRow, renderMetricsHistoryReport } from "../../lib/metrics-history/check-report";

const ROOT = path.resolve(__dirname, "../..");
const vercel = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8")) as {
  crons: Array<{ path: string; schedule: string }>;
};
const shards = vercel.crons
  .filter((c) => c.path.startsWith("/api/cron/collect-metrics"))
  .map((c) => {
    const url = new URL(c.path, "https://cron.example.test");
    return {
      path: url.pathname,
      part: url.searchParams.get("part"),
      shard: Number(url.searchParams.get("shard")),
      of: Number(url.searchParams.get("of")),
      schedule: c.schedule,
    };
  });

/** Minutes after midnight for a `M H 1 * *` schedule; throws on any other shape. */
function minuteOfFirst(schedule: string): number {
  const match = /^(\d{1,2}) (\d{1,2}) 1 \* \*$/.exec(schedule);
  if (!match) throw new Error(`not a monthly-on-the-1st schedule: ${schedule}`);
  return Number(match[2]) * 60 + Number(match[1]);
}

describe("#95 vercel.json metrics-history shards", () => {
  it.each(COLLECTOR_PARTS)("%s has exactly shards 0..of-1 with of = SHARD_COUNTS", (part) => {
    const mine = shards.filter((s) => s.part === part);
    const of = SHARD_COUNTS[part];
    expect(mine.map((s) => s.shard).sort((a, b) => a - b)).toEqual([...Array(of).keys()]);
    for (const s of mine) {
      expect(s.of).toBe(of);
      expect(s.path).toBe("/api/cron/collect-metrics");
    }
  });

  it("names no other part", () => {
    expect(shards.length).toBeGreaterThan(0);
    for (const s of shards) expect(COLLECTOR_PARTS as readonly (string | null)[]).toContain(s.part);
  });

  it("every shard finishes its 300 s budget before monthly-summary at 0 8 1 * *", () => {
    const summary = vercel.crons.find((c) => c.path === "/api/cron/monthly-summary");
    expect(summary?.schedule).toBe("0 8 1 * *");
    const deadline = minuteOfFirst("0 8 1 * *");
    for (const s of shards) {
      expect(minuteOfFirst(s.schedule) + 5).toBeLessThanOrEqual(deadline);
    }
  });

  it("no two shards start in the same minute", () => {
    const minutes = shards.map((s) => minuteOfFirst(s.schedule));
    expect(new Set(minutes).size).toBe(minutes.length);
  });

  it("stays within Vercel's 100 cron jobs per project", () => {
    expect(vercel.crons.length).toBeLessThanOrEqual(100);
  });
});

describe("#95 check-metrics-history", () => {
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
  const rest = { coverage: { tools: 50, rows: 40 }, previousDate: null, flat: [] };

  it("passes when every configured shard has an ok row, printing counts only", () => {
    const { exitCode, report } = renderMetricsHistoryReport({
      date: "2026-11-01",
      rowsPerDate: [{ collected_date: "2026-11-01", rows: 40 }],
      ledger: allOk,
      ...rest,
    });
    expect(exitCode).toBe(0);
    expect(report).toContain("2026-11-01: 40");
    expect(report).toContain("npm 3/4: ok attempted=10 recorded=4");
    expect(report).toMatch(/Result: PASS$/);
  });

  it("fails on a missing shard", () => {
    const { exitCode, report } = renderMetricsHistoryReport({
      date: "2026-11-01",
      rowsPerDate: [],
      ledger: allOk.filter((r) => !(r.collector === "vscode" && r.shard === 2)),
      ...rest,
    });
    expect(exitCode).toBe(3);
    expect(report).toContain("vscode 2/4: MISSING");
  });

  it("fails on a shard that is not ok", () => {
    const ledger = allOk.map((r) => (r.collector === "pypi" && r.shard === 1 ? { ...r, status: "partial" } : r));
    const { exitCode, report } = renderMetricsHistoryReport({ date: "2026-11-01", rowsPerDate: [], ledger, ...rest });
    expect(exitCode).toBe(3);
    expect(report).toContain("pypi 1/2: partial");
  });

  // #95 slice 2: this assertion changed on purpose. Slice 1 asserted no `schedule:`;
  // the owner's ruling adds exactly one monthly schedule, and the check stays read only.
  it("the workflow runs at 06:00 UTC on the 2nd and by dispatch, read only, its queries SELECTs in one read-only transaction", () => {
    const workflow = readFileSync(path.join(ROOT, ".github/workflows/check-metrics-history.yml"), "utf8");
    const on = /\non:\n([\s\S]*?)\n\S/.exec(workflow)?.[1] ?? "";
    expect(on).toContain("workflow_dispatch:");
    expect(on).toMatch(/\n\s+date:\n/);
    expect(on.match(/- cron:/g)).toHaveLength(1);
    expect(on).toContain("- cron: '0 6 2 * *'");
    expect(on).not.toMatch(/push:|pull_request/);
    expect(workflow).toMatch(/\npermissions:\n {2}contents: read\n\n/);
    expect(workflow).toContain("DATABASE_URL: ${{ secrets.DATABASE_URL }}");
    expect(workflow).not.toMatch(/upload-artifact|\/api\/cron|CRON_SECRET|issues: write|gh issue/);
    expect(workflow).toMatch(/if \[ "\$EVENT_NAME" = "schedule" \]; then\n\s+date_flag=\("--scheduled"\)/);
    expect(workflow).toContain('exit "$status"');

    const script = readFileSync(path.join(ROOT, "scripts/check-metrics-history.ts"), "utf8");
    expect(script).toContain("{ readOnly: true }");
    expect(script.match(/sql\.transaction\(/g)).toHaveLength(1);
    expect(script).toContain("for (const query of QUERIES) assertSelectOnly(query);");
    expect(script).toMatch(/QUERIES = \[ROWS_QUERY, LEDGER_QUERY, COVERAGE_QUERY, FLAT_QUERY\]/);
    // Every SQL constant in the script is in QUERIES.
    expect(script.match(/^export const \w+_QUERY =/gm)).toHaveLength(4);
  });
});
