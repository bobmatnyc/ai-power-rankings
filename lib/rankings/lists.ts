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
 *   - `isRankingListIndexable()` / `listHasMetricsPendingNote()`: the models list is indexed
 *     only with 10 or more active rows carrying a Vals TB 4.0 figure (`hasCodingMetric`, D86); below
 *     that it is noindex with the metrics-pending note (#329, D63 amends D80).
 *   - `rankingListPath()` / `listFromSlug()`: `/rankings` is the harness board (D51);
 *     the other lists live under `/rankings/<slug>`.
 *   `COMBINED_LIST` names the legacy one-board rows kept for rollback and export (D55).
 * Test: `tests/unit/ranking-lists-186.test.ts`, `tests/unit/models-list-noindex.test.tsx`,
 *   `tests/unit/models-list-index-rule-329.test.ts`
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

/**
 * #329 (D63, amends D80): lists whose order means nothing until their rows carry coding
 * metrics. Such a list is indexed only when at least `METRIC_INDEX_MIN_ROWS` of its active
 * rows carry a Vals TB 4.0 figure (`hasCodingMetric`, D86); below that it stays noindex with
 * the provisional note.
 */
export const METRIC_GATED_LISTS: readonly RankingList[] = ["model"];

/** #329 (D63): active rows with metrics a metric-gated list needs before it is indexed. */
export const METRIC_INDEX_MIN_ROWS = 10;

/**
 * #329 (D63, Q1): the only accepted source of a model's `terminal_bench`: the Vals
 * Terminal-Bench 4.0 leaderboard (one harness for every model). A fragment may name the snapshot.
 */
export const MODEL_TERMINAL_BENCH_SOURCE = "https://www.vals.ai/benchmarks/terminal-bench-4";

export function isMetricGatedList(list: RankingList): boolean {
  return METRIC_GATED_LISTS.includes(list);
}

function positiveNumber(value: unknown): boolean {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function provenanceSource(data: Record<string, unknown>, key: string): string | null {
  const all = data["metrics_provenance"];
  if (typeof all !== "object" || all === null) return null;
  const entry = (all as Record<string, unknown>)[key];
  if (typeof entry !== "object" || entry === null) return null;
  const source = (entry as Record<string, unknown>)["source"];
  return typeof source === "string" && /^https:\/\/\S+$/.test(source) ? source : null;
}

/**
 * Why: D63 lifts the models list's noindex only when its rows are ranked by real coding
 *   evidence, so "has metrics" needs one definition every reader shares (#329).
 * What: true only when the tool data (`tools.data`, canonical top-level paths) holds a positive
 *   `metrics.terminal_bench` whose `metrics_provenance.terminal_bench.source` is the Vals
 *   TB 4.0 page (`MODEL_TERMINAL_BENCH_SOURCE`; D63 Q1, D86). A SWE-bench Verified figure, from
 *   any source, does not count (D86), nor does a TB figure without provenance, a vendor or TB 2.1
 *   figure, or a nested `info.metrics` copy. This is the index-threshold count only; scoring
 *   still reads `swe_bench` as before. Status is not read here; callers count active rows only.
 * Test: `tests/unit/models-list-index-rule-329.test.ts`
 */
export function hasCodingMetric(toolData: unknown): boolean {
  if (typeof toolData !== "object" || toolData === null) return false;
  const data = toolData as Record<string, unknown>;
  const metrics = data["metrics"];
  if (typeof metrics !== "object" || metrics === null) return false;
  // #329 D86: count Vals TB 4.0 only; swe_bench never counts toward the index threshold.
  const tbSource = provenanceSource(data, "terminal_bench");
  return (
    positiveNumber((metrics as Record<string, unknown>)["terminal_bench"]) &&
    tbSource !== null &&
    tbSource.split("#")[0] === MODEL_TERMINAL_BENCH_SOURCE
  );
}

/**
 * True when `list` page may be indexed: the D53 size rule and, for a metric-gated list
 * (#329, D63), at least `METRIC_INDEX_MIN_ROWS` active rows with metrics.
 */
export function isRankingListIndexable(list: RankingList, entryCount: number, metricRowCount = 0): boolean {
  if (isMetricGatedList(list) && metricRowCount < METRIC_INDEX_MIN_ROWS) return false;
  return isListIndexable(entryCount);
}

/**
 * True when the list page says its order is provisional because model metrics are not
 * collected yet: a metric-gated list below `METRIC_INDEX_MIN_ROWS` active rows with metrics (#329).
 */
export function listHasMetricsPendingNote(list: RankingList, metricRowCount = 0): boolean {
  return isMetricGatedList(list) && metricRowCount < METRIC_INDEX_MIN_ROWS;
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
  /** #329: active rows on the board that carry a coding metric (`hasCodingMetric`). */
  metric_row_count: number;
  /** #329: the page shows the metrics-pending note (a metric-gated list below the D63 threshold). */
  metrics_pending_note: boolean;
}

export function rankingListMeta(list: RankingList, entryCount: number, metricRowCount = 0): RankingListMeta {
  return {
    list,
    slug: LIST_SLUGS[list],
    path: rankingListPath(list),
    entry_count: entryCount,
    indexable: isRankingListIndexable(list, entryCount, metricRowCount),
    tier_scheme: listTierScheme(entryCount),
    provisional_note: listHasProvisionalNote(list),
    metric_row_count: metricRowCount,
    metrics_pending_note: listHasMetricsPendingNote(list, metricRowCount),
  };
}
