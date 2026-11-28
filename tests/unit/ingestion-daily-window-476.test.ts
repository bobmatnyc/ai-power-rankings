/**
 * Provider window vs freshness gate (#476).
 *
 * Why: the daily cron now asks providers for a short window, but the 14-day
 * freshness gate used to share that value and would have narrowed with it.
 * What: Drives runDailyDiscovery in dry-run with a stub Tavily service and
 * checks the `days` the provider receives and the window the gate applies.
 * Test: `npx vitest run tests/unit/ingestion-daily-window-476.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AutomatedIngestionService,
  FRESHNESS_WINDOW_DAYS,
} from "../../lib/services/automated-ingestion.service";
import { DAILY_PROVIDER_WINDOW_DAYS } from "../../lib/services/discovery-queries";

const DAY_MS = 86_400_000;

function result(ageDays: number) {
  return {
    title: "Vendor ships agent mode",
    url: `https://example.com/${ageDays}`,
    description: "d",
    source: "example.com",
    publishedDate: new Date(Date.now() - ageDays * DAY_MS).toISOString(),
    content:
      "An AI coding assistant vendor announced a new agentic feature. This fixture " +
      "body clears the 100-character sufficiency threshold so no extraction runs.",
    score: 0.9,
    discoveredVia: "window" as const,
  };
}

describe("daily provider window is split from the freshness gate (#476)", () => {
  let service: AutomatedIngestionService;
  let searchAINews: ReturnType<typeof vi.fn>;
  let ingestArticle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new AutomatedIngestionService();
    searchAINews = vi.fn().mockResolvedValue([result(10)]);
    ingestArticle = vi.fn().mockResolvedValue({ predictedChanges: [] });
    const internal = service as unknown as Record<string, unknown>;
    internal._tavilySearchService = { isConfigured: () => true, searchAINews };
    internal._braveSearchService = { isAvailable: () => false, searchAINews: vi.fn() };
    internal._articleQualityService = { batchAssess: vi.fn().mockResolvedValue([]) };
    internal._articleIngestionService = { ingestArticle };
  });

  it("uses a 7 day provider window constant", () => {
    expect(DAILY_PROVIDER_WINDOW_DAYS).toBe(7);
  });

  it("short daily window reaches the provider, gate stays 14", async () => {
    const run = await service.runDailyDiscovery({
      dryRun: true,
      skipQualityCheck: true,
      days: DAILY_PROVIDER_WINDOW_DAYS,
    });

    expect(searchAINews.mock.calls[0][0].days).toBe(DAILY_PROVIDER_WINDOW_DAYS);
    // A 10-day-old candidate is outside the provider window but inside the gate.
    expect(run.articlesSkippedStale).toBe(0);
    expect(ingestArticle.mock.calls[0][0].metadata.windowDays).toBe(FRESHNESS_WINDOW_DAYS);
  });

  it("a backfill/manual run with no days keeps the 14-day provider window", async () => {
    await service.runDailyDiscovery({ dryRun: true, skipQualityCheck: true });

    expect(searchAINews.mock.calls[0][0].days).toBe(14);
    expect(ingestArticle.mock.calls[0][0].metadata.windowDays).toBe(14);
  });
});
