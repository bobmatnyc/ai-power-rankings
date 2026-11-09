/**
 * GET /api/admin/crawl-monitor/spend (#393)
 *
 * Why: the crawl monitor's spend section summarises estimated cost per provider
 *   from the `provider_usage_events` ledger; the admin layout checks sign-in
 *   only, so this route checks admin itself, like its sibling routes.
 * What: requireAdmin first (401/403 before any DB read), then a read-only
 *   grouped ledger read shaped by `summarizeProviderSpend`. The response holds
 *   provider labels, counts, sums and price-configured flags; no env names or
 *   values, keys or DB identifiers. Every response is `Cache-Control: no-store`.
 * Test: `tests/unit/crawl-spend-393.test.ts`.
 */

import { requireAdmin } from "@/lib/api-auth";
import { getDb } from "@/lib/db/connection";
import { crawlMonitorJson, noStore } from "@/lib/crawl-monitor/http";
import { loadCrawlSpend } from "@/lib/crawl-monitor/queries";
import { loggers } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const authResult = await requireAdmin();
  if (authResult.error) return noStore(authResult.error);

  const db = getDb();
  if (!db) return crawlMonitorJson({ success: false, error: "Database connection not available" }, 503);

  try {
    const data = await loadCrawlSpend(db, new Date());
    return crawlMonitorJson({ success: true, data });
  } catch (error) {
    loggers.api.error("[CrawlMonitor] Failed to load spend", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    // #393: a fixed message; driver errors can name the database host or the table.
    return crawlMonitorJson({ success: false, error: "Failed to load crawl spend" }, 500);
  }
}
