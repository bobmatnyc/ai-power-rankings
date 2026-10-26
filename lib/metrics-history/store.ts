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
 *   #184: `createOpenWeightStore` (at the end) is the open-weight run's store. It lives here so
 *   this stays the only file under lib/ that touches the history tables.
 * Test: `tests/unit/metrics-collect-route-95.test.ts` (rendered SQL, no `tools` write),
 *   `tests/unit/metrics-open-weight-run-184.test.ts`
 */

import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { metricsCollectionRuns, toolMetricsHistory, tools } from "../db/schema";
// #184: type-only, so the scheduled cron route's import graph never loads the open-weight runner.
import type { OpenWeightStore } from "./collect-open-weight";
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

/**
 * #184: the store for the open-weight model run (`runOpenWeightCollection`).
 * `listModels` is one SELECT of `kind='model'`, `open_weight=true` tools with an `hf_repo`;
 * `upsertMetrics` is the history upsert above; `recordRun` upserts one ledger row
 * (collector `huggingface-models`, shard 0 of 1). It writes no other table.
 */
export function createOpenWeightStore(db: AnyPgDatabase): OpenWeightStore {
  const history = createDbMetricsHistoryStore(db);
  return {
    async listModels() {
      const rows = await db
        .select({ id: tools.id, slug: tools.slug, hfRepo: tools.hfRepo })
        .from(tools)
        .where(and(eq(tools.kind, "model"), eq(tools.openWeight, true), isNotNull(tools.hfRepo)));
      return rows.flatMap((row) => (row.hfRepo ? [{ id: row.id, slug: row.slug, hfRepo: row.hfRepo }] : []));
    },

    upsertMetrics: (row) => history.upsertMetrics(row),

    async recordRun(result) {
      const update = {
        period: result.period,
        shardCount: 1,
        status: result.status,
        attempted: result.counts.attempted,
        recorded: result.counts.recorded,
        flagged: 0,
        notFound: result.counts.not_found,
        failed: result.counts.failed,
        skippedTimeout: result.counts.skipped_timeout,
        error: result.error,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
      };
      await db
        .insert(metricsCollectionRuns)
        .values({ collectedDate: result.collectedDate, collector: "huggingface-models", shard: 0, ...update })
        .onConflictDoUpdate({
          target: [metricsCollectionRuns.collectedDate, metricsCollectionRuns.collector, metricsCollectionRuns.shard],
          set: { ...update, updatedAt: sql`now()` },
        });
    },
  };
}
