/**
 * Public API: Get the current monthly report (the former State of AI editorial)
 *
 * GET /api/state-of-ai/current
 * - #182: returns the newest version of the latest month from the one monthly
 *   generator (`monthly_report_versions`). Until that table has a version, it
 *   reads the read-only `state_of_ai_summaries` table as before: the current
 *   month's editorial, else the most recent.
 * - Public endpoint with ISR caching
 */

import { NextResponse } from "next/server";
import { StateOfAiSummaryService } from "@/lib/services/state-of-ai-summary.service";
import {
  getLatestStoredSummary,
  periodToMonthYear,
} from "@/lib/services/monthly-report.repository";
import { loggers } from "@/lib/logger";

/** The response's `summary` object, shared by the merged report and a legacy editorial. */
interface CurrentReport {
  id: string;
  month: number;
  year: number;
  content: string;
  generatedAt: Date;
  metadata: unknown;
}

/**
 * #182: the merged report when one has a version, else the legacy editorial.
 * A legacy `monthly_summaries` row (version 0) is not used here: it is the
 * other generator's ~1,500-word summary, not this endpoint's content.
 */
async function readCurrentReport(): Promise<CurrentReport | null> {
  const merged = await getLatestStoredSummary();
  if (merged && merged.version > 0) {
    return { ...merged, ...periodToMonthYear(merged.period) };
  }
  return new StateOfAiSummaryService().getCurrentSummary();
}

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
    loggers.api.debug("Fetching current State of AI editorial");

    const summary = await readCurrentReport();

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
