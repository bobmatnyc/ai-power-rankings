import { NextRequest, NextResponse } from "next/server";
import { getNewsRepo, getToolsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10");
    
    const newsRepo = getNewsRepo();
    const toolsRepo = getToolsRepo();
    
    // Get recent articles
    const recentArticles = await newsRepo.getRecent(limit);
    
    // Transform to include tool details
    const transformedArticles = await Promise.all(
      recentArticles.map(async (article) => {
        let toolInfo = null;
        
        if (article.tool_mentions && article.tool_mentions.length > 0) {
          const firstToolId = article.tool_mentions[0];
          const tool = await toolsRepo.getById(firstToolId);
          
          if (tool) {
            toolInfo = {
              id: tool.id,
              slug: tool.slug,
              name: tool.name,
              category: tool.category,
              website_url: tool.website_url,
            };
          }
        }
        
        return {
          ...article,
          primary_tool: toolInfo,
          _transformed: true,
        };
      })
    );
    
    const response = {
      articles: transformedArticles,
      count: transformedArticles.length,
      _source: "json-db",
    };
    
    const apiResponse = NextResponse.json(response);
    
    // Set cache headers
    apiResponse.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=30"
    );
    
    return apiResponse;
  } catch (error) {
    loggers.api.error("Recent news API error", { error });
    
    return NextResponse.json(
      {
        error: "Failed to fetch recent news",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}