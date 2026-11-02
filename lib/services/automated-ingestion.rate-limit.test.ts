import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutomatedIngestionService, isAutoBlockableError, classifyAutoBlockReason } from "./automated-ingestion.service";
import { tavilyExtractService } from "./tavily-extract.service";
import { jinaReaderService } from "./jina-reader.service";
import { isDomainBlocked, AUTO_BLOCK_TTL_MS } from "./blocked-domains.config";
import { ProviderApiError } from "./provider-api-error";

/**
 * Regression tests for #125 Task 2.
 *
 * Why: https://devin.ai/desktop repeatedly failed extraction with
 * "429 Too Many Requests," but the auto-block condition only recognized
 * 401/403/"blocked" as a source-side refusal, not 429 — so the domain was
 * never added to BLOCKED_DOMAINS and every run paid for the same failing
 * extraction attempt again. Root-causing this further: the condition also
 * lived in a catch block that fetchArticleContent's own internal try/catches
 * never let an error reach (both TavilyExtractService.extractContent and this
 * service's own per-method catches swallowed the error and fell through to
 * the next method), so the check was unreachable for ANY status code before
 * this fix, not just 429.
 *
 * What: Exercises isAutoBlockableError as a pure function, then drives the
 * real (unmocked) fetchArticleContent through a Tavily-Extract 429 with the
 * real TavilyExtractService.extractContent throwing after exhausted retries,
 * and asserts the domain ends up in BLOCKED_DOMAINS.
 *
 * Test: `npx vitest run lib/services/automated-ingestion.rate-limit.test.ts`.
 */

/** Access the private fetchArticleContent() without widening the public API. */
function callFetchArticleContent(
  service: AutomatedIngestionService,
  url: string
): Promise<string | null> {
  return (
    service as unknown as {
      fetchArticleContent: (url: string, stats?: unknown) => Promise<string | null>;
    }
  ).fetchArticleContent(url);
}

describe("isAutoBlockableError", () => {
  it.each([
    ["401 Unauthorized", true],
    ["403 Forbidden", true],
    ["429 Too Many Requests", true],
    ["Access blocked by robots.txt", true],
    ["BLOCKED by upstream", true],
    ["500 Internal Server Error", false],
    ["ETIMEDOUT: connect timed out", false],
    ["Unknown error", false],
  ])('treats "%s" as auto-blockable: %s', (errorMsg, expected) => {
    expect(isAutoBlockableError(errorMsg)).toBe(expected);
  });
});

/**
 * Regression tests for #126 — classifyAutoBlockReason(). Previously
 * unreachable by any test: the doc comment on this function pointed here,
 * but only end-to-end auto-block outcomes were asserted (via isDomainBlocked
 * after a full fetchArticleContent run), never this function directly.
 */
describe("classifyAutoBlockReason", () => {
  it.each([
    ["429 Too Many Requests", "transient"],
    // #367: a 401/403 block carries the same TTL as a 429; it used to be permanent.
    ["401 Unauthorized", "transient"],
    ["403 Forbidden", "transient"],
    ["Extraction failed: 403 Forbidden - blocked by Cloudflare", "transient"],
    ["429 then upstream returned 401 on retry", "transient"],
    // Only a refusal with no status code stays permanent.
    ["Access blocked by robots.txt", "permanent"],
  ])('classifies "%s" as %s', (errorMsg, expected) => {
    expect(classifyAutoBlockReason(errorMsg)).toBe(expected);
  });
});

