import { NextResponse } from "next/server";
import { payloadDirect } from "@/lib/payload-direct";
import { loggers } from "@/lib/logger";

export async function GET(): Promise<NextResponse> {
  try {
    // Try to get just a few tools to see if DB is working
    const toolsResponse = await payloadDirect.getTools({ limit: 10 });

    if (!toolsResponse || !toolsResponse.docs || toolsResponse.docs.length === 0) {
      loggers.ranking.warn("No tools found in database", { toolsResponse });
      return NextResponse.json({
        rankings: [],
        stats: { total_tools: 0 },
        debug: {
          dbConnected: false,
          toolsFound: 0,
          error: "No tools in database",
        },
      });
    }

    const tools = toolsResponse.docs;

    // Create simplified rankings from available tools
    const simpleRankings = tools.slice(0, 10).map((tool: any, index: number) => ({
      rank: index + 1,
      previousRank: index + 2, // Fake previous rank for testing
      rankChange: 1,
      changeReason: "Test data",
      tool: {
        id: tool.id,
        slug: tool.slug || tool.id,
        name: tool.display_name || tool.name,
        category: tool.category || "unknown",
        status: tool.status || "active",
        website_url: tool.website_url,
        description: typeof tool.description === "string" ? tool.description : "Test description",
      },
      scores: {
        overall: 85 - index * 5,
        agentic_capability: 8 - index * 0.5,
        innovation: 7 - index * 0.3,
      },
      metrics: {
        users: 100000 - index * 10000,
        swe_bench_score: 75 - index * 3,
      },
    }));

    return NextResponse.json({
      rankings: simpleRankings,
      algorithm: {
        version: "simple-test",
        name: "Simple Test Rankings",
        date: new Date().toISOString(),
      },
      stats: {
        total_tools: tools.length,
      },
      debug: {
        dbConnected: true,
        toolsFound: tools.length,
        environment: process.env.VERCEL_ENV || "development",
        hasDbUrl: !!process.env.SUPABASE_DATABASE_URL,
      },
    });
  } catch (error) {
    loggers.ranking.error("Simple rankings error", { error });
    return NextResponse.json(
      {
        rankings: [],
        stats: { total_tools: 0 },
        debug: {
          dbConnected: false,
          error: error instanceof Error ? error.message : String(error),
          environment: process.env.VERCEL_ENV || "development",
          hasDbUrl: !!process.env.SUPABASE_DATABASE_URL,
        },
      },
      { status: 500 }
    );
  }
}
