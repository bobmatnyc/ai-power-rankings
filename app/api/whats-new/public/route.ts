/**
 * Public API Route: What's New Monthly Summaries
 * GET: Retrieve monthly summary for public display
 * No authentication required - public access
 */

import { type NextRequest, NextResponse } from "next/server";
import { MonthlySummariesRepository } from "@/lib/db/repositories/monthly-summaries.repository";
import { loggers } from "@/lib/logger";

/**
 * GET /api/whats-new/public
 * GET /api/whats-new/public?month=YYYY-MM
 * Retrieve latest or specific monthly summary for public display
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get("month"); // Optional: YYYY-MM format

    loggers.api.info("Public monthly summary request", { month: month || "latest" });

    const summariesRepo = new MonthlySummariesRepository();

    let summary;
    if (month) {
      // Validate month format (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json(
          {
            error: "Invalid month format",
            message: "Month must be in YYYY-MM format (e.g., 2025-01)",
          },
          { status: 400 }
        );
      }
      summary = await summariesRepo.getByPeriod(month);
    } else {
      summary = await summariesRepo.getLatest();
    }

    if (!summary) {
      return NextResponse.json(
        {
          error: "Summary not found",
          message: month
            ? `No summary found for ${month}`
            : "No monthly summaries available yet",
        },
        { status: 404 }
      );
    }

    // Get navigation info (previous/next months)
    const [previous, next] = await Promise.all([
      summariesRepo.getPrevious(summary.period),
      summariesRepo.getNext(summary.period),
    ]);

    return NextResponse.json(
      {
        summary: {
          id: summary.id,
          period: summary.period,
          periodFormatted: summariesRepo.formatPeriod(summary.period),
          content: summary.content,
          metadata: summary.metadata,
          generatedAt: summary.generatedAt,
        },
        navigation: {
          previous: previous ? { period: previous.period, title: summariesRepo.formatPeriod(previous.period) } : null,
          next: next ? { period: next.period, title: summariesRepo.formatPeriod(next.period) } : null,
        },
        _timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    loggers.api.error("Public monthly summary API error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes("Database connection")) {
        return NextResponse.json(
          {
            error: "Database unavailable",
            message: "The database service is currently unavailable. Please try again later.",
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An error occurred while fetching the summary. Please try again later.",
      },
      { status: 500 }
    );
  }
}
