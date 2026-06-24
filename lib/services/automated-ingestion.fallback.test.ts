import { beforeEach, describe, expect, it, vi } from "vitest";
import { AutomatedIngestionService } from "./automated-ingestion.service";
import { TavilySearchService } from "./tavily-search.service";
import { BraveSearchService } from "./brave-search.service";

/**
 * Tests for the resilient search-provider fallback in AutomatedIngestionService.
 *
 * Why: A runtime failure from the primary provider (Tavily HTTP 402/401/403/
 * 429/5xx/network) previously failed the ENTIRE ingestion run even when a
 * healthy Brave provider was configured. These tests lock in the failover so a
 * single provider outage no longer takes down ingestion.
 *
 * What: Exercise the private discoverArticles() helper directly (cast to access
 * it) with mocked Tavily/Brave services to assert ordering, failover, provider
 * attribution, and the all-providers-failed terminal error.
 *
 * Test: `npx vitest run lib/services/automated-ingestion.fallback.test.ts`.
 */

/** Minimal shape returned by discoverArticles for assertions. */
interface DiscoverResult {
  results: Array<{ url: string; title: string }>;
  provider: "tavily" | "brave";
}

/** Access the private discoverArticles() without widening the public API. */
function callDiscover(
  service: AutomatedIngestionService
): Promise<DiscoverResult> {
  return (
    service as unknown as {
      discoverArticles: (
        options?: Record<string, unknown>
      ) => Promise<DiscoverResult>;
    }
  ).discoverArticles({});
}

/** Inject mocked Tavily/Brave services into the private lazy backing fields. */
function injectProviders(
  service: AutomatedIngestionService,
  tavily: Partial<TavilySearchService>,
  brave: Partial<BraveSearchService>
): void {
  const internal = service as unknown as {
    _tavilySearchService: Partial<TavilySearchService>;
    _braveSearchService: Partial<BraveSearchService>;
  };
  internal._tavilySearchService = tavily;
  internal._braveSearchService = brave;
}

describe("AutomatedIngestionService - provider fallback", () => {
  let service: AutomatedIngestionService;

  beforeEach(() => {
    service = new AutomatedIngestionService();
  });

  it("uses Tavily when it succeeds (no fallback)", async () => {
    const tavilyResults = [{ url: "https://a.com", title: "A" }];
    injectProviders(
      service,
      {
        isConfigured: () => true,
        searchAINews: vi.fn().mockResolvedValue(tavilyResults),
      },
      {
        isAvailable: () => true,
        searchAINews: vi.fn().mockResolvedValue([]),
      }
    );

    const { results, provider } = await callDiscover(service);

    expect(provider).toBe("tavily");
    expect(results).toHaveLength(1);
  });

  it("falls over to Brave when Tavily throws a 402 runtime error", async () => {
    const braveResults = [{ url: "https://b.com", title: "B" }];
    const braveSearch = vi.fn().mockResolvedValue(braveResults);
    injectProviders(
      service,
      {
        isConfigured: () => true,
        searchAINews: vi
          .fn()
          .mockRejectedValue(new Error("Tavily API error: 402 - billing")),
      },
      {
        isAvailable: () => true,
        searchAINews: braveSearch,
      }
    );

    const { results, provider } = await callDiscover(service);

    // Tavily failed -> Brave was used -> run can succeed.
    expect(provider).toBe("brave");
    expect(results).toEqual(braveResults);
    expect(braveSearch).toHaveBeenCalledTimes(1);
  });

  it("skips an unconfigured Tavily and uses Brave directly", async () => {
    const braveResults = [{ url: "https://b.com", title: "B" }];
    const tavilySearch = vi.fn();
    injectProviders(
      service,
      {
        isConfigured: () => false,
        searchAINews: tavilySearch,
      },
      {
        isAvailable: () => true,
        searchAINews: vi.fn().mockResolvedValue(braveResults),
      }
    );

    const { provider } = await callDiscover(service);

    expect(provider).toBe("brave");
    expect(tavilySearch).not.toHaveBeenCalled();
  });

  it("throws an aggregated error when every provider fails", async () => {
    injectProviders(
      service,
      {
        isConfigured: () => true,
        searchAINews: vi
          .fn()
          .mockRejectedValue(new Error("Tavily API error: 402")),
      },
      {
        isAvailable: () => true,
        searchAINews: vi.fn().mockRejectedValue(new Error("Brave 500")),
      }
    );

    await expect(callDiscover(service)).rejects.toThrow(
      /All search providers failed/
    );
  });
});
