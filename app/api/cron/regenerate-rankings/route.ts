/**
 * Cron API: Monthly Ranking Regeneration
 *
 * GET /api/cron/regenerate-rankings
 * - Runs on the 1st of the month at 09:00 UTC (configured in vercel.json)
 * - #185: publishes one current board per list (models, coding harnesses,
 *   productivity tools), scored by the active scoring profile set, through
 *   `publishActiveRankings()`. Each list's previous current row is demoted; the
 *   legacy combined rows are neither written nor changed. A refused or
 *   invalid profile set fails the run (500 and alert) before any write.
 * - Requires CRON_SECRET authentication via Bearer token (same as sibling crons)
 * - Idempotent per period; concurrent/duplicate runs for the same period return 409
 * - #95 step 7: `RANKINGS_REQUIRE_FRESH_METRICS=true` turns on the blocking freshness mode;
 *   a refused run (`StaleMetricsError`) writes nothing, alerts and returns 409. Unset: flag mode.
 * Test: `tests/unit/publish-active-185.test.ts`.
 */

import { NextResponse } from "next/server";
import { invalidateRankingsCache } from "@/lib/cache/invalidation.service";
import { loggers } from "@/lib/logger";
import { publishActiveRankings } from "@/lib/rankings/publish-active";
import {
  freshnessModeFromEnv,
  RankingGenerationInProgressError,
  StaleMetricsError,
} from "@/lib/services/ranking-generation.service";

/**
 * Send a failure alert via webhook when the cron route encounters an error.
 *
 * Uses ALERT_WEBHOOK_URL env var (e.g. a Slack incoming webhook or similar).
 * Silently no-ops if the env var is not set.
 */
async function sendCronAlert(
  route: string,
  errorMessage: string,
  details: Record<string, unknown>,
  // #95: a stale-metrics warning reuses this webhook without calling itself a failure.
  label: "FAILURE" | "WARNING" = "FAILURE"
): Promise<void> {
  const webhookUrl = process.env["ALERT_WEBHOOK_URL"];
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `[CRON ${label}] ${route}`,
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
export const maxDuration = 300; // 5 minutes — matches sibling cron routes

/**
 * Verify if request is authorized for cron execution.
 *
 * Uses ONLY the Bearer token check per Vercel's official cron documentation.
 * Vercel's cron scheduler automatically sends `Authorization: Bearer <CRON_SECRET>`.
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
 * GET /api/cron/regenerate-rankings
 * Vercel Cron endpoint for monthly ranking regeneration.
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // 1. Verify cron authentication
    if (!isAuthorizedCronRequest(request)) {
      loggers.api.warn("Unauthorized cron request", {
        hasAuthHeader: !!request.headers.get("authorization"),
        userAgent: request.headers.get("user-agent"),
        endpoint: "/api/cron/regenerate-rankings",
      });

      await sendCronAlert(
        "/api/cron/regenerate-rankings",
        "401 Unauthorized — CRON_SECRET mismatch or not set",
        {
          hasAuthHeader: !!request.headers.get("authorization"),
          impact: "Monthly ranking regeneration is not running — the published list will go stale",
        }
      );

      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    loggers.api.info("Cron: Starting ranking regeneration", {
      triggerDate: new Date().toISOString(),
    });

    // 2. Regenerate rankings (idempotent per period, guarded against concurrent runs)
    // #185: per-list boards under the active profile set; never the combined layout.
    // #95 step 7: the route owns the env read; unset passes no mode, so the service default runs.
    const metricsFreshness = freshnessModeFromEnv(process.env["RANKINGS_REQUIRE_FRESH_METRICS"]);
    const result = await publishActiveRankings(metricsFreshness ? { metricsFreshness } : {});

    const duration = Date.now() - startTime;
    loggers.api.info("Cron: Ranking regeneration complete", {
      period: result.period,
      algorithmVersion: result.algorithmVersion,
      toolCount: result.toolCount,
      publishedAt: result.publishedAt,
      durationMs: duration,
    });

    // #95 step 5: a stale or unverifiable metrics snapshot is a warning; the publish stands.
    if (result.staleMetrics) {
      loggers.api.warn("Cron: Metrics history snapshot is stale for the period", {
        period: result.period,
        metricsFreshness: result.metricsFreshness,
      });
      await sendCronAlert(
        "/api/cron/regenerate-rankings",
        `Metrics snapshot for period ${result.period} is ${result.metricsFreshness.status}: ${result.metricsFreshness.reason ?? "no reason recorded"}`,
        {
          period: result.period,
          latestCollectedDate: result.metricsFreshness.latestCollectedDate,
          impact: "Rankings were published, but may be unchanged from the previous month",
        },
        "WARNING"
      );
    }

    // #311: only a committed publish gets here, so purge the cached current board; a failed one threw above.
    // #311: the purge never throws; report its outcome in the 200 body rather than
    // failing a publish that has already committed (a failure would invite a re-publish).
    const purge = await invalidateRankingsCache();
    if (!purge.success) {
      loggers.api.error("Cron: Rankings published but the cache purge failed", {
        period: result.period,
        errors: purge.errors,
      });
    }

    // 3. Return JSON summary
    return NextResponse.json(
      {
        success: true,
        message: `Rankings regenerated for ${result.period}`,
        period: result.period,
        algorithm_version: result.algorithmVersion,
        tool_count: result.toolCount,
        // #185: the row count of each list board written.
        boards: result.boards,
        published_at: result.publishedAt,
        top_movers: result.topMovers,
        cache_purge: { success: purge.success, errors: purge.errors },
        // #95: the freshness guard's finding (flag-only).
        stale_metrics: result.staleMetrics,
        metrics_freshness: result.metricsFreshness,
        durationMs: duration,
      },
      { status: 200 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;

    // Concurrent/duplicate run for the same period — not a failure, just declined.
    if (error instanceof RankingGenerationInProgressError) {
      loggers.api.warn("Cron: Ranking regeneration already in progress", {
        period: error.period,
        durationMs: duration,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Ranking regeneration already in progress for this period",
          period: error.period,
        },
        { status: 409 }
      );
    }

    // #95 step 7: require mode refused a stale or unverifiable snapshot; nothing was written.
    if (error instanceof StaleMetricsError) {
      loggers.api.warn("Cron: Ranking regeneration refused on stale metrics", {
        period: error.period,
        metricsFreshness: error.freshness,
        durationMs: duration,
      });
      await sendCronAlert("/api/cron/regenerate-rankings", error.message, {
        period: error.period,
        latestCollectedDate: error.freshness.latestCollectedDate,
        durationMs: duration,
        impact: "Rankings were not published: the metrics snapshot is stale (RANKINGS_REQUIRE_FRESH_METRICS)",
      });
      return NextResponse.json(
        {
          success: false,
          error: "Metrics snapshot is stale for this period; rankings were not published",
          period: error.period,
          metrics_freshness: error.freshness,
        },
        { status: 409 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    loggers.api.error("Cron: Failed to regenerate rankings", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: duration,
    });

    await sendCronAlert("/api/cron/regenerate-rankings", errorMessage, {
      durationMs: duration,
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5).join(" | ") : undefined,
      impact: "Monthly ranking regeneration failed — the published rankings may be stale",
    });

    return NextResponse.json(
      { success: false, error: "Failed to regenerate rankings", details: errorMessage },
      { status: 500 }
    );
  }
}
