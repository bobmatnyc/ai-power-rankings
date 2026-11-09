/**
 * Crawl spend section (#393): per-provider spend from the usage ledger.
 *
 * Why: the section must sum estimated cost per provider, never count a call
 *   with no price as $0, and stay admin-only and uncached.
 * What: the route runs through the real `requireAdmin()` (Clerk's `auth` and
 *   `currentUser` replaced, as in `crawl-monitor-325.test.ts`) and its real
 *   grouped SQL on PGlite, with `provider_usage_events` created by migration
 *   0029. `summarizeProviderSpend` and the display text are tested directly.
 * Test: `npx vitest run tests/unit/crawl-spend-393.test.ts`. No server, no network.
 */

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));
const holder = vi.hoisted(() => ({ db: null as unknown, getDbCalls: 0 }));

vi.mock("@clerk/nextjs/server", () => clerk);
vi.mock("../../lib/db/connection", () => ({
  getDb: () => {
    holder.getDbCalls += 1;
    return holder.db;
  },
}));

import * as spendRoute from "../../app/api/admin/crawl-monitor/spend/route";
import {
  type SpendBucket,
  type SpendDayRow,
  priceFlags,
  spendCostText,
  spendDetailText,
  summarizeProviderSpend,
} from "../../lib/crawl-monitor/spend";

vi.setConfig({ testTimeout: 60_000 });

const ANONYMOUS = [{ userId: null }, null] as const;
const NON_ADMIN = [{ userId: "user_1" }, { id: "user_1", privateMetadata: {} }] as const;
const ADMIN = [{ userId: "user_1" }, { id: "user_1", privateMetadata: { isAdmin: true } }] as const;

function signIn([session, user]: readonly [unknown, unknown]) {
  clerk.auth.mockResolvedValue(session);
  clerk.currentUser.mockResolvedValue(user);
}

const NOW = new Date("2030-03-15T12:00:00Z");

// Synthetic values only.
const SECRET_VALUES = {
  TAVILY_API_KEY: "synthetic-tv-value-1111",
  JINA_API_KEY: "synthetic-jn-value-2222",
  TAVILY_USD_PER_CREDIT: "0.0081",
};

const MIGRATION_0029 = readFileSync("lib/db/migrations/0029_create_provider_usage_events.sql", "utf8");

/** A PGlite database with the 0029 ledger table (and the run table its FK names). */
async function ledgerDb(): Promise<PGlite> {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE "automated_ingestion_runs" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL);`);
  for (const statement of MIGRATION_0029.split("--> statement-breakpoint")) {
    if (statement.replace(/--.*$/gm, "").trim()) await pg.exec(statement);
  }
  return pg;
}

type LedgerRow = {
  at: string;
  provider: string;
  operation?: string;
  units?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  reported?: string | null;
  estimated?: string | null;
};

async function insert(pg: PGlite, rows: LedgerRow[]) {
  for (const r of rows) {
    await pg.query(
      `INSERT INTO provider_usage_events
         (created_at, provider, operation, units, input_tokens, output_tokens, reported_cost_usd, estimated_cost_usd)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [r.at, r.provider, r.operation ?? "search", r.units ?? null, r.inputTokens ?? null, r.outputTokens ?? null, r.reported ?? null, r.estimated ?? null]
    );
  }
}

// Today is 2030-03-15 UTC. 23:30 on the 14th in New York is the 15th in UTC.
const LEDGER: LedgerRow[] = [
  // Tavily: priced today and earlier this month, one unpriced call today.
  { at: "2030-03-15T01:00:00Z", provider: "tavily", units: "2.0000", estimated: "0.016200" },
  { at: "2030-03-15T02:00:00Z", provider: "tavily", units: "1.0000", estimated: null },
  { at: "2030-03-02T00:00:00Z", provider: "tavily", units: "1.0000", estimated: "0.008100" },
  // Jina: no price set, so no row has a cost.
  { at: "2030-03-15T03:00:00Z", provider: "jina", operation: "read", units: "1500.0000", estimated: null },
  { at: "2030-02-20T03:00:00Z", provider: "jina", operation: "read", units: "500.0000", estimated: null },
  // Brave: last month only.
  { at: "2030-02-28T23:59:59Z", provider: "brave", units: "1.0000", estimated: "0.005000" },
  // OpenRouter: reported cost wins over the estimate; tokens stand in for units.
  {
    at: "2030-03-15T04:00:00Z",
    provider: "openrouter",
    operation: "article_quality",
    inputTokens: 1000,
    outputTokens: 200,
    reported: "0.100000",
    estimated: "0.900000",
  },
  {
    at: "2030-03-14T23:59:59-00:00",
    provider: "openrouter",
    operation: "article_quality",
    inputTokens: 10,
    outputTokens: 5,
    estimated: "0.200000",
  },
];

