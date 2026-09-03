import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addBlockedDomain, isDomainBlocked, AUTO_BLOCK_TTL_MS } from "./blocked-domains.config";

/**
 * Regression tests for #126 — 429-triggered auto-block TTL.
 *
 * Why: PR #127 extended the auto-block trigger (isAutoBlockableError) to
 * 429s, but BLOCKED_DOMAINS was (and, for 401/403/"blocked" triggers, still
 * is) a plain in-memory Set with no expiry. A 429 is transient — the
 * source's rate limiter cooling down, not a refusal — so one rate-limited
 * extraction must not block that domain for the life of a warm serverless
 * process the way a 401/403/"blocked" refusal correctly does.
 *
 * What: Drives addBlockedDomain()/isDomainBlocked() directly under fake
 * timers. A domain added with `{ transient: true }` (the 429 path) is
 * blocked immediately, stays blocked up to AUTO_BLOCK_TTL_MS, and reports
 * unblocked once that TTL has elapsed. A domain added without the flag (the
 * 401/403/"blocked" path, unchanged) stays blocked well past the same
 * elapsed time.
 *
 * Test: `npx vitest run lib/services/blocked-domains.config.ttl.test.ts`.
 * Stash the fix (`git stash`) and re-run: `addBlockedDomain` pre-fix takes no
 * second argument and BLOCKED_DOMAINS never expires, so the "unblocked after
 * TTL" assertion below fails (the domain is still reported blocked).
 *
 * Also covers the code-critic finding on the first version of this fix: a
 * later transient (429) call for an already-permanently-blocked domain used
 * to unconditionally (re)set a TTL, so a 403-refused domain (permanent) could
 * be demoted to a 4-hour block by a subsequent 429 on the same domain within
 * one `fetchArticleContent` call (Tavily 403 falling through to a Jina 429).
 * Fixed in addBlockedDomain(): a transient call is a no-op when the domain is
 * already present with no recorded expiry.
 */

describe("blocked-domains.config - 429 auto-block TTL (#126)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks a 429-triggered (transient) domain within the TTL, then reports it unblocked after", () => {
    const domain = "ttl-429-test.example";
    const url = `https://${domain}/article-1`;

    expect(isDomainBlocked(url)).toBe(false);

    addBlockedDomain(domain, { transient: true });
    expect(isDomainBlocked(url)).toBe(true);

    // Still inside the TTL window.
    vi.advanceTimersByTime(AUTO_BLOCK_TTL_MS - 1000);
    expect(isDomainBlocked(url)).toBe(true);

    // Past the TTL.
    vi.advanceTimersByTime(2000);
    expect(isDomainBlocked(url)).toBe(false);
  });

  it("keeps a 403-triggered (permanent) domain blocked past the same elapsed time", () => {
    const domain = "ttl-403-test.example";
    const url = `https://${domain}/article-1`;

    expect(isDomainBlocked(url)).toBe(false);

    // No `transient` option — the existing 401/403/"blocked" call shape.
    addBlockedDomain(domain);
    expect(isDomainBlocked(url)).toBe(true);

    // Advance well past the 429 TTL: a permanent block must not expire.
    vi.advanceTimersByTime(AUTO_BLOCK_TTL_MS + 60 * 60 * 1000);
    expect(isDomainBlocked(url)).toBe(true);
  });

  /**
   * Code-critic finding: models the real Tavily-403-then-Jina-429 sequence
   * within one fetchArticleContent call, at the addBlockedDomain layer. A
   * standing permanent block must outrank a later transient signal for the
   * same domain, not get replaced by a 4-hour TTL.
   */
  it("keeps a domain permanently blocked when a later transient (429) call arrives for it", () => {
    const domain = "ttl-403-then-429-test.example";
    const url = `https://${domain}/article-1`;

    // First: Tavily Extract fails with a 403 (permanent).
    addBlockedDomain(domain);
    expect(isDomainBlocked(url)).toBe(true);

    // Then, on fallthrough: Jina Reader fails with a 429 (transient) for the
    // SAME domain, within the same fetchArticleContent call.
    addBlockedDomain(domain, { transient: true });
    expect(isDomainBlocked(url)).toBe(true);

    // Past what would have been the 429 TTL: still blocked, because the
    // permanent block was never demoted.
    vi.advanceTimersByTime(AUTO_BLOCK_TTL_MS + 60 * 60 * 1000);
    expect(isDomainBlocked(url)).toBe(true);
  });
});
