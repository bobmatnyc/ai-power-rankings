/**
 * Provider billing errors must fail the daily-news run (issue #167).
 *
 * Why: On 2026-10-12 Tavily (search + extract) and Jina Reader answered HTTP 402 and
 * OpenRouter answered "requires more credits, or fewer max_tokens". The pipeline caught
 * every one of those errors, counted each candidate as `quality_rejected`, recorded the
 * run `completed` with 0 ingested, and the cron route answered 200. Nothing alerted
 * until the third zero-yield day.
 *
 * What: Drives the REAL GET handler and the REAL AutomatedIngestionService. Only the
 * boundaries are faked: the database (`getDb`), the search / extraction / LLM provider
 * clients, plain `fetch` (the basic-HTML extraction fallback), the article-ingestion
 * service and cache invalidation. The arms are: an incident replay (402s plus the
 * OpenRouter credits text) that must end failed with a non-2xx response; a run whose
 * candidates are genuinely rejected on quality, which must still complete with 200;
 * and a run whose only provider failure is a 429 rate limit, which is not billing.
 *
 * Test: `npx vitest run tests/unit/cron-daily-news-billing.test.ts`. No network, no
 * database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const RUN_ID = "run-167-fixture";

const OPENROUTER_CREDITS_TEXT =
  "OpenRouter generation failed: This request requires more credits, or fewer max_tokens. " +
  "You requested up to 1000 tokens, but can only afford 648. To increase, visit " +
  "https://openrouter.ai/settings/credits and upgrade to a paid account";
const TAVILY_EXTRACT_402_TEXT =
  'Tavily Extract API error: 402 - {"detail":{"error":"Your account is currently disabled ' +
  'because of an unpaid pay-as-you-go balance."}}';
const JINA_402_TEXT =
  "Failed to fetch article with Jina.ai: Jina.ai API error (402): Payment Required";
const TAVILY_SEARCH_429_TEXT = "Tavily API error: 429 - Request rate limit exceeded";

const mocks = vi.hoisted(() => {
  const row: Record<string, unknown> = {};
  return {
    row,
    tavilySearch: vi.fn(),
    braveAvailable: { value: false },
    braveSearch: vi.fn(),
    tavilyExtract: vi.fn(),
    jinaFetch: vi.fn(),
    openRouterGenerate: vi.fn(),
    ingestArticle: vi.fn(),
    resetRow(): void {
      for (const key of Object.keys(row)) delete row[key];
      Object.assign(row, { status: "running", completedAt: null, errorLog: null });
    },
  };
});

// Fake automated_ingestion_runs table — same shape as the fake in
// lib/services/automated-ingestion.candidate-outcomes.test.ts.
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

vi.mock("../../lib/services/tavily-search.service", () => ({
  TavilySearchService: class {
    isConfigured = (): boolean => true;
    searchAINews = mocks.tavilySearch;
  },
}));

vi.mock("../../lib/services/brave-search.service", () => ({
  BraveSearchService: class {
    isAvailable = (): boolean => mocks.braveAvailable.value;
    searchAINews = mocks.braveSearch;
  },
}));

vi.mock("../../lib/services/tavily-extract.service", () => ({
  tavilyExtractService: {
    isAvailable: (): boolean => true,
    extractContent: mocks.tavilyExtract,
  },
}));

vi.mock("../../lib/services/jina-reader.service", () => ({
  jinaReaderService: {
    isAvailable: (): boolean => true,
    fetchArticle: mocks.jinaFetch,
  },
}));

vi.mock("../../lib/services/openrouter.service", () => ({
  getOpenRouterService: () => ({ generate: mocks.openRouterGenerate }),
}));

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

const SECRET = "cron-secret-fixture-value";
const originalCronSecret = process.env["CRON_SECRET"];
const originalWebhookUrl = process.env["ALERT_WEBHOOK_URL"];

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function cronRequest(): Request {
  return new Request("https://aipowerranking.com/api/cron/daily-news", {
    method: "GET",
    headers: { authorization: `Bearer ${SECRET}` },
  });
}

/**
 * Three same-day discovery results on unrelated topics (so semantic dedupe keeps all
 * three). `content` decides whether the extraction chain runs: a short snippet forces
 * Tavily Extract -> Jina -> basic HTML, a long one is used as-is.
 */
function discoveryResults(withContent: boolean) {
  const now = new Date().toISOString();
  const body = withContent
    ? "This fixture body is long enough to clear the 100-character sufficiency threshold, " +
      "so the pipeline reuses it and never calls an extraction provider."
    : "short";
  return [
    ["Cursor ships background agents for large monorepos", "https://news-a.example.com/cursor"],
    ["Zed editor publishes latency benchmark results", "https://news-b.example.com/zed"],
    ["Sourcegraph Cody pricing overhaul announced", "https://news-c.example.com/cody"],
  ].map(([title, url]) => ({
    title,
    url,
    description: "Discovery fixture.",
    source: new URL(url as string).hostname,
    publishedDate: now,
    content: body,
    score: 0.9,
    discoveredVia: "recency" as const,
  }));
}

