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
 * #172 adds a run in which no quality reply parses: every candidate is
 * `assessment_failed`, the run ends failed and the route answers 500.
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
import { loggers } from "../../lib/logger";
import { RUN_SUMMARY_MSG } from "../../lib/services/ingestion-run-summary";

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

// #172: an unparseable quality reply is an assessment failure, and a run in which every
// assessment failed must not end `completed` with a 200.
describe("GET /api/cron/daily-news — every quality assessment fails (#172)", () => {
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

  it("records assessment_failed, ends the run failed and answers 500 when no reply parses", async () => {
    // Fresh hosts: the 429 arm above leaves its hosts on the in-process blocked-domain list.
    mocks.tavilySearch.mockResolvedValue(
      discoveryResults(true).map((r, i) => ({
        ...r,
        url: `https://assess-${i}.example.org/story`,
        source: `assess-${i}.example.org`,
      }))
    );
    // A reply cut off mid-object, with no finish_reason "length" to flag it.
    mocks.openRouterGenerate.mockResolvedValue({
      content: '{"qualityScore": 8, "relevanceScore": 9, "reasoning": "Specific product ne',
      metadata: { estimatedCost: 0.001 },
    });

    const response = await GET(cronRequest());
    const payload = (await response.json()) as RoutePayload;

    // Soft, so a regression reports the outcome and the status code separately.
    const outcomes = (mocks.row["candidateOutcomes"] as OutcomeRow[] | undefined) ?? [];
    expect.soft(outcomes.map((o) => o.outcome)).toEqual([
      "assessment_failed",
      "assessment_failed",
      "assessment_failed",
    ]);
    expect.soft(response.status).toBe(500);
    expect(payload.success).toBe(false);
    expect(payload.data?.status).toBe("failed");
    expect(payload.error).toMatch(/quality assessment failed for all 3 candidates/i);
    expect(mocks.row["status"]).toBe("failed");
    expect(mocks.ingestArticle).not.toHaveBeenCalled();
  });
});

// #172: the circuit breaker in batchAssess must not accept candidates it never assessed;
// with N >= 6 it used to trip after batch 1 and pass every later candidate at score 7.
describe("GET /api/cron/daily-news — assessment circuit breaker fails closed (#172)", () => {
  beforeEach(() => {
    mocks.resetRow();
    mocks.tavilySearch.mockReset();
    mocks.braveSearch.mockReset();
    mocks.braveAvailable.value = false;
    mocks.tavilyExtract.mockReset();
    mocks.jinaFetch.mockReset();
    mocks.openRouterGenerate.mockReset();
    mocks.ingestArticle.mockReset();
    // A wrongly accepted candidate must ingest cleanly, or the ingest error alone fails the run.
    mocks.ingestArticle.mockImplementation(async () => ({ id: "article-fixture" }));
    process.env["CRON_SECRET"] = SECRET;
    delete process.env["ALERT_WEBHOOK_URL"];
  });

  afterEach(() => {
    restoreEnv("CRON_SECRET", originalCronSecret);
    restoreEnv("ALERT_WEBHOOK_URL", originalWebhookUrl);
  });

  /** N same-day candidates whose titles share no word, so semantic dedupe keeps all N. */
  function distinctCandidates(n: number, tag: string) {
    const template = discoveryResults(true)[0]!;
    return Array.from({ length: n }, (_, i) => ({
      ...template,
      title: `Kestrel${tag}${i} Quillon${tag}${i} Varvex${tag}${i}`,
      url: `https://breaker-${tag}-${i}.example.org/story`,
      source: `breaker-${tag}-${i}.example.org`,
    }));
  }

  it.each([6, 11, 20])(
    "accepts nothing and answers 500 when no reply parses across %i candidates",
    async (n) => {
      mocks.tavilySearch.mockResolvedValue(distinctCandidates(n, `u${n}`));
      mocks.openRouterGenerate.mockResolvedValue({
        content: '{"qualityScore": 8, "relevanceScore": 9, "reasoning": "Specific product ne',
        metadata: { estimatedCost: 0.001 },
      });

      const response = await GET(cronRequest());
      const payload = (await response.json()) as RoutePayload;

      const outcomes = (mocks.row["candidateOutcomes"] as OutcomeRow[] | undefined) ?? [];
      expect.soft(outcomes.map((o) => o.outcome)).toEqual(Array(n).fill("assessment_failed"));
      expect.soft(mocks.ingestArticle).not.toHaveBeenCalled();
      expect.soft(response.status).toBe(500);
      expect(payload.data?.status).toBe("failed");
      expect(mocks.row["status"]).toBe("failed");
    }
  );

  it("records assessment_failed for a parseable reply that carries no score", async () => {
    mocks.tavilySearch.mockResolvedValue(distinctCandidates(3, "empty"));
    mocks.openRouterGenerate.mockResolvedValue({ content: "{}", metadata: { estimatedCost: 0.001 } });

    const response = await GET(cronRequest());
    const payload = (await response.json()) as RoutePayload;

    const outcomes = (mocks.row["candidateOutcomes"] as OutcomeRow[] | undefined) ?? [];
    expect.soft(outcomes.map((o) => o.outcome)).toEqual(Array(3).fill("assessment_failed"));
    expect.soft(response.status).toBe(500);
    expect(payload.data?.status).toBe("failed");
  });
});

