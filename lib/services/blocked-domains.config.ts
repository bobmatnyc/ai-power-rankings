/**
 * Configuration for domains known to block scrapers/bots
 * Used by content extraction services to skip or handle specially
 */

/**
 * Domains that consistently block Jina Reader or other scraping attempts
 * These should be handled with extra care or skipped
 */
export const BLOCKED_DOMAINS = new Set([
  "reuters.com",
  "wsj.com",
  "ft.com",
  "bloomberg.com",
  // Add more as discovered
]);

/**
 * #126: expiry timestamps (ms epoch, from Date.now()) for domains that were
 * auto-blocked from a transient signal (a 429) rather than a permanent
 * refusal (401/403/"blocked"). A domain present in BLOCKED_DOMAINS but absent
 * from this map is a permanent block for the life of this process — the
 * pre-existing semantics, unchanged. A domain present in both is blocked only
 * until its recorded expiry; see isDomainBlocked().
 */
const BLOCKED_DOMAIN_EXPIRY = new Map<string, number>();

/**
 * Why: #126 — a 429 means the source's rate limiter is cooling down, not that
 * it refuses this content outright. Before this, a single rate-limited
 * extraction attempt auto-blocked the domain for the rest of the process
 * (same as a 401/403), starving a perfectly good source for the life of a
 * warm serverless process over one transient blip. No Retry-After parsing or
 * cross-cold-start persistence is attempted — this is a minimal, fixed TTL.
 * What: How long a 429-triggered auto-block lasts before the domain is
 * eligible again. 4 hours comfortably outlasts a single daily ingestion run
 * (PIPELINE_TIMEOUT_MS is 10 minutes) plus any same-day retry, without
 * carrying the block into the next day's run on a source that has likely
 * recovered.
 */
export const AUTO_BLOCK_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Why: #126 — an expired 429 block must behave as unblocked without waiting
 * for an explicit unblock call; nothing else clears BLOCKED_DOMAIN_EXPIRY.
 * What: True when `blockedDomain` has a recorded expiry that has passed.
 * A domain with no recorded expiry (a permanent 401/403/"blocked" block, or a
 * static entry from the initial BLOCKED_DOMAINS list) is never expired.
 */
function isExpired(blockedDomain: string): boolean {
  const expiresAt = BLOCKED_DOMAIN_EXPIRY.get(blockedDomain);
  return expiresAt !== undefined && Date.now() >= expiresAt;
}

/**
 * Check if a URL's domain is known to block scrapers.
 *
 * Why: #126 — an entry that has passed its TTL must report as unblocked, not
 * just eventually get cleaned up. Checked and lazily evicted (from both
 * BLOCKED_DOMAINS and BLOCKED_DOMAIN_EXPIRY) here, on the same read path that
 * decides whether to skip a URL, rather than on a timer.
 * Test: `blocked-domains.config.ttl.test.ts` — 429-blocked domain is blocked
 * within the TTL and unblocked after; 403-blocked domain stays blocked past
 * the same elapsed time.
 */
export function isDomainBlocked(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, "");

    for (const blocked of BLOCKED_DOMAINS) {
      if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
        if (isExpired(blocked)) {
          BLOCKED_DOMAINS.delete(blocked);
          BLOCKED_DOMAIN_EXPIRY.delete(blocked);
          continue;
        }
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Add a domain to the blocked list (runtime addition).
 *
 * Why: #126 — `transient: true` (a 429) records a TTL-bounded block that
 * isDomainBlocked() treats as unblocked once AUTO_BLOCK_TTL_MS has elapsed.
 * Omitted (the default, and every pre-existing 401/403/"blocked" caller)
 * keeps the original permanent-for-process-life behavior. A later permanent
 * block always wins over a still-pending TTL. The reverse must NOT happen: a
 * single `fetchArticleContent` call can legitimately auto-block the same
 * domain twice in one pass — e.g. Tavily Extract fails with a 403 (permanent)
 * and, on fallthrough, Jina Reader fails with a 429 (transient) — and a
 * transient call arriving after an existing permanent block must not demote
 * it to a 4-hour TTL. A domain already blocked with no recorded expiry is a
 * standing permanent block, so a transient call for it is a no-op.
 * What: `transient: true` sets an expiry UNLESS the domain is already present
 * in BLOCKED_DOMAINS with no expiry entry (a standing permanent block), in
 * which case the call has no effect. Omitted (permanent) always applies and
 * clears any expiry left over from an earlier transient block of the same
 * domain.
 * Test: `blocked-domains.config.ttl.test.ts` — "keeps a domain permanently
 * blocked when a later transient (429) call arrives for it".
 */
export function addBlockedDomain(domain: string, options?: { transient?: boolean }): void {
  const normalized = domain.toLowerCase().replace(/^www\./, "");

  if (options?.transient) {
    const alreadyPermanent = BLOCKED_DOMAINS.has(normalized) && !BLOCKED_DOMAIN_EXPIRY.has(normalized);
    if (alreadyPermanent) {
      console.log(`[BlockedDomains] ${normalized} already permanently blocked; ignoring transient (429) block`);
      return;
    }
    BLOCKED_DOMAINS.add(normalized);
    BLOCKED_DOMAIN_EXPIRY.set(normalized, Date.now() + AUTO_BLOCK_TTL_MS);
    console.log(`[BlockedDomains] Added ${normalized} to blocked list (expires in ${AUTO_BLOCK_TTL_MS}ms)`);
  } else {
    BLOCKED_DOMAINS.add(normalized);
    BLOCKED_DOMAIN_EXPIRY.delete(normalized);
    console.log(`[BlockedDomains] Added ${normalized} to blocked list`);
  }
}

/**
 * Get statistics on blocked domains
 */
export function getBlockedDomainsStats(): {
  count: number;
  domains: string[];
} {
  return {
    count: BLOCKED_DOMAINS.size,
    domains: Array.from(BLOCKED_DOMAINS).sort(),
  };
}
