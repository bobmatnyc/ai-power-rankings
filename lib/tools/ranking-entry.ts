/**
 * Reads one tool's row out of a stored `rankings.data` snapshot (#193).
 *
 * Why: the tool page shows rank and score twice: the client header (from
 * `/api/tools/[slug]/json`) and the server profile block. Both read the same
 * `is_current` snapshot through these helpers, so the two cannot disagree on
 * which row belongs to a tool or which field holds its rank and score.
 * What: `rankingEntries()` unwraps the three stored shapes, `matchesTool()` is
 * the tool-to-row rule, `entryRank()` / `entryScore()` read the displayed rank
 * and overall score. Pure; no I/O.
 * Test: `tests/unit/tool-profile-193.test.tsx`.
 */

export type RawRankingEntry = Record<string, unknown>;

/** The tool fields a snapshot row is matched on. */
export interface RankingMatchTool {
  id: string;
  slug: string;
  name: string;
}

/** The entries of a snapshot stored as an array, `{ rankings: [] }` or `{ data: [] }`; else `[]`. */
export function rankingEntries(data: unknown): RawRankingEntry[] {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? Array.isArray((data as RawRankingEntry)["rankings"])
        ? ((data as RawRankingEntry)["rankings"] as unknown[])
        : Array.isArray((data as RawRankingEntry)["data"])
          ? ((data as RawRankingEntry)["data"] as unknown[])
          : []
      : [];
  return list.filter((entry): entry is RawRankingEntry => !!entry && typeof entry === "object");
}

/** True when the row is the tool's: same tool id, same slug, or the same name ignoring case. */
export function matchesTool(
  entry: { tool_id?: unknown; tool_slug?: unknown; tool_name?: unknown },
  tool: RankingMatchTool
): boolean {
  const name = entry.tool_name;
  return (
    entry.tool_id === tool.id ||
    entry.tool_slug === tool.slug ||
    (typeof name === "string" && name.toLowerCase() === tool.name.toLowerCase())
  );
}

const positive = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value !== 0 ? value : undefined;

/** The displayed rank: `rank`, else `position`, else 0. */
export function entryRank(entry: RawRankingEntry): number {
  return positive(entry["rank"]) ?? positive(entry["position"]) ?? 0;
}

/** The displayed overall score: `factor_scores.overall`, else `score`, else `total_score`, else 0. */
export function entryScore(entry: RawRankingEntry): number {
  const factors = entry["factor_scores"];
  const overall = factors && typeof factors === "object" ? (factors as RawRankingEntry)["overall"] : undefined;
  return positive(overall) ?? positive(entry["score"]) ?? positive(entry["total_score"]) ?? 0;
}
