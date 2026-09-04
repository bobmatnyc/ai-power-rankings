import { describe, expect, it } from "vitest";
import {
  RESOLVER_WINDOW_DAYS,
  resolveEffectivePublishedDate,
} from "./published-date-resolver";

/**
 * Regression tests for #132 phase B — insert-time effective published date.
 *
 * Why: the insert path chose `metadata.publishedDate || analysis.published_date`.
 * Tavily's date is almost always truthy, so it beat the date the LLM read out
 * of the article text every time — the direct mechanism behind the 2026-09-03
 * run inserting three same-day articles dated Aug 20, Aug 21 and Aug 30.
 *
 * What: Pins the four-rule precedence and, for each rule, which one won. The
 * cases that matter most are the ones a naive "use now() when the article date
 * is bad" fix would get wrong: an unparseable article date must fall through to
 * a usable Tavily date, and a window-pass candidate with every signal stale
 * must never be handed the run clock.
 *
 * Test: `npx vitest run lib/services/published-date-resolver.test.ts`.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-03T06:00:00.000Z").getTime();

function daysBefore(days: number): string {
  return new Date(NOW - days * MS_PER_DAY).toISOString();
}

function hoursAfter(hours: number): string {
  return new Date(NOW + hours * 60 * 60 * 1000).toISOString();
}

describe("resolveEffectivePublishedDate (#132)", () => {
  it("prefers the LLM-extracted article date when it is inside the window", () => {
    const articleDate = daysBefore(0.2);

    const resolved = resolveEffectivePublishedDate({
      articleDate,
      searchDate: daysBefore(14 + 0.001),
      discoveredVia: "recency",
      discoveredAt: NOW,
      nowMs: NOW,
    });

    expect(resolved.source).toBe("article");
    expect(resolved.date.toISOString()).toBe(articleDate);
  });

  /**
   * The case a "fall back to now() whenever the article date is unusable" fix
   * gets wrong. An unparseable model output is a missing signal, not evidence
   * the article is new — a usable provider date still outranks the run clock.
   */
  it("falls to the Tavily date when the LLM date is unparseable, not to now()", () => {
    const searchDate = daysBefore(4);

    const resolved = resolveEffectivePublishedDate({
      articleDate: "not a date at all",
      searchDate,
      discoveredVia: "recency",
      discoveredAt: NOW,
      nowMs: NOW,
    });

    expect(resolved.source).toBe("search");
    expect(resolved.date.toISOString()).toBe(searchDate);
  });

  /**
   * AIAnalyzer.analyzeContent normalizes a null `published_date` to undefined
   * before Zod validation (article-ingestion.service.ts), so undefined is the
   * shape a missing article date actually arrives in.
   */
  it("treats an undefined LLM date as no signal", () => {
    const searchDate = daysBefore(4);

    const resolved = resolveEffectivePublishedDate({
      articleDate: undefined,
      searchDate,
      discoveredVia: "window",
      discoveredAt: NOW,
      nowMs: NOW,
    });

    expect(resolved.source).toBe("search");
    expect(resolved.date.toISOString()).toBe(searchDate);
  });

  it("rejects an LLM date more than a day in the future", () => {
    const searchDate = daysBefore(4);

    const resolved = resolveEffectivePublishedDate({
      articleDate: hoursAfter(72),
      searchDate,
      discoveredVia: "window",
      nowMs: NOW,
    });

    expect(resolved.source).toBe("search");
    expect(resolved.date.toISOString()).toBe(searchDate);
  });

  it("accepts an LLM date inside the 24h clock-skew allowance", () => {
    const articleDate = hoursAfter(6);

    const resolved = resolveEffectivePublishedDate({
      articleDate,
      searchDate: daysBefore(4),
      discoveredVia: "window",
      nowMs: NOW,
    });

    expect(resolved.source).toBe("article");
    expect(resolved.date.toISOString()).toBe(articleDate);
  });

  it("uses the run's discovery time for a recency candidate when both dates are stale", () => {
    const resolved = resolveEffectivePublishedDate({
      articleDate: daysBefore(40),
      searchDate: daysBefore(30),
      discoveredVia: "recency",
      discoveredAt: NOW,
      nowMs: NOW,
    });

    expect(resolved.source).toBe("discovery");
    expect(resolved.date.getTime()).toBe(NOW);
  });

  /**
   * The guard against manufacturing freshness. A window-pass candidate carries
   * no independent last-24h assertion, so a stale pair falls to the pre-#132
   * fallback — never to the run clock.
   */
  it("falls back rather than using discovery time for a stale window candidate", () => {
    const searchDate = daysBefore(30);

    const resolved = resolveEffectivePublishedDate({
      articleDate: daysBefore(40),
      searchDate,
      discoveredVia: "window",
      discoveredAt: NOW,
      nowMs: NOW,
    });

    expect(resolved.source).toBe("fallback");
    expect(resolved.date.toISOString()).toBe(searchDate);
  });

  it("falls back for a recency candidate with no usable discovery time", () => {
    const searchDate = daysBefore(30);

    const resolved = resolveEffectivePublishedDate({
      articleDate: null,
      searchDate,
      discoveredVia: "recency",
      discoveredAt: "not a date",
      nowMs: NOW,
    });

    expect(resolved.source).toBe("fallback");
    expect(resolved.date.toISOString()).toBe(searchDate);
  });

  it("stamps now() through the fallback when no signal exists at all", () => {
    const resolved = resolveEffectivePublishedDate({
      articleDate: undefined,
      searchDate: undefined,
      discoveredVia: "window",
      nowMs: NOW,
    });

    expect(resolved.source).toBe("fallback");
    expect(Number.isNaN(resolved.date.getTime())).toBe(false);
  });

  it("honors a widened window so an operator backfill is not gated back down", () => {
    const articleDate = daysBefore(RESOLVER_WINDOW_DAYS + 6);

    const resolved = resolveEffectivePublishedDate({
      articleDate,
      searchDate: daysBefore(2),
      discoveredVia: "window",
      nowMs: NOW,
      windowDays: 30,
    });

    expect(resolved.source).toBe("article");
    expect(resolved.date.toISOString()).toBe(articleDate);
  });
});