/** An OpenRouter answer the quality service parses as a genuine low-quality verdict. */
function lowQualityVerdict() {
  return {
    content: JSON.stringify({
      qualityScore: 3,
      relevanceScore: 2,
      credibilityScore: 5,
      reasoning: "Market overview that mentions AI coding tools only in passing",
      suggestedCategories: ["General AI News"],
    }),
    metadata: { estimatedCost: 0.001 },
  };
}

interface RoutePayload {
  success: boolean;
  error?: string;
  data?: { status: string; errors: string[] };
}

type OutcomeRow = { outcome: string; reason?: string };

describe("GET /api/cron/daily-news — provider billing errors (#167)", () => {
  beforeEach(() => {
    mocks.resetRow();
    mocks.tavilySearch.mockReset();
    mocks.braveSearch.mockReset();
    mocks.braveAvailable.value = false;
    mocks.tavilyExtract.mockReset();
    mocks.jinaFetch.mockReset();
    mocks.openRouterGenerate.mockReset();
    mocks.ingestArticle.mockReset();
    process.env["CRON_SECRET"] = SECRET;
    delete process.env["ALERT_WEBHOOK_URL"];
    // The basic-HTML fallback is the one extractor that is not a paid provider; it
    // succeeds, exactly as it did in the incident, so the candidates reach quality.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            `<html><body><p>${"Editors and agents compete on latency and price. ".repeat(8)}</p></body></html>`,
            { status: 200 }
          )
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreEnv("CRON_SECRET", originalCronSecret);
    restoreEnv("ALERT_WEBHOOK_URL", originalWebhookUrl);
  });

  it("fails the run and answers non-2xx when providers return 402 and OpenRouter is out of credits", async () => {
    mocks.tavilySearch.mockResolvedValue(discoveryResults(false));
    mocks.tavilyExtract.mockRejectedValue(new Error(TAVILY_EXTRACT_402_TEXT));
    mocks.jinaFetch.mockRejectedValue(new Error(JINA_402_TEXT));
    mocks.openRouterGenerate.mockRejectedValue(new Error(OPENROUTER_CREDITS_TEXT));

    const response = await GET(cronRequest());
    const payload = (await response.json()) as RoutePayload;

    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.data?.status).toBe("failed");

    // The failure reason names each provider and the billing condition.
    expect(payload.error).toMatch(/openrouter/i);
    expect(payload.error).toMatch(/credit/i);
    expect(payload.error).toMatch(/tavily/i);
    expect(payload.error).toMatch(/jina/i);
    expect(payload.error).toMatch(/402/);

    // The run row is terminal-failed and its error_log carries the reasons.
    expect(mocks.row["status"]).toBe("failed");
    const errorLog = (mocks.row["errorLog"] as string[] | null) ?? [];
    expect(errorLog.some((line) => /openrouter/i.test(line) && /credit/i.test(line))).toBe(true);

    // A candidate the LLM never assessed is not a quality rejection.
    const outcomes = (mocks.row["candidateOutcomes"] as OutcomeRow[] | undefined) ?? [];
    expect(outcomes).toHaveLength(3);
    expect(outcomes.some((o) => o.outcome === "quality_rejected")).toBe(false);
    expect(mocks.ingestArticle).not.toHaveBeenCalled();
  });

  it("still completes with 200 when every candidate is genuinely rejected on quality", async () => {
    mocks.tavilySearch.mockResolvedValue(discoveryResults(true));
    mocks.openRouterGenerate.mockResolvedValue(lowQualityVerdict());

    const response = await GET(cronRequest());
    const payload = (await response.json()) as RoutePayload;

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data?.status).toBe("completed");
    expect(mocks.row["status"]).toBe("completed");

    const outcomes = (mocks.row["candidateOutcomes"] as OutcomeRow[] | undefined) ?? [];
    expect(outcomes.map((o) => o.outcome)).toEqual([
      "quality_rejected",
      "quality_rejected",
      "quality_rejected",
    ]);
  });

  it("does not treat a 429 rate limit as a billing failure", async () => {
    // Tavily search is rate-limited; Brave answers. Extraction is rate-limited too.
    mocks.tavilySearch.mockRejectedValue(new Error(TAVILY_SEARCH_429_TEXT));
    mocks.braveAvailable.value = true;
    mocks.braveSearch.mockResolvedValue(discoveryResults(false));
    mocks.tavilyExtract.mockRejectedValue(new Error("Tavily Extract API error: 429 - Too Many Requests"));
    mocks.jinaFetch.mockRejectedValue(new Error("Jina.ai API error (429): Too Many Requests"));
    mocks.openRouterGenerate.mockResolvedValue(lowQualityVerdict());

    const response = await GET(cronRequest());
    const payload = (await response.json()) as RoutePayload;

    expect(response.status).toBe(200);
    expect(payload.data?.status).toBe("completed");
    expect(mocks.row["status"]).toBe("completed");
  });
});
