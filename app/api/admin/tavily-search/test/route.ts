/**
 * Admin API: Tavily Search Test
 *
 * POST /api/admin/tavily-search/test
 * Test the Tavily Search API with a custom query
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { TavilySearchService } from "@/lib/services/tavily-search.service";
import { loggers } from "@/lib/logger";

/**
 * POST /api/admin/tavily-search/test
 *
 * Test Tavily search with a query
 *
 * Request body:
 * - query: string (optional) - Custom search query
 * - maxResults: number (optional) - Max results (default: 10)
 */
export async function POST(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    // Parse request body
    let body: { query?: string; maxResults?: number } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is allowed
    }

    const query = body.query || "AI coding assistant news";
    const maxResults = body.maxResults || 10;

    const tavilyService = new TavilySearchService();

    if (!tavilyService.isConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "Tavily API key not configured",
        },
        { status: 503 }
      );
    }

    loggers.api.info("[TavilyTest] Testing search", { query, maxResults });

    const results = await tavilyService.testSearch(query);

    loggers.api.info("[TavilyTest] Search completed", {
      resultsCount: results.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        query,
        resultsCount: results.length,
        results: results.slice(0, maxResults),
        serviceConfigured: true,
      },
    });
  } catch (error) {
    loggers.api.error("[TavilyTest] Search failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Search failed",
      },
      { status: 500 }
    );
  }
}
