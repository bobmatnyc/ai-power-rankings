/**
 * The measured-only view of a metric-gated list's stored board (#329, Dfe option c).
 *
 * Why: the v8.1 model profile gives a model with no Terminal-Bench figure a neutral
 *   benchmark base, so an unmeasured model would rank above measured ones. The models
 *   board lists measured models only, and every public reader of a model's rank (the
 *   board, the tool page, `/api/rankings/current`, `/api/tools/[slug]/json`) must show
 *   the same rank and "of N". A stored board written before the generation-side
 *   exclusion still holds every model, so the readers apply the same filter.
 * What: `renumberPrevious()` renumbers previous ranks 1..k among the rows of a board, so
 *   a filtered board never shows a move counted on the unfiltered one.
 *   `gateStoredEntries()` keeps a metric-gated list's measured entries in stored-rank
 *   order and renumbers rank, tier and movement; any other list's entries come back as
 *   the same array. `gateBoardEntries()` reads the entries' tools to decide which are
 *   measured (`hasCodingMetric`) and applies the gate; it reads nothing for a list that
 *   is not metric-gated.
 * Test: `tests/unit/models-public-rank-329.test.ts`.
 */
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { hasCodingMetric, isMetricGatedList, listTier, type RankingList } from "@/lib/rankings/lists";
import { entryRank, type RawRankingEntry } from "@/lib/tools/ranking-entry";

const positive = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

/**
 * PURE: movement for rows already in board order (row i has rank i + 1). Rows with a
 * previous rank are numbered 1..k in previous-rank order; a row without one stays null.
 * Postcondition: `change` is `previous - rank`, or 0 when `previous` is null.
 */
export function renumberPrevious(previous: ReadonlyArray<number | null>): Array<{ previous: number | null; change: number }> {
  const order = previous
    .map((p, i) => [p, i] as const)
    .filter((pair): pair is readonly [number, number] => pair[0] !== null)
    .sort((a, b) => a[0] - b[0]);
  const renumbered: Array<number | null> = previous.map(() => null);
  order.forEach(([, i], k) => {
    renumbered[i] = k + 1;
  });
  return renumbered.map((p, i) => ({ previous: p, change: p === null ? 0 : p - (i + 1) }));
}

const previousOf = (entry: RawRankingEntry): number | null => {
  const movement = entry["movement"];
  const stored = movement && typeof movement === "object" ? (movement as RawRankingEntry)["previous_position"] : undefined;
  return positive(stored) ?? positive(entry["previous_rank"]);
};

/**
 * PURE: a metric-gated list's entries kept where `isMeasured`, in stored-rank order, with
 * rank 1..n, the D53 tier and movement renumbered among them. Other lists: `entries` itself.
 */
export function gateStoredEntries(
  list: RankingList,
  entries: RawRankingEntry[],
  isMeasured: (entry: RawRankingEntry) => boolean
): RawRankingEntry[] {
  if (!isMetricGatedList(list)) return entries;
  const kept = entries.filter(isMeasured).sort((a, b) => (entryRank(a) || 999) - (entryRank(b) || 999));
  const moves = renumberPrevious(kept.map(previousOf));
  return kept.map((entry, i) => {
    const rank = i + 1;
    const { previous, change } = moves[i]!;
    const movement = entry["movement"] && typeof entry["movement"] === "object" ? (entry["movement"] as RawRankingEntry) : {};
    return {
      ...entry,
      rank,
      ...("position" in entry ? { position: rank } : {}),
      tier: listTier(rank, kept.length),
      movement: { ...movement, previous_position: previous, change, direction: change > 0 ? "up" : change < 0 ? "down" : "same" },
      ...("previous_rank" in entry ? { previous_rank: previous } : {}),
      ...("rank_change" in entry ? { rank_change: change } : {}),
    };
  });
}

/**
 * Whether each entry's tool (by stored `tool_id`, else `tool_slug`) carries a coding metric.
 * Exported so a reader of many boards (the trending route) looks the tools up once (#329).
 */
export async function measuredPredicate(
  entries: RawRankingEntry[],
  repo: ToolsRepository = new ToolsRepository()
): Promise<(entry: RawRankingEntry) => boolean> {
  const str = (value: unknown) => (typeof value === "string" && value ? value : null);
  const ids = [...new Set(entries.flatMap((e) => str(e["tool_id"]) ?? []))];
  const byKey = new Map<string, unknown>();
  for (const tool of await repo.findByIds(ids)) {
    const t = tool as Record<string, unknown>;
    for (const key of [str(t["db_id"]), str(t["id"])]) if (key) byKey.set(`id:${key}`, tool);
  }
  const slugs = [
    ...new Set(entries.flatMap((e) => (byKey.has(`id:${str(e["tool_id"])}`) ? [] : (str(e["tool_slug"]) ?? [])))),
  ];
  if (slugs.length > 0) {
    for (const tool of await repo.findBySlugs(slugs)) byKey.set(`slug:${tool.slug}`, tool);
  }
  return (entry) => {
    const tool = byKey.get(`id:${str(entry["tool_id"])}`) ?? byKey.get(`slug:${str(entry["tool_slug"])}`);
    return tool !== undefined && hasCodingMetric(tool);
  };
}

/** `gateStoredEntries()` with the measured rule read from the tools table; no read for other lists. */
export async function gateBoardEntries(
  list: RankingList,
  entries: RawRankingEntry[],
  repo: ToolsRepository = new ToolsRepository()
): Promise<RawRankingEntry[]> {
  if (!isMetricGatedList(list)) return entries;
  return gateStoredEntries(list, entries, await measuredPredicate(entries, repo));
}