let pg: PGlite | null = null;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  // requireAdmin() treats missing Clerk keys as "auth disabled"; runtime-only stubs.
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("NEXT_PUBLIC_DISABLE_AUTH", "");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_stub");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_stub");
  vi.stubEnv("DATABASE_URL", "postgresql://u:pw@db.example.test/stubdb");
  for (const [name, value] of Object.entries(SECRET_VALUES)) vi.stubEnv(name, value);
  vi.stubEnv("JINA_USD_PER_MTOKEN", "");
  vi.stubEnv("BRAVE_USD_PER_1K_REQUESTS", "");
  vi.stubEnv("OPENROUTER_INPUT_USD_PER_MTOKEN", "");
  vi.stubEnv("OPENROUTER_OUTPUT_USD_PER_MTOKEN", "");
  holder.getDbCalls = 0;
  pg = await ledgerDb();
  await insert(pg, LEDGER);
  holder.db = drizzle(pg);
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  await pg?.close();
  pg = null;
});

type ProviderJson = { provider: string; priceConfigured: boolean | null; today: SpendBucket; month: SpendBucket; allTime: SpendBucket };

async function adminSpend() {
  signIn(ADMIN);
  const res = await spendRoute.GET();
  return { res, body: await res.json() };
}

describe("GET /api/admin/crawl-monitor/spend auth and caching", () => {
  it("returns 401 to an anonymous caller, with no-store and no DB read", async () => {
    signIn(ANONYMOUS);
    const res = await spendRoute.GET();
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(holder.getDbCalls).toBe(0);
  });

  it("returns 403 to a signed-in non-admin, with no-store and no DB read", async () => {
    signIn(NON_ADMIN);
    const res = await spendRoute.GET();
    expect(res.status).toBe(403);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(holder.getDbCalls).toBe(0);
  });

  it("returns 200 to an admin with no-store, and the route is dynamic", async () => {
    const { res, body } = await adminSpend();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(body.success).toBe(true);
    expect(spendRoute.dynamic).toBe("force-dynamic");
  });

  it("returns 500 with a fixed message and no driver text when the ledger read fails", async () => {
    await pg!.exec("DROP TABLE provider_usage_events");
    const { res, body } = await adminSpend();
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({ success: false, error: "Failed to load crawl spend" });
  });

  it("names no env variable, key, value, table or connection detail", async () => {
    const { body } = await adminSpend();
    const text = JSON.stringify(body);
    for (const leak of [
      ...Object.values(SECRET_VALUES),
      "_USD_PER_",
      "API_KEY",
      "provider_usage_events",
      "example.test",
      "stubdb",
      "postgresql",
    ]) {
      expect(text).not.toContain(leak);
    }
  });
});

describe("GET /api/admin/crawl-monitor/spend aggregation on PGlite", () => {
  it("sums priced calls only and reports unpriced calls beside each sum", async () => {
    const { body } = await adminSpend();
    const providers = body.data.providers as ProviderJson[];
    const by = (name: string) => providers.find((p) => p.provider === name)!;
    expect(providers.map((p) => p.provider)).toEqual(["openrouter", "tavily", "jina", "brave"]);

    expect(by("tavily").today).toEqual({ calls: 2, pricedCalls: 1, unpricedCalls: 1, reportedCalls: 0, costUsd: 0.0162, units: 3 });
    expect(by("tavily").month).toMatchObject({ calls: 3, unpricedCalls: 1, costUsd: 0.0243, units: 4 });
    expect(by("tavily").priceConfigured).toBe(true);

    // No Jina row has a cost: null, never 0.
    expect(by("jina").allTime).toEqual({ calls: 2, pricedCalls: 0, unpricedCalls: 2, reportedCalls: 0, costUsd: null, units: 2000 });
    expect(by("jina").priceConfigured).toBe(false);

    // Brave's only call is in February: none today or this month.
    expect(by("brave").month).toEqual({ calls: 0, pricedCalls: 0, unpricedCalls: 0, reportedCalls: 0, costUsd: null, units: null });
    expect(by("brave").allTime).toMatchObject({ calls: 1, costUsd: 0.005 });

    // The reported 0.10 wins over the 0.90 estimate; the 14th's call is outside today (UTC).
    expect(by("openrouter").today).toEqual({ calls: 1, pricedCalls: 1, unpricedCalls: 0, reportedCalls: 1, costUsd: 0.1, units: 1200 });
    expect(by("openrouter").month).toMatchObject({ calls: 2, reportedCalls: 1, costUsd: 0.3, units: 1215 });
  });

  it("totals add priced calls across providers and count every unpriced call", async () => {
    const { body } = await adminSpend();
    expect(body.data.totals.today).toEqual({ calls: 4, pricedCalls: 2, unpricedCalls: 2, reportedCalls: 1, costUsd: 0.1162, units: null });
    expect(body.data.totals.allTime).toEqual({ calls: 8, pricedCalls: 5, unpricedCalls: 3, reportedCalls: 1, costUsd: 0.3293, units: null });
  });

  it("an empty ledger lists every provider with no calls and no cost", async () => {
    await pg!.exec("DELETE FROM provider_usage_events");
    const { body } = await adminSpend();
    expect(body.data.totals.allTime).toEqual({ calls: 0, pricedCalls: 0, unpricedCalls: 0, reportedCalls: 0, costUsd: null, units: null });
    expect((body.data.providers as ProviderJson[]).every((p) => p.allTime.calls === 0 && p.allTime.costUsd === null)).toBe(true);
  });
});

