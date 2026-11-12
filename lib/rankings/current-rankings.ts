import { type RankingData, rankingsRepository } from "@/lib/db/repositories/rankings.repository";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { loggers } from "@/lib/logger";
import {
  DEFAULT_RANKING_LIST,
  hasCodingMetric,
  isMetricGatedList,
  listOfTool,
  listTier,
  type RankingList,
} from "@/lib/rankings/lists";
import { renumberPrevious } from "@/lib/rankings/metric-gated-board";
import { modelVersion } from "@/lib/rankings/model-version";
import { isNoindexToolSlug } from "@/lib/seo/url-table";

export interface CurrentListBoard {
  list: RankingList;
  snapshot: RankingData;
  rankings: CurrentRankingRow[];
  /** #329: active board rows with a coding metric (`hasCodingMetric`); 0 for a list that is not metric-gated. */
  metricRowCount: number;
}

/**
 * Reads one list's current board as display rows (#192, #186, #185).
 *
 * Why: `/api/rankings` and the home page must show the same rows, ranks and
 * rank changes, so both read the snapshot through this one function. #186: each
 * list has its own board, ranked within the list (D2e), and a tool is ranked in
 * at most one list. #185: after v8 activation the combined board is no public
 * view, so a list with no current row has no board; it is never the combined
 * board split by list.
 * What: reads the list's `is_current` row only; null when there is none.
 * Takes the snapshot's rankings array (an array, or one under `rankings` or
 * `data`), joins each entry to its tool by id then slug, drops entries whose tool
 * is missing (one warning each) or whose kind now maps to another list (or none),
 * sorts by stored rank and renumbers 1..n with tiers, keeping the stored
 * movement. #197: a tool whose slug is noindex (`isNoindexToolSlug`) is dropped
 * before ranks and the metric count. #329: for a metric-gated list (models) `metricRowCount` counts the
 * board rows whose `tools.status` column is `active` and whose tool carries a
 * coding metric (`hasCodingMetric`), for the index rule, and the board keeps
 * only rows whose tool carries a coding metric, ranked 1..n with previous ranks
 * renumbered among them; with none it is empty. Throws when a database read throws.
 * Test: `tests/unit/home-live-rankings-192.test.tsx`,
 *   `tests/unit/rankings-per-list-read-186.test.ts`,
 *   `tests/unit/models-list-metric-filter-329.test.ts`, `tests/unit/models-public-rank-329.test.ts`,
 *   `tests/unit/rankings-noindex-197.test.ts`.
 * #195: with `openWeightOnly`, the board keeps only rows whose `tools.open_weight` column
 * is true (`findOpenWeightIds`), ranked 1..n with previous ranks renumbered among them;
 * `metricRowCount` stays the whole board's. Without it, no open-weight read is made.
 * Test: `tests/unit/rankings-open-weight-195.test.ts`.
 */
export async function loadCurrentRankings(
  list: RankingList = DEFAULT_RANKING_LIST,
  options: BoardOptions = {}
): Promise<CurrentListBoard | null> {
  // #185: the list's own row or nothing; no fallback to the combined board.
  const snapshot = await rankingsRepository.getCurrentRankings(list);
  if (!snapshot) return null;
  return boardFromSnapshot(list, snapshot, options);
}

/** #195: `openWeightOnly` keeps only rows whose tool's `tools.open_weight` column is true. */
export interface BoardOptions {
  openWeightOnly?: boolean;
}

/**
 * #329: `loadCurrentRankings()` for a snapshot the caller already read, so
 * `/api/rankings/current` takes `metricRowCount` from the same count as `/api/rankings`.
 * Throws when a tools read throws (fails closed: no count, no board).
 */
