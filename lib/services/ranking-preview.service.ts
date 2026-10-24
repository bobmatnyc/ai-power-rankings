/**
 * Admin ranking preview on the current engine (#93).
 *
 * Why: #93 moves `POST /api/admin/rankings` `action: "preview"` off the
 *   retired V6 engine. A preview must score exactly as the monthly cron does
 *   and must never write.
 * What: `previewRankings()` runs `regenerateRankings()` in "dry-run" mode, so
 *   no persistence method that writes is called. `buildPreviewComparison()`
 *   shapes the rows into the `rankings_comparison` array the route returned
 *   before, against a comparison snapshot in either stored shape.
 * Test: `lib/services/ranking-preview.service.test.ts`
 */

import {
  createDbPersistence,
  type RankingEntry,
  type RankingPersistencePort,
  type RankingSourceTool,
  regenerateRankings,
} from "./ranking-generation.service";

/** One row of the preview's `rankings_comparison` (response shape before #93). */
export interface PreviewComparisonRow {
  tool_id: string;
  tool_name: string;
  category: string;
  current_rank: number;
  current_score: number;
  previous_rank: number | undefined;
  previous_score: number | undefined;
  rank_change: number;
  score_change: number;
  movement: "new" | "up" | "down" | "same";
}

/** Rows of a stored snapshot: the cron's bare array or the older `{ rankings: [] }`. */
export function snapshotRows(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  const wrapped = (data as { rankings?: unknown } | null)?.rankings;
  return Array.isArray(wrapped) ? (wrapped as Array<Record<string, unknown>>) : [];
}

/**
 * Keep tools whose `data.launch_date` is on or before `previewDate`. A tool
 * with no parseable launch date is kept.
 */
export function filterByPreviewDate(sourceTools: RankingSourceTool[], previewDate: Date): RankingSourceTool[] {
  return sourceTools.filter((tool) => {
    const raw = tool.data?.["launch_date"];
    if (typeof raw !== "string" && typeof raw !== "number") return true;
    const launched = new Date(raw);
    return Number.isNaN(launched.getTime()) || launched <= previewDate;
  });
}

/** Compare computed rows with a prior snapshot, keyed by `tool_id`. */
export function buildPreviewComparison(entries: RankingEntry[], comparisonData: unknown): PreviewComparisonRow[] {
  const previous = new Map(snapshotRows(comparisonData).map((row) => [row["tool_id"], row]));

  return entries.map((entry) => {
    const prior = previous.get(entry.tool_id);
    // #93: older rows carry `position`, cron rows carry `rank`.
    const priorRank = (prior?.["rank"] ?? prior?.["position"]) as number | undefined;
    const priorScore = prior?.["score"] as number | undefined;
    return {
      tool_id: entry.tool_id,
      tool_name: entry.tool_name,
      category: entry.category || "",
      current_rank: entry.rank,
      current_score: entry.score,
      previous_rank: priorRank,
      previous_score: priorScore,
      rank_change: priorRank ? priorRank - entry.rank : 0,
      score_change: prior ? entry.score - (priorScore ?? 0) : entry.score,
      movement: !priorRank ? "new" : priorRank > entry.rank ? "up" : priorRank < entry.rank ? "down" : "same",
    };
  });
}

export interface PreviewRankingsOptions {
  period: string;
  /** Keep only tools launched on or before this date, and score at this date. */
  previewDate?: Date;
  persistence?: RankingPersistencePort;
  now?: () => Date;
}

/** Score the active tools as the cron would, writing nothing. */
export async function previewRankings(options: PreviewRankingsOptions): Promise<RankingEntry[]> {
  const base = options.persistence ?? createDbPersistence();
  const { previewDate } = options;
  const persistence: RankingPersistencePort = previewDate
    ? { ...base, loadActiveTools: async () => filterByPreviewDate(await base.loadActiveTools(), previewDate) }
    : base;
  const now = previewDate ? () => previewDate : options.now;

  const result = await regenerateRankings({
    period: options.period,
    mode: "dry-run",
    persistence,
    ...(now ? { now } : {}),
  });
  return result.entries;
}