describe("summarizeProviderSpend", () => {
  const day = (provider: string, d: string | null, calls: number, priced: number, cost: string | null): SpendDayRow => ({
    provider,
    day: d,
    calls: String(calls),
    pricedCalls: String(priced),
    reportedCalls: "0",
    costUsd: cost,
    units: null,
  });
  const flags = { openrouter: false, tavily: true, jina: false, brave: false };

  it("keeps a bucket's cost null when none of its calls is priced, even with a stray cost", () => {
    const out = summarizeProviderSpend([day("brave", "2030-03-15", 3, 0, "9.99")], NOW, flags);
    expect(out.totals.today).toMatchObject({ calls: 3, unpricedCalls: 3, costUsd: null });
  });

  it("sums six-decimal costs without float drift", () => {
    const out = summarizeProviderSpend(
      [day("tavily", "2030-03-15", 1, 1, "0.100000"), day("tavily", "2030-03-15", 1, 1, "0.200000")],
      NOW,
      flags
    );
    expect(out.totals.today.costUsd).toBe(0.3);
  });

  it("clamps priced calls to calls and keeps the window order", () => {
    const out = summarizeProviderSpend(
      [day("tavily", "2030-03-15", 1, 5, "0.5"), day("tavily", "2030-03-01", 2, 2, "1"), day("tavily", null, 1, 1, "2")],
      NOW,
      flags
    );
    const t = out.providers.find((p) => p.provider === "tavily")!;
    expect(t.today).toMatchObject({ calls: 1, pricedCalls: 1, unpricedCalls: 0 });
    expect(t.month.calls).toBe(3);
    expect(t.allTime).toMatchObject({ calls: 4, costUsd: 3.5 });
  });

  it("groups an unsafe provider value as other with no price flag", () => {
    const out = summarizeProviderSpend([day("<script>", "2030-03-15", 1, 0, null)], NOW, flags);
    expect(out.providers.at(-1)).toMatchObject({ provider: "other", label: "other", priceConfigured: null });
  });

  it("priceFlags reports usable prices only, as booleans", () => {
    const f = priceFlags({ TAVILY_USD_PER_CREDIT: "0.008", JINA_USD_PER_MTOKEN: "abc", BRAVE_USD_PER_1K_REQUESTS: " " } as NodeJS.ProcessEnv);
    expect(f).toEqual({ openrouter: false, tavily: true, jina: false, brave: false });
  });
});

describe("spend display text", () => {
  const bucket = (b: Partial<SpendBucket>): SpendBucket => ({
    calls: 0,
    pricedCalls: 0,
    unpricedCalls: 0,
    reportedCalls: 0,
    costUsd: null,
    units: null,
    ...b,
  });

  it.each([
    [bucket({}), "no calls"],
    [bucket({ calls: 2, unpricedCalls: 2 }), "not priced"],
    [bucket({ calls: 1, pricedCalls: 1, costUsd: 0 }), "$0.0000"],
    [bucket({ calls: 1, pricedCalls: 1, costUsd: 0.00004 }), "<$0.0001"],
    [bucket({ calls: 3, pricedCalls: 2, unpricedCalls: 1, costUsd: 0.0243 }), "$0.0243"],
  ])("spendCostText case %# reads its expected text", (b, text) => {
    expect(spendCostText(b)).toBe(text);
  });

  it("an unpriced call never reads as $0", () => {
    expect(spendCostText(bucket({ calls: 5, unpricedCalls: 5 }))).not.toMatch(/\$/);
  });

  it("a partial sum names the calls it leaves out", () => {
    expect(spendDetailText(bucket({ calls: 3, pricedCalls: 2, unpricedCalls: 1, units: 4 }), "credits")).toBe(
      "3 calls · 4 credits · 1 not priced, not in the sum"
    );
  });

  it("the section issues GET requests only, to the admin route", () => {
    const src = readFileSync("app/[lang]/(authenticated)/admin/crawl-monitor/crawl-spend-section.tsx", "utf8");
    expect(src).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)/i);
    expect(src).toContain('"/api/admin/crawl-monitor/spend"');
  });
});
