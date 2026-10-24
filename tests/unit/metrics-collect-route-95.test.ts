/**
 * #95: GET /api/cron/collect-metrics — auth, parameters, fail-closed status,
 * and the guarantee that it never writes `tools`.
 *
 * Why: the route writes a private table on the 1st of each month. It must
 *   refuse unauthorised and misconfigured calls loudly, never answer 2xx for a
 *   shard that did not fully record, and never move published scores by
 *   writing `tools.data`.
 * What: drives the real GET handler and the real drizzle store over a
 *   `drizzle-orm/pg-proxy` database whose driver records every SQL statement
 *   (no connection). `getDb` and `createCollectorAdapter` are mocked with
 *   relative paths; each test asserts the mock was used. The alert webhook is a
 *   stubbed `fetch`.
 * Test: `npx vitest run tests/unit/metrics-collect-route-95.test.ts`. No network, no database.
 */

import { drizzle } from "drizzle-orm/pg-proxy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Statement {
  text: string;
  params: unknown[];
}

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  createAdapter: vi.fn(),
}));

vi.mock("../../lib/db/connection", () => ({ getDb: mocks.getDb }));

vi.mock("../../lib/metrics-collectors/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/metrics-collectors/registry")>()),
  createCollectorAdapter: mocks.createAdapter,
}));

import { GET } from "../../app/api/cron/collect-metrics/route";

const SECRET = "cron-secret-fixture-value";
const WEBHOOK = "https://alerts.example.test/hook";
const TOOL_ROWS = [
  ["id-alpha", "alpha", "Alpha", {}],
  ["id-beta", "beta", "Beta", {}],
  ["id-gamma", "gamma", "Gamma", {}],
];

let statements: Statement[] = [];
let failOn: RegExp | null = null;
let alerts: Array<Record<string, unknown>> = [];

function fakeDb() {
  return drizzle(async (text: string, params: unknown[]) => {
    statements.push({ text, params });
    if (failOn?.test(text)) throw new Error("db connection lost");
    if (/^select .* from "tools"/i.test(text)) return { rows: TOOL_ROWS };
    return { rows: [] };
  });
}

