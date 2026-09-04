/**
 * Effective published-date resolution for article inserts.
 *
 * Why: #132 — the insert path chose `metadata.publishedDate || analysis.published_date`,
 * so Tavily's self-reported date (almost always truthy) beat the date the LLM
 * read out of the article text. The 2026-09-03 06:00 UTC run ingested three
 * articles the same day with published dates of Aug 20, Aug 21 and Aug 30, and
 * `/api/news/recent?days=1` returned nothing. Resolution now runs after
 * extraction and analysis, where a second, independent date signal exists, and
 * records which signal won so a stale insert is diagnosable after the fact.
 * What: A deterministic precedence over the three available signals — the
 * LLM-extracted article date, the search provider's date, and the run's own
 * discovery time — plus the pre-#132 fallback when none of them qualifies.
 * Pure (clock injected), so it is unit-testable without a database or network.
 */

import { validatePublishedDate } from "@/lib/types/article-analysis";
import type { DiscoveredVia } from "./tavily-search.service";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Maximum publisher clock skew tolerated on a forward-dated signal. A date more
 * than this far ahead of the run clock is a bad extraction, not a timezone
 * rounding artifact, so it is rejected rather than inserted as the freshest
 * article on the site.
 */
export const FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

/**
 * Freshness window used by the resolver. Mirrors FRESHNESS_WINDOW_DAYS in
 * automated-ingestion.service.ts; kept as its own literal so the insert path
 * does not import the discovery orchestrator (and its search-provider
 * dependencies) just to read one number.
 */
export const RESOLVER_WINDOW_DAYS = 14;

/** Which rule produced the effective published date. */
export type PublishedDateSource = "article" | "search" | "discovery" | "fallback";

export interface EffectivePublishedDate {
  date: Date;
  source: PublishedDateSource;
}

export interface ResolvePublishedDateInput {
  /** `analysis.published_date` — read by the LLM out of the article text. */
  articleDate?: string | null;
  /** `metadata.publishedDate` — the search provider's self-reported date. */
  searchDate?: string | null;
  /** Which discovery pass found this candidate. */
  discoveredVia?: DiscoveredVia;
  /** The run's discovery time, as stamped when the freshness gate ran. */
  discoveredAt?: string | number | Date | null;
  /** Injectable clock, for deterministic tests. */
  nowMs?: number;
  /** Freshness window; callers pass the run's own window. */
  windowDays?: number;
}

/** Parses to epoch ms, or NaN when the value is missing or unparseable. */
function parseMs(value: string | number | Date | null | undefined): number {
  if (value === null || value === undefined || value === "") return Number.NaN;
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

/**
 * True when `ms` is a real timestamp no more than `windowDays` behind `nowMs`
 * and no more than FUTURE_SKEW_MS ahead of it.
 */
function isUsableDate(ms: number, nowMs: number, windowDays: number): boolean {
  if (Number.isNaN(ms)) return false;
  const ageMs = nowMs - ms;
  if (ageMs < -FUTURE_SKEW_MS) return false;
  return ageMs <= windowDays * MS_PER_DAY;
}

/**
 * Why: See this file's header — the pre-#132 `||` made the search provider's
 * date unconditionally authoritative over the article's own text.
 * What: Applies four rules in order and returns both the date and which rule
 * won.
 *   1. `article` — the LLM-extracted date, when it parses, is not more than
 *      FUTURE_SKEW_MS in the future, and falls inside the freshness window.
 *   2. `search` — the provider's date, under the same usability test.
 *   3. `discovery` — the run's discovery time, but ONLY for a candidate the
 *      `time_range: 'day'` recency pass found. Tavily asserting "last 24h" is
 *      an independent freshness signal; for a window-pass candidate no such
 *      assertion exists, so inventing a date from the run clock would
 *      manufacture freshness rather than record it.
 *   4. `fallback` — `validatePublishedDate` over whatever exists, in the
 *      pre-#132 order (search date, then article date). This preserves today's
 *      behavior exactly for a window candidate whose every signal is stale.
 * Test: `resolveEffectivePublishedDate` cases in published-date-resolver.test.ts.
 */
export function resolveEffectivePublishedDate(
  input: ResolvePublishedDateInput
): EffectivePublishedDate {
  const {
    articleDate,
    searchDate,
    discoveredVia,
    discoveredAt,
    nowMs = Date.now(),
    windowDays = RESOLVER_WINDOW_DAYS,
  } = input;

  const articleMs = parseMs(articleDate);
  if (isUsableDate(articleMs, nowMs, windowDays)) {
    return { date: new Date(articleMs), source: "article" };
  }

  const searchMs = parseMs(searchDate);
  if (isUsableDate(searchMs, nowMs, windowDays)) {
    return { date: new Date(searchMs), source: "search" };
  }

  if (discoveredVia === "recency") {
    const discoveredMs = parseMs(discoveredAt);
    if (!Number.isNaN(discoveredMs)) {
      return { date: new Date(discoveredMs), source: "discovery" };
    }
  }

  return { date: validatePublishedDate(searchDate || articleDate), source: "fallback" };
}
