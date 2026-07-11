/**
 * Cron API: Monthly Ranking Regeneration
 *
 * GET /api/cron/regenerate-rankings
 * - Runs on the 1st of the month at 09:00 UTC (configured in vercel.json)
 * - Recomputes v7.6 rankings for the current period and persists a new current
 *   snapshot (previous snapshot demoted, new row `is_current = true`)
 * - Requires CRON_SECRET authentication via Bearer token (same as sibling crons)
 * - Idempotent per period; concurrent/duplicate runs for the same period return 409
 */

import { NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import {
  RankingGenerationInProgressError,
  regenerateRankings,
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
    const result = await regenerateRankings();

    const duration = Date.now() - startTime;
    loggers.api.info("Cron: Ranking regeneration complete", {
      period: result.period,
      algorithmVersion: result.algorithmVersion,
      toolCount: result.toolCount,
      publishedAt: result.publishedAt,
      durationMs: duration,
    });

    // 3. Return JSON summary
    return NextResponse.json(
      {
        success: true,
        message: `Rankings regenerated for ${result.period}`,
        period: result.period,
        algorithm_version: result.algorithmVersion,
        tool_count: result.toolCount,
        published_at: result.publishedAt,
        top_movers: result.topMovers,
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
