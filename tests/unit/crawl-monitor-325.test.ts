import { readFileSync } from "node:fs";
import { getTableName, type Table } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Crawl monitor (#325): admin gate, no secrets, no caching, read-only, and the
 * estimated-spend aggregation.
 *
 * Why: the admin layout checks sign-in only, and the monitor reads tables that
 * hold provider error text and per-candidate scores.
 * What: the two GET routes run through the real `requireAdmin()` with Clerk's
 * `auth`/`currentUser` replaced (as `admin-api-auth.test.ts` does) and a fake
 * select-only database fed synthetic rows. The page is checked the way
 * `admin-page-debug-routes-auth.test.ts` checks the admin dashboard page.
 * Test: `npx vitest run tests/unit/crawl-monitor-325.test.ts`. No database, no network.
 */

const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));
const dbState = vi.hoisted(() => ({
  rows: {} as Record<string, unknown[]>,
  getDb: vi.fn(),
  /** Limits passed to `.limit()`, keyed by table name. */
  limits: {} as Record<string, number[]>,
  /** When set, every query rejects with it. */
  failWith: null as Error | null,
}));
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  })
);

vi.mock("@clerk/nextjs/server", () => clerk);
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("../../app/[lang]/(authenticated)/admin/crawl-monitor/crawl-monitor-client", () => ({
  default: () => null,
}));
vi.mock("../../lib/db/connection", () => ({ getDb: dbState.getDb }));

import CrawlMonitorPage from "../../app/[lang]/(authenticated)/admin/crawl-monitor/page";
import * as overviewRoute from "../../app/api/admin/crawl-monitor/overview/route";
import * as runsRoute from "../../app/api/admin/crawl-monitor/runs/route";
import {
  bucketCandidateOutcomes,
  providerFlags,
  sanitizeErrorText,
  sumEstimatedCostUsd,
  summarizeRunWindows,
  summarizeSpend,
  jobStatusByRunType,
  type RunCostRow,
} from "../../lib/crawl-monitor/aggregate";

/** A select-only Drizzle stand-in: `select().from(t)...` resolves to the rows staged for `t`. */
function fakeDb() {
  return {
    select: () => ({
      from: (table: Table) => {
        const name = getTableName(table);
        const rows = dbState.rows[name] ?? [];
        const chain = {
          where: () => chain,
          orderBy: () => chain,
          limit: (n: number) => {
            (dbState.limits[name] ??= []).push(n);
            return chain;
          },
          then: (resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) =>
            (dbState.failWith ? Promise.reject(dbState.failWith) : Promise.resolve(rows)).then(resolve, reject),
        };
        return chain;
      },
    }),
  };
}

const ANONYMOUS = [{ userId: null }, null] as const;
const NON_ADMIN = [{ userId: "user_1" }, { id: "user_1", privateMetadata: {} }] as const;
const ADMIN = [{ userId: "user_1" }, { id: "user_1", privateMetadata: { isAdmin: true } }] as const;

function signIn([session, user]: readonly [unknown, unknown]) {
  clerk.auth.mockResolvedValue(session);
  clerk.currentUser.mockResolvedValue(user);
}

const NOW = new Date("2030-03-15T12:00:00Z");

// Synthetic values only: no real tool names, scores, hosts or ids.
const SECRET_VALUES = {
  OPENROUTER_API_KEY: "synthetic-or-value-0000",
  TAVILY_API_KEY: "synthetic-tv-value-1111",
  JINA_API_KEY: "synthetic-jn-value-2222",
  ALERT_WEBHOOK_URL: "https://hooks.example.test/synthetic",
};

function stageRows() {
  dbState.rows = {
    automated_ingestion_runs: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        runType: "daily_news",
        status: "completed",
        createdAt: new Date("2030-03-15T06:00:00Z"),
        startedAt: new Date("2030-03-15T06:00:00Z"),
        completedAt: new Date("2030-03-15T06:02:30Z"),
        articlesDiscovered: 5,
        articlesPassedQuality: 2,
        articlesIngested: 1,
        articlesSkipped: 1,
        articlesSkippedSemantic: 0,
        articlesSkippedStale: 1,
        rankingChanges: 0,
        searchQuery: "synthetic query text",
        ingestedArticleIds: ["synthetic-article-id"],
        errorLog: ["Provider error at https://api.example.test/v1 with token abcdefghijklmnopqrstuvwxyz0123"],
        candidateOutcomes: [
          { url: "https://news.example.test/a", title: "Synthetic Title A", outcome: "ingested" },
          {
            url: "https://news.example.test/b",
            title: "Synthetic Title B",
            outcome: "quality_rejected",
            averageScore: 4.5,
            relevanceScore: 3,
            reason: "synthetic reason",
          },
        ],
        estimatedCostUsd: "0.0125",
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        runType: "daily_news",
        status: "failed",
        createdAt: new Date("2030-03-10T06:00:00Z"),
        startedAt: new Date("2030-03-10T06:00:00Z"),
        completedAt: null,
        articlesDiscovered: 0,
        errorLog: [],
        candidateOutcomes: [],
        estimatedCostUsd: null,
      },
    ],
    monthly_summaries: [{ generatedAt: new Date("2030-03-15T06:05:00Z") }],
    state_of_ai_summaries: [
      {
        month: 3,
        year: 2030,
        generatedAt: new Date("2030-03-01T08:00:00Z"),
        metadata: { cost_usd: 0.02, model: "synthetic/model", prompt_tokens: 10 },
      },
    ],
  };
}

