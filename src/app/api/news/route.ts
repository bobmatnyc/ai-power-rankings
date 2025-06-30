import { NextRequest, NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getNewsRepo, getToolsRepo } from "@/lib/json-db";
import { cachedJsonResponse } from "@/lib/api-cache";

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

    // Sort by published date (newest first)
    const sortedNews = allNews.sort(
      (a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime()
    );

    // Transform to expected format
    const transformedNews = await Promise.all(
      sortedNews.map(async (article: any) => {
        // Get tool info from tool_mentions or tool_ids
        let toolNames = "Various Tools";
        let toolCategory = "ai-coding-tool";
        let toolWebsite = "";
        let primaryToolId = "unknown";

        // Check tool_mentions first (new format)
        if (article.tool_mentions && article.tool_mentions.length > 0) {
          // Try to find tools by name
          const firstToolName = article.tool_mentions[0];
          const tools = await toolsRepo.getAll();
          const matchingTool = tools.find(
            (t) =>
              t.name.toLowerCase() === firstToolName.toLowerCase() ||
              t.slug === firstToolName.toLowerCase().replace(/\s+/g, "-")
          );

          if (matchingTool) {
            toolNames = matchingTool.name;
            toolCategory = matchingTool.category || "ai-coding-tool";
            toolWebsite = matchingTool.info?.website || "";
            primaryToolId = matchingTool.slug || matchingTool.id;
          } else {
            // Use the tool mention as the name even if we don't find a match
            toolNames = article.tool_mentions.join(", ");
          }
        } else if (article.tool_ids && article.tool_ids.length > 0) {
          // Fallback to old format with tool_ids
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

        // Map category to event_type based on tags or content
        let eventType = "update";

        // Check tags first for better categorization
        if (article.tags && article.tags.length > 0) {
          const tagStr = article.tags.join(" ").toLowerCase();
          if (
            tagStr.includes("launch") ||
            tagStr.includes("beta") ||
            tagStr.includes("general-availability")
          ) {
            eventType = "feature";
          } else if (
            tagStr.includes("milestone") ||
            tagStr.includes("revenue") ||
            tagStr.includes("funding") ||
            tagStr.includes("growth")
          ) {
            eventType = "milestone";
          } else if (tagStr.includes("benchmark") || tagStr.includes("performance")) {
            eventType = "feature";
          } else if (tagStr.includes("rebrand") || tagStr.includes("acquisition")) {
            eventType = "announcement";
          }
        }

        // Fallback to content analysis
        if (eventType === "update") {
          const text = `${article.title} ${article.summary || article.content || ""}`.toLowerCase();

          if (
            text.includes("funding") ||
            text.includes("raised") ||
            text.includes("investment") ||
            text.includes("valuation") ||
            text.includes("arr")
          ) {
            eventType = "milestone";
          } else if (
            text.includes("launch") ||
            text.includes("released") ||
            text.includes("feature") ||
            text.includes("introduces")
          ) {
            eventType = "feature";
          } else if (
            text.includes("partnership") ||
            text.includes("acquired") ||
            text.includes("acquisition")
          ) {
            eventType = "partnership";
          } else if (
            text.includes("hiring") ||
            text.includes("ceo") ||
            text.includes("leadership") ||
            text.includes("rebrand")
          ) {
            eventType = "announcement";
          }
        }

        return {
          id: article.id,
          slug: article.slug,
          tool_id: primaryToolId,
          tool_slug: primaryToolId !== "unknown" ? primaryToolId : undefined,
          tool_name: toolNames,
          tool_category: toolCategory,
          tool_website: toolWebsite,
          event_date: article.published_date || article.published_at || article.created_at,
          event_type: eventType,
          title: article.title,
          description: article.summary || article.content,
          source_url: article.source_url,
          source_name: article.source || article.source_name || "AI News",
          metrics: {
            importance_score: article.importance_score || 5,
          },
          tags: article.tags || [],
        };
      })
    );

    // Apply filter
    let filteredNews = transformedNews;
    if (filter !== "all") {
      filteredNews = transformedNews.filter((item: any) => item.event_type === filter);
    }

    // Apply pagination
    const paginatedNews = filteredNews.slice(offset, offset + limit);
    const hasMore = offset + limit < filteredNews.length;

    return cachedJsonResponse(
      {
        news: paginatedNews,
        total: filteredNews.length,
        hasMore,
        _source: "json-db",
        _timestamp: new Date().toISOString(),
      },
      "/api/news"
    );
  } catch (error) {
    loggers.api.error("News API error", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
