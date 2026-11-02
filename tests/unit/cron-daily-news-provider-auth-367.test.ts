/**
 * Provider auth failures must fail the run and never block a news site (issue #367).
 *
 * Why: On 2026-11-01 06:00Z every Tavily call answered 401 (invalid key). The run read
 * "401" out of the error text, permanently blocked techcrunch.com, wired.com and
 * arstechnica.com, skipped their later candidates as `blocked_domain`, and still ended
 * `completed` with 0 errors, so no alert fired.
 *
 * What: Drives the REAL GET handler, the REAL AutomatedIngestionService and the REAL
 * Tavily Search, Tavily Extract and Jina Reader clients. Only the boundaries are faked:
 * `fetch` (routed by host, so each provider answers on the wire as it did), the
 * database, Brave Search, the OpenRouter client, article ingestion and cache
 * invalidation. Arms: a Tavily 401 replay of the incident; a Jina 401; an OpenRouter
 * 401; and a news site's own 403, which still blocks its domain, for the TTL only.
 * Retry back-off runs on fake timers.
 *
 * Test: `npx vitest run tests/unit/cron-daily-news-provider-auth-367.test.ts`. No
 * network, no database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const RUN_ID = "run-367-fixture";

const mocks = vi.hoisted(() => {
  // The provider clients are module singletons that read their keys at import time.
  process.env["TAVILY_API_KEY"] = "tvly-fixture-key";
  process.env["JINA_API_KEY"] = "jina-fixture-key";
  const row: Record<string, unknown> = {};
  return {
    row,
    braveSearch: vi.fn(),
    openRouterGenerate: vi.fn(),
    ingestArticle: vi.fn(),
    resetRow(): void {
      for (const key of Object.keys(row)) delete row[key];
      Object.assign(row, { status: "running", completedAt: null, errorLog: null });
    },
  };
});

// Fake automated_ingestion_runs table — same shape as tests/unit/cron-daily-news-billing.test.ts.
vi.mock("../../lib/db/connection", () => ({
  getDb: () => ({
    execute: async () => ({ rows: [{ id: RUN_ID }] }),
    update: () => ({
      set: (data: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            Object.assign(mocks.row, data);
            return [{ id: RUN_ID, ...mocks.row }];
          },
        }),
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve([]),
          limit: () => Promise.resolve([{ status: mocks.row["status"] }]),
          then: (resolve: (value: unknown[]) => void) => resolve([]),
        }),
      }),
    }),
  }),
}));

vi.mock("../../lib/services/brave-search.service", () => ({
  BraveSearchService: class {
    isAvailable = (): boolean => true;
    searchAINews = mocks.braveSearch;
  },
}));

vi.mock("../../lib/services/openrouter.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/services/openrouter.service")>();
  return {
    OpenRouterError: actual.OpenRouterError,
    getOpenRouterService: () => ({ generate: mocks.openRouterGenerate }),
  };
});

vi.mock("../../lib/services/article-ingestion.service", () => ({
  ArticleIngestionService: class {
    ingestArticle = mocks.ingestArticle;
  },
}));

vi.mock("../../lib/cache/invalidation.service", () => ({
  invalidateArticleCache: vi.fn(async () => ({
    pathsRevalidated: [],
    tagsRevalidated: [],
    memoryCacheCleared: [],
    success: true,
  })),
}));

import { GET } from "../../app/api/cron/daily-news/route";
import { summarizeFailedFetches } from "../../lib/services/automated-ingestion.service";
import {
  AUTO_BLOCK_TTL_MS,
  getBlockedDomainsStats,
  isDomainBlocked,
} from "../../lib/services/blocked-domains.config";
import { OpenRouterError } from "../../lib/services/openrouter.service";

const SECRET = "cron-secret-fixture-value";
const originalCronSecret = process.env["CRON_SECRET"];

const TAVILY_401_BODY = '{"detail":{"error":"Unauthorized: missing or invalid API key."}}';
const ARTICLE_TEXT = "Editors and agents compete on latency and price in this fixture story. ".repeat(8);

type Answer = { status: number; body: string };
type FetchRoutes = { tavilySearch?: Answer; tavilyExtract?: Answer; jina?: Answer; site?: Answer };

const json = (value: unknown): string => JSON.stringify(value);

/** Routes every outbound request by host: Tavily, Jina, or the news site itself. */
function stubFetch(routes: FetchRoutes): void {
  const siteDefault: Answer = { status: 200, body: `<html><body><p>${ARTICLE_TEXT}</p></body></html>` };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      let answer: Answer | undefined;
      if (url.startsWith("https://api.tavily.com/search")) answer = routes.tavilySearch;
      else if (url.startsWith("https://api.tavily.com/extract")) answer = routes.tavilyExtract;
      else if (url.startsWith("https://r.jina.ai/")) answer = routes.jina;
      else answer = routes.site ?? siteDefault;
      if (!answer) throw new Error(`unrouted fetch in test: ${url}`);
      return new Response(answer.body, { status: answer.status });
    })
  );
}

