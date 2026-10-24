import { type RankingData, rankingsRepository } from "@/lib/db/repositories/rankings.repository";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { loggers } from "@/lib/logger";

/**
 * Reads the current published rankings snapshot as display rows (#192).
 *
 * Why: `/api/rankings` and the home page must show the same rows, ranks and
 * rank changes, so both read the snapshot through this one function.
 * What: reads the `is_current` snapshot through `rankingsRepository`, takes its
 * rankings array (the JSONB is an array or holds one under `rankings` or
 * `data`), joins each entry to its tool by id then slug, drops entries whose
 * tool is missing (one warning each), and sorts by rank. Returns null when no
 * snapshot is current. Throws when the database read throws.
 * Test: `tests/unit/home-live-rankings-192.test.tsx`; the route keeps its
 * response shape (`app/api/rankings/route.ts`).
 */
export async function loadCurrentRankings(): Promise<{
  snapshot: RankingData;
  rankings: CurrentRankingRow[];
} | null> {
  const snapshot = await rankingsRepository.getCurrentRankings();
  if (!snapshot) return null;

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

  // Filter out null values (tools that weren't found)
  const valid = formatted.filter((r): r is CurrentRankingRow => r !== null);

  // Sort by rank to ensure proper ordering
  valid.sort((a, b) => (a.rank || 999) - (b.rank || 999));

  return { snapshot, rankings: valid };
}

export type CurrentRankingRow = NonNullable<Awaited<ReturnType<typeof formatRanking>>>;

/** One snapshot entry joined to its tool, in the `/api/rankings` row shape; null when the tool is missing. */
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

  return {
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
}
