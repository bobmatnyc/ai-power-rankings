import { type NextRequest, NextResponse } from "next/server";
import { cachedJsonResponse } from "@/lib/api-cache";
import { getDb } from "@/lib/db/connection";
import { NewsRepository } from "@/lib/db/repositories/news";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { loggers } from "@/lib/logger";
import { findToolByText } from "@/lib/tool-matcher";

export async function GET(request: NextRequest) {
  try {
    // Ensure database connection is available
    const db = getDb();
    if (!db) {
      loggers.api.error("Database connection not available");
      return NextResponse.json(
        {
          error: "Database connection unavailable",
          message: "The database service is currently unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const filter = searchParams.get("filter") || "all";
    const debug = searchParams.get("debug") === "true";
    const cacheKey = searchParams.get("cb"); // Cache-busting key

    loggers.api.debug("Getting news from database", { limit, offset, filter });

    const newsRepo = new NewsRepository();
    const toolsRepo = new ToolsRepository();

    // Get paginated news articles from database
    const { articles: allNews } = await newsRepo.getPaginated(limit * 3, 0); // Get more to filter

    // Helper function to get the effective date
    const getEffectiveDate = (article: any) => {
      return (
        article.published_at ||
        article.publishedAt ||
        article.created_at ||
        article.createdAt ||
        new Date().toISOString()
      );
    };

    // Transform to expected format
    const transformedNews = await Promise.all(
      allNews.map(async (article) => {
        // Get tool mentions from database
        const toolMentions = article.toolMentions || [];

        // Get tool info from tool_mentions or tool associations
        let toolNames = "Various Tools";
        const toolCategory = "ai-coding-tool";
        const toolWebsite = "";
        let primaryToolId = "unknown";

        // Try to extract tool from title using the term mapping
        const matchedSlug = findToolByText(article.title);

        // Extract tool names from tool_mentions
        if (toolMentions && toolMentions.length > 0) {
          // Handle both string array and object array formats
          const toolNamesList = toolMentions.map((mention: any) =>
            typeof mention === 'string' ? mention : mention?.tool
          ).filter(Boolean);

          if (toolNamesList.length > 0) {
            toolNames = toolNamesList.join(", ");
            primaryToolId = matchedSlug || toolNamesList[0].toLowerCase().replace(/\s+/g, "-");
          }
        } else if (matchedSlug) {
          // If no tool mentions but we matched from title, use that
          toolNames = matchedSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          primaryToolId = matchedSlug;
        }

        // Map event type based on tags or content
        let eventType = "update";

        // Check tags first for better categorization
        const tags = article.tags || [];
        if (tags.length > 0) {
          const tagStr = tags.join(" ").toLowerCase();
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
          } else if (tagStr.includes("partnership")) {
            eventType = "partnership";
          }
        }

        // Fallback to content analysis
        if (eventType === "update") {
          const text =
            `${article.title} ${article.summary || article.content || ""}`.toLowerCase();

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

        // Generate scoring factor impacts based on content and event type
        const generateScoringFactors = (eventType: string, title: string, importance: number) => {
          const factors: Record<string, number> = {};
          const titleLower = title.toLowerCase();

          // Enhanced impact magnitude calculation for more varied scores
          const baseMagnitude = Math.max(0.1, (importance - 4) / 5);

          // Add bonus multipliers for high-impact keywords
          let multiplier = 1;
          if (titleLower.includes("breakthrough") || titleLower.includes("revolutionary")) {
            multiplier = 1.5;
          }
          if (titleLower.includes("million") || titleLower.includes("billion")) {
            multiplier = 1.3;
          }
          if (titleLower.includes("launches") || titleLower.includes("announces")) {
            multiplier = 1.2;
          }

          switch (eventType) {
            case "milestone":
              if (titleLower.includes("funding") || titleLower.includes("raised")) {
                factors["market_traction"] = baseMagnitude * 2 * multiplier;
                factors["business_sentiment"] = baseMagnitude * 1.5 * multiplier;
                factors["development_velocity"] = baseMagnitude * 0.5 * multiplier;
              }
              break;
            case "feature":
              if (titleLower.includes("ai") || titleLower.includes("autonomous")) {
                factors["agentic_capability"] = baseMagnitude * 2 * multiplier;
                factors["innovation"] = baseMagnitude * 1.5 * multiplier;
              }
              if (titleLower.includes("performance") || titleLower.includes("faster")) {
                factors["technical_performance"] = baseMagnitude * 1.8 * multiplier;
              }
              if (titleLower.includes("integration") || titleLower.includes("multi")) {
                factors["platform_resilience"] = baseMagnitude * 1.2 * multiplier;
              }
              break;
            case "partnership":
              factors["business_sentiment"] = baseMagnitude * 1.3 * multiplier;
              factors["market_traction"] = baseMagnitude * 1.0 * multiplier;
              factors["platform_resilience"] = baseMagnitude * 0.8 * multiplier;
              break;
            case "update":
              factors["development_velocity"] = baseMagnitude * 1.5 * multiplier;
              if (titleLower.includes("users") || titleLower.includes("community")) {
                factors["developer_adoption"] = baseMagnitude * 1.2 * multiplier;
              }
              break;
            case "announcement":
              factors["business_sentiment"] = baseMagnitude * 1.0 * multiplier;
              break;
          }

          // Round factors to 1 decimal place and filter out zeros
          const filteredFactors: Record<string, number> = {};
          Object.entries(factors).forEach(([key, value]) => {
            const rounded = Math.round((value as number) * 10) / 10;
            if (Math.abs(rounded) >= 0.1) {
              filteredFactors[key] = rounded;
            }
          });

          return Object.keys(filteredFactors).length > 0 ? filteredFactors : undefined;
        };

        // Enhanced importance scoring based on content
        let importance = article.importanceScore || 5;
        const titleLower = article.title.toLowerCase();

        // Boost importance for high-impact keywords
        if (
          titleLower.includes("funding") ||
          titleLower.includes("raised") ||
          titleLower.includes("million")
        ) {
          importance = Math.min(10, importance + 2);
        }
        if (titleLower.includes("breakthrough") || titleLower.includes("revolutionary")) {
          importance = Math.min(10, importance + 3);
        }
        if (titleLower.includes("launches") || titleLower.includes("announces")) {
          importance = Math.min(10, importance + 1);
        }
        if (titleLower.includes("ai") && titleLower.includes("autonomous")) {
          importance = Math.min(10, importance + 2);
        }

        const scoring_factors = generateScoringFactors(eventType, article.title, importance);

        return {
          id: article.id,
          slug: article.slug,
          tool_id: primaryToolId,
          tool_slug: primaryToolId !== "unknown" ? primaryToolId : undefined,
          tool_name: toolNames,
          tool_category: toolCategory,
          tool_website: toolWebsite,
          event_date: getEffectiveDate(article),
          event_type: eventType,
          title: article.title,
          description: article.summary || article.content,
          source_url: article.sourceUrl,
          source_name: article.source || "AI News",
          metrics: {
            importance_score: importance,
          },
          scoring_factors,
          tags: tags,
        };
      })
    );

    // Apply filter
    let filteredNews = transformedNews;
    if (filter !== "all") {
      filteredNews = transformedNews.filter((item) => item.event_type === filter);
    }

    // Apply pagination to the filtered results
    const paginatedNews = filteredNews.slice(offset, offset + limit);
    const hasMoreFiltered = offset + limit < filteredNews.length;

    const responseData = {
      news: paginatedNews,
      total: filteredNews.length,
      hasMore: hasMoreFiltered,
      _source: "database",
      _timestamp: new Date().toISOString(),
      ...(debug && {
        _debug: {
          cache_key: cacheKey,
          user_agent: request.headers.get("User-Agent")?.substring(0, 100),
          request_time: new Date().toISOString(),
          mobile_ua: request.headers.get("User-Agent")?.toLowerCase().includes("mobile"),
          query_params: {
            limit,
            offset,
            filter,
            cache_buster: cacheKey
          }
        }
      })
    };

    return cachedJsonResponse(responseData, "/api/news", 200, undefined, request);
  } catch (error) {
    loggers.api.error("News API error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An error occurred while fetching news. Please try again later.",
      },
      { status: 500 }
    );
  }
}
