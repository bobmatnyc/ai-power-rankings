/**
 * Why: #476 — on the 2026-11-23 run, ~13 of 20 candidates were scored on thin
 * extraction (teasers, `[...]` fragments, error pages, nav menus), and some of
 * those were longer than the 500-char length check, so they were never
 * re-fetched. One candidate also carried a `google.com/url?...` redirect.
 * What: Pure helpers that decide whether a search snippet needs its full text
 * fetched before quality scoring, that unwrap Google redirect URLs, and that
 * name aggregator hosts that cannot be resolved to a publisher.
 * Test: `tests/unit/teaser-detection-476.test.ts`.
 */

/** #476: a snippet at or below this length is a teaser (Tavily cuts `description` at 500). */
export const TEASER_MAX_CHARS = 500;

/** #476: truncation markers left by feeds and extractors that cut an article short. */
const TRUNCATION_MARKERS: readonly RegExp[] = [
  /\[\s*(?:\.\.\.|…)\s*\]/, // "[...]" / "[…]"
  /(?:\.\.\.|…)\s*$/, // ends mid-sentence with an ellipsis
  /\b(?:read|see) (?:the )?(?:more|full (?:story|article|post))\b/i,
  /\bcontinue reading\b/i,
  /\b(?:subscribe|sign in|log in) to (?:continue|read)\b/i,
];

/** #476: text an extractor returns when it got an error or interstitial page, not the article. */
const ERROR_PAGE_MARKERS: readonly RegExp[] = [
  /\boops\b/i,
  /\bsomething went wrong\b/i,
  /\bpage (?:not found|cannot be found)\b/i,
  /\benable javascript\b/i,
];

/** #476: a line this short (in words) reads as a menu item, not prose. */
const NAV_LINE_MAX_WORDS = 4;
/** #476: nav-only when at least this share of non-empty lines are menu-like. */
const NAV_LINE_SHARE = 0.7;
/** #476: below this many lines a share is noise, not a menu. */
const NAV_MIN_LINES = 6;

/**
 * Why: #476 — nav-menu extractions (Yahoo, publisher headers) are long enough
 * to pass the length check yet carry no article prose.
 * What: True when most non-empty lines are a few words or a bare markdown link.
 */
export function isNavBoilerplate(content: string): boolean {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < NAV_MIN_LINES) return false;
  const navLike = lines.filter(
    (line) =>
      /^[-*]?\s*\[[^\]]*\]\([^)]*\)\s*$/.test(line) ||
      line.split(/\s+/).length <= NAV_LINE_MAX_WORDS
  ).length;
  return navLike / lines.length >= NAV_LINE_SHARE;
}

/**
 * Why: #476 — the 500-char length rule alone missed truncated and boilerplate
 * snippets, which were then scored as if they were the article.
 * What: True when `content` is short, carries a truncation or error-page
 * marker, or is nav boilerplate; such a candidate gets its full text fetched.
 */
export function needsFullText(content: string): boolean {
  const text = content.trim();
  if (text.length <= TEASER_MAX_CHARS) return true;
  if (TRUNCATION_MARKERS.some((marker) => marker.test(text))) return true;
  // #476: an error page is short prose; only test the head so a long article
  // that mentions "oops" in its body is not re-fetched.
  const head = text.substring(0, 300);
  if (ERROR_PAGE_MARKERS.some((marker) => marker.test(head))) return true;
  return isNavBoilerplate(text);
}

/**
 * Why: #476 — a `google.com/url?...` candidate was fetched and deduplicated
 * under Google's redirect, not under the publisher URL.
 * What: For a google.* host with path `/url`, returns the `url` (or `q`)
 * query param when it is an absolute http(s) URL; otherwise returns `url`
 * unchanged. Never throws.
 */
export function resolvePublisherUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const host = parsed.hostname.toLowerCase();
  const isGoogle = /(^|\.)google\.[a-z.]+$/.test(host);
  if (!isGoogle || parsed.pathname !== "/url") return url;
  const target = parsed.searchParams.get("url") ?? parsed.searchParams.get("q");
  if (!target) return url;
  try {
    const resolved = new URL(target);
    return resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved.toString() : url;
  } catch {
    return url;
  }
}

/**
 * #476: why a candidate URL cannot reach a publisher page. `google_wrapper` is
 * a google.* page left after resolvePublisherUrl found no `url=`/`q=` target.
 */
export type UnresolvableHostRule = "google_wrapper" | "news_google" | "tavily" | "malformed_url";

// #476: google.<tld> or www.google.<tld> only, so cloud.google.com or ai.google.dev posts still pass.
const GOOGLE_WRAPPER_HOST = /^(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/;
// #476: news.google.* serves article tokens that redirect client-side, never the article.
const NEWS_GOOGLE_HOST = /^news\.google\.[a-z]{2,3}(?:\.[a-z]{2})?$/;
const TAVILY_HOST = /(^|\.)tavily\.com$/;

/**
 * #476: hosts sent as Tavily `exclude_domains`. Exact wrapper hosts only: a bare
 * `google.com` would also suppress cloud.google.com and developers.google.com,
 * which the pipeline keeps. unresolvableHostRule() drops whatever gets through.
 */
export const UNRESOLVABLE_EXCLUDE_DOMAINS: readonly string[] = Object.freeze([
  "www.google.com",
  "news.google.com",
  "tavily.com",
  "www.tavily.com",
]);

/**
 * Why: #476 — on 2026-11-25, 17 of 30 candidates were google.com or tavily.com
 * pages. They gave all 9 teaser_unexpanded rejections and 1 extraction failure,
 * and each cost an LLM score.
 * What: Returns the rule that makes `url` unresolvable, or null for a URL that
 * can reach a publisher page. Call it after resolvePublisherUrl(), so a google
 * `url=` wrapper with a target is already the publisher URL. A value that is
 * not an absolute http(s) URL is `malformed_url`. Never throws.
 * Test: `unresolvableHostRule` cases in tests/unit/unresolvable-host-476.test.ts.
 */
export function unresolvableHostRule(url: unknown): UnresolvableHostRule | null {
  let parsed: URL;
  try {
    parsed = new URL(String(url ?? ""));
  } catch {
    return "malformed_url";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "malformed_url";
  const host = parsed.hostname.toLowerCase();
  if (NEWS_GOOGLE_HOST.test(host)) return "news_google";
  if (GOOGLE_WRAPPER_HOST.test(host)) return "google_wrapper";
  if (TAVILY_HOST.test(host)) return "tavily";
  return null;
}