export async function boardFromSnapshot(
  list: RankingList,
  snapshot: RankingData,
  options: BoardOptions = {}
): Promise<CurrentListBoard> {
  const rankingsData = snapshot.data;
  let rankings = [];

  // Handle different data structures that might be in the JSONB field
  if (Array.isArray(rankingsData)) {
    rankings = rankingsData;
  } else if (rankingsData && typeof rankingsData === "object") {
    if (rankingsData["rankings"] && Array.isArray(rankingsData["rankings"])) {
      rankings = rankingsData["rankings"];
    } else if (rankingsData["data"] && Array.isArray(rankingsData["data"])) {
      rankings = rankingsData["data"];
    }
  }

  const toolsRepo = new ToolsRepository();
  const formatted = await Promise.all(rankings.map((ranking: any) => formatRanking(ranking, toolsRepo)));

  // Filter out null values (tools that weren't found), then the tools of other lists.
  const joined = formatted.filter((r): r is FormattedRanking => r !== null);
  // #329: only ACTIVE rows with a coding metric count toward the index threshold, so a
  // metric-gated list (models) reads the `tools.status` COLUMN (the joined tool's `status`
  // can be a stale JSONB copy); a failed read rejects here (fails closed).
  const columnStatus = isMetricGatedList(list)
    ? await toolsRepo.findColumnStatuses(joined.flatMap((r) => (r.dbId ? [r.dbId] : [])))
    : new Map<string, string>();
  const statusOf = (r: FormattedRanking) => (r.dbId ? columnStatus.get(r.dbId) : undefined);
  const listed = joined.filter((r) => inList(r, list));
  // #197: a noindex tool (`isNoindexToolSlug`) is on no board; it leaves before ranks and the metric gate.
  const members = listed.filter((r) => !isNoindexToolSlug(r.row.tool.slug));

  // Sort by rank to ensure proper ordering
  members.sort((a, b) => (a.row.rank || 999) - (b.row.rank || 999));

  const metricRowCount = isMetricGatedList(list) ? countMetricRows(members.map((m) => ({ status: statusOf(m), codingMetric: m.codingMetric }))) : 0;
  // #195: the open-weight view keeps only rows whose open_weight column is true; the count above stays the whole board's.
  const shown = options.openWeightOnly ? await openWeightMembers(members, toolsRepo) : members;
  // #329: a metric-gated list ranks only rows with a coding metric; an unmeasured row's neutral
  // benchmark base would rank it above measured rows, so it is left off the board (option c, Dfe).
  if (!isMetricGatedList(list)) {
    const rows = shown.map((m) => m.row);
    // #197: with a noindex row dropped, previous ranks are renumbered among the rest, as `/api/rankings/current` does.
    return { list, snapshot, rankings: rankWithinList(shown.length < listed.length ? withRenumberedMoves(rows) : rows), metricRowCount };
  }
  // #329: previous ranks renumbered among the measured rows, so no move is counted on the unfiltered board.
  const board = withRenumberedMoves(shown.filter((m) => m.codingMetric).map((m) => m.row));
  return { list, snapshot, rankings: rankWithinList(board), metricRowCount };
}

/** #195: the members whose tool's `tools.open_weight` column is true, in board order; a failed read throws. */
async function openWeightMembers(members: FormattedRanking[], toolsRepo: ToolsRepository): Promise<FormattedRanking[]> {
  const open = await toolsRepo.findOpenWeightIds(members.flatMap((m) => (m.dbId ? [m.dbId] : [])));
  return members.filter((m) => m.dbId !== undefined && open.has(m.dbId));
}

/** PURE: rows in board order with previous rank and rank change renumbered among them (`renumberPrevious`). */
function withRenumberedMoves(rows: CurrentRankingRow[]): CurrentRankingRow[] {
  const moves = renumberPrevious(rows.map((row) => (typeof row.previousRank === "number" && row.previousRank > 0 ? row.previousRank : null)));
  return rows.map((row, i) => ({ ...row, previousRank: moves[i]!.previous, rankChange: moves[i]!.change }));
}

/** #329 PURE: rows that count toward the D63 index threshold: `tools.status` column active AND a coding metric. */
export function countMetricRows(rows: ReadonlyArray<{ status: string | undefined; codingMetric: boolean }>): number {
  return rows.filter((r) => r.status === "active" && r.codingMetric).length;
}

/**
 * #186: whether a joined row belongs on `list`'s board. A list row was written for this
 * list; it drops only a tool whose kind is known and now maps elsewhere (a row read
 * without a kind is kept as written).
 */
function inList(entry: FormattedRanking, list: RankingList): boolean {
  return entry.kind === undefined || entry.toolList === list;
}

/**
 * #186 PURE: ranks 1..n and tiers for one list's rows, in the given order. The
 * stored movement is kept: a list row's previous rank is already within the list.
 */
export function rankWithinList(rows: CurrentRankingRow[]): CurrentRankingRow[] {
  return rows.map((row, index) => {
    const rank = index + 1;
    return { ...row, rank, tier: listTier(rank, rows.length) };
  });
}

export type CurrentRankingRow = NonNullable<Awaited<ReturnType<typeof formatRanking>>>["row"];

