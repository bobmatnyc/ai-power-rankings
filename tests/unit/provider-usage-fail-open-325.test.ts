/**
 * #325: a ledger write failure never fails or changes a provider call or an ingestion run.
 *
 * Why: the ledger is bookkeeping. If an insert error propagated, a missing table (code
 *   deployed before migration 0029), a database blip or a hung write would fail the
 *   quality assessment, every candidate would read `assessment_failed`, and the daily
 *   run would end failed (#172) for a reason unrelated to the news.
 * What: drives the REAL daily-news GET handler, AutomatedIngestionService,
 *   ArticleQualityService and OpenRouterService. Only `fetch` (OpenRouter replies), the
 *   database and the search provider are faked, as in `cron-daily-news-billing.test.ts`.
 *   The same run is made with a working ledger and with one whose insert throws: the
 *   response, run status and candidate outcomes must be identical; only the ledger rows
 *   are missing, and each missing row logs "ledger row not written". A hung insert must
 *   not hold `generate` past the write bound.
 * Test: `npx vitest run tests/unit/provider-usage-fail-open-325.test.ts`. No network, no
 *   database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const RUN_ID = "00000000-0000-4000-8000-000000000326";

const mocks = vi.hoisted(() => {
  const row: Record<string, unknown> = {};
  return {
    row,
    ledgerRows: [] as Record<string, unknown>[],
    ledgerMode: { value: "ok" as "ok" | "throw" | "hang" },
    tavilySearch: vi.fn(),
    resetRow(): void {
      for (const key of Object.keys(row)) delete row[key];
      Object.assign(row, { status: "running", completedAt: null, errorLog: null });
    },
  };
});

vi.mock("../../lib/db/connection", () => ({
  getDb: () => ({
    execute: async () => ({ rows: [{ id: RUN_ID }] }),
    insert: () => ({
      values: async (value: Record<string, unknown>) => {
        if (mocks.ledgerMode.value === "throw") {
          throw new Error('relation "provider_usage_events" does not exist');
        }
        if (mocks.ledgerMode.value === "hang") return new Promise(() => {});
        mocks.ledgerRows.push(value);
      },
    }),
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
    isAvailable = (): boolean => false;
    searchAINews = vi.fn();
  },
}));

vi.mock("../../lib/services/tavily-extract.service", () => ({
  tavilyExtractService: { isAvailable: (): boolean => false, extractContent: vi.fn() },
}));

vi.mock("../../lib/services/jina-reader.service", () => ({
  jinaReaderService: { isAvailable: (): boolean => false, fetchArticle: vi.fn() },
}));

vi.mock("../../lib/services/article-ingestion.service", () => ({
  ArticleIngestionService: class {
    ingestArticle = vi.fn();
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
import { OpenRouterService } from "../../lib/services/openrouter.service";
import { LEDGER_NOT_WRITTEN_MSG, LEDGER_WRITE_TIMEOUT_MS } from "../../lib/services/provider-usage";

const SECRET = "cron-secret-fixture-value";
const MODEL = "anthropic/claude-sonnet-5.5";

/** Three same-day candidates with enough body that no extraction provider runs. */
function discoveryResults() {
  const now = new Date().toISOString();
  const body =
    "This fixture body is long enough to clear the 100-character sufficiency threshold, " +
    "so the pipeline reuses it and never calls an extraction provider.";
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

/** An OpenRouter completion the quality service reads as a genuine low-quality verdict. */
function lowQualityCompletion() {
  const verdict = {
    qualityScore: 3,
    relevanceScore: 2,
    credibilityScore: 5,
    reasoning: "Market overview that mentions AI coding tools only in passing",
    suggestedCategories: ["General AI News"],
  };
  return {
    id: "gen-fixture",
    object: "chat.completion",
    created: 1792562400,
    model: MODEL,
    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(verdict) } }],
    usage: { prompt_tokens: 900, completion_tokens: 60, total_tokens: 960, cost: 0.0024 },
  };
}

interface RunObservation {
  status: number;
  success: boolean;
  runStatus: unknown;
  rowStatus: unknown;
  errors: string[];
  outcomes: string[];
}

