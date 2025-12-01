/**
 * Public API: Get Current State of AI Editorial
 *
 * GET /api/state-of-ai/current
 * - Returns current month's State of AI editorial
 * - Falls back to most recent if current month not available
 * - Public endpoint with ISR caching
 */

import { NextResponse } from "next/server";
import { StateOfAiSummaryService } from "@/lib/services/state-of-ai-summary.service";
import { loggers } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ISR: Revalidate every hour (3600 seconds)
export const revalidate = 3600;

/**
 * GET /api/state-of-ai/current
 * Get current month's State of AI editorial summary
 */
export async function GET() {
  try {
    const service = new StateOfAiSummaryService();

    loggers.api.debug("Fetching current State of AI editorial");

    const summary = await service.getCurrentSummary();

    if (!summary) {
      loggers.api.warn("No State of AI editorial found");
      return NextResponse.json(
        {
          error: "No State of AI editorial available yet",
          message: "The State of AI editorial has not been generated for any period.",
        },
        { status: 404 }
      );
    }

    loggers.api.debug("State of AI editorial retrieved", {
      month: summary.month,
      year: summary.year,
      generatedAt: summary.generatedAt.toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        summary: {
          id: summary.id,
          month: summary.month,
          year: summary.year,
          content: summary.content,
          generatedAt: summary.generatedAt.toISOString(),
          metadata: summary.metadata,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      }
    );
  } catch (error) {
    loggers.api.error("Failed to fetch State of AI editorial", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Failed to fetch State of AI editorial",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