beforeEach(() => {
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
  vi.stubEnv("BRAVE_SEARCH_API_KEY", "");
  dbState.getDb.mockImplementation(() => fakeDb());
  dbState.limits = {};
  dbState.failWith = null;
  stageRows();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const ROUTES: Array<[string, () => Promise<Response>]> = [
  ["GET /api/admin/crawl-monitor/overview", () => overviewRoute.GET()],
  [
    "GET /api/admin/crawl-monitor/runs",
    () => runsRoute.GET(new NextRequest("http://localhost/api/admin/crawl-monitor/runs?limit=5")),
  ],
];

const SECRET_KEY_NAME = /key|secret|token|password|credential|endpoint|host|url|dsn|connection|database/i;

function allKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      allKeys(v, out);
    }
  }
  return out;
}

describe("crawl monitor routes require an admin", () => {
  it.each(ROUTES)("%s returns 401 for an anonymous caller, uncached, without a DB read", async (_n, call) => {
    signIn(ANONYMOUS);
    const res = await call();
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(dbState.getDb).not.toHaveBeenCalled();
  });

  it.each(ROUTES)("%s returns 403 for a signed-in non-admin without a DB read", async (_n, call) => {
    signIn(NON_ADMIN);
    const res = await call();
    expect(res.status).toBe(403);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(dbState.getDb).not.toHaveBeenCalled();
  });

  it.each(ROUTES)("%s returns 200 for an admin with no-store", async (_n, call) => {
    signIn(ADMIN);
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect((await res.json()).success).toBe(true);
  });

  it.each(ROUTES)("%s returns no secret-named fields and no secret or scored values", async (_n, call) => {
    signIn(ADMIN);
    const body = await (await call()).json();
    const keys = allKeys(body);
    expect(keys.filter((k) => SECRET_KEY_NAME.test(k))).toEqual([]);
    expect(keys).not.toContain("averageScore");
    expect(keys).not.toContain("relevanceScore");
    const text = JSON.stringify(body);
    for (const value of [...Object.values(SECRET_VALUES), "db.example.test", "example.test", "Synthetic Title", "synthetic query", "abcdefghijklmnopqrstuvwxyz"]) {
      expect(text).not.toContain(value);
    }
  });

  it("both routes are dynamic", () => {
    expect(overviewRoute.dynamic).toBe("force-dynamic");
    expect(runsRoute.dynamic).toBe("force-dynamic");
  });

  it("runs rejects an unknown status filter", async () => {
    signIn(ADMIN);
    const res = await runsRoute.GET(new NextRequest("http://localhost/api/admin/crawl-monitor/runs?status=x"));
    expect(res.status).toBe(400);
  });
});

describe("crawl monitor overview content", () => {
  it("reports windows, estimated spend, jobs and provider flags", async () => {
    signIn(ADMIN);
    const { data } = await (await overviewRoute.GET()).json();
    expect(data.runWindows.today).toEqual({ runs: 1, failures: 0 });
    expect(data.runWindows.last7Days).toEqual({ runs: 2, failures: 1 });
    expect(data.estimatedSpend).toEqual({ todayUsd: 0.0125, monthUsd: 0.0125, allTimeUsd: 0.0125, runsWithoutCost: 1 });
    const daily = data.jobs.find((j: { job: string }) => j.job === "Ingestion: daily_news");
    expect(daily).toMatchObject({ lastSuccessAt: "2030-03-15T06:00:00.000Z", stale: false });
    expect(data.stateOfAi).toEqual({ period: "2030-03", estimatedCostUsd: 0.02 });
    expect(data.providers).toContainEqual({ name: "Brave (search fallback)", configured: false });
    expect(data.providers).toContainEqual({ name: "OpenRouter (LLM)", configured: true });
  });

  it("shows run quality only as outcome counts and score buckets", async () => {
    signIn(ADMIN);
    const { data } = await (await runsRoute.GET(new NextRequest("http://localhost/api/admin/crawl-monitor/runs"))).json();
    expect(data[0].outcomeCounts).toEqual({ ingested: 1, quality_rejected: 1 });
    expect(data[0].rejectedScoreBuckets["4-6"]).toBe(1);
    expect(data[0].durationMs).toBe(150_000);
    expect(data[0].errors[0]).toContain("[url]");
  });
});

