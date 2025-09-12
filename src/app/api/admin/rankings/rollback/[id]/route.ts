import { promises as fs } from "node:fs";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

interface Tool {
  name: string;
  slug: string;
}

interface Scores {
  overall?: number;
  [key: string]: number | undefined;
}

interface RankingItem {
  rank?: number;
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
    rolled_back_from?: string;
    rolled_back_to?: string;
    rolled_back_at?: string;
    rolled_back_by?: string;
    [key: string]: unknown;
  };
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
    return JSON.parse(data) as RankingVersion[];
  } catch {
    return [];
  }
}

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Import auth utilities at the top of the function
    const { shouldBypassAuth, getLocalMockSession } = await import("@/lib/auth-utils");

    let userEmail = "admin";

    // Skip authentication check for local development
    if (!shouldBypassAuth()) {
      const session = await auth();
      if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userEmail = session.user?.email ?? "admin";
    } else {
      console.log("🔓 Local environment - bypassing auth for rankings rollback");
      const mockSession = getLocalMockSession();
      userEmail = mockSession.user.email;
    }

    const versionId = params.id;

    // Load version history
    const versions = await loadVersionHistory();

    // Find the version to rollback to
    const targetVersion = versions.find((v: RankingVersion) => v.id === versionId);

    if (!targetVersion) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // Load current rankings
    const rankingsData = await loadRankingsData();

    // Handle flat rankings array structure
    if (!rankingsData.rankings || !Array.isArray(rankingsData.rankings)) {
      return NextResponse.json({ error: "No current rankings found" }, { status: 404 });
    }

    // Restore the rankings from the snapshot
    if (targetVersion.rankings_snapshot) {
      // Store current version info before rollback
      const currentVersion = rankingsData.metadata?.version;

      // Restore rankings array
      rankingsData.rankings = targetVersion.rankings_snapshot;

      // Update metadata
      rankingsData.metadata = {
        ...rankingsData.metadata,
        last_updated: new Date().toISOString(),
        rolled_back_from: currentVersion,
        rolled_back_to: targetVersion.version,
        rolled_back_at: new Date().toISOString(),
        rolled_back_by: userEmail,
      };

      // Save the rolled back rankings
      await saveRankingsData(rankingsData);

      return NextResponse.json({
        success: true,
        message: `Successfully rolled back to version ${targetVersion.version}`,
        version: targetVersion.version,
        version_id: targetVersion.id,
      });
    } else {
      return NextResponse.json({ error: "Version snapshot not available" }, { status: 400 });
    }
  } catch (error) {
    console.error("Rollback error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rollback" },
      { status: 500 }
    );
  }
}
