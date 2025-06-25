import { NextRequest, NextResponse } from "next/server";
import { payloadDirect } from "@/lib/payload-direct";
import { loggers } from "@/lib/logger";
import cachedNewsData from "@/data/cache/news.json";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const filter = searchParams.get("filter") || "all";

    // Check if we should use cache-first approach
    const useCacheFirst =
      process.env["USE_CACHE_FALLBACK"] === "true" || process.env["VERCEL_ENV"] === "preview";

    // For preview environments, return cached data immediately
    if (useCacheFirst) {
      loggers.api.info("Using cache-first approach for news");

      // Apply filter to cached data
      let filteredNews = cachedNewsData.news;
      if (filter !== "all") {
        filteredNews = cachedNewsData.news.filter((item: any) => item.event_type === filter);
      }

      // Apply pagination
      const paginatedNews = filteredNews.slice(offset, offset + limit);

      const apiResponse = NextResponse.json({
        news: paginatedNews,
        total: filteredNews.length,
        hasMore: offset + limit < filteredNews.length,
        _cached: true,
        _cachedAt: "2025-06-25T15:10:00.000Z",
        _cacheReason: "Cache-first approach for preview environment",
      });

      apiResponse.headers.set("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=900");
      return apiResponse;
    }

    // Calculate page from offset
    const page = Math.floor(offset / limit) + 1;

    // Get news from Payload
    const response = await payloadDirect.getNews({
      limit,
      page,
      sort: "-published_at",
    });
    const newsItems = response.docs;

    // Don't filter here - we'll filter after transformation based on event_type

    // Transform news data into the expected format
    const transformedNews =
      newsItems?.map((article: any) => {
        // Map category to event type with keyword fallback
        let eventType = "update";
        const headline = (article.headline || "").toLowerCase();
        const summary = (article.summary || "").toLowerCase();
        const text = `${headline} ${summary}`;

        // First check explicit category
        switch (article.category) {
          case "funding":
            eventType = "milestone";
            break;
          case "acquisition":
            eventType = "partnership";
            break;
          case "product-launch":
            eventType = "feature";
            break;
          case "technical-achievement":
            eventType = "update";
            break;
          case "general":
            eventType = "update";
            break;
          default:
            // Use keyword-based detection for all categories including unknown ones
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
            } else {
              eventType = "update";
            }
        }

        // Additional keyword enhancement even for categorized articles
        if (
          article.category &&
          article.category !== "funding" &&
          article.category !== "acquisition" &&
          article.category !== "product-launch"
        ) {
          // Override with keyword detection for better accuracy
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
            text.includes("introduces") ||
            text.includes("unveils") ||
            text.includes("debuts") ||
            text.includes("feature") ||
            text.includes("version") ||
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
            text.includes("appoints") ||
            text.includes("names")
          ) {
            eventType = "announcement";
          }
        }

        // Get the main tool from related_tools array
        let primaryToolId = null;
        let toolNames = "Various Tools";
        let toolCategory = "ai-coding-tool";
        let toolWebsite = "";

        if (Array.isArray(article.related_tools) && article.related_tools.length > 0) {
          // Handle both string IDs and populated objects
          const firstTool = article.related_tools[0];
          primaryToolId = typeof firstTool === "string" ? firstTool : firstTool?.id;

          // Get category and website from first tool if it's populated
          if (typeof firstTool === "object" && firstTool) {
            toolCategory = firstTool.category || "ai-coding-tool";
            toolWebsite = firstTool.website_url || "";
          }

          // Fallback website mapping for common tools if website_url is empty
          if (!toolWebsite && primaryToolId) {
            const websiteMap: Record<string, string> = {
              cursor: "cursor.sh",
              devin: "devin.ai",
              "claude-code": "claude.ai",
              "github-copilot": "github.com",
              "chatgpt-canvas": "openai.com",
              "openai-codex-cli": "openai.com",
              "augment-code": "augmentcode.com",
              "google-jules": "deepmind.google",
              lovable: "lovable.dev",
              "bolt-new": "bolt.new",
              windsurf: "codeium.com",
              zed: "zed.dev",
              tabnine: "tabnine.com",
              "replit-agent": "replit.com",
              "amazon-q-developer": "aws.amazon.com",
            };

            toolWebsite = websiteMap[primaryToolId] || "";
          }

          toolNames = article.related_tools
            .map((tool: any) => {
              const toolId = typeof tool === "string" ? tool : tool?.id;
              const toolName = typeof tool === "object" && tool?.name ? tool.name : toolId;

              // Simple mapping for common tool IDs to display names
              const toolNameMap: Record<string, string> = {
                cursor: "Cursor",
                devin: "Devin",
                "claude-code": "Claude Code",
                "github-copilot": "GitHub Copilot",
                "chatgpt-canvas": "ChatGPT Canvas",
                "openai-codex-cli": "OpenAI Codex CLI",
                "augment-code": "Augment Code",
                "google-jules": "Google Jules",
                lovable: "Lovable",
                "bolt-new": "Bolt.new",
                windsurf: "Windsurf",
                zed: "Zed",
                tabnine: "Tabnine",
                "replit-agent": "Replit Agent",
                "amazon-q-developer": "Amazon Q Developer",
              };

              return toolNameMap[toolId] || toolName || toolId;
            })
            .join(", ");
        }

        // Extract summary text from rich text if needed
        let summaryText = "";
        if (article.summary && Array.isArray(article.summary)) {
          summaryText = article.summary
            .map((block: any) => block.children?.map((child: any) => child.text).join(""))
            .join("\n");
        } else if (typeof article.summary === "string") {
          summaryText = article.summary;
        }

        // Map tags array or create from category
        const tags = article.tags || [article.category];
        if (article.related_tools && Array.isArray(article.related_tools)) {
          article.related_tools.forEach((tool: any) => {
            const toolId = typeof tool === "string" ? tool : tool?.id;
            if (toolId) {
              tags.push(toolId);
            }
          });
        }

        // Get tool slug if available from the first tool object
        let toolSlug = primaryToolId;
        if (Array.isArray(article.related_tools) && article.related_tools.length > 0) {
          const firstTool = article.related_tools[0];
          if (typeof firstTool === "object" && firstTool?.slug) {
            toolSlug = firstTool.slug;
          }
        }

        return {
          id: article.id,
          tool_id: toolSlug || primaryToolId || "unknown", // Use slug if available
          tool_name: toolNames,
          tool_category: toolCategory,
          tool_website: toolWebsite,
          event_date: article.published_at || article.createdAt,
          event_type: eventType,
          title: article.headline,
          description: summaryText || article.headline,
          source_url: article.source_url,
          source_name: article.source || "AI News",
          metrics: {
            importance_score:
              article.impact_level === "high" ? 8 : article.impact_level === "medium" ? 5 : 3,
          },
          tags: tags,
        };
      }) || [];

    // Apply filter after transformation based on event_type
    let filteredNews = transformedNews;
    if (filter !== "all") {
      filteredNews = transformedNews.filter((item: any) => item.event_type === filter);
    }

    const apiResponse = NextResponse.json({
      news: filteredNews,
      total: filteredNews.length, // Use filtered count
      hasMore: false, // Since we're filtering post-transformation, disable pagination for now
    });

    // Set cache headers for production
    apiResponse.headers.set(
      "Cache-Control",
      process.env.NODE_ENV === "production"
        ? "public, s-maxage=1800, stale-while-revalidate=900"
        : "no-cache"
    );

    return apiResponse;
  } catch (error) {
    loggers.news.error("News API error, falling back to cached data", { error });

    // Fall back to cached data on error - return all news without filtering
    const apiResponse = NextResponse.json({
      news: cachedNewsData.news.slice(0, 20), // Return first 20 items
      total: cachedNewsData.news.length,
      hasMore: cachedNewsData.news.length > 20,
      _cached: true,
      _cachedAt: "2025-06-25T15:10:00.000Z",
      _cacheReason: "Database error fallback",
    });

    apiResponse.headers.set("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=900");
    return apiResponse;
  }
}
