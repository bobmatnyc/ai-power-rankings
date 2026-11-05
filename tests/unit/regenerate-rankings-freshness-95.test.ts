import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The regenerate-rankings cron route and the metrics freshness guard (#95 step 5, fix round).
 *
 * Why: the cron scores live `tools.data`, so a fresh `tool_metrics_history` snapshot says
 *   nothing about what it published. With point-in-time off the route must report
 *   `not_applicable`, read no history and send no warning; when a history-scored publish
 *   is stale it must send the `[CRON WARNING]` webhook and report the guard's fields.
 * What: the default case runs the real publish path against the in-memory Drizzle stand-in
 *   (`fake-rankings-db`) with the history read module replaced by spies. The stale case
 *   hands the route a mocked publish result, since the route itself never turns
 *   point-in-time on. `fetch` is stubbed; `ALERT_WEBHOOK_URL` points at a test URL.
 * Test: `npx vitest run tests/unit/regenerate-rankings-freshness-95.test.ts`. No network, no database.
 */

const db = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("../../lib/db/connection", () => ({ getDb: () => db.client }));

vi.mock("next/cache", () => ({
  revalidateTag: () => {},
  revalidatePath: () => {},
  unstable_cache: <T,>(fn: T) => fn,
}));

const history = vi.hoisted(() => ({
  rows: vi.fn(async () => []),
  latest: vi.fn(async () => "2020-01-01"),
}));
vi.mock("../../lib/metrics-history/read", () => ({
  selectMetricsHistoryRows: history.rows,
  selectLatestCollectedDate: history.latest,
}));

// null: the real publish; a value: the route gets this result instead.
const publish = vi.hoisted(() => ({ result: null as unknown }));
vi.mock("../../lib/rankings/publish-active", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/rankings/publish-active")>();
  return {
    ...actual,
    publishActiveRankings: (...args: Parameters<typeof actual.publishActiveRankings>) =>
      publish.result ? Promise.resolve(publish.result) : actual.publishActiveRankings(...args),
  };
});

import { GET as cronGET } from "../../app/api/cron/regenerate-rankings/route";
import type { RankingGenerationResult } from "../../lib/services/ranking-generation.service";
import { createFakeRankingsDb, type FakeToolRow } from "../../lib/services/__fixtures__/fake-rankings-db";

const WEBHOOK = "https://alerts.example.test/hook";
const stamp = new Date("2026-01-01T00:00:00Z");

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

const cron = () =>
  cronGET(new Request("https://example.test/api/cron/regenerate-rankings", { headers: { authorization: "Bearer s" } }));

let fetchMock: ReturnType<typeof vi.fn>;
const webhookCalls = () => fetchMock.mock.calls.filter(([url]) => url === WEBHOOK);

beforeEach(() => {
  db.client = createFakeRankingsDb({
    tools: [tool("h1", "harness", 900_000), tool("m1", "model", 800_000), tool("p1", "productivity", 500_000)],
  }).client;
  publish.result = null;
  history.rows.mockClear();
  history.latest.mockClear();
  vi.stubEnv("CRON_SECRET", "s");
  vi.stubEnv("ALERT_WEBHOOK_URL", WEBHOOK);
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

describe("GET /api/cron/regenerate-rankings metrics freshness (#95)", () => {
  it("defaults (point-in-time off): not_applicable, stale_metrics false, no history read, no webhook", async () => {
    const response = await cron();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stale_metrics).toBe(false);
    expect(body.metrics_freshness).toMatchObject({
      mode: "flag",
      status: "not_applicable",
      latestCollectedDate: null,
      reason: "publish scored from live tools.data, not tool_metrics_history",
    });
    expect(history.rows).not.toHaveBeenCalled();
    expect(history.latest).not.toHaveBeenCalled();
    expect(webhookCalls()).toEqual([]);
  });

  it("a stale history-scored publish sends the [CRON WARNING] webhook and reports the guard's fields", async () => {
    const metricsFreshness = {
      mode: "flag",
      status: "stale",
      period: "2026-11",
      latestCollectedDate: "2026-10-01",
      reason: "newest tool_metrics_history snapshot (2026-10-01) predates period 2026-11",
    } as const;
    const result: RankingGenerationResult = {
      period: "2026-11",
      algorithmVersion: "8.0",
      toolCount: 3,
      publishedAt: "2026-11-01T09:00:00.000Z",
      topMovers: [],
      mode: "publish",
      entries: [],
      layout: "per-list",
      boards: [],
      pointInTime: { period: "2026-11", applied: true, snapshotTools: 3, fallbackTools: [], skippedLeaves: 0, reason: null },
      metricsFreshness,
      staleMetrics: true,
    };
    publish.result = result;

    const response = await cron();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stale_metrics).toBe(true);
    expect(body.metrics_freshness).toEqual(metricsFreshness);
    const calls = webhookCalls();
    expect(calls).toHaveLength(1);
    const payload = JSON.parse((calls[0]![1] as RequestInit).body as string);
    expect(payload.text).toBe("[CRON WARNING] /api/cron/regenerate-rankings");
    expect(payload.error).toMatch(/period 2026-11 is stale: newest tool_metrics_history snapshot \(2026-10-01\)/);
    expect(payload.latestCollectedDate).toBe("2026-10-01");
  });
});