type FormattedRanking = {
  row: CurrentRankingRow;
  kind: unknown;
  toolList: RankingList | null;
  /** The tool's row UUID (`db_id`), the key for the `tools.status` column lookup (#301, #329). */
  dbId: string | undefined;
  /** #329: the joined tool carries a coding metric with provenance (`hasCodingMetric`). */
  codingMetric: boolean;
};

/**
 * One snapshot entry joined to its tool: the `/api/rankings` row shape plus the tool's
 * kind and list (#186); null when the tool is missing.
 */
async function formatRanking(ranking: any, toolsRepo: ToolsRepository) {
  // Try to find tool by ID or slug
  let tool = null;

  if (ranking["tool_id"]) {
    tool = await toolsRepo.findById(ranking["tool_id"]);
  }

  if (!tool && ranking["tool_slug"]) {
    tool = await toolsRepo.findBySlug(ranking["tool_slug"]);
  }

  if (!tool) {
    loggers.api.warn("Tool not found for ranking", {
      toolId: ranking["tool_id"],
      toolSlug: ranking["tool_slug"],
    });
    return null;
  }

  // Parse tool info from database
  const toolInfo = (tool.info || {}) as any;
  const toolAsAny = tool as Record<string, any> | undefined;

  // Extract logo and fix path if needed (database has /tools/ but files are in /tool-icons/)
  let logoPath = toolAsAny?.logo_url || toolAsAny?.logo || toolInfo?.logo || null;
  if (logoPath && logoPath.startsWith('/tools/')) {
    logoPath = logoPath.replace('/tools/', '/tool-icons/');
  }

  // #186: membership reads the kind column and data.modality (D52) of the joined tool.
  const kind = toolAsAny?.["kind"];
  const toolList = listOfTool(kind, toolAsAny?.["modality"]);

  const row = {
    rank: ranking["rank"] || ranking["position"] || 1,
    previousRank:
      ranking["movement"]?.["previous_position"] || ranking["previous_rank"] || null,
    rankChange: ranking["movement"]?.["change"] || ranking["rank_change"] || 0,
    changeReason:
      ranking["change_analysis"]?.["primary_reason"] || ranking["change_reason"] || "",
    tool: {
      id: tool.id,
      slug: tool.slug,
      name: tool.name,
      category: tool.category,
      // #196: the `tools.subcategory` column (underscore form), which `?category=` filters on; null when unset.
      subcategory: typeof toolAsAny?.["subcategory"] === "string" ? (toolAsAny["subcategory"] as string) : null,
      status: tool.status,
      website_url: toolInfo?.website || "",
      logo: logoPath,
      description: toolInfo?.description || "",
      // #329: a model row carries its version (lifecycle point, else null).
      ...(kind === "model" ? { version: modelVersion(tool) } : {}),
    },
    total_score: ranking["score"] || ranking["total_score"] || 0,
    scores: {
      overall: ranking["score"] || ranking["total_score"] || 0,
      base_score: ranking["base_score"] || ranking["score"] || 0,
      news_impact:
        ranking["factor_scores"]?.["innovation"] || ranking["scores"]?.["news_impact"] || 0,
      agentic_capability:
        (ranking["factor_scores"]?.["agenticCapability"] ??
          ranking["factor_scores"]?.["agentic_capability"] ??
          ranking["scores"]?.["agentic_capability"] ??
          50) / 10 || 5,
      innovation:
        (ranking["factor_scores"]?.["innovation"] ??
          ranking["scores"]?.["innovation"] ??
          50) / 10 || 5,
    },
    metrics: {
      news_articles_count: ranking["metrics"]?.["news_articles_count"] || 0,
      recent_funding_rounds: ranking["metrics"]?.["recent_funding_rounds"] || 0,
      recent_product_launches: ranking["metrics"]?.["recent_product_launches"] || 0,
      users:
        ranking["metrics"]?.["users"] ||
        (ranking["factor_scores"]?.["developerAdoption"] ??
          ranking["factor_scores"]?.["developer_adoption"] ??
          50) * 1000 ||
        10000,
      swe_bench_score:
        ranking["metrics"]?.["swe_bench_score"] ||
        toolInfo?.metrics?.swe_bench?.verified ||
        toolInfo?.metrics?.swe_bench?.lite ||
        toolInfo?.metrics?.swe_bench?.full ||
        null,
    },
    tier: ranking["tier"] || "standard",
  };
  // #329: the tool data's canonical metrics and provenance decide whether the row counts for D63.
  return { row, kind, toolList, dbId: toolAsAny?.["db_id"] as string | undefined, codingMetric: hasCodingMetric(tool) };
}
