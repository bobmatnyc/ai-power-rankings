import { NextRequest, NextResponse } from "next/server";
import { getNewsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const newsRepo = getNewsRepo();
    const tagsWithCounts = await newsRepo.getTagsWithCounts();
    
    // Convert to array and sort by count descending
    const sortedTags = Object.entries(tagsWithCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([tag, count]) => ({
        tag,
        count,
      }));
    
    return NextResponse.json({
      tags: sortedTags,
      total: sortedTags.length,
      _source: "json-db",
    });
  } catch (error) {
    loggers.api.error("News tags API error", { error });
    
    return NextResponse.json(
      {
        error: "Failed to fetch news tags",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}