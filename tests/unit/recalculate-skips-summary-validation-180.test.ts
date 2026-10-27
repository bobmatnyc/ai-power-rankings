/**
 * Admin recalculation does not validate the article summary (issue #180).
 *
 * Why: The #180 summary check throws `SummaryRejectedError` from `analyzeContent`. The admin
 *   recalculate paths never read the summary, so they must not fail, or spend retry calls, on it.
 * What: Runs `ArticleDatabaseService.recalculateArticleRankings` with the real `AIAnalyzer` and
 *   only the OpenRouter `fetch` and the repository replaced. The model returns an invalid summary
 *   every time; the call must succeed after exactly one OpenRouter call. A second test pins that
 *   the analyzer still rejects the same output when the caller does not opt out (ingest).
 * Test: `npx vitest run tests/unit/recalculate-skips-summary-validation-180.test.ts`. No network, no database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SummaryRejectedError } from "../../lib/article-summary";
import { ArticleDatabaseService } from "../../lib/services/article-db-service";
import { AIAnalyzer } from "../../lib/services/article-ingestion.service";

vi.mock("server-only", () => ({}));

const INVALID_SUMMARY = "Too short.";

function stubOpenRouter(): ReturnType<typeof vi.fn> {
  const fetchStub = vi.fn(async () => {
    const analysis = {
      title: "Code review for Claude Code is generally available",
      summary: INVALID_SUMMARY,
      rewritten_content: "Body.",
      source: "example.com",
      published_date: "2026-10-20",
      category: "Code Assistant",
      tags: ["code review"],
      tool_mentions: [{ tool: "Claude Code", context: "launch", sentiment: 0.7, relevance: 1 }],
      company_mentions: [],
      overall_sentiment: 0.6,
      importance_score: 7,
      key_insights: ["Generally available"],
    };
    const reply = {
      model: "anthropic/claude-sonnet-5.5",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: { role: "assistant", content: JSON.stringify(analysis) },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
    };
    return new Response(JSON.stringify(reply), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

/** A service built without its constructor, so no database connection is opened. */
function recalculationService() {
  const articlesRepo = {
    createProcessingLog: vi.fn(async () => ({ id: "log-1" })),
    getArticleById: vi.fn(async () => ({
      id: "article-1",
      title: "Title",
      content: "article body",
      sourceUrl: null,
      fileName: null,
      author: null,
    })),
    rollbackArticleRankings: vi.fn(async () => undefined),
    saveRankingChanges: vi.fn(async () => undefined),
    updateProcessingLog: vi.fn(async () => undefined),
  };
  const service = Object.create(ArticleDatabaseService.prototype) as Record<string, unknown>;
  Object.assign(service, {
    articlesRepo,
    aiAnalyzer: new AIAnalyzer(),
    rankingsCalculator: { calculateRankingChanges: () => [] },
    getAllTools: async () => [],
    getCurrentRankings: async () => [],
  });
  return { service: service as unknown as ArticleDatabaseService, articlesRepo };
}

beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ["setTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("summary validation scope (#180)", () => {
  it("recalculation succeeds on an invalid summary with one OpenRouter call and no backoff", async () => {
    const fetchStub = stubOpenRouter();
    const { service, articlesRepo } = recalculationService();

    const pending = service.recalculateArticleRankings("article-1").then(
      () => undefined,
      (error: unknown) => error
    );
    await vi.advanceTimersByTimeAsync(20_000);

    expect(await pending, "recalculation must not throw").toBeUndefined();
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(articlesRepo.updateProcessingLog).toHaveBeenCalledWith(
      "log-1",
      expect.objectContaining({ status: "completed" })
    );
  });

  it("analyzeContent still rejects the same output when the caller does not opt out", async () => {
    const fetchStub = stubOpenRouter();

    const pending = new AIAnalyzer().analyzeContent("article body").then(
      () => undefined,
      (error: unknown) => error
    );
    await vi.advanceTimersByTimeAsync(20_000);

    expect(await pending).toBeInstanceOf(SummaryRejectedError);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });
});
