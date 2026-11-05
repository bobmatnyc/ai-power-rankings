/**
 * Read side of the metrics history for ranking regeneration (#95 steps 4-5).
 *
 * Why: the collector's store (`./store.ts`) only writes; regeneration needs the rows at or
 *   before a ranking period and the newest collection day.
 * What: two SELECTs on `tool_metrics_history`, both bounded by `period <= $period`
 *   (`YYYY-MM` sorts as text). Rows whose tool was deleted (`tool_id` null) are skipped.
 *   Errors propagate to the caller; nothing here catches.
 * Test: `tests/unit/point-in-time-metrics-95.test.ts` (rendered SQL)
 */

import { and, isNotNull, lte, max } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { toolMetricsHistory } from "../db/schema";
import type { MetricsHistoryRow } from "./point-in-time";

// Any drizzle Postgres driver: neon-http, neon-serverless, or pg-proxy in tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPgDatabase = PgDatabase<PgQueryResultHKT, any>;

/** Every history row at or before `period` that still names a tool. */
export async function selectMetricsHistoryRows(db: AnyPgDatabase, period: string): Promise<MetricsHistoryRow[]> {
  const rows = await db
    .select({
      toolId: toolMetricsHistory.toolId,
      collectedDate: toolMetricsHistory.collectedDate,
      metrics: toolMetricsHistory.metrics,
    })
    .from(toolMetricsHistory)
    .where(and(lte(toolMetricsHistory.period, period), isNotNull(toolMetricsHistory.toolId)));
  return rows.map((row) => ({
    toolId: row.toolId as string,
    collectedDate: row.collectedDate,
    metrics: (row.metrics ?? {}) as Record<string, unknown>,
  }));
}

/** `MAX(collected_date)` at or before `period`; null when there is no row. */
export async function selectLatestCollectedDate(db: AnyPgDatabase, period: string): Promise<string | null> {
  const rows = await db
    .select({ latest: max(toolMetricsHistory.collectedDate) })
    .from(toolMetricsHistory)
    .where(lte(toolMetricsHistory.period, period));
  return rows[0]?.latest ?? null;
}
