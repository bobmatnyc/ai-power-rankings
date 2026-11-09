/**
 * GET /api/admin/crawl-monitor/balances (#394)
 *
 * Why: the crawl monitor sets each provider's own usage or balance figure next
 *   to the spend the ledger recorded, so a missed call or a wrong unit price
 *   shows before the bill does. The admin layout checks sign-in only, so this
 *   route checks admin itself, like its sibling routes.
 * What: requireAdmin first (401/403 before any DB read or provider call), then
 *   the ledger read (`loadCrawlSpend`) and one bounded, read-only GET per
 *   provider with a balance API, in parallel, shaped by `buildBalanceCheck`. A
 *   ledger failure is reported as "ledger unavailable", not as an error page.
 *   Keys are read here, server-side, and never returned; the response holds
 *   labels, validated numbers and fixed state words only. Every response is
 *   `Cache-Control: no-store`.
 * Test: `tests/unit/provider-balance-394.test.ts`.
 */

import { requireAdmin } from "@/lib/api-auth";
import { getDb } from "@/lib/db/connection";
import { buildBalanceCheck, readProviderBalances } from "@/lib/crawl-monitor/balances";
import { crawlMonitorJson, noStore } from "@/lib/crawl-monitor/http";
import { loadCrawlSpend } from "@/lib/crawl-monitor/queries";
import type { CrawlSpendSummary } from "@/lib/crawl-monitor/spend";
import { loggers } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const authResult = await requireAdmin();
  if (authResult.error) return noStore(authResult.error);

  const now = new Date();
  const db = getDb();
  const ledger: Promise<CrawlSpendSummary | null> = db
    ? loadCrawlSpend(db, now).catch((error: unknown) => {
        // #394: a fixed message; driver errors can name the database host or the table.
        loggers.api.error("[CrawlMonitor] Balance check could not read the ledger", {
          error: error instanceof Error ? error.name : "Unknown error",
        });
        return null;
      })
    : Promise.resolve(null);

  // #394: provider reads never throw; a failed read comes back as "unavailable", never as 0.
  const [spend, balances] = await Promise.all([ledger, readProviderBalances(process.env, fetch)]);
  return crawlMonitorJson({ success: true, data: buildBalanceCheck(spend, balances, now) });
}