describe("crawl monitor page", () => {
  async function render(): Promise<string | null> {
    try {
      await CrawlMonitorPage({ params: Promise.resolve({ lang: "en" }) });
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("REDIRECT:")) return message.slice("REDIRECT:".length);
      throw error;
    }
  }

  it("redirects anonymous to sign-in and a non-admin to unauthorized", async () => {
    signIn(ANONYMOUS);
    expect(await render()).toBe("/en/sign-in");
    signIn(NON_ADMIN);
    expect(await render()).toBe("/en/unauthorized");
    expect(dbState.getDb).not.toHaveBeenCalled();
  });

  it("renders for an admin", async () => {
    signIn(ADMIN);
    expect(await render()).toBeNull();
  });

  it("client issues GET requests only and reuses no DB status banner", () => {
    const src = readFileSync("app/[lang]/(authenticated)/admin/crawl-monitor/crawl-monitor-client.tsx", "utf8");
    expect(src).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)/i);
    expect(src).not.toMatch(/db-status|DatabaseStatus|unified-admin-dashboard/);
  });
});

describe("estimated-spend aggregation", () => {
  const row = (createdAt: string, cost: string | null, status = "completed"): RunCostRow => ({
    runType: "daily_news",
    status,
    createdAt,
    estimatedCostUsd: cost,
  });

  it("sumEstimatedCostUsd: empty is zero; nulls and junk add nothing; decimals do not drift", () => {
    expect(sumEstimatedCostUsd([])).toBe(0);
    expect(sumEstimatedCostUsd([null, undefined, "", "abc", "-1"])).toBe(0);
    expect(sumEstimatedCostUsd(["0.1", null, "0.2"])).toBe(0.3);
    expect(sumEstimatedCostUsd(["0.0001", 0.0002, "1.2345"])).toBe(1.2348);
  });

  it("summarizeSpend on an empty table is all zero", () => {
    expect(summarizeSpend([], NOW)).toEqual({ todayUsd: 0, monthUsd: 0, allTimeUsd: 0, runsWithoutCost: 0 });
  });

  it("summarizeSpend buckets by UTC day and month and counts null costs", () => {
    const rows = [
      row("2030-03-15T00:00:00Z", "0.5000"),
      row("2030-03-14T23:59:59Z", "0.2500"),
      row("2030-02-28T23:59:59Z", "1.0000"),
      row("2030-03-15T01:00:00Z", null),
    ];
    expect(summarizeSpend(rows, NOW)).toEqual({ todayUsd: 0.5, monthUsd: 0.75, allTimeUsd: 1.75, runsWithoutCost: 1 });
  });

  it("summarizeRunWindows counts runs and failures per window", () => {
    const rows = [row("2030-03-15T06:00:00Z", "0", "failed"), row("2030-03-01T06:00:00Z", "0"), row("2029-01-01T00:00:00Z", "0", "failed")];
    expect(summarizeRunWindows(rows, NOW)).toEqual({
      today: { runs: 1, failures: 1 },
      last7Days: { runs: 1, failures: 1 },
      last30Days: { runs: 2, failures: 1 },
    });
  });

  it("jobStatusByRunType flags daily_news stale without a success in 26h", () => {
    const [daily] = jobStatusByRunType([row("2030-03-13T06:00:00Z", "0"), row("2030-03-15T06:00:00Z", "0", "failed")], NOW);
    expect(daily).toMatchObject({ lastStatus: "failed", lastSuccessAt: "2030-03-13T06:00:00.000Z", stale: true });
    expect(jobStatusByRunType([], NOW)[0]).toMatchObject({ job: "Ingestion: daily_news", stale: true });
  });
});

