/**
 * GET /api/admin/crawl-monitor/runs?limit=&runType=&status= (#325)
 *
 * Why: the crawl monitor lists recent ingestion runs without the raw
 *   `candidate_outcomes` (titles, URLs, per-candidate scores) the existing
 *   ingestion route returns.
 * What: requireAdmin first, then up to `limit` (default 20, max 100) runs as
 *   sanitised views: counts, outcome counts, score buckets, error excerpts and
 *   the stored estimated cost. Every response is `Cache-Control: no-store`.
 * Test: `tests/unit/crawl-monitor-325.test.ts`.
 */

import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getDb } from "@/lib/db/connection";
import { crawlMonitorJson, noStore } from "@/lib/crawl-monitor/http";
import { RUN_STATUSES, loadCrawlMonitorRuns } from "@/lib/crawl-monitor/queries";
import { loggers } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult.error) return noStore(authResult.error);

  const params = request.nextUrl.searchParams;
  const parsedLimit = Number.parseInt(params.get("limit") ?? "20", 10);
  const limit = Math.min(Math.max(Number.isNaN(parsedLimit) ? 20 : parsedLimit, 1), 100);
  const runType = params.get("runType") ?? undefined;
  const status = params.get("status") ?? undefined;
  if (runType !== undefined && !/^[a-z_]{1,50}$/.test(runType)) {
    return crawlMonitorJson({ success: false, error: "Invalid runType" }, 400);
  }
  if (status !== undefined && !(RUN_STATUSES as readonly string[]).includes(status)) {
    return crawlMonitorJson({ success: false, error: "Invalid status" }, 400);
  }

  const db = getDb();
  if (!db) return crawlMonitorJson({ success: false, error: "Database connection not available" }, 503);

  try {
    const data = await loadCrawlMonitorRuns(db, { limit, runType, status });
    return crawlMonitorJson({ success: true, data });
  } catch (error) {
    loggers.api.error("[CrawlMonitor] Failed to load runs", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return crawlMonitorJson({ success: false, error: "Failed to load crawl runs" }, 500);
  }
}
