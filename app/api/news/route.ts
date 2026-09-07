import { type NextRequest, NextResponse } from "next/server";
import { cachedJsonResponse } from "@/lib/api-cache";
import { getDb } from "@/lib/db/connection";
import { NewsRepository } from "@/lib/db/repositories/news";
import { loggers } from "@/lib/logger";
import { findToolByText } from "@/lib/tool-matcher";

/** Largest page the route will serve; the news page asks for exactly this many. */
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * Deepest page the route will serve; a request past it is rejected, not clamped.
 *
 * Why: Postgres reaches an OFFSET by sorting and discarding every row before it,
 * so an unbounded `?offset=` is a cheap way for a caller to make the database do
 * arbitrary work per request. Clamping would be worse than rejecting: a client
 * paging forward would get page 10000 back with `hasMore: true` and walk that
 * same page forever. A 400 tells it where the wall is. The news page walks
 * forward one page at a time and no in-repo caller passes an offset at all.
 * Test: `tests/unit/news-route-pagination.test.ts`.
 */
const MAX_OFFSET = 10000;

/**
 * Reads one integer query parameter, bounded.
 *
 * Why: `parseInt("abc")` is NaN, which reached the query as a LIMIT/OFFSET and
 * would fail the statement rather than fall back (#140).
 * What: Returns `fallback` when the value is not a number. Otherwise clamps it
 * into `[min, max]` — `min` defaults to 0, and an omitted `max` means no upper
 * bound. Out-of-range input is clamped, never rejected and never replaced by
 * `fallback`.
 * Test: `tests/unit/news-route-pagination.test.ts`.
 */
function readBoundedInt(
  raw: string | null,
  fallback: number,
  { min = 0, max }: { min?: number; max?: number } = {}
): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;

  const floored = Math.max(min, parsed);
  return max === undefined ? floored : Math.min(max, floored);
}

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
    // #140: bound both, and fall back rather than 500, before either reaches SQL.
    const limit = readBoundedInt(searchParams.get("limit"), DEFAULT_LIMIT, {
      min: 1,
      max: MAX_LIMIT,
    });
    const offset = readBoundedInt(searchParams.get("offset"), 0);
    const filter = searchParams.get("filter") || "all";
    const debug = searchParams.get("debug") === "true";
    const cacheKey = searchParams.get("cb"); // Cache-busting key

    // #140: past the ceiling the request is refused rather than served a
    // clamped page, which a paginating client would loop on.
    if (offset > MAX_OFFSET) {
      return NextResponse.json(
        {
          error: "Invalid offset",
          message: `offset exceeds maximum of ${MAX_OFFSET}`,
        },
        { status: 400 }
      );
    }

    // #140: the event_type filter is a SQL expression now, so the page, its
    // total and the filter all come out of one query instead of a fetched pool.
    const eventType = filter === "all" ? null : filter;

    loggers.api.debug("Getting news from database", { limit, offset, filter });

    const newsRepo = new NewsRepository();

    const {
      articles: allNews,
      total,
      hasMore,
    } = await newsRepo.getPaginatedFiltered({ limit, offset, eventType });

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

        const tags = article.tags || [];
        // #140: event_type is derived in SQL (lib/db/news-event-type.ts) so the
        // WHERE, the COUNT(*) and this response all read one classification.
        const eventType = article.eventType;

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

    const responseData = {
      news: transformedNews,
      total,
      hasMore,
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
