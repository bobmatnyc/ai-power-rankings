import { type NextRequest, NextResponse } from "next/server";
import { CacheManager } from "@/lib/cache/cache-manager";
import { loadCacheWithFallback } from "@/lib/cache/load-cache";
import { getNewsRepo, getToolsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const filter = searchParams.get("filter") || "all";

    // Check if we should use cache-first approach
    const useCacheFirst =
      process.env["USE_CACHE_FALLBACK"] === "true" ||
      process.env["VERCEL_ENV"] === "preview" ||
      true; // Enable for all environments temporarily

    // For all environments, return cached data immediately
    if (useCacheFirst) {
      loggers.api.debug("Using cache-first approach for news");

      // Return ALL news data - let client handle filtering and pagination
      const cachedNewsData = await loadCacheWithFallback("news");
      const cacheInfo = await new CacheManager().getInfo("news");

      const apiResponse = NextResponse.json({
        news: cachedNewsData.news,
        total: cachedNewsData.news.length,
        _cached: true,
        _cachedAt: cacheInfo.lastModified || new Date().toISOString(),
        _cacheReason: "Cache-first approach (database stability mode)",
        _cacheSource: cacheInfo.source,
      });

      apiResponse.headers.set("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=900");
      return apiResponse;
    }

    // Calculate page from offset
    // Page calculated from offset but not used directly

    // Get news from JSON database
    const newsRepo = getNewsRepo();
    const toolsRepo = getToolsRepo();

    const allNews = await newsRepo.getAll();

    // Sort by published date descending
    const sortedNews = allNews.sort(
      (a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime()
    );

    // Transform news data into the expected format
    const transformedNews = await Promise.all(
      sortedNews.map(async (article) => {
        // Map category to event type with keyword fallback
        let eventType = "update";
        const headline = article.title.toLowerCase();
        const summary = (article.summary || "").toLowerCase();
        const text = `${headline} ${summary}`;

        // Use keyword-based detection
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

        // Get the main tool from tool_mentions array
        let primaryToolId = null;
        let toolNames = "Various Tools";
        let toolCategory = "ai-coding-tool";
        let toolWebsite = "";
        let toolSlug = null;

        if (article.tool_mentions && article.tool_mentions.length > 0) {
          // Get tool details
          const tools = await Promise.all(
            article.tool_mentions.map(async (toolId) => {
              const tool = await toolsRepo.getById(toolId);
              return tool;
            })
          );

          const validTools = tools.filter(Boolean);

          if (validTools.length > 0) {
            const firstTool = validTools[0];
            primaryToolId = firstTool?.id;
            toolSlug = firstTool?.slug;
            toolCategory = firstTool?.category || "ai-coding-tool";
            toolWebsite = firstTool?.info?.website || "";

            toolNames = validTools.map((tool) => tool?.name).join(", ");
          } else {
            // Fallback to tool name mapping if tools not found
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

            toolNames = article.tool_mentions.map((id) => toolNameMap[id] || id).join(", ");

            primaryToolId = article.tool_mentions[0];
            toolSlug = primaryToolId;
          }
        }

        // Map tags array
        const tags = [...(article.tags || [])];
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
          description: article.summary || `${article.content.substring(0, 200)}...`,
          source_url: article.source_url,
          source_name: article.source || "AI News",
          metrics: {
            importance_score: 5, // Default importance
          },
          tags: [...new Set(tags)], // Remove duplicates
        };
      })
    );

    // Apply filter after transformation based on event_type
    let filteredNews = transformedNews;
    if (filter !== "all") {
      filteredNews = transformedNews.filter((item) => item.event_type === filter);
    }

    // Apply pagination
    const startIndex = offset;
    const endIndex = startIndex + limit;
    const paginatedNews = filteredNews.slice(startIndex, endIndex);

    const apiResponse = NextResponse.json({
      news: paginatedNews,
      total: filteredNews.length,
      hasMore: endIndex < filteredNews.length,
      _source: "json-db",
    });

    // Set cache headers for production
    apiResponse.headers.set(
      "Cache-Control",
      process.env["NODE_ENV"] === "production"
        ? "public, s-maxage=1800, stale-while-revalidate=900"
        : "no-cache"
    );

    return apiResponse;
  } catch (error) {
    loggers.news.error("News API error, falling back to cached data", { error });

    // Fall back to cached data on error - return all news without filtering
    const cachedNewsData = await loadCacheWithFallback("news");
    const cacheInfo = await new CacheManager().getInfo("news");

    const apiResponse = NextResponse.json({
      news: cachedNewsData.news.slice(0, 20), // Return first 20 items
      total: cachedNewsData.news.length,
      hasMore: cachedNewsData.news.length > 20,
      _cached: true,
      _cachedAt: cacheInfo.lastModified || new Date().toISOString(),
      _cacheReason: "Database error fallback",
      _cacheSource: cacheInfo.source,
    });

    apiResponse.headers.set("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=900");
    return apiResponse;
  }
}
