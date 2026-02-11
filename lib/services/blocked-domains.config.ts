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
 * Check if a URL's domain is known to block scrapers
 */
export function isDomainBlocked(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, "");

    // Check exact match
    if (BLOCKED_DOMAINS.has(hostname)) {
      return true;
    }

    // Check if it's a subdomain of a blocked domain
    const blockedArray = Array.from(BLOCKED_DOMAINS);
    for (const blocked of blockedArray) {
      if (hostname.endsWith(`.${blocked}`) || hostname === blocked) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Add a domain to the blocked list (runtime addition)
 */
export function addBlockedDomain(domain: string): void {
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  BLOCKED_DOMAINS.add(normalized);
  console.log(`[BlockedDomains] Added ${normalized} to blocked list`);
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
