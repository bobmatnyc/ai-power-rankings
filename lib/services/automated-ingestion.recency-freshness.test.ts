import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AutomatedIngestionService,
  FRESHNESS_WINDOW_DAYS,
  passesFreshnessGate,
  provisionalPublishedDateMs,
  sortByFreshness,
  type IngestionResult,
} from "./automated-ingestion.service";
import type { TavilySearchService } from "./tavily-search.service";
import type { BraveSearchService } from "./brave-search.service";
import type { ArticleQualityService } from "./article-quality.service";
import type { ArticleIngestionService } from "./article-ingestion.service";
import { resolveEffectivePublishedDate } from "./published-date-resolver";

/**
 * Regression tests for #132 phase A — gate-time provisional freshness.
 *
 * Why: before extraction there is no LLM-extracted date, so the freshness gate
 * and the freshest-first sort had exactly one signal: Tavily's
 * `published_date`. The 2026-09-03 06:00 UTC run discovered same-day pages
 * whose Tavily dates read Aug 20, Aug 21 and Aug 30 — well outside the 14-day
 * window — so the recency pass added candidates the gate then threw away, and
 * the sort ranked whatever survived by a date that did not describe it.
 *
 * What: Exercises the two pure decisions against an injected clock, then drives
 * the whole discovery pipeline in dry-run mode (no database needed) to prove a
 * recency-pass candidate with a three-week-old Tavily date reaches ingestion
 * instead of being counted as stale.
 *
 * Test: `npx vitest run lib/services/automated-ingestion.recency-freshness.test.ts`.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const FIXED_NOW = new Date("2026-09-03T06:00:00.000Z").getTime();

/** ISO date `days` before `base`. */
function daysBefore(days: number, base: number): string {
  return new Date(base - days * MS_PER_DAY).toISOString();
}

/** ISO date `days` before the REAL clock — the pipeline calls Date.now() itself. */
function daysAgo(days: number): string {
  return daysBefore(days, Date.now());
}

/** One discovery result shaped like a TavilySearchResult, tagged by pass. */
function searchResult(
  publishedDate: string | null,
  discoveredVia: "recency" | "window",
  url = "https://example.com/a"
) {
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
    discoveredVia,
  };
}

function injectServices(
  service: AutomatedIngestionService,
  results: ReturnType<typeof searchResult>[],
  ingestArticle: ReturnType<typeof vi.fn>
): void {
  const internal = service as unknown as {
    _tavilySearchService: Partial<TavilySearchService>;
    _braveSearchService: Partial<BraveSearchService>;
    _articleQualityService: Partial<ArticleQualityService>;
    _articleIngestionService: Partial<ArticleIngestionService>;
  };

  internal._tavilySearchService = {
    isConfigured: () => true,
    searchAINews: vi.fn().mockResolvedValue(results),
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
}

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

describe("passesFreshnessGate (#132)", () => {
  it("keeps a recency-pass candidate whose Tavily date is three weeks old", () => {
    const item = { publishedDate: daysBefore(21, FIXED_NOW), discoveredVia: "recency" as const };
    expect(passesFreshnessGate(item, FIXED_NOW, FRESHNESS_WINDOW_DAYS)).toBe(true);
  });

  it("still drops a window-pass candidate whose date is three weeks old", () => {
    const item = { publishedDate: daysBefore(21, FIXED_NOW), discoveredVia: "window" as const };
    expect(passesFreshnessGate(item, FIXED_NOW, FRESHNESS_WINDOW_DAYS)).toBe(false);
  });

  it("treats an untagged candidate as a window candidate", () => {
    const item = { publishedDate: daysBefore(21, FIXED_NOW) };
    expect(passesFreshnessGate(item, FIXED_NOW, FRESHNESS_WINDOW_DAYS)).toBe(false);
  });

  it("keeps a window-pass candidate inside the window", () => {
    const item = { publishedDate: daysBefore(3, FIXED_NOW), discoveredVia: "window" as const };
    expect(passesFreshnessGate(item, FIXED_NOW, FRESHNESS_WINDOW_DAYS)).toBe(true);
  });
});

describe("provisionalPublishedDateMs (#132)", () => {
  it("uses the run's discovery time for a recency candidate with a stale date", () => {
    const item = { publishedDate: daysBefore(21, FIXED_NOW), discoveredVia: "recency" as const };
    expect(provisionalPublishedDateMs(item, FIXED_NOW, FRESHNESS_WINDOW_DAYS)).toBe(FIXED_NOW);
  });

  it("uses the provider date when it is inside the window", () => {
    const sourceDate = daysBefore(3, FIXED_NOW);
    const item = { publishedDate: sourceDate, discoveredVia: "recency" as const };
    expect(provisionalPublishedDateMs(item, FIXED_NOW, FRESHNESS_WINDOW_DAYS)).toBe(
      new Date(sourceDate).getTime()
    );
  });

  it("leaves a window candidate's stale date alone", () => {
    const sourceDate = daysBefore(21, FIXED_NOW);
    const item = { publishedDate: sourceDate, discoveredVia: "window" as const };
    expect(provisionalPublishedDateMs(item, FIXED_NOW, FRESHNESS_WINDOW_DAYS)).toBe(
      new Date(sourceDate).getTime()
    );
  });

  it("reports NaN for a window candidate with no date", () => {
    const item = { publishedDate: null, discoveredVia: "window" as const };
    expect(Number.isNaN(provisionalPublishedDateMs(item, FIXED_NOW, FRESHNESS_WINDOW_DAYS))).toBe(
      true
    );
  });
});

describe("sortByFreshness with pass membership (#132)", () => {
  /**
   * The ordering case from the issue: a recency-pass candidate carrying an
   * Aug 20 Tavily date must outrank a window candidate that merely reports a
   * newer one, because the recency pass has asserted last-24h content.
   */
  it("sorts a stale-dated recency candidate ahead of a three-day-old window candidate", () => {
    const recency = searchResult(
      daysBefore(21, FIXED_NOW),
      "recency",
      "https://example.com/recent"
    );
    const window = searchResult(daysBefore(3, FIXED_NOW), "window", "https://example.com/broad");

    const sorted = sortByFreshness([window, recency], FIXED_NOW, FRESHNESS_WINDOW_DAYS);

    expect(sorted.map((r) => r.url)).toEqual([
      "https://example.com/recent",
      "https://example.com/broad",
    ]);
  });

  it("leaves two window candidates ordered by their own dates", () => {
    const older = searchResult(daysBefore(9, FIXED_NOW), "window", "https://example.com/older");
    const newer = searchResult(daysBefore(2, FIXED_NOW), "window", "https://example.com/newer");

    const sorted = sortByFreshness([older, newer], FIXED_NOW, FRESHNESS_WINDOW_DAYS);

    expect(sorted.map((r) => r.url)).toEqual([
      "https://example.com/newer",
      "https://example.com/older",
    ]);
  });
});

describe("AutomatedIngestionService - recency candidates survive the gate (#132)", () => {
  let service: AutomatedIngestionService;
  let ingestArticle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new AutomatedIngestionService();
    ingestArticle = vi.fn().mockResolvedValue({ predictedChanges: [] });
  });

  it("ingests a recency-pass candidate whose Tavily date is three weeks old", async () => {
    injectServices(service, [searchResult(daysAgo(21), "recency")], ingestArticle);

    const result = await runDiscovery(service);

    expect(result.articlesSkippedStale).toBe(0);
    expect(result.articlesIngested).toBe(1);
  });

  it("still skips a window-pass candidate whose date is three weeks old", async () => {
    injectServices(service, [searchResult(daysAgo(21), "window")], ingestArticle);

    const result = await runDiscovery(service);

    expect(result.articlesSkippedStale).toBe(1);
    expect(result.articlesIngested).toBe(0);
  });

  it("keeps the recency candidate and drops the stale window one in a mixed batch", async () => {
    injectServices(
      service,
      [
        searchResult(daysAgo(21), "recency", "https://example.com/recent"),
        searchResult(daysAgo(21), "window", "https://example.com/broad"),
      ],
      ingestArticle
    );

    const result = await runDiscovery(service);

    expect(result.articlesSkippedStale).toBe(1);
    expect(result.articlesIngested).toBe(1);
    expect(ingestArticle).toHaveBeenCalledTimes(1);
    expect(ingestArticle.mock.calls[0][0].input).toBe("https://example.com/recent");
  });

  it("passes the pass tag and the run's discovery time to the insert path", async () => {
    injectServices(service, [searchResult(daysAgo(21), "recency")], ingestArticle);

    await runDiscovery(service);

    const metadata = ingestArticle.mock.calls[0][0].metadata;
    expect(metadata.discoveredVia).toBe("recency");
    expect(Number.isNaN(new Date(metadata.discoveredAt).getTime())).toBe(false);
  });
});