describe("AutomatedIngestionService - 429 auto-block (extraction chain)", () => {
  let service: AutomatedIngestionService;

  beforeEach(() => {
    service = new AutomatedIngestionService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * The core regression. Pre-fix this domain was never blocked: 429 wasn't in
   * the trigger condition, AND the condition lived on an unreachable catch
   * path (fetchArticleContent's own catches swallowed the error instead of
   * propagating it). Both had to be fixed for this to pass.
   */
  it("auto-blocks the domain when Tavily Extract exhausts retries with a 429", async () => {
    const url = "https://devin-ai-test-429.example/article-1";
    expect(isDomainBlocked(url)).toBe(false);

    vi.spyOn(tavilyExtractService, "isAvailable").mockReturnValue(true);
    vi.spyOn(tavilyExtractService, "extractContent").mockRejectedValue(
      new Error("Tavily Extract API error: 429 - Too Many Requests")
    );
    vi.spyOn(jinaReaderService, "isAvailable").mockReturnValue(false);
    // Basic HTML fetch (method 3) is attempted unconditionally; fail it fast
    // so the test doesn't hit the network.
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network disabled in test"));

    const content = await callFetchArticleContent(service, url);

    expect(content).toBeNull();
    expect(isDomainBlocked(url)).toBe(true);
  });

  it("does not auto-block on a non-blockable extraction failure (e.g. 500)", async () => {
    const url = "https://devin-ai-test-500.example/article-1";
    expect(isDomainBlocked(url)).toBe(false);

    vi.spyOn(tavilyExtractService, "isAvailable").mockReturnValue(true);
    vi.spyOn(tavilyExtractService, "extractContent").mockRejectedValue(
      new Error("Tavily Extract API error: 500 - Internal Server Error")
    );
    vi.spyOn(jinaReaderService, "isAvailable").mockReturnValue(false);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network disabled in test"));

    await callFetchArticleContent(service, url);

    expect(isDomainBlocked(url)).toBe(false);
  });

  // #367: Jina's own 403 is the provider refusing our key, not the site refusing the page.
  it("does not auto-block the domain when Jina Reader's own API answers 403", async () => {
    const url = "https://devin-ai-test-403.example/article-1";
    expect(isDomainBlocked(url)).toBe(false);

    vi.spyOn(tavilyExtractService, "isAvailable").mockReturnValue(false);
    vi.spyOn(jinaReaderService, "isAvailable").mockReturnValue(true);
    const jina403 = new ProviderApiError("jina", 403, "Jina.ai API error (403): Forbidden");
    vi.spyOn(jinaReaderService, "fetchArticle").mockRejectedValue(
      new Error(`Failed to fetch article with Jina.ai: ${jina403.message}`, { cause: jina403 })
    );
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network disabled in test"));

    await callFetchArticleContent(service, url);

    expect(isDomainBlocked(url)).toBe(false);
  });

  // #367: Tavily's own 429 still blocks for the #125 TTL; the status, not the text, decides.
  it("blocks for the TTL only when Tavily Extract's own API answers 429", async () => {
    const url = "https://devin-ai-test-provider-429.example/article-1";
    expect(isDomainBlocked(url)).toBe(false);

    vi.useFakeTimers();
    try {
      vi.spyOn(tavilyExtractService, "isAvailable").mockReturnValue(true);
      vi.spyOn(tavilyExtractService, "extractContent").mockRejectedValue(
        new ProviderApiError("tavily", 429, "Tavily Extract API error: 429 - Too Many Requests")
      );
      vi.spyOn(jinaReaderService, "isAvailable").mockReturnValue(false);
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network disabled in test"));

      await callFetchArticleContent(service, url);

      expect(isDomainBlocked(url)).toBe(true);
      vi.advanceTimersByTime(AUTO_BLOCK_TTL_MS + 1000);
      expect(isDomainBlocked(url)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * #367: a site's own 403 (Tavily Extract relays it as a per-URL "Extraction
   * failed" in a 200 response) still blocks the domain, but only for
   * AUTO_BLOCK_TTL_MS. Before #367 this block was permanent for the process.
   */
  it("blocks a site 403 for the TTL only, then unblocks the domain", async () => {
    const url = "https://devin-ai-test-site-403.example/article-1";
    expect(isDomainBlocked(url)).toBe(false);

    vi.useFakeTimers();
    try {
      vi.spyOn(tavilyExtractService, "isAvailable").mockReturnValue(true);
      vi.spyOn(tavilyExtractService, "extractContent").mockRejectedValue(
        new Error("Extraction failed: 403 Forbidden")
      );
      vi.spyOn(jinaReaderService, "isAvailable").mockReturnValue(false);
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network disabled in test"));

      await callFetchArticleContent(service, url);

      expect(isDomainBlocked(url)).toBe(true);
      vi.advanceTimersByTime(AUTO_BLOCK_TTL_MS - 1000);
      expect(isDomainBlocked(url)).toBe(true);
      vi.advanceTimersByTime(2000);
      expect(isDomainBlocked(url)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
