import { type RankingData, rankingsRepository } from "@/lib/db/repositories/rankings.repository";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { loggers } from "@/lib/logger";
import {
  COMBINED_LIST,
  DEFAULT_RANKING_LIST,
  listOfTool,
  listTier,
  type RankingList,
} from "@/lib/rankings/lists";

/** #186: where a list's rows came from: its own current row, or the combined board split by list. */
export type ListBoardSource = "list" | "combined";

export interface CurrentListBoard {
  list: RankingList;
  source: ListBoardSource;
  snapshot: RankingData;
  rankings: CurrentRankingRow[];
}

/**
 * Reads one list's current board as display rows (#192, #186).
 *
 * Why: `/api/rankings` and the home page must show the same rows, ranks and
 * rank changes, so both read the snapshot through this one function. #186: each
 * list has its own board, ranked within the list (D2e), and a tool is ranked in
 * at most one list.
 * What: reads the list's `is_current` row. When the list has none yet (before
 * the per-list publish runs), reads the current legacy combined row instead and
 * keeps only the tools `listOfTool()` puts in this list (`source: "combined"`).
 * Takes the snapshot's rankings array (an array, or one under `rankings` or
 * `data`), joins each entry to its tool by id then slug, drops entries whose tool
 * is missing (one warning each) or belongs to another list (or none), drops a
 * combined board's rows whose tool is not `active` now, sorts by stored rank
 * and renumbers 1..n with D53 tiers. A combined row's movement is a global move, so its previous rank is renumbered within the list too. Returns
 * null when neither row exists. Throws when a database read throws.
 * Test: `tests/unit/home-live-rankings-192.test.tsx`,
 *   `tests/unit/rankings-per-list-read-186.test.ts`,
 *   `tests/unit/models-list-inactive-rows.test.ts`.
 */
export async function loadCurrentRankings(list: RankingList = DEFAULT_RANKING_LIST): Promise<CurrentListBoard | null> {
  const listRow = await rankingsRepository.getCurrentRankings(list);
  const snapshot = listRow ?? (await rankingsRepository.getCurrentRankings(COMBINED_LIST));
  if (!snapshot) return null;
  const source: ListBoardSource = listRow ? "list" : "combined";

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
  const members = formatted.filter((r): r is FormattedRanking => r !== null && inList(r, list, source));

  // Sort by rank to ensure proper ordering
  members.sort((a, b) => (a.row.rank || 999) - (b.row.rank || 999));

  return { list, source, snapshot, rankings: rankWithinList(members.map((m) => m.row), source) };
}

/**
 * #186: whether a joined row belongs on `list`'s board. A combined row needs the tool's
 * list to be `list` and the tool to be `active` now: the stored board can still hold a
 * tool that was retired (for example `redirect`) after the board was published, and the
 * stored data is left as written; this read drops it. A list row was written for this list; it drops only a tool whose
 * kind is known and now maps elsewhere (a row read without a kind is kept as written).
 */
function inList(entry: FormattedRanking, list: RankingList, source: ListBoardSource): boolean {
  if (source === "combined") return entry.toolList === list && entry.status === "active";
  return entry.kind === undefined || entry.toolList === list;
}

/**
 * #186 PURE: ranks 1..n and D53 tiers for one list's rows, in the given order.
 * For a combined source the stored previous ranks are global, so each is replaced by
 * the tool's position among this list's tools that have one (D2e); a tool that left
 * the list since then is not counted.
 */
export function rankWithinList(rows: CurrentRankingRow[], source: ListBoardSource): CurrentRankingRow[] {
  const previousWithin = new Map<number, number>();
  if (source === "combined") {
    const previous = rows
      .map((row, index) => ({ index, previous: row.previousRank }))
      .filter((p): p is { index: number; previous: number } => typeof p.previous === "number" && p.previous > 0)
      .sort((a, b) => a.previous - b.previous);
    previous.forEach((p, position) => previousWithin.set(p.index, position + 1));
  }
  return rows.map((row, index) => {
    const rank = index + 1;
    const tier = listTier(rank, rows.length);
    if (source === "list") return { ...row, rank, tier };
    const previousRank = previousWithin.get(index) ?? null;
    return { ...row, rank, tier, previousRank, rankChange: previousRank === null ? 0 : previousRank - rank };
  });
}

export type CurrentRankingRow = NonNullable<Awaited<ReturnType<typeof formatRanking>>>["row"];

type FormattedRanking = {
  row: CurrentRankingRow;
  kind: unknown;
  toolList: RankingList | null;
  /** The tool's current `tools.status`. */
  status: string;
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
      status: tool.status,
      website_url: toolInfo?.website || "",
      logo: logoPath,
      description: toolInfo?.description || "",
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
  return { row, kind, toolList, status: String(tool.status ?? "") };
}