/**
 * The gate and the resolver must judge staleness against the SAME window.
 * `freshnessWindowDays` is `options.days ?? FRESHNESS_WINDOW_DAYS`, so an
 * operator running `--days=30` widens the gate; if that width does not reach
 * the insert path, the resolver keeps applying its own 14-day default and
 * rejects a candidate the gate deliberately admitted.
 */
describe("AutomatedIngestionService - widened window reaches the resolver (#132)", () => {
  let service: AutomatedIngestionService;
  let ingestArticle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new AutomatedIngestionService();
    ingestArticle = vi.fn().mockResolvedValue({ predictedChanges: [] });
  });

  it("carries the run's freshness window in the insert metadata", async () => {
    injectServices(service, [searchResult(daysAgo(20), "window")], ingestArticle);

    await runDiscovery(service, 30);

    expect(ingestArticle.mock.calls[0][0].metadata.windowDays).toBe(30);
  });

  it("defaults to the standard window when the run does not widen it", async () => {
    injectServices(service, [searchResult(daysAgo(3), "window")], ingestArticle);

    await runDiscovery(service);

    expect(ingestArticle.mock.calls[0][0].metadata.windowDays).toBe(FRESHNESS_WINDOW_DAYS);
  });

  /**
   * The reported failure, end to end: a 30-day run admits a window candidate
   * whose Tavily date is 20 days old, and the article text carries a 25-day-old
   * date. Both are inside the run's window, so the LLM-extracted date must win
   * and the source must read `article`. Before the window was threaded through
   * `metadata`, the resolver applied 14 days, rejected both, and fell through to
   * `fallback` — which also picks the Tavily date over the article's own.
   */
  it("resolves a 25-day-old article date under an operator-widened 30-day run", async () => {
    injectServices(service, [searchResult(daysAgo(20), "window")], ingestArticle);

    await runDiscovery(service, 30);

    const metadata = ingestArticle.mock.calls[0][0].metadata;
    const articleDate = daysAgo(25);
    const resolved = resolveEffectivePublishedDate({
      articleDate,
      searchDate: metadata.publishedDate,
      discoveredVia: metadata.discoveredVia,
      discoveredAt: metadata.discoveredAt,
      windowDays: metadata.windowDays,
    });

    expect(resolved.source).toBe("article");
    expect(resolved.date.toISOString()).toBe(articleDate);
  });
});
