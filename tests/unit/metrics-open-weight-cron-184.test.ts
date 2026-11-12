/**
 * #184: GET /api/cron/collect-open-weight-metrics, its vercel.json entry, and the gap check.
 *
 * Why: owner ruling D83 schedules the open-weight collector monthly. The route writes
 *   history, so it must refuse an unauthorised call, never answer 2xx for a run that
 *   failed, and stay apart from the sharded collect-metrics run. The run writes no ledger
 *   row, so the gap check's coverage floor is what catches a missed month.
 * What: drives both real GET handlers with `getDb`, `runOpenWeightCollection`,
 *   `runMetricsShard` and `createCollectorAdapter` mocked (relative paths); the alert
 *   webhook is a stubbed `fetch`. Parses vercel.json. Renders the check report with
 *   `huggingface` coverage.
 * Test: `npx vitest run tests/unit/metrics-open-weight-cron-184.test.ts`. No network, no database.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  runOpenWeight: vi.fn(),
  runShard: vi.fn(),
  createAdapter: vi.fn(),
}));

vi.mock("../../lib/db/connection", () => ({ getDb: mocks.getDb }));

vi.mock("../../lib/metrics-history/collect-open-weight", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/metrics-history/collect-open-weight")>()),
  runOpenWeightCollection: mocks.runOpenWeight,
}));

vi.mock("../../lib/metrics-history/collect-shard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/metrics-history/collect-shard")>()),
  runMetricsShard: mocks.runShard,
}));

vi.mock("../../lib/metrics-collectors/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/metrics-collectors/registry")>()),
  createCollectorAdapter: mocks.createAdapter,
}));

import { GET as collectMetricsGET } from "../../app/api/cron/collect-metrics/route";
import { GET } from "../../app/api/cron/collect-open-weight-metrics/route";
import { HF_METRICS_KEY } from "../../lib/metrics-collectors/huggingface";
import { COLLECTOR_PARTS, SHARD_COUNTS } from "../../lib/metrics-collectors/registry";
import {
  CHECKED_PARTS,
  COVERAGE_FLOOR,
  type LedgerRow,
  parseCoverageFloors,
  renderMetricsHistoryReport,
} from "../../lib/metrics-history/check-report";

const ROOT = path.resolve(__dirname, "../..");
const ROUTE_PATH = "/api/cron/collect-open-weight-metrics";
const SECRET = "cron-secret-fixture-value";
const WEBHOOK = "https://alerts.example.test/hook";

const COUNTS = { attempted: 25, recorded: 25, not_found: 0, failed: 0, skipped_timeout: 0 };
const okRun = { collectedDate: "2027-01-01", period: "2027-01", status: "ok", counts: COUNTS, error: null };

let alerts: Array<Record<string, unknown>> = [];

function request(url: string, auth: string | null = `Bearer ${SECRET}`): Request {
  const headers = new Headers();
  if (auth !== null) headers.set("authorization", auth);
  return new Request(`https://aipowerranking.com${url}`, { headers });
}

const original = { cron: process.env["CRON_SECRET"], webhook: process.env["ALERT_WEBHOOK_URL"] };
function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

beforeEach(() => {
  alerts = [];
  mocks.getDb.mockReset().mockImplementation(() => ({}));
  mocks.runOpenWeight.mockReset().mockResolvedValue(okRun);
  mocks.runShard.mockReset().mockResolvedValue({
    result: {
      part: "npm",
      shard: 0,
      of: SHARD_COUNTS.npm,
      collectedDate: "2027-01-01",
      status: "ok",
      counts: { attempted: 1, recorded: 1, flagged: 0, not_found: 0, failed: 0, skipped_timeout: 0 },
      error: null,
    },
    ledgerError: null,
  });
  mocks.createAdapter.mockReset();
  process.env["CRON_SECRET"] = SECRET;
  process.env["ALERT_WEBHOOK_URL"] = WEBHOOK;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url !== WEBHOOK) throw new Error(`unexpected fetch ${url}`);
      alerts.push(JSON.parse(String(init?.body)));
      return new Response("ok");
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  restore("CRON_SECRET", original.cron);
  restore("ALERT_WEBHOOK_URL", original.webhook);
});

describe("#184 collect-open-weight-metrics route", () => {
  it.each([
    ["no header", null],
    ["wrong bearer", "Bearer not-the-secret"],
  ])("returns 401 and alerts for %s, running nothing", async (_name, auth) => {
    const response = await GET(request(ROUTE_PATH, auth));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ success: false, error: "Unauthorized" });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.["text"]).toBe(`[CRON FAILURE] ${ROUTE_PATH}`);
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.runOpenWeight).not.toHaveBeenCalled();
  });

  it("runs the collection once in apply mode and returns its counts with 200", async () => {
    const response = await GET(request(ROUTE_PATH));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, status: "ok", collected_date: "2027-01-01", counts: COUNTS });
    expect(mocks.runOpenWeight).toHaveBeenCalledTimes(1);
    expect(mocks.runOpenWeight.mock.calls[0]?.[0]).toMatchObject({ dryRun: false });
    expect(alerts).toHaveLength(0);
  });

  it("answers 500 and alerts when the runner throws", async () => {
    mocks.runOpenWeight.mockRejectedValue(new Error("hub unreachable"));

    const response = await GET(request(ROUTE_PATH));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ success: false, details: "hub unreachable" });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ text: `[CRON FAILURE] ${ROUTE_PATH}`, error: "hub unreachable" });
  });

  it.each(["partial", "failed"])("answers 500 and alerts on a %s run, with its counts", async (status) => {
    const counts = { ...COUNTS, recorded: 20, not_found: 5 };
    mocks.runOpenWeight.mockResolvedValue({ ...okRun, status, counts, error: "m: 404" });

    const response = await GET(request(ROUTE_PATH));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ success: false, status, counts });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ status, counts });
  });

  it("answers 500 and alerts when no database is available, before running", async () => {
    mocks.getDb.mockReturnValue(null);

    const response = await GET(request(ROUTE_PATH));

    expect(response.status).toBe(500);
    expect(alerts).toHaveLength(1);
    expect(mocks.runOpenWeight).not.toHaveBeenCalled();
  });
});

describe("#184 the two collection routes stay apart", () => {
  it("the open-weight route never runs a collect-metrics shard", async () => {
    expect((await GET(request(ROUTE_PATH))).status).toBe(200);
    expect(mocks.runOpenWeight).toHaveBeenCalledTimes(1);
    expect(mocks.runShard).not.toHaveBeenCalled();
    expect(mocks.createAdapter).not.toHaveBeenCalled();
  });

  it("the collect-metrics route never runs the open-weight collection", async () => {
    const response = await collectMetricsGET(request("/api/cron/collect-metrics?part=npm&shard=0&of=4"));
    expect(response.status).toBe(200);
    expect(mocks.runShard).toHaveBeenCalledTimes(1);
    expect(mocks.runOpenWeight).not.toHaveBeenCalled();
  });
});

describe("#184 vercel.json schedule", () => {
  const vercel = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8")) as {
    crons: Array<{ path: string; schedule: string }>;
  };
  /** Minutes after midnight for an `M H 1 * *` schedule. */
  const minuteOfFirst = (schedule: string): number => {
    const match = /^(\d{1,2}) (\d{1,2}) 1 \* \*$/.exec(schedule);
    if (!match) throw new Error(`not a monthly-on-the-1st schedule: ${schedule}`);
    return Number(match[2]) * 60 + Number(match[1]);
  };
  const daily = (schedule: string): number => {
    const match = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(schedule);
    if (!match) throw new Error(`not a daily schedule: ${schedule}`);
    return Number(match[2]) * 60 + Number(match[1]);
  };
  const scheduleOf = (p: string) => vercel.crons.find((c) => c.path === p)?.schedule ?? "";

  it("has exactly one monthly entry for the route, with no query", () => {
    const mine = vercel.crons.filter((c) => c.path.startsWith(ROUTE_PATH));
    expect(mine).toEqual([{ path: ROUTE_PATH, schedule: "30 5 1 * *" }]);
  });

  it("runs its 300 s budget clear of every shard, daily-news, monthly-summary and regenerate-rankings", () => {
    const start = minuteOfFirst(scheduleOf(ROUTE_PATH));
    const shardStarts = vercel.crons
      .filter((c) => c.path.startsWith("/api/cron/collect-metrics?"))
      .map((c) => minuteOfFirst(c.schedule));
    expect(shardStarts).toHaveLength(Object.values(SHARD_COUNTS).reduce((a, b) => a + b, 0));
    for (const shard of shardStarts) expect(start).toBeGreaterThanOrEqual(shard + 5);
    expect(start + 5).toBeLessThanOrEqual(daily(scheduleOf("/api/cron/daily-news")));
    expect(start + 5).toBeLessThanOrEqual(minuteOfFirst(scheduleOf("/api/cron/monthly-summary")));
    expect(start + 5).toBeLessThanOrEqual(minuteOfFirst(scheduleOf("/api/cron/regenerate-rankings")));
  });
});

