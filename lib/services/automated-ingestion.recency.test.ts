import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AutomatedIngestionService,
  FRESHNESS_WINDOW_DAYS,
  sortByFreshness,
} from "./automated-ingestion.service";
import { TavilySearchService } from "./tavily-search.service";
import { BraveSearchService } from "./brave-search.service";
import { ArticleQualityService } from "./article-quality.service";
import { ArticleIngestionService } from "./article-ingestion.service";

/**
 * Regression tests for #125 Task 1.
 *
 * Why: A DB-level diagnostic (6 days of production runs) found discovery
 * consistently returned 9-25 candidates/day, but nothing 0-1 days old was
 * ever discovered-and-landed — freshest ingested items were 1-3 days old.
 * Root cause: discovery is provider-relevance-ordered, not date-ordered
 * (Tavily has no sort-by-recency option; see tavily-search.service.ts), and
 * two caps downstream (`newArticles.slice(0, maxArticles * 2)` before
 * content-prep, `passingArticles.slice(0, maxArticles)` before ingest)
 * truncated that relevance order — so a same-day article ranked low on
 * relevance could be cut before a several-days-old, higher-relevance one.
 *
 * What: Proves sortByFreshness as a pure function, then proves it closes the
 * gap end-to-end: a mixed-age candidate set in provider (non-date) order,
 * larger than maxArticles, must still ingest the FRESHEST article. This case
 * fails against the pre-fix code, which took whatever the provider returned
 * first.
 *
 * Test: `npx vitest run lib/services/automated-ingestion.recency.test.ts`.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** ISO date `days` before the real clock (pipeline fixtures call Date.now() itself). */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * MS_PER_DAY).toISOString();
}

function searchResult(publishedDate: string | null, url: string) {
  return {
    title: `Article at ${url}`,
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

describe("sortByFreshness", () => {
  it("orders items by publishedDate descending (freshest first)", () => {
    const items = [
      searchResult(daysAgo(8), "https://example.com/old"),
      searchResult(daysAgo(0), "https://example.com/fresh"),
      searchResult(daysAgo(4), "https://example.com/mid"),
    ];

    expect(sortByFreshness(items).map((i) => i.url)).toEqual([
      "https://example.com/fresh",
      "https://example.com/mid",
      "https://example.com/old",
    ]);
  });

  it("sorts missing/unparseable dates after every dated item", () => {
    const items = [
      searchResult(null, "https://example.com/unknown"),
      searchResult(daysAgo(5), "https://example.com/dated"),
      searchResult("not-a-date", "https://example.com/unparseable"),
    ];

    expect(sortByFreshness(items).map((i) => i.url)).toEqual([
      "https://example.com/dated",
      "https://example.com/unknown",
      "https://example.com/unparseable",
    ]);
  });

  it("does not mutate the input array", () => {
    const items = [
      searchResult(daysAgo(1), "https://example.com/a"),
      searchResult(daysAgo(2), "https://example.com/b"),
    ];
    const original = [...items];

    sortByFreshness(items);

    expect(items).toEqual(original);
  });
});

/** Mocks the service's collaborators; returns the search spy for assertions. */
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

  internal._articleQualityService = {
    batchAssess: vi.fn().mockResolvedValue([]),
  } as unknown as Partial<ArticleQualityService>;

  internal._articleIngestionService = {
    ingestArticle,
  } as unknown as Partial<ArticleIngestionService>;

  return { searchAINews };
}

describe("AutomatedIngestionService - freshest-first ordering before the maxArticles cap", () => {
  let service: AutomatedIngestionService;
  let ingestArticle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new AutomatedIngestionService();
    ingestArticle = vi.fn().mockResolvedValue({ id: "article-1" });
  });

  /**
   * The core regression. Candidates are given in PROVIDER (relevance) order:
   * an 8-day-old "most relevant" result first, a same-day "least relevant"
   * result last — mirroring the production symptom. With maxArticles = 1,
   * pre-fix code takes index 0 (the stale one) because nothing reorders the
   * list before the cap; post-fix, the freshest article is kept.
   */
  it("ingests the freshest candidate, not the highest-relevance one, when candidates exceed maxArticles", async () => {
    injectServices(
      service,
      [
        searchResult(daysAgo(8), "https://example.com/old-relevant"),
        searchResult(daysAgo(4), "https://example.com/mid"),
        searchResult(daysAgo(0), "https://example.com/fresh-less-relevant"),
      ],
      ingestArticle
    );

    const result = await service.runDailyDiscovery({
      dryRun: true,
      skipQualityCheck: true,
      maxArticles: 1,
    });

    expect(result.articlesDiscovered).toBe(3);
    expect(result.articlesIngested).toBe(1);
    expect(ingestArticle).toHaveBeenCalledTimes(1);
    expect(ingestArticle).toHaveBeenCalledWith(
      expect.objectContaining({ input: "https://example.com/fresh-less-relevant" })
    );
  });

  it("requests an explicit same-day recency pass from Tavily", async () => {
    const { searchAINews } = injectServices(
      service,
      [searchResult(daysAgo(1), "https://example.com/a")],
      ingestArticle
    );

    await service.runDailyDiscovery({ dryRun: true, skipQualityCheck: true, maxArticles: 20 });

    expect(searchAINews).toHaveBeenCalledWith(
      expect.objectContaining({ includeRecentPass: true, days: FRESHNESS_WINDOW_DAYS })
    );
  });
});
