/**
 * The public ranking lists: which tools each one ranks, its URL, and its publish rules (#186).
 *
 * Why: #186 replaces the one interim global board with one board per list. A tool is
 *   ranked in at most one list, and ranks, tiers and indexing are counted within that
 *   list (D2e, D2f), so every reader and writer must agree on membership and the rules.
 * What: pure helpers, no database.
 *   - `listOfTool()`: a `tools.kind` maps to its list; `other` and an unknown kind map to
 *     none. An image or video model (`data.modality`) maps to none (D52).
 *   - `parseRankingListParam()`: the `list` (or `kind`) query value; absent means the
 *     coding-harness list (D51); an unknown value is an error, never a default.
 *   - `listTier()` / `isListIndexable()`: a list of 10 or more entries is indexed with the
 *     normal tiers; a shorter one is noindex and its tiers are S/A/B by thirds (D53).
 *   - `listHasProvisionalNote()`: only productivity carries the public note (D54).
 *   - `rankingListPath()` / `listFromSlug()`: `/rankings` is the harness board (D51);
 *     the other lists live under `/rankings/<slug>`.
 *   `COMBINED_LIST` names the legacy one-board rows kept for rollback and export (D55).
 * Test: `tests/unit/ranking-lists-186.test.ts`
 */

import { calculateTier } from "@/lib/ranking-utils";

/** #186: the public lists, keyed by the `tools.kind` they rank. */
export const RANKING_LISTS = ["harness", "model", "productivity"] as const;
export type RankingList = (typeof RANKING_LISTS)[number];

/** D51: the list an unqualified `/rankings` and `/api/rankings` return. */
export const DEFAULT_RANKING_LIST: RankingList = "harness";

/** D55: the `rankings.list` value of the legacy one-board rows (migration 0020 default). */
export const COMBINED_LIST = "combined";
export type StoredRankingList = RankingList | typeof COMBINED_LIST;
export const STORED_RANKING_LISTS: readonly StoredRankingList[] = [COMBINED_LIST, ...RANKING_LISTS];

/** URL segment of each list under `/rankings/`. The harness board is also `/rankings` (D51). */
export const LIST_SLUGS: Readonly<Record<RankingList, string>> = {
  harness: "coding-harnesses",
  model: "models",
  productivity: "productivity-tools",
};

/** D52: models of these `data.modality` values stay out of the `models` list. */
export const EXCLUDED_MODEL_MODALITIES: readonly string[] = ["image", "video"];

/** D53: a list with at least this many entries is indexed and keeps the normal tiers. */
export const INDEX_MIN_ENTRIES = 10;

export type TierScheme = "standard" | "thirds";

function isRankingList(value: string): value is RankingList {
  return (RANKING_LISTS as readonly string[]).includes(value);
}

/**
 * The list a tool is ranked in, or null when it is ranked in none.
 *
 * Postcondition: a non-null result equals `kind`, so one tool maps to one list.
 */
export function listOfTool(kind: unknown, modality: unknown): RankingList | null {
  if (typeof kind !== "string" || !isRankingList(kind)) return null;
  // D52: image and video models are not ranked in `models` (a later list may use modality).
  if (kind === "model" && typeof modality === "string" && EXCLUDED_MODEL_MODALITIES.includes(modality.trim().toLowerCase())) {
    return null;
  }
  return kind;
}

/** The list a `/rankings/<slug>` segment names, or null. */
export function listFromSlug(slug: string): RankingList | null {
  const found = RANKING_LISTS.find((list) => LIST_SLUGS[list] === slug);
  return found ?? null;
}

export type ParsedListParam = { ok: true; list: RankingList; defaulted: boolean } | { ok: false; error: string };

/**
 * Parse the `list` query value (a list id such as `model`, or its slug such as `models`).
 * Absent or empty means the default list (D51); anything else unknown is an error.
 */
export function parseRankingListParam(raw: string | null | undefined): ParsedListParam {
  const value = raw?.trim().toLowerCase() ?? "";
  if (value === "") return { ok: true, list: DEFAULT_RANKING_LIST, defaulted: true };
  const list = isRankingList(value) ? value : listFromSlug(value);
  if (list) return { ok: true, list, defaulted: false };
  return { ok: false, error: `unknown list "${raw}"; expected one of ${RANKING_LISTS.join(", ")}` };
}

/** The path (without locale) of a list's canonical page. D51: the harness board is `/rankings`. */
export function rankingListPath(list: RankingList): string {
  return list === DEFAULT_RANKING_LIST ? "/rankings" : `/rankings/${LIST_SLUGS[list]}`;
}

/** D53: true when a list of `entryCount` entries is indexed. */
export function isListIndexable(entryCount: number): boolean {
  return entryCount >= INDEX_MIN_ENTRIES;
}

/** D53: the tier scheme for a list of `entryCount` entries. */
export function listTierScheme(entryCount: number): TierScheme {
  return isListIndexable(entryCount) ? "standard" : "thirds";
}

/**
 * The tier of `rank` (1-based) in a list of `entryCount` entries (D53).
 *
 * Precondition: 1 <= rank <= entryCount. Standard scheme: the public S-D tiers by rank.
 * Thirds scheme: the first third S, the second A, the last B (`floor(3 * (rank - 1) / n)`).
 */
export function listTier(rank: number, entryCount: number): string {
  if (!Number.isInteger(rank) || rank < 1 || rank > entryCount) {
    throw new RangeError(`rank ${rank} is outside a list of ${entryCount}`);
  }
  if (listTierScheme(entryCount) === "standard") return calculateTier(rank);
  return ["S", "A", "B"][Math.floor((3 * (rank - 1)) / entryCount)]!;
}

/** D54: the productivity list ships with provisional harness weights and says so on its page. */
export function listHasProvisionalNote(list: RankingList): boolean {
  return list === "productivity";
}

/** What a response or page says about the list it shows. */
export interface RankingListMeta {
  list: RankingList;
  slug: string;
  path: string;
  entry_count: number;
  indexable: boolean;
  tier_scheme: TierScheme;
  provisional_note: boolean;
}

export function rankingListMeta(list: RankingList, entryCount: number): RankingListMeta {
  return {
    list,
    slug: LIST_SLUGS[list],
    path: rankingListPath(list),
    entry_count: entryCount,
    indexable: isListIndexable(entryCount),
    tier_scheme: listTierScheme(entryCount),
    provisional_note: listHasProvisionalNote(list),
  };
}
