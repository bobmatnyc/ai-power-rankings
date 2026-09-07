import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

/**
 * Pins the SQL classification against the JavaScript ladder it replaced (#140).
 *
 * Why: `/api/news` derived `event_type` in JavaScript over a fetched pool, which
 * is why `offset` could not go into the query. Moving the derivation into SQL is
 * what removes the pool — but it also means the keyword ladders live in one
 * place now, and a dropped or reordered keyword silently reclassifies articles.
 * The lists below are written out again here rather than imported, so this file
 * disagrees with the module if either side changes alone.
 *
 * What: Renders `newsEventTypeSql()` through the real `PgDialect` and checks the
 * cascade's shape — tags consulted before text, ladder rungs in the same order
 * the `if`/`else if` chain used, `'update'` as the fallthrough — plus every
 * keyword the deleted route code tested for.
 *
 * Test: `npx vitest run lib/db/news-event-type.test.ts`.
 */

import { NEWS_EVENT_TYPES, newsEventTypeSql } from "./news-event-type";

const rendered = new PgDialect().sqlToQuery(newsEventTypeSql());
const statement = rendered.sql;
const patterns = rendered.params as string[];

/** The tag ladder as app/api/news/route.ts tested it, in its original order. */
const TAG_LADDER: Array<[string, string[]]> = [
  ["milestone", ["milestone", "revenue", "funding", "growth", "valuation", "series", "unicorn"]],
  ["feature", ["launch", "beta", "general-availability", "benchmark", "performance", "release"]],
  ["partnership", ["partnership", "integration", "collaboration"]],
  ["announcement", ["rebrand", "acquisition"]],
];

/** The content-analysis ladder, likewise. */
const TEXT_LADDER: Array<[string, string[]]> = [
  [
    "milestone",
    [
      "funding",
      "raised",
      "investment",
      "valuation",
      "arr",
      "unicorn",
      "series",
      "customers",
      "revenue",
      "growth",
      "users",
    ],
  ],
  [
    "feature",
    [
      "launch",
      "released",
      "feature",
      "introduces",
      "announces",
      "unveils",
      "debuts",
      "new model",
      "introducing",
      "rolls out",
      "ships",
      "releases",
    ],
  ],
  [
    "partnership",
    [
      "partnership",
      "acquired",
      "acquisition",
      "integrates",
      "collaboration",
      "joins",
      "integrating",
      "integrated with",
      "teams up",
    ],
  ],
  [
    "announcement",
    [
      "rebrand",
      "stepping down",
      "appointed",
      "new ceo",
      "new chief",
      "rebranding",
      "spin-off",
      "merger",
    ],
  ],
];

describe("newsEventTypeSql (#140)", () => {
  it("reads tags first, then title plus summary-or-content", () => {
    const tagHaystack = statement.indexOf("array_to_string");
    const textHaystack = statement.indexOf('"title"');

    expect(tagHaystack).toBeGreaterThan(-1);
    expect(textHaystack).toBeGreaterThan(-1);
    expect(tagHaystack).toBeLessThan(textHaystack);
  });

  it("falls back to content only where the JavaScript `||` did", () => {
    // `summary || content || ""` treats an empty-string summary as absent, which
    // a bare coalesce on NULL would not.
    expect(statement).toContain("nullif");
    expect(statement).toContain('"summary"');
    expect(statement).toContain('"content"');
    // Both haystacks are compared case-insensitively, as `.toLowerCase()` was.
    expect(statement).toContain("lower(");
  });

  it("defaults to update when no rung matches", () => {
    expect(statement.toLowerCase()).toContain("coalesce");
    expect(statement).toContain("'update'");
    expect(statement.lastIndexOf("'update'")).toBeGreaterThan(statement.lastIndexOf("'rebrand'"));
  });

  it("keeps every rung in ladder order, so a substring cannot win over its prefix", () => {
    // "launch" is a substring of "launches": milestone must be tested first, or
    // a funding launch reclassifies from milestone to feature.
    for (const ladder of [TAG_LADDER, TEXT_LADDER]) {
      const positions = ladder.map(([eventType]) => statement.indexOf(`'${eventType}'`));
      expect(positions.every((position) => position > -1)).toBe(true);
    }

    const first = statement.indexOf("'milestone'");
    const second = statement.indexOf("'feature'");
    const third = statement.indexOf("'partnership'");
    const fourth = statement.indexOf("'announcement'");
    expect(first).toBeLessThan(second);
    expect(second).toBeLessThan(third);
    expect(third).toBeLessThan(fourth);
  });

  it("carries every keyword the deleted JavaScript tested for, as a LIKE pattern", () => {
    const expected = [...TAG_LADDER, ...TEXT_LADDER].flatMap(([, keywords]) => keywords);

    for (const keyword of expected) {
      expect(patterns, keyword).toContain(`%${keyword}%`);
    }
    // No stray extras: the two ladders account for every bound pattern.
    expect(patterns).toHaveLength(
      TAG_LADDER.reduce((sum, [, k]) => sum + k.length, 0) +
        TEXT_LADDER.reduce((sum, [, k]) => sum + k.length, 0)
    );
  });

  it("names only classifications the type union declares", () => {
    const quoted = statement.match(/'[a-z]+'/g) ?? [];
    const literals = new Set(quoted.map((value) => value.slice(1, -1)));
    literals.delete("");

    for (const literal of literals) {
      expect(NEWS_EVENT_TYPES, literal).toContain(literal);
    }
  });
});
