import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AutomatedIngestionService,
  FRESHNESS_WINDOW_DAYS,
  isFreshPublishedDate,
  type IngestionResult,
} from "./automated-ingestion.service";
import { TavilySearchService } from "./tavily-search.service";
import { BraveSearchService } from "./brave-search.service";
import { ArticleQualityService } from "./article-quality.service";
import { ArticleIngestionService } from "./article-ingestion.service";

/**
 * Regression tests for the ingestion freshness gate.
 *
 * Why: Discovery hands each result's publisher-supplied date straight to the
 * insert, and validatePublishedDate accepts any parseable date. From ~2026-08-20
 * every discovered article carried a date weeks to months old, so runs inserted
 * rows and reported healthy positive `articlesIngested` counts while nothing
 * surfaced in any publishedDate-ordered view. Accepting a stale article as
 * healthy yield is the fail-open branch; the "excludes a 6-month-old article"
 * case below fails against the pre-fix code and passes after.
 *
 * What: Exercises the pure decision helper against an injected clock, then
 * drives the whole discovery pipeline with mocked collaborators so the gate is
 * proven where it actually decides yield — `articlesIngested`.
 *
 * Test: `npx vitest run lib/services/automated-ingestion.freshness.test.ts`.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Fixed clock for the pure-helper cases, which take an injected `nowMs`. */
const FIXED_NOW = new Date("2026-08-28T06:00:00.000Z").getTime();

/** ISO date `days` before `base`. */
function daysBefore(days: number, base: number): string {
  return new Date(base - days * MS_PER_DAY).toISOString();
}

/**
 * ISO date `days` before the REAL clock. The pipeline calls Date.now() itself,
 * so pipeline fixtures must be relative to the real clock or they rot as the
 * wall clock moves past a hard-coded date.
 */
function daysAgo(days: number): string {
  return daysBefore(days, Date.now());
}

/**
 * One discovery result shaped like a TavilySearchResult. `content` is over the
 * 100-char sufficiency threshold so the pipeline reuses it and never reaches the
 * network-backed extraction chain — this stays a unit test.
 */
function searchResult(publishedDate: string | null, url = "https://example.com/a") {
  return {
    title: "Some AI coding tool announcement",
    url,
    description: "An AI coding tool announcement used as a discovery fixture.",
    source: "example.com",
    publishedDate,
    content:
      "An AI coding assistant vendor announced a new agentic feature today. " +
      "This fixture body exists only to clear the 100-character sufficiency " +
      "threshold so no extraction call is attempted during the test run.",
    score: 0.9,
  };
}

/** Mocks the service's collaborators; returns the provider spy for assertions. */
function injectServices(
  service: AutomatedIngestionService,
  results: ReturnType<typeof searchResult>[],
  ingestArticle: ReturnType<typeof vi.fn>
): { searchAINews: ReturnType<typeof vi.fn> } {
  const searchAINews = vi.fn().mockResolvedValue(results);

  const internal = service as unknown as {
    _tavilySearchService: Partial<TavilySearchService>;
    _braveSearchService: Partial<BraveSearchService>;
    _articleQualityService: Partial<ArticleQualityService>;
    _articleIngestionService: Partial<ArticleIngestionService>;
  };

  internal._tavilySearchService = {
    isConfigured: () => true,
    searchAINews,
  } as unknown as Partial<TavilySearchService>;

  internal._braveSearchService = {
    isAvailable: () => false,
    searchAINews: vi.fn(),
  } as unknown as Partial<BraveSearchService>;

  // Not reached: every run below sets skipQualityCheck, so the LLM gate is
  // bypassed and the freshness gate is the only thing that can reject an article.
  internal._articleQualityService = {
    batchAssess: vi.fn().mockResolvedValue([]),
  } as unknown as Partial<ArticleQualityService>;

  internal._articleIngestionService = {
    ingestArticle,
  } as unknown as Partial<ArticleIngestionService>;

  return { searchAINews };
}

/**
 * Run the pipeline in dry-run mode: no ingestion-run row is written, and the DB
 * helpers (checkDuplicates / getRecentArticleTitles) degrade to "no duplicates"
 * without a database, so no live connection is needed.
 */
function runDiscovery(
  service: AutomatedIngestionService,
  days?: number
): Promise<IngestionResult> {
  return service.runDailyDiscovery({
    dryRun: true,
    skipQualityCheck: true,
    maxArticles: 20,
    ...(days === undefined ? {} : { days }),
  });
}