// #172: every run logs one counts-only "[AutomatedIngestion] Run summary" line, and the
// fail-closed path logs it too, before the route answers 500.
describe("GET /api/cron/daily-news — run summary log line (#172)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

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
    warnSpy = vi.spyOn(loggers.api, "warn");
    errorSpy = vi.spyOn(loggers.api, "error");
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    restoreEnv("CRON_SECRET", originalCronSecret);
    restoreEnv("ALERT_WEBHOOK_URL", originalWebhookUrl);
  });

  /** Every summary call, on either level, as `[level, fields]`. */
  function summaryCalls(): Array<[string, Record<string, unknown>]> {
    const pick = (level: string, spy: ReturnType<typeof vi.spyOn>) =>
      spy.mock.calls
        .filter((call) => call[0] === RUN_SUMMARY_MSG)
        .map((call) => [level, call[1] as Record<string, unknown>] as [string, Record<string, unknown>]);
    return [...pick("warn", warnSpy), ...pick("error", errorSpy)];
  }

  /** A fresh candidate whose title shares no word with the others. */
  function candidate(tag: string, overrides: Record<string, unknown> = {}) {
    const template = discoveryResults(true)[0]!;
    return {
      ...template,
      title: `Corvane${tag} Pellith${tag} Draxum${tag}`,
      url: `https://summary-${tag}.example.org/story`,
      source: `summary-${tag}.example.org`,
      ...overrides,
    };
  }

  it("logs the real stage counts once for a run that adds 3 articles", async () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const keep = [candidate("k0"), candidate("k1"), candidate("k2")];
    mocks.tavilySearch.mockResolvedValue([
      ...keep,
      candidate("rej"), // quality-rejected below
      { ...keep[0]!, url: "https://summary-dup.example.org/story" }, // semantic duplicate of k0
      candidate("blk", { url: "https://www.reuters.com/technology/story", source: "reuters.com" }),
      candidate("old", { publishedDate: sixtyDaysAgo, discoveredVia: "window" }), // stale
    ]);
    mocks.openRouterGenerate.mockImplementation(async (request: { messages: { content: string }[] }) =>
      request.messages.some((m) => m.content.includes("Corvanerej"))
        ? lowQualityVerdict()
        : {
            content: JSON.stringify({
              qualityScore: 9,
              relevanceScore: 9,
              credibilityScore: 9,
              reasoning: "Specific AI coding tool news",
              suggestedCategories: ["Product Launch"],
            }),
            metadata: { estimatedCost: 0.001 },
          }
    );
    let nextId = 0;
    mocks.ingestArticle.mockImplementation(async () => ({ id: `article-${nextId++}` }));

    const response = await GET(cronRequest());
    const payload = (await response.json()) as RoutePayload & {
      data?: { articlesIngested: number; articlesDiscovered: number };
    };

    expect(response.status).toBe(200);
    const calls = summaryCalls();
    expect(calls).toHaveLength(1);
    const [level, fields] = calls[0]!;
    expect(level).toBe("warn");
    expect(fields).toMatchObject({
      runId: RUN_ID,
      status: "completed",
      cause: null,
      dryRun: false,
      discovered: 7,
      stale: 1,
      candidates: 6,
      urlDuplicates: 0,
      semanticDuplicates: 1,
      duplicates: 1,
      fetched: 4,
      fetchFailed: 1,
      blockedDomain: 1,
      assessed: 4,
      assessmentFailed: 0,
      rejected: 1,
      passedQuality: 3,
      added: 3,
      ingestFailed: 0,
      errorCount: 0,
    });
    // The same numbers the run result reports.
    expect(fields["added"]).toBe(payload.data?.articlesIngested);
    expect(fields["discovered"]).toBe(payload.data?.articlesDiscovered);
    // Counts only: no URL, host or provider text in the line.
    expect(JSON.stringify(fields)).not.toMatch(/https?:|example\.org|reuters/i);
  });

  it.each([
    {
      tag: "u",
      cause: "assessment_unparseable",
      arrange: () =>
        mocks.openRouterGenerate.mockResolvedValue({
          content: '{"qualityScore": 8, "relevanceScore": 9, "reasoning": "Specific product ne',
          metadata: { estimatedCost: 0.001 },
        }),
    },
    {
      tag: "t",
      cause: "assessment_truncated",
      arrange: () =>
        mocks.openRouterGenerate.mockRejectedValue(
          new Error(
            "AI response truncated at the token limit (finish_reason=length, model=m, " +
              "completion_tokens=2000, max_tokens=2000, content_length=10)"
          )
        ),
    },
  ])("logs counts and cause $cause on the fail-closed path before the 500", async ({ tag, cause, arrange }) => {
    mocks.tavilySearch.mockResolvedValue([
      candidate(`${tag}fc0`),
      candidate(`${tag}fc1`),
      candidate(`${tag}fc2`),
      candidate(`${tag}blk`, { url: "https://www.reuters.com/fail-closed", source: "reuters.com" }),
    ]);
    arrange();

    const response = await GET(cronRequest());
    const payload = (await response.json()) as RoutePayload;

    // The failure itself is unchanged: 500, run failed, nothing ingested.
    expect(response.status).toBe(500);
    expect(payload.data?.status).toBe("failed");
    expect(mocks.ingestArticle).not.toHaveBeenCalled();

    const calls = summaryCalls();
    expect(calls).toHaveLength(1);
    const [level, fields] = calls[0]!;
    expect(level).toBe("error");
    expect(fields).toMatchObject({
      runId: RUN_ID,
      status: "failed",
      cause,
      discovered: 4,
      candidates: 4,
      fetched: 3,
      fetchFailed: 1,
      blockedDomain: 1,
      assessed: 3,
      assessmentFailed: 3,
      rejected: 0,
      passedQuality: 0,
      added: 0,
    });
    expect(JSON.stringify(fields)).not.toMatch(/https?:|example\.org|reuters/i);
  });
});
