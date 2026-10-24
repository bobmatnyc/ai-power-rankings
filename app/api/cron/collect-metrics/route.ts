/**
 * Cron API: Monthly metrics-history collection, one collector shard per call (#95)
 *
 * GET /api/cron/collect-metrics?part=<github|pypi|npm|vscode>&shard=<i>&of=<n>
 * - Runs on the 1st of the month, one vercel.json entry per shard, all before
 *   the 08:00 UTC monthly-summary cron
 * - Writes ONLY tool_metrics_history and metrics_collection_runs; never `tools`
 *   (published scores do not move). The history is private and kept forever.
 * - Requires CRON_SECRET authentication via Bearer token (same as sibling crons)
 * - Answers 200 only when the shard is `ok` and its ledger row was written;
 *   a partial or failed shard, or any database throw, answers 500 and alerts
 *
 * Test: `tests/unit/metrics-collect-route-95.test.ts`
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/connection";
import { loggers } from "@/lib/logger";
import {
  COLLECTOR_PARTS,
  type CollectorPart,
  createCollectorAdapter,
  SHARD_COUNTS,
} from "@/lib/metrics-collectors/registry";
import { runMetricsShard } from "@/lib/metrics-history/collect-shard";
import { createDbMetricsHistoryStore } from "@/lib/metrics-history/store";

const ROUTE = "/api/cron/collect-metrics";

/**
 * Send a failure alert via webhook when the cron route encounters an error.
 *
 * Uses ALERT_WEBHOOK_URL env var (e.g. a Slack incoming webhook or similar).
 * Silently no-ops if the env var is not set.
 * #95: copied from the regenerate-rankings route, not shared (Architect ruling).
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
export const maxDuration = 300; // 5 minutes — the shard stops starting tools at 270 s

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

/** #95: `part`, `shard` and `of` must name one configured shard exactly. */
function parseShardParams(
  url: URL
): { part: CollectorPart; shard: number; of: number } | { error: string } {
  const part = url.searchParams.get("part");
  const shardText = url.searchParams.get("shard");
  const ofText = url.searchParams.get("of");

  if (!part || !(COLLECTOR_PARTS as readonly string[]).includes(part)) {
    return { error: `part must be one of ${COLLECTOR_PARTS.join(", ")}` };
  }
  const expectedOf = SHARD_COUNTS[part as CollectorPart];
  if (!ofText || !/^[0-9]+$/.test(ofText) || Number(ofText) !== expectedOf) {
    return { error: `of must be ${expectedOf} for part ${part}` };
  }
  if (!shardText || !/^[0-9]+$/.test(shardText) || Number(shardText) >= expectedOf) {
    return { error: `shard must be an integer from 0 to ${expectedOf - 1}` };
  }
  return { part: part as CollectorPart, shard: Number(shardText), of: expectedOf };
}

/**
 * GET /api/cron/collect-metrics
 * Vercel Cron endpoint for one shard of the monthly metrics-history collection.
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
        impact: "Monthly metrics-history collection is not running — this month's history will be missing",
      });

      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // 2. Validate the shard parameters — a bad vercel.json entry must fail loudly.
    const params = parseShardParams(new URL(request.url));
    if ("error" in params) {
      await sendCronAlert(ROUTE, `400 Bad Request — ${params.error}`, {
        impact: "A metrics-history shard is misconfigured and collected nothing",
      });
      return NextResponse.json({ success: false, error: params.error }, { status: 400 });
    }

    const db = getDb();
    if (!db) throw new Error("Database connection not available");

    loggers.api.info("Cron: Starting metrics-history shard", { ...params });

    // 3. Collect this shard and write its ledger row (never throws).
    const { result, ledgerError } = await runMetricsShard(params, {
      store: createDbMetricsHistoryStore(db),
      createAdapter: (signal) => createCollectorAdapter(params.part, { signal, env: process.env }),
    });

    const duration = Date.now() - startTime;
    const body = {
      success: result.status === "ok" && ledgerError === null,
      part: result.part,
      shard: result.shard,
      of: result.of,
      collected_date: result.collectedDate,
      status: result.status,
      counts: result.counts,
      ledger_recorded: ledgerError === null,
      error: result.error ?? ledgerError,
      durationMs: duration,
    };

    loggers.api.info("Cron: Metrics-history shard finished", {
      part: result.part,
      shard: result.shard,
      status: result.status,
      ...result.counts,
      ledgerRecorded: ledgerError === null,
      durationMs: duration,
    });

    if (!body.success) {
      await sendCronAlert(ROUTE, body.error ?? `shard ${result.status}`, {
        part: result.part,
        shard: result.shard,
        of: result.of,
        status: result.status,
        counts: result.counts,
        ledgerRecorded: ledgerError === null,
        durationMs: duration,
        impact: "Part of this month's metrics history is missing",
      });
      return NextResponse.json(body, { status: 500 });
    }

    return NextResponse.json(body, { status: 200 });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    loggers.api.error("Cron: Failed to collect metrics history", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: duration,
    });

    await sendCronAlert(ROUTE, errorMessage, {
      durationMs: duration,
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 5).join(" | ") : undefined,
      impact: "Monthly metrics-history collection failed — this shard recorded nothing",
    });

    return NextResponse.json(
      { success: false, error: "Failed to collect metrics history", details: errorMessage },
      { status: 500 }
    );
  }
}
