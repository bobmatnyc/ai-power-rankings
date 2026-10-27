/**
 * Cron API: Weekly Digest Generation
 *
 * GET /api/cron/weekly-digest
 * - Runs Monday at 07:30 UTC (configured in vercel.json), after the 06:00 daily-news run
 * - Generates the digest for the previous full ISO week (Monday to Sunday UTC)
 * - Requires CRON_SECRET authentication via Bearer token, exactly like the sibling cron routes
 * - #181: `?force=1` replaces a stored week; `?dry_run=1` reports counts and writes nothing
 * - A week with no articles is a normal skip (HTTP 200, no alert); an LLM, validation
 *   or database failure answers 500, alerts, and stores nothing
 */

import { NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { generateWeeklyDigest } from "@/lib/services/weekly-digest.service";

/**
 * Send a failure alert via webhook when the cron route encounters an error.
 *
 * Uses ALERT_WEBHOOK_URL env var (e.g. a Slack incoming webhook or similar).
 * Silently no-ops if the env var is not set.
 * #181: copied from the sibling cron routes, not shared (the #95 ruling keeps
 * the copies; extracting one helper is a decision for the Architect).
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
export const maxDuration = 300; // up to two LLM calls plus the write

const ROUTE = "/api/cron/weekly-digest";

/**
 * Verify if request is authorized for cron execution.
 *
 * Uses ONLY the Bearer token check per Vercel's official cron documentation.
 * Vercel's cron scheduler automatically sends `Authorization: Bearer <CRON_SECRET>`.
 * #181: identical to the sibling routes; no header or user-agent shortcut.
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
 * GET /api/cron/weekly-digest
 * Vercel Cron endpoint for generating the weekly digest
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  if (!isAuthorizedCronRequest(request)) {
    loggers.api.warn("Unauthorized cron request", {
      hasAuthHeader: !!request.headers.get("authorization"),
      endpoint: ROUTE,
    });
    // 401 means CRON_SECRET is misconfigured: this week's digest would be skipped
    await sendCronAlert(ROUTE, "401 Unauthorized — CRON_SECRET mismatch or not set", {
      hasAuthHeader: !!request.headers.get("authorization"),
      impact: "The weekly digest will not be generated this week",
    });
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const force = params.get("force") === "1";
  const dryRun = params.get("dry_run") === "1";

  try {
    const outcome = await generateWeeklyDigest({ force, dryRun });
    loggers.api.info("Cron: weekly digest run complete", {
      ...outcome,
      durationMs: Date.now() - startTime,
    });
    // A skipped week (no articles, already stored) is a normal result, not a failure.
    return NextResponse.json({ success: true, ...outcome }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const duration = Date.now() - startTime;
    loggers.api.error("Cron: Failed to generate weekly digest", {
      error: errorMessage,
      durationMs: duration,
    });
    await sendCronAlert(ROUTE, errorMessage, {
      durationMs: duration,
      impact: "No weekly digest stored for the week; a manual re-run is safe",
    });
    return NextResponse.json(
      { success: false, error: "Failed to generate weekly digest", details: errorMessage },
      { status: 500 }
    );
  }
}
