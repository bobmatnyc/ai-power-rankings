import { promises as fs } from "node:fs";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { invalidateCachePattern } from "@/lib/memory-cache";

interface Tool {
  name: string;
  slug: string;
}

interface Scores {
  overall?: number;
  [key: string]: number | undefined;
}

interface RankingItem {
  rank: number;
  previousRank?: number | null;
  rankChange?: number;
  tool?: Tool;
  scores?: Scores;
}

interface RankingsData {
  rankings: RankingItem[];
  metadata?: {
    last_updated?: string;
    version?: string;
    version_id?: string;
    [key: string]: unknown;
  };
}

interface PreviewItem {
  rank: number;
  tool: string;
  score: number;
  change: number;
}

interface NewsAnalysis {
  // Add specific structure if needed
  [key: string]: unknown;
}

interface RankingVersion {
  id: string;
  version: string;
  created_at: string;
  created_by: string;
  changes_summary: string;
  news_items_count: number;
  rankings_snapshot: RankingItem[];
  previous_version_id?: string;
}

async function loadRankingsData(): Promise<RankingsData> {
  const rankingsPath = path.join(process.cwd(), "public", "data", "rankings.json");
  const data = await fs.readFile(rankingsPath, "utf-8");
  return JSON.parse(data) as RankingsData;
}

async function saveRankingsData(data: RankingsData) {
  const rankingsPath = path.join(process.cwd(), "public", "data", "rankings.json");
  await fs.writeFile(rankingsPath, JSON.stringify(data, null, 2));

  // Also update the static cache
  const cachePath = path.join(process.cwd(), "src", "data", "cache", "rankings-static.json");
  await fs.writeFile(cachePath, JSON.stringify(data, null, 2));
}

async function loadVersionHistory(): Promise<RankingVersion[]> {
  const versionsPath = path.join(process.cwd(), "data", "json", "ranking-versions.json");

  try {
    const data = await fs.readFile(versionsPath, "utf-8");
    return JSON.parse(data);
  } catch {
    // File doesn't exist, create it
    return [];
  }
}

async function saveVersionHistory(versions: RankingVersion[]) {
  const versionsPath = path.join(process.cwd(), "data", "json", "ranking-versions.json");

  // Ensure directory exists
  const dir = path.dirname(versionsPath);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(versionsPath, JSON.stringify(versions, null, 2));
}

function generateVersionNumber(versions: RankingVersion[]): string {
  if (versions.length === 0) {
    return "1.0.0";
  }

  const lastVersion = versions[versions.length - 1]?.version || "0.0.0";
  const parts = lastVersion.split(".");
  const patch = parseInt(parts[2] || "0", 10) + 1;

  return `${parts[0]}.${parts[1]}.${patch}`;
}

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const { isAuthenticated } = await import("@/lib/clerk-auth");
    const isAuth = await isAuthenticated();

    if (!isAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = "admin";

    const body = (await request.json()) as {
      preview: {
        current: PreviewItem[];
        proposed: PreviewItem[];
      };
      news_analysis?: NewsAnalysis;
      commit_message?: string;
    };
    const { preview, news_analysis, commit_message } = body;

    if (!preview || !preview.proposed) {
      return NextResponse.json({ error: "Ranking preview required" }, { status: 400 });
    }

    // Load current rankings
    const rankingsData = await loadRankingsData();

    // Handle flat rankings array structure
    if (!rankingsData.rankings || !Array.isArray(rankingsData.rankings)) {
      return NextResponse.json({ error: "No current rankings found" }, { status: 404 });
    }

    // Create a backup of current rankings
    const currentSnapshot = JSON.parse(JSON.stringify(rankingsData.rankings));

    // Load version history
    const versions = await loadVersionHistory();

    // Create new version entry
    const newVersion: RankingVersion = {
      id: uuidv4(),
      version: generateVersionNumber(versions),
      created_at: new Date().toISOString(),
      created_by: userEmail,
      changes_summary: commit_message || "Ranking update based on news analysis",
      news_items_count: news_analysis ? 1 : 0,
      rankings_snapshot: currentSnapshot,
      previous_version_id: versions.length > 0 ? versions[versions.length - 1]?.id : undefined,
    };

    // Update rankings with proposed changes
    const updatedRankings = preview.proposed.map((item: PreviewItem, index: number) => {
      const currentRanking = rankingsData.rankings.find(
        (r: RankingItem) => r.tool?.name === item.tool || r.tool?.slug === item.tool
      );

      if (currentRanking) {
        return {
          ...currentRanking,
          rank: index + 1,
          previousRank:
            preview.current.find((c: PreviewItem) => c.tool === item.tool)?.rank || null,
          rankChange: item.change,
          scores: {
            ...(currentRanking.scores || {}),
            overall: item.score,
          },
        };
      } else {
        // Create new ranking entry if tool not found
        return {
          rank: index + 1,
          previousRank: null,
          rankChange: 0,
          tool: {
            name: item.tool,
            slug: item.tool.toLowerCase().replace(/\s+/g, "-"),
          },
          scores: {
            overall: item.score,
          },
        };
      }
    });

    // Update the rankings data
    rankingsData.rankings = updatedRankings;
    rankingsData.metadata = {
      ...(rankingsData.metadata || {}),
      last_updated: new Date().toISOString(),
      version: newVersion.version,
      version_id: newVersion.id,
    };

    // Save updated rankings
    await saveRankingsData(rankingsData);

    // Add new version to history and save
    versions.push(newVersion);
    await saveVersionHistory(versions);

    // Store the news analysis if provided
    if (news_analysis) {
      const newsPath = path.join(process.cwd(), "data", "json", "news", `${newVersion.id}.json`);
      await fs.mkdir(path.dirname(newsPath), { recursive: true });
      await fs.writeFile(
        newsPath,
        JSON.stringify(
          {
            version_id: newVersion.id,
            analysis: news_analysis,
            created_at: new Date().toISOString(),
          },
          null,
          2
        )
      );
    }

    // Invalidate rankings cache to force refresh
    const invalidatedCount = invalidateCachePattern("^api:rankings:");
    console.log(`Invalidated ${invalidatedCount} rankings cache entries after commit`);

    return NextResponse.json({
      success: true,
      version: newVersion.version,
      version_id: newVersion.id,
      message: `Successfully committed rankings version ${newVersion.version}`,
    });
  } catch (error) {
    console.error("Ranking commit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to commit rankings" },
      { status: 500 }
    );
  }
}
