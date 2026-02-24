/**
 * Cron API: Daily AI News Discovery and Ingestion
 *
 * GET /api/cron/daily-news
 * - Runs daily at 6 AM UTC (configured in vercel.json)
 * - Discovers and ingests relevant AI coding tools news
 * - Requires CRON_SECRET authentication via Bearer token OR Vercel cron authentication
 * - Invalidates news/homepage caches after successful ingestion
 */

import { NextResponse } from "next/server";
import {
  AutomatedIngestionService,
  type IngestionResult,
} from "@/lib/services/automated-ingestion.service";
import { invalidateArticleCache } from "@/lib/cache/invalidation.service";
import { loggers } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800; // ~13 minutes - pipeline can take 10+ minutes with large article sets

/**
 * Verify if request is authorized for cron execution
 */
function isAuthorizedCronRequest(request: Request): boolean {
  // Method 1: Check for Bearer token (manual testing)
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env["CRON_SECRET"];

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    loggers.api.info("Cron: Authorized via Bearer token");
    return true;
  }

  // Method 2: Check for Vercel cron headers (automatic scheduling)
  const vercelCronHeader = request.headers.get("x-vercel-cron");
  const userAgent = request.headers.get("user-agent");

  if (vercelCronHeader === "1" || userAgent?.includes("vercel-cron")) {
    loggers.api.info("Cron: Authorized via Vercel cron scheduler");
    return true;
  }

  // Method 3: Check if running in Vercel environment with internal request
  const isVercelEnvironment = process.env.VERCEL === "1";
  const vercelRegion = request.headers.get("x-vercel-deployment-url");

  if (isVercelEnvironment && vercelRegion) {
    loggers.api.info("Cron: Authorized via Vercel internal request");
    return true;
  }

  return false;
}

/**
 * GET /api/cron/daily-news
 * Vercel Cron endpoint for daily AI news discovery and ingestion
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // 1. Verify cron authentication
    if (!isAuthorizedCronRequest(request)) {
      const authHeader = request.headers.get("Authorization");
      const vercelCronHeader = request.headers.get("x-vercel-cron");

      loggers.api.warn("Unauthorized cron request", {
        hasAuthHeader: !!authHeader,
        hasVercelCronHeader: !!vercelCronHeader,
        userAgent: request.headers.get("user-agent"),
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

    // 3. Invalidate caches if any articles were ingested
    // This ensures the News page and Homepage show new content immediately
    if (result.articlesIngested > 0) {
      try {
        const cacheResult = await invalidateArticleCache();
        loggers.api.info("Cron: Cache invalidation complete", {
          pathsRevalidated: cacheResult.pathsRevalidated.length,
          tagsRevalidated: cacheResult.tagsRevalidated.length,
          memoryCacheCleared: cacheResult.memoryCacheCleared.length,
          success: cacheResult.success,
        });
      } catch (cacheError) {
        // Log but don't fail the cron job if cache invalidation fails
        loggers.api.error("Cron: Cache invalidation failed", {
          error: cacheError instanceof Error ? cacheError.message : "Unknown error",
        });
      }
    }

    // 4. Return success response
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
