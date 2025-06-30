import { NextRequest, NextResponse } from "next/server";
import { getToolsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

export async function GET(_request: NextRequest) {
  try {
    const toolsRepo = getToolsRepo();
    const tools = await toolsRepo.getAll();

    // Get unique categories with counts
    const categoryMap = new Map<string, number>();

    tools.forEach((tool) => {
      if (tool.category && tool.status !== "deprecated") {
        const count = categoryMap.get(tool.category) || 0;
        categoryMap.set(tool.category, count + 1);
      }
    });

    // Convert to array and sort by count
    const categories = Array.from(categoryMap.entries())
      .map(([category, count]) => ({
        category,
        count,
        displayName: category
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
      }))
      .sort((a, b) => b.count - a.count);

    const response = {
      categories,
      total: categories.length,
      _source: "json-db",
    };

    const apiResponse = NextResponse.json(response);

    // Set cache headers
    apiResponse.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=1800");

    return apiResponse;
  } catch (error) {
    loggers.api.error("Tool categories API error", { error });

    return NextResponse.json(
      {
        error: "Failed to fetch tool categories",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