describe("isFreshPublishedDate", () => {
  it("rejects an article published 6 months ago", () => {
    expect(isFreshPublishedDate(daysBefore(180, FIXED_NOW), FIXED_NOW)).toBe(false);
  });

  it("rejects an article one day past the window", () => {
    expect(
      isFreshPublishedDate(daysBefore(FRESHNESS_WINDOW_DAYS + 1, FIXED_NOW), FIXED_NOW)
    ).toBe(false);
  });

  it("accepts an article inside the window", () => {
    expect(
      isFreshPublishedDate(daysBefore(FRESHNESS_WINDOW_DAYS - 1, FIXED_NOW), FIXED_NOW)
    ).toBe(true);
  });

  it("accepts an article exactly at the window boundary", () => {
    expect(
      isFreshPublishedDate(daysBefore(FRESHNESS_WINDOW_DAYS, FIXED_NOW), FIXED_NOW)
    ).toBe(true);
  });

  it.each([
    ["missing", null],
    ["undefined", undefined],
    ["empty", ""],
    ["unparseable", "not-a-date"],
  ])("accepts a %s source date (validatePublishedDate falls back to now())", (_label, value) => {
    expect(isFreshPublishedDate(value as string | null | undefined, FIXED_NOW)).toBe(true);
  });

  it("accepts a future-dated article rather than treating clock skew as staleness", () => {
    const future = new Date(FIXED_NOW + 2 * MS_PER_DAY).toISOString();
    expect(isFreshPublishedDate(future, FIXED_NOW)).toBe(true);
  });

  it("honors a widened window so an operator backfill is not gated back down", () => {
    const thirtyDaysOld = daysBefore(30, FIXED_NOW);
    expect(isFreshPublishedDate(thirtyDaysOld, FIXED_NOW)).toBe(false);
    expect(isFreshPublishedDate(thirtyDaysOld, FIXED_NOW, 60)).toBe(true);
  });
});

describe("AutomatedIngestionService - freshness gate (yield accounting)", () => {
  let service: AutomatedIngestionService;
  let ingestArticle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new AutomatedIngestionService();
    ingestArticle = vi.fn().mockResolvedValue({ id: "article-1" });
  });

  /**
   * The core regression. Pre-fix this returned articlesIngested = 1: the stale
   * article passed straight through and the run reported healthy yield.
   */
  it("excludes a 6-month-old article from fresh yield", async () => {
    injectServices(service, [searchResult(daysAgo(180))], ingestArticle);

    const result = await runDiscovery(service);

    expect(result.articlesDiscovered).toBe(1);
    expect(result.articlesIngested).toBe(0);
    expect(result.articlesSkippedStale).toBe(1);
    // Rejected before the insert path, so no extraction or LLM spend either.
    expect(ingestArticle).not.toHaveBeenCalled();
  });

  /**
   * Requirement (b): a discovers-but-yields-nothing run must be distinguishable
   * in automated_ingestion_runs. articles_ingested = 0 against a positive
   * articles_discovered is the persisted signal ZERO_YIELD_STREAK reads (see
   * scripts/check-ingestion-gap.mjs).
   */
  it("records zero yield against positive discovery when every article is stale", async () => {
    injectServices(
      service,
      [
        searchResult(daysAgo(60), "https://example.com/a"),
        searchResult(daysAgo(120), "https://example.com/b"),
        searchResult(daysAgo(300), "https://example.com/c"),
      ],
      ingestArticle
    );

    const result = await runDiscovery(service);

    expect(result.articlesDiscovered).toBe(3);
    expect(result.articlesIngested).toBe(0);
    expect(result.articlesSkippedStale).toBe(3);
    expect(result.articlesSkipped).toBe(3);
    expect(result.status).toBe("completed");
    expect(ingestArticle).not.toHaveBeenCalled();
  });

  /** Requirement (d): genuinely fresh articles still ingest exactly as before. */
  it("still ingests an article published inside the window", async () => {
    injectServices(service, [searchResult(daysAgo(2))], ingestArticle);

    const result = await runDiscovery(service);

    expect(result.articlesDiscovered).toBe(1);
    expect(result.articlesSkippedStale).toBe(0);
    expect(result.articlesIngested).toBe(1);
  });

  /** Requirement (d): a missing source date falls back to now() and still ingests. */
  it("still ingests an article with no source published date", async () => {
    injectServices(service, [searchResult(null)], ingestArticle);

    const result = await runDiscovery(service);

    expect(result.articlesSkippedStale).toBe(0);
    expect(result.articlesIngested).toBe(1);
  });

  it("keeps the fresh article and drops the stale one in a mixed batch", async () => {
    injectServices(
      service,
      [
        searchResult(daysAgo(200), "https://example.com/stale"),
        searchResult(daysAgo(1), "https://example.com/fresh"),
      ],
      ingestArticle
    );

    const result = await runDiscovery(service);

    expect(result.articlesDiscovered).toBe(2);
    expect(result.articlesSkippedStale).toBe(1);
    expect(result.articlesIngested).toBe(1);
  });

  it("bounds the provider lookback instead of leaving it unset", async () => {
    const { searchAINews } = injectServices(service, [searchResult(daysAgo(1))], ingestArticle);

    await runDiscovery(service);

    // Pre-fix the cron path passed days: undefined, so executeSearch omitted the
    // key and discovery was relevance-ranked with no date bound at all.
    expect(searchAINews).toHaveBeenCalledWith(
      expect.objectContaining({ days: FRESHNESS_WINDOW_DAYS })
    );
  });

  it("widens the gate when the caller widens the lookback", async () => {
    injectServices(service, [searchResult(daysAgo(30))], ingestArticle);

    const result = await runDiscovery(service, 60);

    expect(result.articlesSkippedStale).toBe(0);
    expect(result.articlesIngested).toBe(1);
  });
});