describe("crawl monitor error branches", () => {
  const runsReq = (query: string) => runsRoute.GET(new NextRequest(`http://localhost/api/admin/crawl-monitor/runs${query}`));

  it.each(ROUTES)("%s returns 500 with a fixed message and no driver text when the query throws", async (_n, call) => {
    signIn(ADMIN);
    dbState.failWith = new Error('connect ECONNREFUSED db.example.test:5432 relation "x" driver detail');
    const res = await call();
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const text = JSON.stringify(await res.json());
    expect(text).toMatch(/"error":"Failed to load crawl (overview|runs)"/);
    expect(text).not.toMatch(/example\.test|ECONNREFUSED|5432|driver/);
  });

  it.each(ROUTES)("%s returns 503 with no-store when getDb() is null", async (_n, call) => {
    signIn(ADMIN);
    dbState.getDb.mockImplementation(() => null);
    const res = await call();
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each([
    ["?limit=1000", 100],
    ["?limit=0", 1],
    ["?limit=abc", 20],
    ["", 20],
  ])("runs%s reaches the query as limit %d", async (query, expected) => {
    signIn(ADMIN);
    expect((await runsReq(query)).status).toBe(200);
    expect(dbState.limits["automated_ingestion_runs"]).toEqual([expected]);
  });

  it.each(["?runType=DROP%20TABLE", "?status=deleted"])("runs%s returns 400 with no-store and no DB read", async (query) => {
    signIn(ADMIN);
    const res = await runsReq(query);
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(dbState.getDb).not.toHaveBeenCalled();
  });
});

describe("sanitising helpers", () => {
  // #325 fix round: the critic's probe strings, plus the raw inputs that produced them.
  it.each([
    ["owner bob.smith@[host] hit quota", ["bob", "smith"]],
    ["owner bob.smith@mail.example.test hit quota", ["bob", "smith", "example"]],
    ["Failed to ingest [host]/2030/03/cursor-raises-series-c: 500", ["2030", "cursor", "series"]],
    ["Failed to ingest news.example.test/2030/03/cursor-raises-series-c: 500", ["2030", "cursor", "series", "example"]],
    ["Key tvly-dev-AbC/dEf+GhIjKlMnOpQrStUv rejected", ["tvly", "AbC", "dEf", "GhIj", "StUv"]],
    ["Incorrect API key: sk-or-v1-****abcd", ["sk-", "v1", "abcd", "****"]],
    ["auth header Bearer syntheticBearerValue0000 refused", ["syntheticBearer", "0000"]],
    ["used pk_test_c3ludGhldGlj and sk_live_c3ludGhldGlj and jina_c3ludGhldGlj", ["c3lud", "pk_", "sk_", "jina_"]],
    ["blob QUJDREVGR0hJSktMTU5PUA+/= here", ["QUJD", "+/="]],
  ])("sanitizeErrorText(%j) leaks none of its sensitive parts", (input, leaks) => {
    const out = sanitizeErrorText(input);
    for (const part of leaks) expect(out, out).not.toContain(part);
  });

  it("sanitizeErrorText keeps ordinary error words readable", () => {
    expect(sanitizeErrorText("Tavily API error: 402 Payment Required; rate limit exceeded, retry later")).toBe(
      "Tavily API error: 402 Payment Required; rate limit exceeded, retry later"
    );
    expect(sanitizeErrorText("Extraction failed: non-retryable-provider-error after timeout")).toBe(
      "Extraction failed: non-retryable-provider-error after timeout"
    );
    expect(sanitizeErrorText("Failed to ingest [host]/a/b: 500")).toBe("Failed to ingest [host] 500");
  });
  it("sanitizeErrorText removes URLs, hosts, endpoint ids and token-like strings", () => {
    const out = sanitizeErrorText(
      "connect to ep-synthetic-name-123 at db.region.example.test failed; see https://x.example.test/p?k=1 key sk_abcdefghijklmnopqrstuvwxyz"
    );
    expect(out).not.toMatch(/ep-synthetic|example\.test|abcdefghijklmnop/);
    expect(sanitizeErrorText("x".repeat(500)).length).toBeLessThanOrEqual(200);
  });

  it("bucketCandidateOutcomes ignores malformed entries", () => {
    const out = bucketCandidateOutcomes([null, 3, { outcome: "<b>" }, { outcome: "quality_rejected", averageScore: 9.9 }]);
    expect(out.outcomeCounts).toEqual({ quality_rejected: 1 });
    expect(out.rejectedScoreBuckets["8-10"]).toBe(1);
    expect(bucketCandidateOutcomes("not an array").outcomeCounts).toEqual({});
  });

  it("providerFlags reports presence only", () => {
    const flags = providerFlags({ OPENROUTER_API_KEY: "v", TAVILY_API_KEY: "  " } as NodeJS.ProcessEnv);
    expect(flags[0]).toEqual({ name: "OpenRouter (LLM)", configured: true });
    expect(flags[1]).toEqual({ name: "Tavily (search, extract)", configured: false });
    expect(JSON.stringify(flags)).not.toContain('"v"');
  });
});
