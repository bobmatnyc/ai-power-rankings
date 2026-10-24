/**
 * Typed GA4 custom-event helper (#175).
 *
 * Why: The site loaded gtag but sent no custom events, so rankings clicks,
 *   filter use, outbound tool clicks, scroll depth and search were invisible.
 *   UI code needs one call that cannot throw, cannot leak PII, and does
 *   nothing where gtag is absent (server render, tests, blocked tags).
 * What: `trackEvent(name, params)` forwards to `window.gtag("event", ...)`
 *   when gtag is a function. Params are restricted to the typed schema in
 *   `AnalyticsEventMap`; at runtime only string/number/boolean values pass,
 *   strings are cut to GA4's 100-character limit, and any error is swallowed.
 *   The other exports derive safe parameter values (host only, length bucket,
 *   page type) so call sites never handle raw URLs or query text.
 * Test: `tests/unit/analytics-track.test.ts`; call sites in
 *   `tests/unit/analytics-events.test.tsx`. Event plan:
 *   `docs/refresh/ga4-event-plan.md`.
 */

/** Coarse page classification sent with page-level events. */
export type PageType =
  | "home"
  | "rankings"
  | "tools"
  | "tool_detail"
  | "news"
  | "news_article"
  | "best_of"
  | "trending"
  | "whats_new"
  | "methodology"
  | "about"
  | "other";

export type QueryLengthBucket = "1-3" | "4-10" | "11-30" | "31+";

/** Every custom event and its parameters. Event names are GA4 snake_case. */
export interface AnalyticsEventMap {
  ranking_row_click: {
    tool_slug: string;
    rank: number;
    list_name: string;
    tool_category: string;
  };
  filter_use: {
    filter_name: "category" | "tag" | "sort";
    filter_value: string;
    page_type: PageType;
  };
  tool_outbound_click: {
    tool_slug: string;
    link_domain: string;
    link_type: "website" | "github";
  };
  scroll_depth: {
    percent_scrolled: 75;
    page_type: PageType;
  };
  site_search: {
    query_length: number;
    query_length_bucket: QueryLengthBucket;
    result_count: number;
    // #193: "tool_not_found" is the search box on a tool 404 page.
    search_location: "rankings" | "tool_not_found";
  };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

// GA4 drops event parameter values longer than 100 characters.
const MAX_PARAM_LENGTH = 100;

type Gtag = (command: "event", name: string, params: Record<string, string | number | boolean>) => void;

function getGtag(): Gtag | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as unknown as { gtag?: unknown }).gtag;
  return typeof candidate === "function" ? (candidate as Gtag) : null;
}

/**
 * Sends one GA4 custom event. Never throws; a no-op without `window.gtag`.
 */
export function trackEvent<K extends AnalyticsEventName>(name: K, params: AnalyticsEventMap[K]): void {
  try {
    const gtag = getGtag();
    if (!gtag) return;
    const clean: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
      if (typeof value === "string") clean[key] = value.slice(0, MAX_PARAM_LENGTH);
      else if (typeof value === "number" && Number.isFinite(value)) clean[key] = value;
      else if (typeof value === "boolean") clean[key] = value;
    }
    gtag("event", name, clean);
  } catch {
    // Analytics must never break the UI.
  }
}

/** Hostname of `url` without a leading `www.`; null for a non-http(s) or invalid URL. */
export function linkDomain(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Buckets a query length so search terms are never sent as text. */
export function queryLengthBucket(length: number): QueryLengthBucket {
  if (length <= 3) return "1-3";
  if (length <= 10) return "4-10";
  if (length <= 30) return "11-30";
  return "31+";
}

const PAGE_TYPES: Record<string, PageType> = {
  rankings: "rankings",
  tools: "tools",
  news: "news",
  trending: "trending",
  "whats-new": "whats_new",
  methodology: "methodology",
  about: "about",
};

/** Classifies a `/{lang}/...` pathname. Only the route shape is kept, never a slug. */
export function pageTypeFromPath(pathname: string | null | undefined): PageType {
  const segments = (pathname ?? "").split("/").filter(Boolean);
  const [section, detail] = segments.slice(1);
  if (!section) return "home";
  if (section === "tools" && detail) return "tool_detail";
  if (section === "news" && detail) return "news_article";
  if (section.startsWith("best-")) return "best_of";
  return PAGE_TYPES[section] ?? "other";
}
