import { NextResponse } from "next/server";
import { payloadDirect } from "@/lib/payload-direct";
import { loggers } from "@/lib/logger";
import cachedToolsData from "@/data/cache/tools.json";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const page = parseInt(searchParams.get("page") || "1");

    // Try to get live data first
    try {
      const liveTools = await payloadDirect.getTools({ limit, page });

      if (liveTools && liveTools.docs && liveTools.docs.length > 0) {
        // Return live data
        return NextResponse.json({
          tools: liveTools.docs,
          totalDocs: liveTools.totalDocs,
          page: liveTools.page,
          totalPages: liveTools.totalPages,
        });
      }
    } catch (error) {
      loggers.api.warn("Failed to fetch live tools data, using cache", { error });
    }

    // Fall back to cached data
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTools = cachedToolsData.tools.slice(startIndex, endIndex);

    return NextResponse.json({
      tools: paginatedTools,
      totalDocs: cachedToolsData.tools.length,
      page,
      totalPages: Math.ceil(cachedToolsData.tools.length / limit),
      _cached: true,
      _cachedAt: "2025-06-25T13:37:00.000Z",
      _cacheReason: "Database connection unavailable",
    });
  } catch (error) {
    loggers.api.error("Error in tools-cached endpoint", { error });
    return NextResponse.json({ error: "Failed to fetch tools" }, { status: 500 });
  }
}