describe("#184 the gap check expects the open-weight key", () => {
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
  const report = (recorded: number) =>
    renderMetricsHistoryReport({
      date: "2027-01-01",
      rowsPerDate: [],
      ledger: allOk,
      coverage: { tools: 300, rows: 250 },
      previousDate: null,
      flat: [],
      partCoverage: [{ part: HF_METRICS_KEY, eligible: 25, recorded }],
    });

  it("checks the name the collector writes, at an 80% floor, with no ledger expectation", () => {
    expect(HF_METRICS_KEY).toBe("huggingface");
    expect(CHECKED_PARTS).toContain(HF_METRICS_KEY);
    expect(COVERAGE_FLOOR[HF_METRICS_KEY]).toBe(0.8);
    expect(Object.keys(SHARD_COUNTS)).not.toContain(HF_METRICS_KEY);
    expect(parseCoverageFloors("huggingface=off")[HF_METRICS_KEY]).toBeNull();
  });

  it("fails a month the open-weight run missed", () => {
    const { exitCode, report: text } = report(0);
    expect(exitCode).toBe(3);
    expect(text).toContain("huggingface: 0 of 25 eligible (0%) FAIL under the floor of 80%");
  });

  it("passes a month the run recorded, including a few 404s, and fails under the floor", () => {
    const run = report(20);
    expect(run.exitCode).toBe(0);
    expect(run.report).toContain("huggingface: 20 of 25 eligible (80%) ok, floor 80%");
    expect(run.report).not.toMatch(/huggingface \d/); // no ledger line for it
    expect(report(19).exitCode).toBe(3);
  });
});
