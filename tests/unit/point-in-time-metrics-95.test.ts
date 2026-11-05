import { drizzle } from "drizzle-orm/pg-proxy";
import { describe, expect, it } from "vitest";

/**
 * Point-in-time regeneration and the metrics freshness guard (#95 steps 4-5).
 *
 * Why: `usePointInTimeMetrics` must leave a run unchanged when off, score from
 *   `tool_metrics_history` when on, name every tool it scored live, and never turn a
 *   failed history read into a live publish. The guard must flag a stale snapshot
 *   without blocking.
 * What: drives `regenerateRankings()` through an in-memory `RankingPersistencePort`
 *   (the `ranking-generation.service.test.ts` pattern), checks the pure helpers, and
 *   renders the history SQL through a recording `drizzle-orm/pg-proxy` database.
 * Test: `npx vitest run tests/unit/point-in-time-metrics-95.test.ts`. No database.
 */

import {
  assessMetricsFreshness,
  foldHistoryRows,
  MetricsHistoryReadError,
  type MetricsHistoryRow,
  type MetricsHistorySnapshot,
} from "../../lib/metrics-history/point-in-time";
import { selectLatestCollectedDate, selectMetricsHistoryRows } from "../../lib/metrics-history/read";
import {
  type RankingEntry,
  type RankingPersistencePort,
  type RankingSourceTool,
  regenerateRankings,
} from "../../lib/services/ranking-generation.service";

const now = () => new Date("2026-11-01T09:00:00Z");
const PERIOD = "2026-11";

function tool(id: string, slug: string, installs: number, extra: Record<string, unknown> = {}): RankingSourceTool {
  return {
    id,
    name: slug,
    slug,
    category: "code-editor",
    status: "active",
    data: { metrics: { vscode: { installs }, ...extra } },
  };
}

// Live: alpha leads. History: charlie leads, so a history-scored run reorders the board.
const TOOLS = [
  tool("t1", "alpha", 60_000_000, { github: { stars: 50_000 } }),
  tool("t2", "bravo", 1_000_000),
  tool("t3", "charlie", 1_000),
];

function leaf(value: unknown, flags?: string[]) {
  return { value, source: "vscode-marketplace", as_of: "2026-11-01", ...(flags ? { flags } : {}) };
}

function snapshot(metrics: Record<string, Record<string, unknown>>, collectedDate = "2026-11-01"): MetricsHistorySnapshot {
  const parts = Object.fromEntries(Object.keys(metrics).map((part) => [part, collectedDate]));
  return { metrics, collectedDate, parts };
}

interface FakePort extends RankingPersistencePort {
  saved: RankingEntry[] | null;
  historyCalls: string[];
  freshnessCalls: string[];
}

function fakePort(
  opts: {
    history?: Map<string, MetricsHistorySnapshot> | Error;
    latest?: string | null | Error;
    withReaders?: boolean;
  } = {}
): FakePort {
  const port: FakePort = {
    saved: null,
    historyCalls: [],
    freshnessCalls: [],
    loadActiveTools: async () => structuredClone(TOOLS),
    loadCurrentRankings: async () => null,
    saveSnapshot: async ({ data }) => {
      port.saved = data;
    },
  };
  if (opts.withReaders !== false) {
    port.loadMetricsHistoryForPeriod = async (period) => {
      port.historyCalls.push(period);
      if (opts.history instanceof Error) throw opts.history;
      return opts.history ?? new Map();
    };
    port.loadLatestMetricsCollectedDate = async (period) => {
      port.freshnessCalls.push(period);
      if (opts.latest instanceof Error) throw opts.latest;
      return opts.latest === undefined ? "2026-11-01" : opts.latest;
    };
  }
  return port;
}

const bySlug = (rows: RankingEntry[] | null) => new Map((rows ?? []).map((r) => [r.tool_slug, r]));

