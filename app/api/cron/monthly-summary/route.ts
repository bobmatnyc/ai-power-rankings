/**
 * Cron API: Monthly report for the closed month
 *
 * GET /api/cron/monthly-summary
 * - Runs on 1st of month at 8 AM UTC (configured in vercel.json)
 * - #182: generates the previous month's report through the one monthly
 *   generator (`WhatsNewSummaryService`), which appends a version to
 *   `monthly_report_versions`. It no longer writes `state_of_ai_summaries`.
 *   When the month's data is unchanged since the newest stored version, no
 *   LLM call is made and nothing is written.
 * - Requires CRON_SECRET authentication via Bearer token
 */

import { NextResponse } from "next/server";
import {
  GENERATED_BY_MONTHLY_CRON,
  WhatsNewSummaryService,
} from "@/lib/services/whats-new-summary.service";
import { monthYearToPeriod } from "@/lib/services/monthly-report.repository";
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
export const maxDuration = 300; // Allow up to 300 seconds for LLM generation (bumped from 60 — see process-status-report-2026-05-09.md)

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
 * GET /api/cron/monthly-summary
 * Vercel Cron endpoint for generating the closed month's report
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // 1. Verify cron authentication
    if (!isAuthorizedCronRequest(request)) {
      loggers.api.warn("Unauthorized cron request", {
        hasAuthHeader: !!request.headers.get("authorization"),
        userAgent: request.headers.get("user-agent"),
        endpoint: "/api/cron/monthly-summary",
      });

      // Alert: 401 means CRON_SECRET is misconfigured — this month's report will be skipped
      await sendCronAlert("/api/cron/monthly-summary", "401 Unauthorized — CRON_SECRET mismatch or not set", {
        hasAuthHeader: !!request.headers.get("authorization"),
        impact: "The closed month's report will not be generated",
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

    const period = monthYearToPeriod(targetMonth, targetYear);

    loggers.api.info("Cron: Starting monthly report generation", {
      period,
      triggerDate: now.toISOString(),
    });

    // 3. #182: the one monthly generator; unchanged data returns the stored version.
    const service = new WhatsNewSummaryService();
    const result = await service.generateMonthlySummary(period, false, GENERATED_BY_MONTHLY_CRON);

    const duration = Date.now() - startTime;

    loggers.api.info("Cron: Monthly report generation complete", {
      period,
      version: result.summary.version,
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
          ? `Monthly report version ${result.summary.version} generated for ${period}`
          : `Monthly report for ${period} is unchanged`,
        summaryGenerated: result.isNew,
        summary: {
          id: result.summary.id,
          period: result.summary.period,
          version: result.summary.version,
          month: targetMonth,
          year: targetYear,
          generatedAt: result.summary.generatedAt.toISOString(),
          contentLength: result.summary.content.length,
        },
        generationTimeMs: result.generationTimeMs,
      },
      { status: 200 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    loggers.api.error("Cron: Failed to generate the monthly report", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: duration,
    });

    // Alert on failure so the gap is caught immediately rather than discovered weeks later
    await sendCronAlert("/api/cron/monthly-summary", errorMessage, {
      durationMs: duration,
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5).join(" | ") : undefined,
      impact: "The closed month's report may not have been generated — check monthly_report_versions",
    });

    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate monthly summary",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
