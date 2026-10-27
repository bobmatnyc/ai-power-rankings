/**
 * GET /api/admin/crawl-monitor/overview (#325)
 *
 * Why: the crawl monitor page needs run tiles, estimated spend, last success
 *   per job and provider flags; the admin layout checks sign-in only, so this
 *   route checks admin itself.
 * What: requireAdmin first (401/403 before any DB read), then a read-only
 *   overview. No secrets: provider entries are configured flags only.
 *   Every response is `Cache-Control: no-store`.
 * Test: `tests/unit/crawl-monitor-325.test.ts`.
 */

import { requireAdmin } from "@/lib/api-auth";
import { getDb } from "@/lib/db/connection";
import { crawlMonitorJson, noStore } from "@/lib/crawl-monitor/http";
import { loadCrawlMonitorOverview } from "@/lib/crawl-monitor/queries";
import { loggers } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const authResult = await requireAdmin();
  if (authResult.error) return noStore(authResult.error);

  const db = getDb();
  if (!db) return crawlMonitorJson({ success: false, error: "Database connection not available" }, 503);

  try {
    const data = await loadCrawlMonitorOverview(db, new Date());
    return crawlMonitorJson({ success: true, data });
  } catch (error) {
    loggers.api.error("[CrawlMonitor] Failed to load overview", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // #325: a fixed message; driver errors can name the database host.
    return crawlMonitorJson({ success: false, error: "Failed to load crawl overview" }, 500);
  }
}