describe("usePointInTimeMetrics (#95 step 4)", () => {
  it("flag off: the history is never read and the rows equal a run on a port without readers", async () => {
    const plain = fakePort({ withReaders: false });
    const withHistory = fakePort({ history: new Map([["t3", snapshot({ vscode: { installs: leaf(90_000_000) } })]]) });

    const plainResult = await regenerateRankings({ persistence: plain, now, period: PERIOD, metricsFreshness: "off" });
    const result = await regenerateRankings({ persistence: withHistory, now, period: PERIOD, metricsFreshness: "off" });

    expect(withHistory.historyCalls).toEqual([]);
    expect(withHistory.saved).toEqual(plain.saved);
    expect(JSON.stringify(withHistory.saved)).not.toContain("point_in_time");
    expect(result.pointInTime).toBeNull();
    expect(plainResult.pointInTime).toBeNull();
  });

  it("flag on with a full snapshot: every tool is scored from history and stamped", async () => {
    const history = new Map([
      ["t1", snapshot({ vscode: { installs: leaf(1_000) } })],
      ["t2", snapshot({ vscode: { installs: leaf(1_000_000) } })],
      ["t3", snapshot({ vscode: { installs: leaf(60_000_000) } })],
    ]);
    const port = fakePort({ history });

    const result = await regenerateRankings({ persistence: port, now, period: PERIOD, usePointInTimeMetrics: true });

    expect(port.historyCalls).toEqual([PERIOD]);
    expect(result.pointInTime).toEqual({
      period: PERIOD,
      applied: true,
      snapshotTools: 3,
      fallbackTools: [],
      skippedLeaves: 0,
      reason: null,
    });
    // History moves charlie first; alpha keeps its live github stars (no github history), so it stays above bravo.
    expect(port.saved!.map((r) => r.tool_slug)).toEqual(["charlie", "alpha", "bravo"]);
    for (const row of port.saved!) {
      expect(row.point_in_time).toBe(true);
      expect(row.reconstructed).toBeUndefined();
      expect(row.provenance).toMatchObject({ period: PERIOD, source: "tool_metrics_history", collected_date: "2026-11-01" });
    }
  });

  it("flag on with partial history: tools without history are scored live and named; flagged leaves keep live", async () => {
    const live = fakePort({ withReaders: false });
    await regenerateRankings({ persistence: live, now, period: PERIOD, metricsFreshness: "off" });

    const history = new Map([
      // alpha: npm only. Its live vscode and github values must survive the merge.
      ["t1", snapshot({ npm: { downloads_last_month: leaf(5) } })],
      // bravo: a non-numeric installs leaf, flagged by the collector. Live 1M is kept.
      ["t2", snapshot({ vscode: { installs: leaf("1.2M", ["non_numeric"]) } })],
      // charlie: no history at all.
    ]);
    const port = fakePort({ history });
    const result = await regenerateRankings({ persistence: port, now, period: PERIOD, usePointInTimeMetrics: true });

    expect(result.pointInTime).toMatchObject({ applied: true, snapshotTools: 2, fallbackTools: ["charlie"], skippedLeaves: 1 });
    const rows = bySlug(port.saved);
    const liveRows = bySlug(live.saved);
    expect(rows.get("charlie")!.point_in_time).toBeUndefined();
    expect(rows.get("charlie")!.score).toBe(liveRows.get("charlie")!.score);
    // The flagged leaf did not replace the live 1M installs with a string that scores 0.
    expect(rows.get("bravo")!.score).toBe(liveRows.get("bravo")!.score);
    expect(rows.get("bravo")!.point_in_time).toBe(true);
    expect(rows.get("alpha")!.factor_scores["developerAdoption"]).toBeGreaterThanOrEqual(
      liveRows.get("alpha")!.factor_scores["developerAdoption"]!
    );
    expect(rows.get("alpha")!.rank).toBe(1);
  });

  it("flag on with an empty history map: every tool is scored live and listed as a fallback", async () => {
    const live = fakePort({ withReaders: false });
    await regenerateRankings({ persistence: live, now, period: PERIOD, metricsFreshness: "off" });
    const port = fakePort({ history: new Map() });

    const result = await regenerateRankings({ persistence: port, now, period: PERIOD, usePointInTimeMetrics: true });

    expect(result.pointInTime).toEqual({
      period: PERIOD,
      applied: true,
      snapshotTools: 0,
      fallbackTools: ["alpha", "bravo", "charlie"],
      skippedLeaves: 0,
      reason: null,
    });
    expect(port.saved).toEqual(live.saved);
  });

  it("flag on and the history read throws: the run rejects and writes nothing", async () => {
    const port = fakePort({ history: new Error("relation \"tool_metrics_history\" does not exist") });

    const run = regenerateRankings({ persistence: port, now, period: PERIOD, usePointInTimeMetrics: true });

    await expect(run).rejects.toBeInstanceOf(MetricsHistoryReadError);
    await expect(run).rejects.toThrow(/2026-11 could not be read: relation "tool_metrics_history" does not exist/);
    expect(port.saved).toBeNull();
  });

  it("flag on with no history reader on the port: the run rejects and writes nothing", async () => {
    const port = fakePort({ withReaders: false });

    await expect(
      regenerateRankings({ persistence: port, now, period: PERIOD, usePointInTimeMetrics: true })
    ).rejects.toBeInstanceOf(MetricsHistoryReadError);
    expect(port.saved).toBeNull();
  });
});

