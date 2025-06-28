import { NextRequest, NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getNewsRepo, getToolsRepo } from "@/lib/json-db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const filter = searchParams.get("filter") || "all";

    loggers.api.debug("Getting news from JSON repository", { limit, offset, filter });

    const newsRepo = getNewsRepo();
    const toolsRepo = getToolsRepo();
    
    // Get all news articles
    const allNews = await newsRepo.getAll();
    
    // Transform to expected format
    const transformedNews = await Promise.all(allNews.map(async (article: any) => {
      // Get tool info if tool_ids exist
      let toolNames = "Various Tools";
      let toolCategory = "ai-coding-tool";
      let toolWebsite = "";
      let primaryToolId = "unknown";
      
      if (article.tool_ids && article.tool_ids.length > 0) {
        const firstToolId = article.tool_ids[0];
        const tool = await toolsRepo.getById(firstToolId);
        
        if (tool) {
          toolNames = tool.name;
          toolCategory = tool.category || "ai-coding-tool";
          toolWebsite = tool.info?.website || "";
          primaryToolId = tool.slug || tool.id;
        }
        
        // If multiple tools, get all names
        if (article.tool_ids.length > 1) {
          const tools = await Promise.all(
            article.tool_ids.map(async (id: string) => {
              const t = await toolsRepo.getById(id);
              return t?.name || id;
            })
          );
          toolNames = tools.join(", ");
        }
      }
      
      // Map category to event_type
      let eventType = "update";
      const text = `${article.title} ${article.summary}`.toLowerCase();
      
      if (text.includes("funding") || text.includes("raised") || text.includes("investment")) {
        eventType = "milestone";
      } else if (text.includes("launch") || text.includes("released") || text.includes("feature")) {
        eventType = "feature";
      } else if (text.includes("partnership") || text.includes("acquired")) {
        eventType = "partnership";
      } else if (text.includes("hiring") || text.includes("ceo") || text.includes("leadership")) {
        eventType = "announcement";
      }
      
      return {
        id: article.id,
        tool_id: primaryToolId,
        tool_name: toolNames,
        tool_category: toolCategory,
        tool_website: toolWebsite,
        event_date: article.published_at || article.created_at,
        event_type: eventType,
        title: article.title,
        description: article.summary,
        source_url: article.source_url,
        source_name: article.source_name || "AI News",
        metrics: {
          importance_score: article.importance_score || 5,
        },
        tags: article.tags || [],
      };
    }));
    
    // Apply filter
    let filteredNews = transformedNews;
    if (filter !== "all") {
      filteredNews = transformedNews.filter((item: any) => item.event_type === filter);
    }
    
    // Apply pagination
    const paginatedNews = filteredNews.slice(offset, offset + limit);
    const hasMore = offset + limit < filteredNews.length;

    const apiResponse = NextResponse.json({
      news: paginatedNews,
      total: filteredNews.length,
      hasMore,
      _source: "json-db",
      _timestamp: new Date().toISOString()
    });

    // Set cache headers
    apiResponse.headers.set(
      "Cache-Control",
      process.env.NODE_ENV === "production"
        ? "public, s-maxage=1800, stale-while-revalidate=900"
        : "no-cache"
    );

    return apiResponse;
  } catch (error) {
    loggers.api.error("News API error", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
