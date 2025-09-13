import { promises as fs } from "node:fs";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";

interface RankingVersion {
  id: string;
  version: string;
  created_at: string;
  created_by: string;
  changes_summary: string;
  news_items_count: number;
  rankings_snapshot: unknown[];
  previous_version_id?: string;
}

export async function GET(_request: NextRequest) {
  try {
    // Check admin authentication
    const { isAdminAuthenticated } = await import("@/lib/admin-auth");
    const isAuthenticated = await isAdminAuthenticated();
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const versionsPath = path.join(process.cwd(), "data", "json", "ranking-versions.json");

    try {
      const data = await fs.readFile(versionsPath, "utf-8");
      const versions = JSON.parse(data);

      // Sort by created_at descending (newest first)
      versions.sort(
        (a: RankingVersion, b: RankingVersion) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Limit to last 50 versions
      const recentVersions = versions.slice(0, 50);

      return NextResponse.json({
        success: true,
        versions: recentVersions,
        total: versions.length,
      });
    } catch {
      // File doesn't exist yet
      return NextResponse.json({
        success: true,
        versions: [],
        total: 0,
      });
    }
  } catch (error) {
    console.error("Failed to load versions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load versions" },
      { status: 500 }
    );
  }
}
