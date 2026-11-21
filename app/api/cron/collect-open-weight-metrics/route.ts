/**
 * Cron API: monthly open-weight model metrics collection (#184)
 *
 * GET /api/cron/collect-open-weight-metrics
 * - #184: owner ruling D83 schedules the open-weight collector monthly. One vercel.json
 *   entry, `30 5 1 * *`: after the last collect-metrics shard (github 5/6 at 04:50, done
 *   by 04:55) and before daily-news (06:00), monthly-summary (08:00) and
 *   regenerate-rankings (09:00). On the 1st, so its rows share the collected_date the
 *   check on the 2nd reads.
 * - Calls `runOpenWeightCollection` once, in apply mode. Writes ONLY
 *   tool_metrics_history (the `huggingface` key); never `tools`, never the ledger.
 * - Requires CRON_SECRET authentication via Bearer token (same as sibling crons)
 * - Fails closed: 200 only when the run is `ok`. A partial or failed run, or any throw,
 *   answers 500 and alerts.
 *
 * Test: `tests/unit/metrics-open-weight-cron-184.test.ts`
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/connection";
import { loggers } from "@/lib/logger";
import { HuggingFaceModelCollector } from "@/lib/metrics-collectors/huggingface";
import { runOpenWeightCollection } from "@/lib/metrics-history/collect-open-weight";
import { createOpenWeightStore } from "@/lib/metrics-history/store";

const ROUTE = "/api/cron/collect-open-weight-metrics";

/**
 * Send a failure alert via webhook when the cron route encounters an error.
 *
 * Uses ALERT_WEBHOOK_URL env var (e.g. a Slack incoming webhook or similar).
 * Silently no-ops if the env var is not set.
 * #184: copied from the collect-metrics route, not shared (the #95 Architect ruling).
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
export const maxDuration = 300; // 5 minutes — the run stops starting models at 270 s

/**
 * Verify if request is authorized for cron execution.
 *
 * Uses ONLY the Bearer token check per Vercel's official cron documentation.
 * Vercel's cron scheduler automatically sends `Authorization: Bearer <CRON_SECRET>`.
 * #184: copied from the collect-metrics route.
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
 * GET /api/cron/collect-open-weight-metrics
 * Vercel Cron endpoint for the monthly open-weight model collection.
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // 1. Verify cron authentication
    if (!isAuthorizedCronRequest(request)) {
      loggers.api.warn("Unauthorized cron request", {
        hasAuthHeader: !!request.headers.get("authorization"),
        userAgent: request.headers.get("user-agent"),
        endpoint: ROUTE,
      });

      await sendCronAlert(ROUTE, "401 Unauthorized — CRON_SECRET mismatch or not set", {
        hasAuthHeader: !!request.headers.get("authorization"),
        impact: "Monthly open-weight model collection is not running — this month's model history will be missing",
      });

      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    if (!db) throw new Error("Database connection not available");

    loggers.api.info("Cron: Starting open-weight model collection");

    // 2. #184: one run, in apply mode. HF_TOKEN is optional; without it the Hub calls are anonymous.
    const token = process.env["HF_TOKEN"];
    const result = await runOpenWeightCollection({
      store: createOpenWeightStore(db),
      collect: (repo, signal) => new HuggingFaceModelCollector({ signal, token }).fetchModelMetrics(repo),
      dryRun: false,
    });

    const duration = Date.now() - startTime;
    const body = {
      success: result.status === "ok",
      collected_date: result.collectedDate,
      status: result.status,
      counts: result.counts,
      error: result.error,
      durationMs: duration,
    };

    loggers.api.info("Cron: Open-weight model collection finished", {
      status: result.status,
      ...result.counts,
      durationMs: duration,
    });

    // #184: fail closed — anything short of `ok` answers 500 and alerts.
    if (!body.success) {
      await sendCronAlert(ROUTE, result.error ?? `run ${result.status}`, {
        status: result.status,
        counts: result.counts,
        durationMs: duration,
        impact: "Part or all of this month's open-weight model history is missing",
      });
      return NextResponse.json(body, { status: 500 });
    }

    return NextResponse.json(body, { status: 200 });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    loggers.api.error("Cron: Failed to collect open-weight model metrics", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: duration,
    });

    await sendCronAlert(ROUTE, errorMessage, {
      durationMs: duration,
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5).join(" | ") : undefined,
      impact: "Monthly open-weight model collection failed — nothing was recorded",
    });

    return NextResponse.json(
      { success: false, error: "Failed to collect open-weight model metrics", details: errorMessage },
      { status: 500 }
    );
  }
}