describe("metrics freshness guard (#95 step 5)", () => {
  // The guard checks history only on a run that scored from it (#95 fix round).
  const PIT = { usePointInTimeMetrics: true } as const;

  it("point-in-time off (the cron default): not_applicable, no history read, not stale", async () => {
    const port = fakePort({ latest: "2020-01-01" });

    const result = await regenerateRankings({ persistence: port, now, period: PERIOD });

    expect(port.freshnessCalls).toEqual([]);
    expect(port.historyCalls).toEqual([]);
    expect(result.staleMetrics).toBe(false);
    expect(result.metricsFreshness).toMatchObject({
      mode: "flag",
      status: "not_applicable",
      reason: "publish scored from live tools.data, not tool_metrics_history",
    });
  });

  it("an override file that took precedence is not_applicable too", async () => {
    const port = fakePort({ latest: "2020-01-01" });
    const result = await regenerateRankings({
      persistence: port,
      now,
      period: PERIOD,
      usePointInTimeMetrics: true,
      metricsOverridePath: "data/historical-metrics/2025-12.json",
    });

    expect(result.pointInTime).toMatchObject({ applied: false, reason: "metricsOverridePath took precedence" });
    expect(result.metricsFreshness.status).toBe("not_applicable");
    expect(port.freshnessCalls).toEqual([]);
  });

  it("defaults to flag mode: a snapshot older than the period is flagged and the run still publishes", async () => {
    const port = fakePort({ latest: "2026-10-01" });

    const result = await regenerateRankings({ persistence: port, now, period: PERIOD, ...PIT });

    expect(port.freshnessCalls).toEqual([PERIOD]);
    expect(result.staleMetrics).toBe(true);
    expect(result.metricsFreshness).toMatchObject({ mode: "flag", status: "stale", latestCollectedDate: "2026-10-01" });
    expect(port.saved).toHaveLength(3);
  });

  it("a snapshot collected in the period is fresh", async () => {
    const result = await regenerateRankings({ persistence: fakePort({ latest: "2026-11-01" }), now, period: PERIOD, ...PIT });

    expect(result.staleMetrics).toBe(false);
    expect(result.metricsFreshness.status).toBe("fresh");
  });

  it("a failed freshness read is recorded as unknown, flagged, and does not block", async () => {
    const port = fakePort({ latest: new Error("timeout") });

    const result = await regenerateRankings({ persistence: port, now, period: PERIOD, ...PIT });

    expect(result.metricsFreshness).toMatchObject({ status: "unknown", reason: "history read failed: timeout" });
    expect(result.staleMetrics).toBe(true);
    expect(port.saved).toHaveLength(3);
  });

  it("off skips the read", async () => {
    const port = fakePort({ latest: "2020-01-01" });

    const result = await regenerateRankings({ persistence: port, now, period: PERIOD, metricsFreshness: "off", ...PIT });

    expect(port.freshnessCalls).toEqual([]);
    expect(result.staleMetrics).toBe(false);
    expect(result.metricsFreshness.status).toBe("off");
  });

  it("assessMetricsFreshness: no snapshot at all is stale", () => {
    expect(assessMetricsFreshness(PERIOD, null)).toMatchObject({ status: "stale", latestCollectedDate: null });
  });
});

describe("foldHistoryRows (#95)", () => {
  it("keeps the newest row per tool and collector key, so a missed collector keeps its last reading", () => {
    const rows: MetricsHistoryRow[] = [
      { toolId: "t1", collectedDate: "2026-10-01", metrics: { github: { stars: leaf(10) }, npm: { downloads_last_month: leaf(1) } } },
      { toolId: "t1", collectedDate: "2026-11-01", metrics: { npm: { downloads_last_month: leaf(2) } } },
    ];

    const folded = foldHistoryRows(rows).get("t1")!;

    expect(folded.metrics["npm"]).toEqual({ downloads_last_month: leaf(2) });
    expect(folded.metrics["github"]).toEqual({ stars: leaf(10) });
    expect(folded.parts).toEqual({ npm: "2026-11-01", github: "2026-10-01" });
    expect(folded.collectedDate).toBe("2026-11-01");
  });
});

describe("history read SQL (#95)", () => {
  function recordingDb(rows: unknown[][]) {
    const statements: Array<{ text: string; params: unknown[] }> = [];
    const db = drizzle(async (text: string, params: unknown[]) => {
      statements.push({ text, params });
      return { rows };
    });
    return { db, statements };
  }

  it("bounds both reads by period and skips rows with no tool", async () => {
    const rowsDb = recordingDb([["t1", "2026-11-01", { npm: {} }]]);
    const latestDb = recordingDb([["2026-11-01"]]);

    const rows = await selectMetricsHistoryRows(rowsDb.db, PERIOD);
    const latest = await selectLatestCollectedDate(latestDb.db, PERIOD);

    expect(rowsDb.statements[0]!.text).toMatch(
      /from "tool_metrics_history" where \("tool_metrics_history"\."period" <= \$1 and "tool_metrics_history"\."tool_id" is not null\)/
    );
    expect(rowsDb.statements[0]!.params).toEqual([PERIOD]);
    expect(rows).toEqual([{ toolId: "t1", collectedDate: "2026-11-01", metrics: { npm: {} } }]);
    expect(latestDb.statements[0]!.text).toMatch(/select max\("collected_date"\) from "tool_metrics_history" where "tool_metrics_history"\."period" <= \$1/);
    expect(latestDb.statements[0]!.params).toEqual([PERIOD]);
    expect(latest).toBe("2026-11-01");
  });
});

