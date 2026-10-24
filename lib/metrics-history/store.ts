/**
 * Drizzle store for the metrics-history collection (#95).
 *
 * Why: slice 1 must write only the two history tables and never `tools`, and
 *   two collectors writing the same tool on the same day must both survive.
 * What: `listTools` is the one statement that touches `tools`, a SELECT.
 *   `upsertMetrics` is one INSERT ... ON CONFLICT (tool_id, collected_date)
 *   DO UPDATE SET metrics = existing || EXCLUDED.metrics: atomic, and each
 *   collector owns its top-level key, so a re-run replaces only its own key.
 *   `recordRun` upserts the ledger row on (collected_date, collector, shard).
 * Test: `tests/unit/metrics-collect-route-95.test.ts` (rendered SQL, no `tools` write)
 */

import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { metricsCollectionRuns, toolMetricsHistory, tools } from "../db/schema";
import type { MetricsHistoryStore } from "./collect-shard";

// Any drizzle Postgres driver: neon-http, neon-serverless, or pg-proxy in tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPgDatabase = PgDatabase<PgQueryResultHKT, any>;

export function createDbMetricsHistoryStore(db: AnyPgDatabase): MetricsHistoryStore {
  return {
    async listTools() {
      return db
        .select({ id: tools.id, slug: tools.slug, name: tools.name, data: tools.data })
        .from(tools);
    },

    async upsertMetrics(row) {
      await db
        .insert(toolMetricsHistory)
        .values({
          toolId: row.toolId,
          toolSlug: row.toolSlug,
          collectedDate: row.collectedDate,
          period: row.period,
          metrics: row.metrics,
        })
        .onConflictDoUpdate({
          target: [toolMetricsHistory.toolId, toolMetricsHistory.collectedDate],
          set: {
            metrics: sql`"tool_metrics_history"."metrics" || excluded."metrics"`,
            toolSlug: sql`excluded."tool_slug"`,
            updatedAt: sql`now()`,
          },
        });
    },

    async recordRun(result) {
      const update = {
        period: result.period,
        shardCount: result.of,
        status: result.status,
        attempted: result.counts.attempted,
        recorded: result.counts.recorded,
        flagged: result.counts.flagged,
        notFound: result.counts.not_found,
        failed: result.counts.failed,
        skippedTimeout: result.counts.skipped_timeout,
        error: result.error,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
      };
      await db
        .insert(metricsCollectionRuns)
        .values({ collectedDate: result.collectedDate, collector: result.part, shard: result.shard, ...update })
        .onConflictDoUpdate({
          target: [metricsCollectionRuns.collectedDate, metricsCollectionRuns.collector, metricsCollectionRuns.shard],
          set: { ...update, updatedAt: sql`now()` },
        });
    },
  };
}