async function runDailyNews(): Promise<RunObservation> {
  const response = await GET(
    new Request("https://aipowerranking.com/api/cron/daily-news", {
      method: "GET",
      headers: { authorization: `Bearer ${SECRET}` },
    })
  );
  const payload = (await response.json()) as {
    success: boolean;
    data?: { status: string; errors: string[] };
  };
  const outcomes = (mocks.row["candidateOutcomes"] as Array<{ outcome: string }> | undefined) ?? [];
  return {
    status: response.status,
    success: payload.success,
    runStatus: payload.data?.status,
    rowStatus: mocks.row["status"],
    errors: payload.data?.errors ?? [],
    outcomes: outcomes.map((o) => o.outcome),
  };
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mocks.resetRow();
  mocks.ledgerRows = [];
  mocks.ledgerMode.value = "ok";
  mocks.tavilySearch.mockReset();
  mocks.tavilySearch.mockResolvedValue(discoveryResults());
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("ALERT_WEBHOOK_URL", "");
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      String(url).includes("openrouter.ai")
        ? new Response(JSON.stringify(lowQualityCompletion()), { status: 200 })
        : new Response("<html><body><p>fixture</p></body></html>", { status: 200 })
    )
  );
  warn = vi.spyOn(loggers.api, "warn");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function ledgerWarnings() {
  return warn.mock.calls.filter(([message]) => message === LEDGER_NOT_WRITTEN_MSG);
}

describe("#325 ledger writes fail open", () => {
  it("a working ledger records one row per assessment, linked to the run", async () => {
    const run = await runDailyNews();

    expect(run).toMatchObject({ status: 200, success: true, runStatus: "completed", rowStatus: "completed" });
    expect(run.outcomes).toEqual(["quality_rejected", "quality_rejected", "quality_rejected"]);
    expect(mocks.ledgerRows).toHaveLength(3);
    for (const row of mocks.ledgerRows) {
      expect(row).toMatchObject({
        provider: "openrouter",
        operation: "article_quality",
        runId: RUN_ID,
        reportedCostUsd: "0.002400",
        costIsEstimated: false,
      });
    }
    expect(ledgerWarnings()).toHaveLength(0);
  });

  it("an insert error leaves the run's outcome unchanged; only the rows are missing, and the log says so", async () => {
    const baseline = await runDailyNews();

    mocks.resetRow();
    mocks.ledgerRows = [];
    warn.mockClear();
    mocks.ledgerMode.value = "throw";
    const failing = await runDailyNews();

    expect(failing).toEqual(baseline);
    expect(failing).toMatchObject({ status: 200, runStatus: "completed" });
    expect(mocks.ledgerRows).toHaveLength(0);
    const warnings = ledgerWarnings();
    expect(warnings).toHaveLength(3);
    for (const [, context] of warnings) {
      expect(context).toMatchObject({
        provider: "openrouter",
        operation: "article_quality",
        runId: RUN_ID,
        error: expect.stringContaining("provider_usage_events"),
      });
    }
  });

  it(
    "a hung insert does not hold generate past the write bound",
    async () => {
      mocks.ledgerMode.value = "hang";
      const started = Date.now();

      const result = await new OpenRouterService().generate(
        { model: MODEL, messages: [{ role: "user", content: "q" }] },
        { operation: "generate", maxAttempts: 1 }
      );

      expect(result.content).toContain("qualityScore");
      expect(Date.now() - started).toBeLessThan(LEDGER_WRITE_TIMEOUT_MS + 1_500);
      expect(ledgerWarnings()).toHaveLength(1);
      expect(ledgerWarnings()[0]?.[1]).toMatchObject({ error: expect.stringMatching(/timed out/) });
    },
    LEDGER_WRITE_TIMEOUT_MS + 5_000
  );

  it(
    "a slow ledger write does not count against the per-attempt provider timeout",
    async () => {
      // #325 critic: a 1000 ms reply plus a hung write used to exceed timeoutMs 2500,
      // so the attempt timed out, a second billed call went out, and generate threw.
      mocks.ledgerMode.value = "hang";
      const fetchStub = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        return new Response(JSON.stringify(lowQualityCompletion()), { status: 200 });
      });
      vi.stubGlobal("fetch", fetchStub);

      const result = await new OpenRouterService().generate(
        { model: MODEL, messages: [{ role: "user", content: "q" }] },
        { operation: "generate", maxAttempts: 2, timeoutMs: 2_500 }
      );

      expect(result.content).toContain("qualityScore");
      expect(result.metadata.attempts).toBe(1);
      expect(fetchStub).toHaveBeenCalledTimes(1);
      expect(ledgerWarnings()).toHaveLength(1);
    },
    15_000
  );
});
