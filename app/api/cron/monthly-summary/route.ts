/**
 * Cron API: Monthly State of AI Summary Generation
 *
 * GET /api/cron/monthly-summary
 * - Runs on 1st of month at 8 AM UTC (configured in vercel.json)
 * - Generates State of AI editorial summary for the previous month
 * - Requires CRON_SECRET authentication via Bearer token
 */

import { NextResponse } from "next/server";
import { StateOfAiSummaryService } from "@/lib/services/state-of-ai-summary.service";
import { loggers } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for LLM generation

/**
 * GET /api/cron/monthly-summary
 * Vercel Cron endpoint for generating monthly State of AI summary
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // 1. Verify CRON_SECRET authentication
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env["CRON_SECRET"];

    if (!cronSecret) {
      loggers.api.error("CRON_SECRET environment variable not configured");
      return NextResponse.json(
        {
          success: false,
          error: "Cron endpoint not configured",
        },
        { status: 500 }
      );
    }

    const expectedToken = `Bearer ${cronSecret}`;
    if (authHeader !== expectedToken) {
      loggers.api.warn("Unauthorized cron request", {
        hasAuthHeader: !!authHeader,
        endpoint: "/api/cron/monthly-summary",
      });
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // 2. Determine target month (previous month for 1st of month cron)
    const now = new Date();
    let targetMonth = now.getMonth(); // 0-indexed, so current month - 1
    let targetYear = now.getFullYear();

    // If we're on the 1st, generate for previous month
    // If month is January (0), go to December of previous year
    if (targetMonth === 0) {
      targetMonth = 12;
      targetYear -= 1;
    }

    loggers.api.info("Cron: Starting monthly State of AI generation", {
      targetMonth,
      targetYear,
      triggerDate: now.toISOString(),
    });

    // 3. Generate State of AI summary
    const service = new StateOfAiSummaryService();
    const result = await service.generateStateOfAi(
      targetMonth,
      targetYear,
      "cron-monthly-summary",
      false // Don't force regenerate if already exists
    );

    const duration = Date.now() - startTime;

    loggers.api.info("Cron: Monthly State of AI generation complete", {
      targetMonth,
      targetYear,
      isNew: result.isNew,
      durationMs: duration,
      contentLength: result.summary.content.length,
      summaryId: result.summary.id,
    });

    // 4. Return success response
    return NextResponse.json(
      {
        success: true,
        message: result.isNew
          ? `State of AI summary generated for ${targetMonth}/${targetYear}`
          : `State of AI summary already exists for ${targetMonth}/${targetYear}`,
        summaryGenerated: result.isNew,
        summary: {
          id: result.summary.id,
          month: result.summary.month,
          year: result.summary.year,
          generatedAt: result.summary.generatedAt.toISOString(),
          contentLength: result.summary.content.length,
        },
        generationTimeMs: result.generationTimeMs,
      },
      { status: 200 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;

    loggers.api.error("Cron: Failed to generate monthly State of AI summary", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: duration,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate monthly summary",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
