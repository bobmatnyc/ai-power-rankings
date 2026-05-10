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

/**
 * Send a failure alert via webhook when the cron route encounters an error.
 *
 * Uses ALERT_WEBHOOK_URL env var (e.g. a Slack incoming webhook or similar).
 * Silently no-ops if the env var is not set — set it in Vercel dashboard to
 * enable alerting.
 */
async function sendCronAlert(
  route: string,
  errorMessage: string,
  details: Record<string, unknown>
): Promise<void> {
  const webhookUrl = process.env["ALERT_WEBHOOK_URL"];
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `[CRON FAILURE] ${route}`,
        error: errorMessage,
        ...details,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Never throw from the alert path — logging is sufficient fallback
    loggers.api.error("Cron: Failed to send alert webhook", { route });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800; // ~13 minutes - pipeline can take 10+ minutes with large article sets

/**
 * Verify if request is authorized for cron execution.
 *
 * Uses ONLY the Bearer token check per Vercel's official cron documentation.
 * Vercel's cron scheduler automatically sends `Authorization: Bearer <CRON_SECRET>`.
 *
 * Previous methods removed due to security vulnerabilities:
 * - x-vercel-cron header: Not sent by Vercel, was dead code
 * - User-agent check: Trivially spoofable by any HTTP client
 * - Vercel environment check: VERCEL=1 and x-vercel-deployment-url are present
 *   on ALL requests, not just cron — this bypassed auth entirely
 */
function isAuthorizedCronRequest(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env["CRON_SECRET"];

  if (!cronSecret) {
    loggers.api.error("Cron: CRON_SECRET environment variable not configured");
    return false;
  }

  if (authHeader === `Bearer ${cronSecret}`) {
    loggers.api.info("Cron: Authorized via Bearer token");
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
      loggers.api.warn("Unauthorized cron request", {
        hasAuthHeader: !!request.headers.get("authorization"),
        userAgent: request.headers.get("user-agent"),
        endpoint: "/api/cron/daily-news",
      });

      // Alert: 401 means CRON_SECRET is misconfigured — daily ingestion is silently broken
      await sendCronAlert("/api/cron/daily-news", "401 Unauthorized — CRON_SECRET mismatch or not set", {
        hasAuthHeader: !!request.headers.get("authorization"),
        impact: "Daily article ingestion is not running — articles will fall behind",
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    loggers.api.error("Cron: Failed to run daily news discovery", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: duration,
    });

    // Alert on failure so outages are caught immediately rather than discovered days later
    await sendCronAlert("/api/cron/daily-news", errorMessage, {
      durationMs: duration,
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5).join(" | ") : undefined,
      impact: "Daily article ingestion failed — run the backfill script if this persists: npx tsx scripts/trigger-ingestion.ts --max-articles=20 --days=1",
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
