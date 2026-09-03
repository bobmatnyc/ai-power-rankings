import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TavilyExtractService } from "./tavily-extract.service";

/**
 * Regression tests for #125 — code-critic follow-up on bbf43787 (MEDIUM).
 *
 * Why: automated-ingestion.rate-limit.test.ts mocks TavilyExtractService
 * .extractContent() directly, so it never exercises the real retry-exhaustion
 * throw this fix added (tavily-extract.service.ts:214-227), nor
 * extractBatch()'s catch-to-null wrapper around it (:247-258) added to keep
 * extractBatch's "null for failed extractions" contract intact now that
 * extractContent can throw. Neither had a direct test.
 *
 * What: Drives the REAL extractContent()/extractBatch() against a mocked
 * fetch that always returns HTTP 429, with fake timers standing in for the
 * exponential-backoff delays between retries (real delays would make this
 * test take ~3s). Asserts extractContent throws once retries are exhausted,
 * and extractBatch instead resolves to { url, content: null } for that URL.
 *
 * Test: `npx vitest run lib/services/tavily-extract.service.retry.test.ts`.
 */

const RATE_LIMITED_URL = "https://devin.ai/desktop";

function mock429Fetch() {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: false,
    status: 429,
    text: async () => "Too Many Requests",
  } as unknown as Response);
}

describe("TavilyExtractService - retry exhaustion", () => {
  let service: TavilyExtractService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new TavilyExtractService("test-key");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("extractContent throws once all retries are exhausted on a persistent 429", async () => {
    const fetchSpy = mock429Fetch();

    const call = service.extractContent(RATE_LIMITED_URL);
    // Attach the rejection handler BEFORE advancing timers: `call` rejects
    // while timers are draining below, and attaching `.rejects` only after
    // that point leaves it briefly unhandled (Node flags it as an unhandled
    // rejection even though this test goes on to await it correctly).
    const assertion = expect(call).rejects.toThrow(/429/);
    await vi.runAllTimersAsync();
    await assertion;

    // 3 attempts total (this.maxRetries), not one.
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("extractBatch keeps its null-for-failed contract instead of throwing", async () => {
    mock429Fetch();

    const batchCall = service.extractBatch([RATE_LIMITED_URL]);
    await vi.runAllTimersAsync();
    const results = await batchCall;

    expect(results).toEqual([{ url: RATE_LIMITED_URL, content: null }]);
  });
});
