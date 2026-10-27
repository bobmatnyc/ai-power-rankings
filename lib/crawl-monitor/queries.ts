/**
 * Crawl monitor reads (#325). Read-only Drizzle selects over tables the crawl
 * jobs already write; shaping happens in `./aggregate`.
 *
 * Why: the monitor needs no migration; every figure comes from existing rows.
 *   #325: metrics collection is left out: the #95 / D20 privacy guard bars
 *   page-serving code from the metrics history tables.
 * What: `loadCrawlMonitorOverview` returns tiles, spend, job status and
 *   provider flags; `loadCrawlMonitorRuns` returns recent
 *   ingestion runs as sanitised views. Neither writes.
 * Test: the route cases in `tests/unit/crawl-monitor-325.test.ts` mock this module;
 *   the shaping it delegates to is tested directly there.
 */

import { desc, eq, and, type SQL } from "drizzle-orm";
import type { getDb } from "@/lib/db/connection";
import {
  automatedIngestionRuns,
  monthlySummaries,
  stateOfAiSummaries,
} from "@/lib/db/schema";
import {
  type CrawlRunView,
  type JobStatus,
  type SpendSummary,
  type WindowStats,
  jobStatusByRunType,
  parseCostUsd,
  providerFlags,
  summarizeRunWindows,
  summarizeSpend,
  summaryJobStatus,
  toCrawlRunView,
} from "./aggregate";

export type Db = NonNullable<ReturnType<typeof getDb>>;

export interface CrawlMonitorOverview {
  generatedAt: string;
  runWindows: { today: WindowStats; last7Days: WindowStats; last30Days: WindowStats };
  estimatedSpend: SpendSummary;
  jobs: JobStatus[];
  stateOfAi: { period: string | null; estimatedCostUsd: number | null };
  providers: Array<{ name: string; configured: boolean }>;
}

/**
 * Reads the overview. The run table is read in full but only four narrow
 * columns: the daily cron writes one row a day, so all-time is a few hundred rows.
 */
export async function loadCrawlMonitorOverview(db: Db, now: Date): Promise<CrawlMonitorOverview> {
  const [runRows, whatsNew, stateOfAi] = await Promise.all([
    db
      .select({
        runType: automatedIngestionRuns.runType,
        status: automatedIngestionRuns.status,
        createdAt: automatedIngestionRuns.createdAt,
        estimatedCostUsd: automatedIngestionRuns.estimatedCostUsd,
      })
      .from(automatedIngestionRuns),
    db
      .select({ generatedAt: monthlySummaries.generatedAt })
      .from(monthlySummaries)
      .orderBy(desc(monthlySummaries.generatedAt))
      .limit(1),
    db
      .select({
        month: stateOfAiSummaries.month,
        year: stateOfAiSummaries.year,
        generatedAt: stateOfAiSummaries.generatedAt,
        metadata: stateOfAiSummaries.metadata,
      })
      .from(stateOfAiSummaries)
      .orderBy(desc(stateOfAiSummaries.generatedAt))
      .limit(1),
  ]);

  const latestSoa = stateOfAi[0];
  // #325: only `cost_usd` is read from the metadata; model and token fields stay server-side.
  const soaCost = parseCostUsd(
    (latestSoa?.metadata as { cost_usd?: number | string | null } | null | undefined)?.cost_usd ?? null
  );

  return {
    generatedAt: now.toISOString(),
    runWindows: summarizeRunWindows(runRows, now),
    estimatedSpend: summarizeSpend(runRows, now),
    jobs: [
      ...jobStatusByRunType(runRows, now),
      summaryJobStatus("What's New monthly summary", "monthly_summaries", whatsNew[0]?.generatedAt),
      summaryJobStatus("State of AI summary", "state_of_ai_summaries", latestSoa?.generatedAt),
    ],
    stateOfAi: {
      period: latestSoa ? `${latestSoa.year}-${String(latestSoa.month).padStart(2, "0")}` : null,
      estimatedCostUsd: soaCost,
    },
    providers: providerFlags(),
  };
}

export const RUN_STATUSES = ["running", "completed", "failed"] as const;

/** Recent ingestion runs, newest first, optionally filtered by run type and status. */
export async function loadCrawlMonitorRuns(
  db: Db,
  options: { limit: number; runType?: string; status?: string }
): Promise<CrawlRunView[]> {
  const filters: SQL[] = [];
  if (options.runType) filters.push(eq(automatedIngestionRuns.runType, options.runType));
  if (options.status) filters.push(eq(automatedIngestionRuns.status, options.status));
  const rows = await db
    .select({
      id: automatedIngestionRuns.id,
      runType: automatedIngestionRuns.runType,
      status: automatedIngestionRuns.status,
      createdAt: automatedIngestionRuns.createdAt,
      startedAt: automatedIngestionRuns.startedAt,
      completedAt: automatedIngestionRuns.completedAt,
      articlesDiscovered: automatedIngestionRuns.articlesDiscovered,
      articlesPassedQuality: automatedIngestionRuns.articlesPassedQuality,
      articlesIngested: automatedIngestionRuns.articlesIngested,
      articlesSkipped: automatedIngestionRuns.articlesSkipped,
      articlesSkippedSemantic: automatedIngestionRuns.articlesSkippedSemantic,
      articlesSkippedStale: automatedIngestionRuns.articlesSkippedStale,
      rankingChanges: automatedIngestionRuns.rankingChanges,
      errorLog: automatedIngestionRuns.errorLog,
      candidateOutcomes: automatedIngestionRuns.candidateOutcomes,
      estimatedCostUsd: automatedIngestionRuns.estimatedCostUsd,
    })
    .from(automatedIngestionRuns)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(automatedIngestionRuns.createdAt))
    .limit(options.limit);
  return rows.map(toCrawlRunView);
}
