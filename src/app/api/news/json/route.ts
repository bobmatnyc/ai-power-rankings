import { NextRequest, NextResponse } from "next/server";
import { getNewsRepo, getToolsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const page = parseInt(searchParams.get("page") || "1");
    const filter = searchParams.get("filter") || "all";
    const toolId = searchParams.get("toolId");
    const tag = searchParams.get("tag");
    const search = searchParams.get("search");

    const newsRepo = getNewsRepo();
    const toolsRepo = getToolsRepo();

    let newsItems;
    
    // Apply filters based on query params
    if (search) {
      newsItems = await newsRepo.search(search);
    } else if (toolId) {
      newsItems = await newsRepo.getByToolMention(toolId);
    } else if (tag) {
      newsItems = await newsRepo.getByTag(tag);
    } else {
      newsItems = await newsRepo.getAll();
    }

    // Sort by published date descending
    newsItems.sort((a, b) => 
      new Date(b.published_date).getTime() - new Date(a.published_date).getTime()
    );

    // Transform news data to match the expected API format
    const transformedNews = await Promise.all(
      newsItems.map(async (article) => {
        // Determine event type based on category and content
        let eventType = "update";
        const text = `${article.title} ${article.summary || ""}`.toLowerCase();

        switch (article.category) {
          case "funding":
            eventType = "milestone";
            break;
          case "acquisition":
            eventType = "partnership";
            break;
          case "product":
          case "product-launch":
            eventType = "feature";
            break;
          case "technical":
          case "technical-achievement":
            eventType = "update";
            break;
          case "general":
            eventType = "update";
            break;
          default:
            // Keyword-based detection
            if (
              text.includes("funding") ||
              text.includes("raised") ||
              text.includes("million") ||
              text.includes("billion") ||
              text.includes("investment") ||
              text.includes("series") ||
              text.includes("venture") ||
              text.includes("valuation") ||
              text.includes("round")
            ) {
              eventType = "milestone";
            } else if (
              text.includes("launch") ||
              text.includes("released") ||
              text.includes("announced") ||
              text.includes("introduces") ||
              text.includes("unveils") ||
              text.includes("debuts") ||
              text.includes("feature") ||
              text.includes("version") ||
              text.includes("update") ||
              text.includes("beta") ||
              text.includes("integration") ||
              text.includes("new")
            ) {
              eventType = "feature";
            } else if (
              text.includes("acquired") ||
              text.includes("partnership") ||
              text.includes("merger") ||
              text.includes("collaboration") ||
              text.includes("deal") ||
              text.includes("agreement") ||
              text.includes("partners") ||
              text.includes("joins")
            ) {
              eventType = "partnership";
            } else if (
              text.includes("hiring") ||
              text.includes("leadership") ||
              text.includes("ceo") ||
              text.includes("expansion") ||
              text.includes("growth") ||
              text.includes("news") ||
              text.includes("appoints") ||
              text.includes("names") ||
              text.includes("announces")
            ) {
              eventType = "announcement";
            }
        }

        // Get tool information
        let primaryToolId = null;
        let toolNames = "Various Tools";
        let toolCategory = "ai-coding-tool";
        let toolWebsite = "";
        let toolSlug = null;

        if (article.tool_mentions && article.tool_mentions.length > 0) {
          // Get tool details from repository
          const tools = await Promise.all(
            article.tool_mentions.map(async (toolId) => {
              const tool = await toolsRepo.getById(toolId);
              return tool;
            })
          );

          const validTools = tools.filter(Boolean);
          
          if (validTools.length > 0) {
            const firstTool = validTools[0];
            primaryToolId = firstTool.id;
            toolSlug = firstTool.slug;
            toolCategory = firstTool.category || "ai-coding-tool";
            toolWebsite = firstTool.website_url || "";
            
            toolNames = validTools.map(tool => tool.name).join(", ");
          }
        }

        // Build tags array
        const tags = [...(article.tags || [])];
        if (article.category) {
          tags.push(article.category);
        }
        if (article.tool_mentions) {
          tags.push(...article.tool_mentions);
        }

        return {
          id: article.id,
          tool_id: toolSlug || primaryToolId || "unknown",
          tool_name: toolNames,
          tool_category: toolCategory,
          tool_website: toolWebsite,
          event_date: article.published_date,
          event_type: eventType,
          title: article.title,
          description: article.summary || article.content.substring(0, 200) + "...",
          source_url: article.source_url,
          source_name: article.source || "AI News",
          metrics: {
            importance_score: article.importance_score || 5,
          },
          tags: [...new Set(tags)], // Remove duplicates
        };
      })
    );

    // Apply event type filter if specified
    let filteredNews = transformedNews;
    if (filter !== "all") {
      filteredNews = transformedNews.filter((item) => item.event_type === filter);
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedNews = filteredNews.slice(startIndex, endIndex);

    const response = {
      news: paginatedNews,
      total: filteredNews.length,
      page,
      totalPages: Math.ceil(filteredNews.length / limit),
      hasMore: endIndex < filteredNews.length,
      _source: "json-db",
    };

    const apiResponse = NextResponse.json(response);

    // Set cache headers
    apiResponse.headers.set(
      "Cache-Control",
      process.env.NODE_ENV === "production"
        ? "public, s-maxage=300, stale-while-revalidate=150"
        : "no-cache"
    );

    return apiResponse;
  } catch (error) {
    loggers.api.error("News JSON API error", { error });

    return NextResponse.json(
      {
        error: "Failed to fetch news",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Add POST endpoint for creating news (admin only)
export async function POST(request: NextRequest) {
  try {
    // TODO: Add authentication check here
    
    const body = await request.json();
    const newsRepo = getNewsRepo();
    
    // Generate slug if not provided
    const slug = body.slug || 
      body.title.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    
    const newsArticle = {
      id: body.id || `news-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      slug,
      title: body.title,
      content: body.content,
      summary: body.summary,
      author: body.author,
      published_date: body.published_date || new Date().toISOString(),
      source: body.source,
      source_url: body.source_url,
      tags: body.tags || [],
      tool_mentions: body.tool_mentions || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    await newsRepo.upsert(newsArticle);
    
    return NextResponse.json({
      success: true,
      article: newsArticle,
    });
  } catch (error) {
    loggers.api.error("News POST error", { error });
    
    return NextResponse.json(
      {
        error: "Failed to create news article",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}