/** Same-day candidates on unrelated topics, so semantic dedupe keeps every one. */
function candidates(hosts: string[]) {
  const topics = [
    "Cursor ships background agents for large monorepos",
    "Zed editor publishes latency benchmark results",
    "Sourcegraph Cody pricing overhaul announced",
  ];
  return hosts.map((host, i) => ({
    title: topics[i % topics.length]!,
    url: `https://${host}/story-${i}`,
    description: "Discovery fixture.",
    source: host,
    publishedDate: new Date().toISOString(),
  }));
}

/** A Tavily Search body whose results carry a short snippet, so extraction runs. */
function tavilySearchBody(hosts: string[], content = "short"): string {
  return json({
    results: candidates(hosts).map((c) => ({
      title: c.title,
      url: c.url,
      content,
      published_date: c.publishedDate,
      score: 0.9,
    })),
  });
}

function passingVerdict() {
  return {
    content: json({
      qualityScore: 9,
      relevanceScore: 9,
      credibilityScore: 9,
      reasoning: "Specific AI coding tool news",
      suggestedCategories: ["Product Launch"],
    }),
    metadata: { estimatedCost: 0.001 },
  };
}

function cronRequest(): Request {
  return new Request("https://aipowerranking.com/api/cron/daily-news", {
    method: "GET",
    headers: { authorization: `Bearer ${SECRET}` },
  });
}

interface RoutePayload {
  success: boolean;
  error?: string;
  data?: { status: string; errors: string[] };
}

/** Runs the route while advancing fake timers, so provider retry back-off elapses. */
async function runCron(): Promise<{ status: number; payload: RoutePayload }> {
  let settled = false;
  const pending = GET(cronRequest()).finally(() => {
    settled = true;
  });
  for (let step = 0; step < 200 && !settled; step++) {
    await vi.advanceTimersByTimeAsync(500);
  }
  const response = await pending;
  return { status: response.status, payload: (await response.json()) as RoutePayload };
}

