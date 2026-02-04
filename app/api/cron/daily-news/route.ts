/**
 * Cron API: Daily AI News Discovery and Ingestion
 *
 * GET /api/cron/daily-news
 * - Runs daily at 6 AM UTC (configured in vercel.json)
 * - Discovers and ingests relevant AI coding tools news
 * - Requires CRON_SECRET authentication via Bearer token
 */

import { NextResponse } from "next/server";
import {
  AutomatedIngestionService,
  type IngestionResult,
} from "@/lib/services/automated-ingestion.service";
import { loggers } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for news discovery and ingestion

/**
 * GET /api/cron/daily-news
 * Vercel Cron endpoint for daily AI news discovery and ingestion
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
        endpoint: "/api/cron/daily-news",
      });
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    loggers.api.info("Cron: Starting daily news discovery", {
      triggerDate: new Date().toISOString(),
    });

    // 2. Run daily news discovery and ingestion
    const service = new AutomatedIngestionService();
    const result: IngestionResult = await service.runDailyDiscovery();

    const duration = Date.now() - startTime;

    loggers.api.info("Cron: Daily news discovery complete", {
      runId: result.runId,
      articlesDiscovered: result.articlesDiscovered,
      articlesIngested: result.articlesIngested,
      articlesSkipped: result.articlesSkipped,
      rankingChanges: result.rankingChanges,
      errors: result.errors.length,
      durationMs: duration,
    });

    // 3. Return success response
    return NextResponse.json(
      {
        success: true,
        data: {
          runId: result.runId,
          status: result.status,
          articlesDiscovered: result.articlesDiscovered,
          articlesPassedQuality: result.articlesPassedQuality,
          articlesIngested: result.articlesIngested,
          articlesSkipped: result.articlesSkipped,
          rankingChanges: result.rankingChanges,
          estimatedCostUsd: result.estimatedCostUsd,
          errors: result.errors,
          ingestedArticleIds: result.ingestedArticleIds,
          durationMs: result.durationMs,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;

    loggers.api.error("Cron: Failed to run daily news discovery", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: duration,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to run daily news discovery",
      },
      { status: 500 }
    );
  }
}
