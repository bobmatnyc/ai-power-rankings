/**
 * API Route: What's New Monthly Summary
 * GET: Read a stored summary (public; never generates)
 * POST: Force regeneration (admin only)
 */

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { cachedJsonResponse } from "@/lib/api-cache";
import {
  WhatsNewSummaryService,
  getStoredSummaryVersion,
} from "@/lib/services/whats-new-summary.service";
import { loggers } from "@/lib/logger";

// Runtime configuration for Vercel
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// #160: a 16k-token regeneration can outlast 60 s; matches /api/cron/monthly-summary.
export const maxDuration = 300;

/**
 * GET /api/whats-new/summary
 *
 * Why: This route is public, and generating a summary spends LLM credits, so
 * an anonymous request must never start generation. Generation happens only
 * through the admin POST below and the CRON_SECRET-gated daily-news cron.
 * What: Returns the stored summary for `?period=YYYY-MM`, or 404 when none is
 * stored. Without a period it returns the current month's stored summary,
 * else the most recent stored one, else 404. #160: the daily-news cron
 * (re)generates the current month's row, so the fallback covers the days
 * before a new month has any articles. #182: `&version=N` with a period returns
 * that stored version (0 = the pre-merge row), so regenerating keeps every
 * earlier version reachable; a malformed version is 400.
 * Test: `tests/unit/auth-hardening.test.ts`, `tests/unit/monthly-report-182.test.ts`.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || undefined; // YYYY-MM format
    const versionParam = searchParams.get("version");

    loggers.api.info("Fetching monthly summary", { period: period || "current" });

    // #182: an exact version needs an exact period.
    if (versionParam !== null && (!period || !/^\d+$/.test(versionParam))) {
      return NextResponse.json(
        { error: "Bad request", message: "version needs a period and a whole number.", summary: null },
        { status: 400 }
      );
    }

    const summaryService = new WhatsNewSummaryService();

    const stored =
      versionParam !== null && period
        ? await getStoredSummaryVersion(period, Number(versionParam))
        : ((await summaryService.getCachedSummary(period)) ??
          (period ? null : await summaryService.getLatestSummary()));

    if (!stored) {
      loggers.api.info("No stored summary found", { period: period || "current" });
      return NextResponse.json(
        { error: "Not found", message: "No summary is available for this period.", summary: null },
        { status: 404 }
      );
    }

    return cachedJsonResponse(
      {
        summary: {
          period: stored.period,
          version: stored.version,
          content: stored.content,
          generatedAt: stored.generatedAt,
          metadata: stored.metadata,
        },
        isNew: false,
        generationTimeMs: 0,
        _timestamp: new Date().toISOString(),
        _cached: true,
      },
      `/api/whats-new/summary?period=${period || "current"}${versionParam !== null ? `&version=${versionParam}` : ""}`,
      200, // HTTP status code
      { maxAge: 300, sMaxAge: 300 } // Cache for 5 minutes
    );
  } catch (error) {
    loggers.api.error("Monthly summary API error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof Error && error.message.includes("Database connection")) {
      return NextResponse.json(
        {
          error: "Database unavailable",
          message: "The database service is currently unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An error occurred while reading the summary. Please try again later.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/whats-new/summary
 *
 * Why: Forces an LLM regeneration of the monthly summary, so it is admin-only.
 * It used to accept any signed-in user, and only when NODE_ENV was production.
 * What: `requireAdmin()` runs before the body is read (401 anonymous, 403
 * non-admin); an admin's request regenerates the summary for `body.period`.
 * Test: `tests/unit/auth-hardening.test.ts`.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const period = body.period || undefined; // YYYY-MM format

    loggers.api.info("Manual regeneration triggered", {
      period: period || "current",
      userId: authResult.userId,
    });

    const summaryService = new WhatsNewSummaryService();
    // #182: a forced regeneration appends a version; earlier ones stay readable.
    const result = await summaryService.generateMonthlySummary(period, true, authResult.userId ?? "admin");

    return NextResponse.json({
      success: true,
      summary: {
        period: result.summary.period,
        version: result.summary.version,
        content: result.summary.content,
        generatedAt: result.summary.generatedAt,
        metadata: result.summary.metadata,
      },
      generationTimeMs: result.generationTimeMs,
      _timestamp: new Date().toISOString(),
    });
  } catch (error) {
    loggers.api.error("Manual regeneration failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Regeneration failed",
        message: "Failed to regenerate summary. Please try again later.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