describe("GET /api/cron/daily-news — provider auth errors (#367)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    mocks.resetRow();
    mocks.braveSearch.mockReset();
    mocks.openRouterGenerate.mockReset();
    mocks.ingestArticle.mockReset();
    mocks.openRouterGenerate.mockResolvedValue(passingVerdict());
    let nextId = 0;
    mocks.ingestArticle.mockImplementation(async () => ({ id: `article-${nextId++}` }));
    process.env["CRON_SECRET"] = SECRET;
    delete process.env["ALERT_WEBHOOK_URL"];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (originalCronSecret === undefined) delete process.env["CRON_SECRET"];
    else process.env["CRON_SECRET"] = originalCronSecret;
  });

  it("a Tavily 401 on search and extract blocks no domain and fails the run", async () => {
    // Incident replay: Tavily rejects the key everywhere; Brave answers discovery and
    // Jina extracts the pages, so before #367 the run ingested and reported `completed`.
    const hosts = ["techcrunch.com", "wired.com", "arstechnica.com"];
    mocks.braveSearch.mockResolvedValue(candidates(hosts));
    stubFetch({
      tavilySearch: { status: 401, body: TAVILY_401_BODY },
      tavilyExtract: { status: 401, body: TAVILY_401_BODY },
      jina: { status: 200, body: json({ data: { content: ARTICLE_TEXT, title: "Fixture" } }) },
    });
    const blockedBefore = getBlockedDomainsStats().domains;

    const { status, payload } = await runCron();

    expect(getBlockedDomainsStats().domains).toEqual(blockedBefore);
    for (const host of hosts) expect(isDomainBlocked(`https://${host}/later`)).toBe(false);
    expect(payload.data?.status).not.toBe("completed");
    expect(payload.data?.status).toBe("failed");
    expect(status).toBe(500);
    expect(payload.data?.errors[0]).toMatch(/^Provider auth error \[tavily\]: HTTP 401 Unauthorized/);
  });

  it("a Jina 401 blocks no domain and fails the run", async () => {
    const hosts = ["jina-auth-a.example.com", "jina-auth-b.example.com"];
    stubFetch({
      tavilySearch: { status: 200, body: tavilySearchBody(hosts) },
      // Tavily Extract answers 200 with nothing extracted, so the chain falls to Jina.
      tavilyExtract: { status: 200, body: json({ results: [], failed_results: [] }) },
      jina: { status: 401, body: json({ code: 401, message: "Invalid API key" }) },
    });
    const blockedBefore = getBlockedDomainsStats().domains;

    const { status, payload } = await runCron();

    expect(getBlockedDomainsStats().domains).toEqual(blockedBefore);
    expect(payload.data?.status).toBe("failed");
    expect(status).toBe(500);
    expect(payload.data?.errors[0]).toMatch(/^Provider auth error \[jina\]: HTTP 401 Unauthorized/);
  });

  it("an OpenRouter 401 fails the run with an auth reason and blocks no domain", async () => {
    const hosts = ["openrouter-auth-a.example.com", "openrouter-auth-b.example.com"];
    stubFetch({ tavilySearch: { status: 200, body: tavilySearchBody(hosts, ARTICLE_TEXT) } });
    // The shape OpenRouterService.generate throws: a wrapper over the HTTP-level error.
    const inner = new OpenRouterError("User not found.", 401, false);
    mocks.openRouterGenerate.mockRejectedValue(
      new OpenRouterError("OpenRouter generation failed: User not found.", undefined, false, inner)
    );
    const blockedBefore = getBlockedDomainsStats().domains;

    const { status, payload } = await runCron();

    expect(getBlockedDomainsStats().domains).toEqual(blockedBefore);
    expect(payload.data?.status).toBe("failed");
    expect(status).toBe(500);
    expect(payload.data?.errors[0]).toMatch(/^Provider auth error \[openrouter\]: HTTP 401 Unauthorized/);
  });

  it("a news site's own 403 blocks its domain for the TTL only and does not fail the run", async () => {
    const host = "site-403.example.com";
    stubFetch({
      tavilySearch: { status: 200, body: tavilySearchBody([host]) },
      // Tavily's account is fine (HTTP 200); the per-URL failure is the site's 403.
      tavilyExtract: {
        status: 200,
        body: json({ results: [], failed_results: [{ url: `https://${host}/story-0`, error: "403 Forbidden" }] }),
      },
      jina: { status: 200, body: json({ data: { content: ARTICLE_TEXT, title: "Fixture" } }) },
    });

    const { status, payload } = await runCron();

    expect(payload.data?.status).toBe("completed");
    expect(status).toBe(200);
    expect(payload.data?.errors.some((e) => e.startsWith("Provider auth error"))).toBe(false);
    expect(isDomainBlocked(`https://${host}/later`)).toBe(true);
    vi.advanceTimersByTime(AUTO_BLOCK_TTL_MS + 1000);
    expect(isDomainBlocked(`https://${host}/later`)).toBe(false);
  });
});

describe("summarizeFailedFetches (#367)", () => {
  it("returns undefined when no fetch failed", () => {
    expect(summarizeFailedFetches([], 4)).toBeUndefined();
  });

  it("counts failures per reason against the candidates attempted", () => {
    expect(
      summarizeFailedFetches(
        [{ reason: "blocked_domain" }, { reason: "all_extraction_methods_failed" }, { reason: "blocked_domain" }],
        7
      )
    ).toBe("Content fetch failed for 3 of 7 candidates: blocked_domain=2, all_extraction_methods_failed=1");
  });

  it("names at most five reasons", () => {
    const failed = ["a", "b", "c", "d", "e", "f"].map((reason) => ({ reason }));
    expect(summarizeFailedFetches(failed, 6)).toBe(
      "Content fetch failed for 6 of 6 candidates: a=1, b=1, c=1, d=1, e=1, ..."
    );
  });
});
