/**
 * The `event_type` a news article is classified as, derived inside SQL.
 *
 * Why: `/api/news` classified every article in JavaScript after fetching a fixed
 * `limit * 3` pool, then filtered and sliced that pool. `event_type` is the only
 * filter the route accepts, so as long as it existed only in JavaScript the
 * route could not push `offset` into the query, `total` could not be a real
 * `COUNT(*)`, and any offset past the pool returned an empty page (#140).
 * Nothing about the classification needs the row in memory — it reads `tags`,
 * `title`, `summary` and `content`, all columns — so it moves here and becomes
 * the single definition, used by the SELECT list, the WHERE clause and the
 * COUNT alike.
 * What: Reproduces the route's original keyword ladder as a `CASE` cascade:
 * tags decide first, then `title` joined with summary-or-content, else
 * `"update"`. Rule order inside each ladder is significant and matches the
 * `if`/`else if` chain it replaces — "launch" is a substring of "launches", so
 * milestone must be tested before feature.
 * Test: `lib/db/news-event-type.test.ts`.
 */

import { type SQL, sql } from "drizzle-orm";
import { articles } from "./article-schema";

export const NEWS_EVENT_TYPES = [
  "milestone",
  "feature",
  "partnership",
  "announcement",
  "update",
] as const;

export type NewsEventType = (typeof NEWS_EVENT_TYPES)[number];

/** One rung of a classification ladder: the type, and the substrings that pick it. */
type Rule = readonly [NewsEventType, readonly string[]];

/** Applied to `tags`, joined with spaces — the first ladder the route consults. */
const TAG_RULES: readonly Rule[] = [
  ["milestone", ["milestone", "revenue", "funding", "growth", "valuation", "series", "unicorn"]],
  ["feature", ["launch", "beta", "general-availability", "benchmark", "performance", "release"]],
  ["partnership", ["partnership", "integration", "collaboration"]],
  ["announcement", ["rebrand", "acquisition"]],
];

/** Applied to title + summary-or-content, only when the tag ladder picks nothing. */
const TEXT_RULES: readonly Rule[] = [
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

/** `tags.join(" ").toLowerCase()`; a NULL or empty array matches no keyword. */
const TAG_HAYSTACK = sql`lower(coalesce(array_to_string(${articles.tags}, ' '), ''))`;

/**
 * `${title} ${summary || content || ""}`, lowercased. `nullif` reproduces the
 * JavaScript `||`, which falls through to `content` on an empty-string summary
 * as well as on NULL.
 */
const TEXT_HAYSTACK = sql`lower(${articles.title} || ' ' || coalesce(nullif(${articles.summary}, ''), ${articles.content}, ''))`;

/** `haystack LIKE ANY (ARRAY['%needle%', ...]::text[])`. Needles are bound, not inlined. */
function matchesAny(haystack: SQL, needles: readonly string[]): SQL {
  const patterns = needles.map((needle) => sql`${`%${needle}%`}`);
  return sql`${haystack} like any (array[${sql.join(patterns, sql`, `)}]::text[])`;
}

/** The `CASE` for one ladder; NULL when no rung matches, so `coalesce` can fall through. */
function ladder(haystack: SQL, rules: readonly Rule[]): SQL {
  const branches = rules.map(([eventType, needles]) => {
    // Inlined rather than bound: eventType comes from NEWS_EVENT_TYPES, a frozen
    // literal union with no quote characters, and a bound CASE result would give
    // Postgres no type to infer the branch from.
    const literal = sql.raw(`'${eventType}'`);
    return sql`when ${matchesAny(haystack, needles)} then ${literal}`;
  });
  return sql`case ${sql.join(branches, sql` `)} end`;
}

/**
 * The full classification, usable anywhere a column expression is.
 *
 * Why: One definition shared by the SELECT list, the `event_type` filter and the
 * `COUNT(*)` means a filtered page and its total can never disagree.
 * What: Tag ladder, then text ladder, then the `"update"` default.
 * Test: `lib/db/news-event-type.test.ts`, `lib/db/repositories/news.test.ts`.
 */
export function newsEventTypeSql(): SQL<NewsEventType> {
  return sql`coalesce(${ladder(TAG_HAYSTACK, TAG_RULES)}, ${ladder(TEXT_HAYSTACK, TEXT_RULES)}, 'update')`;
}
