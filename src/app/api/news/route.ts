import { type NextRequest, NextResponse } from "next/server";
import { cachedJsonResponse } from "@/lib/api-cache";
import { getNewsRepo, getToolsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";
import { findToolByText } from "@/lib/tool-matcher";

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
      sortedNews.map(async (article) => {
        // Get tool info from tool_mentions or tool_ids
        let toolNames = "Various Tools";
        let toolCategory = "ai-coding-tool";
        let toolWebsite = "";
        let primaryToolId = "unknown";

        // Try to extract tool from title using the term mapping
        const tools = await toolsRepo.getAll();
        let matchingTool = null;

        // First, try to find tool using the term mapping
        const matchedSlug = findToolByText(article.title);
        if (matchedSlug) {
          matchingTool = tools.find((t) => t.slug === matchedSlug) || null;
        }

        // If no match in title, check tool_mentions
        if (!matchingTool && article.tool_mentions && article.tool_mentions.length > 0) {
          // Try to find tools by name
          const firstToolName = article.tool_mentions[0];
          matchingTool = tools.find(
            (t) =>
              t.name.toLowerCase() === firstToolName?.toLowerCase() ||
              t.slug === firstToolName?.toLowerCase().replace(/\s+/g, "-")
          );

          if (!matchingTool) {
            // Use the tool mention as the name even if we don't find a match
            toolNames = article.tool_mentions.join(", ");
          }
        }

        if (matchingTool) {
          toolNames = matchingTool.name;
          toolCategory = matchingTool.category || "ai-coding-tool";
          toolWebsite = matchingTool.info?.website || "";
          primaryToolId = matchingTool.slug || matchingTool.id;
        } else if ((article as any).tool_ids && (article as any).tool_ids.length > 0) {
          // Fallback to old format with tool_ids
          const firstToolId = (article as any).tool_ids[0];
          const tool = await toolsRepo.getById(firstToolId);

          if (tool) {
            toolNames = tool.name;
            toolCategory = tool.category || "ai-coding-tool";
            toolWebsite = tool.info?.website || "";
            primaryToolId = tool.slug || tool.id;
          }

          // If multiple tools, get all names
          if ((article as any).tool_ids.length > 1) {
            const tools = await Promise.all(
              (article as any).tool_ids.map(async (id: string) => {
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

        // Generate scoring factor impacts based on content and event type
        const generateScoringFactors = (eventType: string, title: string, importance: number) => {
          const factors: Record<string, number> = {};
          const titleLower = title.toLowerCase();

          // Enhanced impact magnitude calculation for more varied scores
          const baseMagnitude = Math.max(0.1, (importance - 4) / 5); // Better range: 0.1 to 1.2

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
        let importance = (article as any).importance_score || 5;
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
          event_date: article.published_date || (article as any).published_at || article.created_at,
          event_type: eventType,
          title: article.title,
          description: article.summary || article.content,
          source_url: article.source_url,
          source_name: article.source || (article as any).source_name || "AI News",
          metrics: {
            importance_score: importance,
          },
          scoring_factors,
          tags: article.tags || [],
        };
      })
    );

    // Apply filter
    let filteredNews = transformedNews;
    if (filter !== "all") {
      filteredNews = transformedNews.filter((item) => item.event_type === filter);
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
