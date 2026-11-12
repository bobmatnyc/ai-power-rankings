import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The opt-in blocking freshness mode (#95 step 7).
 *
 * Why: with `RANKINGS_REQUIRE_FRESH_METRICS` on, a history-scored run whose snapshot is stale
 *   or unverifiable must fail closed: no write, `StaleMetricsError`, a 409 and an alert from the
 *   cron route. A live-scored run (today's cron) is `not_applicable` and must still publish, and
 *   with the env unset the route must pass no mode, so the service default "flag" runs.
 * What: drives `publishActiveRankings()` and the cron route against the in-memory Drizzle
 *   stand-in (`fake-rankings-db`), with the history read module replaced by spies and the
 *   publish module wrapped to record its arguments or throw a given error. `fetch` is stubbed.
 * Test: `npx vitest run tests/unit/require-fresh-metrics-95.test.ts`. No network, no database.
 */

const db = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("../../lib/db/connection", () => ({ getDb: () => db.client }));

vi.mock("next/cache", () => ({
  revalidateTag: () => {},
  revalidatePath: () => {},
  unstable_cache: <T,>(fn: T) => fn,
}));

const history = vi.hoisted(() => ({
  rows: vi.fn(async (): Promise<unknown[]> => []),
  latest: vi.fn(async (): Promise<string | null> => "2026-10-01"),
}));
vi.mock("../../lib/metrics-history/read", () => ({
  selectMetricsHistoryRows: history.rows,
  selectLatestCollectedDate: history.latest,
}));

// Records each call's options; `error` set: the route gets this rejection instead.
const publish = vi.hoisted(() => ({ calls: [] as unknown[], error: null as Error | null }));
vi.mock("../../lib/rankings/publish-active", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/rankings/publish-active")>();
  return {
    ...actual,
    publishActiveRankings: (...args: Parameters<typeof actual.publishActiveRankings>) => {
      publish.calls.push(args[0]);
      return publish.error ? Promise.reject(publish.error) : actual.publishActiveRankings(...args);
    },
  };
});

import { GET as cronGET } from "../../app/api/cron/regenerate-rankings/route";
import {
  freshnessModeFromEnv,
  type MetricsFreshness,
  StaleMetricsError,
} from "../../lib/metrics-history/point-in-time";
import { publishActiveRankings } from "../../lib/rankings/publish-active";
import {
  createFakeRankingsDb,
  type FakeRankingRow,
  type FakeToolRow,
  rankingRow,
} from "../../lib/services/__fixtures__/fake-rankings-db";

const WEBHOOK = "https://alerts.example.test/hook";
const stamp = new Date("2026-01-01T00:00:00Z");
const now = () => new Date("2026-11-01T09:00:00Z");

function tool(id: string, kind: string, users: number): FakeToolRow {
  return {
    id,
    name: `Tool ${id}`,
    slug: `${id}-slug`,
    category: "other",
    status: "active",
    kind,
    data: { info: { description: id }, metrics: { users } },
    createdAt: stamp,
    updatedAt: stamp,
  };
}

const PUBLISHED: FakeRankingRow = rankingRow({
  id: "published-2026-10",
  period: "2026-10",
  list: "coding",
  isCurrent: true,
  publishedAt: stamp,
  data: [{ tool_id: "h1", rank: 1 }],
});

const cron = () =>
  cronGET(new Request("https://example.test/api/cron/regenerate-rankings", { headers: { authorization: "Bearer s" } }));

let fake: ReturnType<typeof createFakeRankingsDb>;
let fetchMock: ReturnType<typeof vi.fn>;
const webhookCalls = () => fetchMock.mock.calls.filter(([url]) => url === WEBHOOK);

beforeEach(() => {
  fake = createFakeRankingsDb({
    rankings: [structuredClone(PUBLISHED)],
    tools: [tool("h1", "harness", 900_000), tool("m1", "model", 800_000), tool("p1", "productivity", 500_000)],
  });
  db.client = fake.client;
  publish.calls = [];
  publish.error = null;
  history.rows.mockReset().mockResolvedValue([]);
  history.latest.mockReset().mockResolvedValue("2026-10-01");
  vi.stubEnv("CRON_SECRET", "s");
  vi.stubEnv("ALERT_WEBHOOK_URL", WEBHOOK);
  vi.stubEnv("RANKINGS_REQUIRE_FRESH_METRICS", undefined);
  fetchMock = vi.fn(async () => new Response("ok"));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("require mode in regenerateRankings (#95 step 7)", () => {
  it("a stale history-scored run throws StaleMetricsError and writes nothing", async () => {
    const run = publishActiveRankings({ now, metricsFreshness: "require", usePointInTimeMetrics: true });

    await expect(run).rejects.toBeInstanceOf(StaleMetricsError);
    await expect(run).rejects.toMatchObject({
      freshness: { mode: "require", status: "stale", period: "2026-11", latestCollectedDate: "2026-10-01" },
    });
    expect(history.latest).toHaveBeenCalledWith(expect.anything(), "2026-11");
    expect(fake.state.writes).toEqual([]);
    expect(fake.state.rankings).toEqual([PUBLISHED]);
  });

  it("an unverifiable snapshot (failed read) also throws and writes nothing", async () => {
    history.latest.mockRejectedValue(new Error("timeout"));

    await expect(
      publishActiveRankings({ now, metricsFreshness: "require", usePointInTimeMetrics: true })
    ).rejects.toMatchObject({ name: "StaleMetricsError", freshness: { status: "unknown" } });
    expect(fake.state.writes).toEqual([]);
  });

  it("a fresh history-scored run publishes", async () => {
    history.latest.mockResolvedValue("2026-11-01");

    const result = await publishActiveRankings({ now, metricsFreshness: "require", usePointInTimeMetrics: true });

    expect(result.metricsFreshness).toMatchObject({ mode: "require", status: "fresh" });
    expect(fake.state.writes.length).toBeGreaterThan(0);
  });

  it("a live-scored run (the cron path) is not_applicable and publishes", async () => {
    const result = await publishActiveRankings({ now, metricsFreshness: "require" });

    expect(result.metricsFreshness).toMatchObject({ mode: "require", status: "not_applicable" });
    expect(result.staleMetrics).toBe(false);
    expect(history.latest).not.toHaveBeenCalled();
    expect(fake.state.writes.length).toBeGreaterThan(0);
  });
});

describe("GET /api/cron/regenerate-rankings with RANKINGS_REQUIRE_FRESH_METRICS (#95 step 7)", () => {
  it("env unset: the route passes no mode and the service default (flag) runs", async () => {
    const response = await cron();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(publish.calls).toEqual([{}]);
    expect(body.metrics_freshness).toMatchObject({ mode: "flag", status: "not_applicable" });
  });

  it("env true on the live cron path: require mode runs, not_applicable, 200", async () => {
    vi.stubEnv("RANKINGS_REQUIRE_FRESH_METRICS", "true");

    const response = await cron();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(publish.calls).toEqual([{ metricsFreshness: "require" }]);
    expect(body.metrics_freshness).toMatchObject({ mode: "require", status: "not_applicable" });
    expect(webhookCalls()).toEqual([]);
  });

  it("StaleMetricsError: 409, the failure alert fires, nothing is written", async () => {
    vi.stubEnv("RANKINGS_REQUIRE_FRESH_METRICS", "1");
    const freshness: MetricsFreshness = {
      mode: "require",
      status: "stale",
      period: "2026-11",
      latestCollectedDate: "2026-10-01",
      reason: "newest tool_metrics_history snapshot (2026-10-01) predates period 2026-11",
    };
    publish.error = new StaleMetricsError(freshness);

    const response = await cron();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ success: false, period: "2026-11", metrics_freshness: freshness });
    const calls = webhookCalls();
    expect(calls).toHaveLength(1);
    const payload = JSON.parse((calls[0]![1] as RequestInit).body as string);
    expect(payload.text).toBe("[CRON FAILURE] /api/cron/regenerate-rankings");
    expect(payload.error).toMatch(/period 2026-11 is stale/);
    expect(fake.state.writes).toEqual([]);
  });

  it("an unrecognised env value fails the run (500, alert) before any publish", async () => {
    vi.stubEnv("RANKINGS_REQUIRE_FRESH_METRICS", "yes");

    const response = await cron();

    expect(response.status).toBe(500);
    expect(publish.calls).toEqual([]);
    expect(webhookCalls()).toHaveLength(1);
    expect(fake.state.writes).toEqual([]);
  });
});

describe("freshnessModeFromEnv (#95 step 7)", () => {
  it.each([
    [undefined, undefined],
    ["", undefined],
    ["0", undefined],
    ["false", undefined],
    ["1", "require"],
    ["true", "require"],
    [" TRUE ", "require"],
  ])("%j -> %j", (raw, mode) => {
    expect(freshnessModeFromEnv(raw)).toBe(mode);
  });

  it("throws on any other value", () => {
    expect(() => freshnessModeFromEnv("on")).toThrow(/RANKINGS_REQUIRE_FRESH_METRICS/);
  });
});