/** Column -> bound value for an `insert into "t" (cols) values (...)` statement. */
function insertedValues(statement: Statement): Record<string, unknown> {
  const match = /insert into "\w+" \(([^)]*)\) values \((.*?)\) on conflict/i.exec(statement.text);
  expect(match, statement.text).not.toBeNull();
  const columns = (match as RegExpExecArray)[1]!.split(",").map((c) => c.trim().replace(/"/g, ""));
  const tokens = (match as RegExpExecArray)[2]!.split(",").map((t) => t.trim());
  const out: Record<string, unknown> = {};
  columns.forEach((column, i) => {
    const token = tokens[i] ?? "";
    out[column] = token.startsWith("$") ? statement.params[Number(token.slice(1)) - 1] : token;
  });
  return out;
}

function request(query: string, auth: string | null = `Bearer ${SECRET}`): Request {
  const headers = new Headers();
  if (auth !== null) headers.set("authorization", auth);
  return new Request(`https://aipowerranking.com/api/cron/collect-metrics${query}`, { headers });
}

function foundAdapter(metrics: Record<string, unknown>) {
  return { init: async () => {}, collect: async () => ({ kind: "found", metrics }), pause: async () => {} };
}

const original = { cron: process.env["CRON_SECRET"], webhook: process.env["ALERT_WEBHOOK_URL"] };
function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

beforeEach(() => {
  statements = [];
  failOn = null;
  alerts = [];
  mocks.getDb.mockReset().mockImplementation(() => fakeDb());
  mocks.createAdapter.mockReset().mockImplementation(() => foundAdapter({ stars: 5, forks: 1 }));
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

describe("#95 collect-metrics auth and parameters", () => {
  it.each([
    ["no header", null],
    ["wrong bearer", "Bearer not-the-secret"],
  ])("returns 401 and alerts for %s, touching no database", async (_name, auth) => {
    const response = await GET(request("?part=github&shard=0&of=1", auth));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ success: false, error: "Unauthorized" });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.["text"]).toBe("[CRON FAILURE] /api/cron/collect-metrics");
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.createAdapter).not.toHaveBeenCalled();
  });

  it.each([
    ["unknown part", "?part=cargo&shard=0&of=1"],
    ["missing part", "?shard=0&of=1"],
    ["shard out of range", "?part=npm&shard=4&of=4"],
    ["negative shard", "?part=npm&shard=-1&of=4"],
    ["fractional shard", "?part=npm&shard=1.5&of=4"],
    ["missing shard", "?part=npm&of=4"],
    ["of not the configured count", "?part=npm&shard=0&of=3"],
    ["missing of", "?part=pypi&shard=0"],
  ])("returns 400 for %s", async (_name, query) => {
    const response = await GET(request(query));

    expect(response.status).toBe(400);
    expect((await response.json()).success).toBe(false);
    expect(alerts).toHaveLength(1);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});

describe("#95 collect-metrics writes", () => {
  it("records every tool, answers 200, and its counts match the ledger row", async () => {
    const response = await GET(request("?part=github&shard=0&of=1"));
    const body = await response.json();

    expect(mocks.getDb).toHaveBeenCalledTimes(1);
    expect(mocks.createAdapter).toHaveBeenCalledWith("github", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, status: "ok", part: "github", shard: 0, of: 1, ledger_recorded: true });
    expect(body.counts).toEqual({ attempted: 3, recorded: 3, flagged: 0, not_found: 0, failed: 0, skipped_timeout: 0 });
    expect(alerts).toHaveLength(0);

    const ledger = statements.filter((s) => /^insert into "metrics_collection_runs"/i.test(s.text));
    expect(ledger).toHaveLength(1);
    expect(insertedValues(ledger[0] as Statement)).toMatchObject({
      collected_date: body.collected_date,
      collector: "github",
      shard: 0,
      shard_count: 1,
      status: "ok",
      attempted: 3,
      recorded: 3,
      flagged: 0,
      not_found: 0,
      failed: 0,
      skipped_timeout: 0,
    });
  });

  it("upserts with an atomic jsonb merge on (tool_id, collected_date)", async () => {
    await GET(request("?part=github&shard=0&of=1"));

    const upserts = statements.filter((s) => /^insert into "tool_metrics_history"/i.test(s.text));
    expect(upserts).toHaveLength(3);
    for (const upsert of upserts) {
      expect(upsert.text).toContain(
        'on conflict ("tool_id","collected_date") do update set "tool_slug" = excluded."tool_slug", "metrics" = "tool_metrics_history"."metrics" || excluded."metrics"'
      );
    }
    const row = insertedValues(upserts[0] as Statement);
    expect(row["tool_id"]).toBe("id-alpha");
    expect(JSON.parse(String(row["metrics"]))).toEqual({
      github: {
        stars: { value: 5, source: "github-api", as_of: expect.any(String) },
        forks: { value: 1, source: "github-api", as_of: expect.any(String) },
      },
    });
  });

  it("never writes the tools table: its only statement on tools is one SELECT", async () => {
    await GET(request("?part=github&shard=0&of=1"));

    expect(statements.length).toBeGreaterThan(0);
    const onTools = statements.filter((s) => /"tools"/.test(s.text));
    expect(onTools).toHaveLength(1);
    expect(onTools[0]?.text).toMatch(/^select "id", "slug", "name", "data" from "tools"$/);
    for (const s of statements) {
      expect(s.text).not.toMatch(/^\s*(update|delete|truncate)\b/i);
      expect(s.text).toMatch(/^(select .* from "tools"|insert into "(tool_metrics_history|metrics_collection_runs)")/i);
    }
  });

  it("a database throw answers 500 and alerts, and still tries the ledger", async () => {
    failOn = /^insert into "tool_metrics_history"/i;
    const response = await GET(request("?part=github&shard=0&of=1"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.status).toBe("failed");
    expect(body.counts).toMatchObject({ attempted: 3, recorded: 0, failed: 3 });
    expect(alerts).toHaveLength(1);
    const ledger = statements.find((s) => /^insert into "metrics_collection_runs"/i.test(s.text));
    expect(insertedValues(ledger as Statement)["status"]).toBe("failed");
  });

  it.each([
    ["the tools read throws", /^select/i],
    ["the ledger write throws", /^insert into "metrics_collection_runs"/i],
    ["every statement throws", /./],
  ])("answers 500 and alerts when %s", async (_name, pattern) => {
    failOn = pattern;
    const response = await GET(request("?part=github&shard=0&of=1"));

    expect(response.status).toBe(500);
    expect((await response.json()).success).toBe(false);
    expect(alerts).toHaveLength(1);
  });

  it("answers 500 and alerts when no database connection is available", async () => {
    mocks.getDb.mockReturnValue(null);
    const response = await GET(request("?part=github&shard=0&of=1"));

    expect(response.status).toBe(500);
    expect(alerts).toHaveLength(1);
    expect(mocks.createAdapter).not.toHaveBeenCalled();
  });

  it("a string in a numeric key is stored flagged and counted", async () => {
    mocks.createAdapter.mockImplementation(() => foundAdapter({ stars: "1.2k" }));
    const response = await GET(request("?part=github&shard=0&of=1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.counts).toMatchObject({ recorded: 3, flagged: 3 });
    const upsert = statements.find((s) => /^insert into "tool_metrics_history"/i.test(s.text));
    const metrics = JSON.parse(String(insertedValues(upsert as Statement)["metrics"]));
    expect(metrics.github.stars).toMatchObject({ value: "1.2k", flags: ["non_numeric"] });
  });

  it("past the deadline it answers 500 with status partial and skipped_timeout > 0", async () => {
    let fakeNow = Date.UTC(2026, 10, 1, 1, 0, 0);
    vi.spyOn(Date, "now").mockImplementation(() => fakeNow);
    mocks.createAdapter.mockImplementation(() => ({
      init: async () => {},
      collect: async () => {
        fakeNow += 200_000;
        return { kind: "found", metrics: { stars: 1 } };
      },
      pause: async () => {},
    }));

    const response = await GET(request("?part=github&shard=0&of=1"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.status).toBe("partial");
    expect(body.counts.skipped_timeout).toBeGreaterThan(0);
    expect(body.counts.recorded + body.counts.skipped_timeout).toBe(body.counts.attempted);
    expect(alerts).toHaveLength(1);
  });
});
