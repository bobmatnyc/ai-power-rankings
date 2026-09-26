/**
 * Cron-side what's-new summary regeneration (#160).
 *
 * Why: The public summary GET never generates (#161), so without this the
 * page kept serving an old month until an admin regenerated it. The daily
 * ingestion cron calls this once per run; ingestion must succeed even when
 * regeneration fails.
 * What: Resolves the current UTC month and runs
 * `WhatsNewSummaryService.regenerateIfChanged`. Never throws: a missing API
 * key, a database error or an LLM error becomes `status: "failed"`, and is
 * logged.
 * Test: `tests/unit/whats-new-auto-regenerate.test.ts`,
 * `tests/unit/cron-daily-news-summary.test.ts`.
 */

import { loggers } from "@/lib/logger";
import {
  WhatsNewSummaryService,
  type AutoRegenerationOutcome,
} from "./whats-new-summary.service";

export async function autoRegenerateMonthlySummary(options: {
  timeBudgetMs: number;
  now?: Date;
}): Promise<AutoRegenerationOutcome> {
  const period = (options.now ?? new Date()).toISOString().slice(0, 7); // YYYY-MM, UTC

  try {
    const outcome = await new WhatsNewSummaryService().regenerateIfChanged(
      period,
      options.timeBudgetMs
    );
    loggers.api.info("What's-new summary auto-regeneration", { ...outcome });
    return outcome;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    loggers.api.error("What's-new summary auto-regeneration failed; stored summary kept", {
      period,
      error: message,
    });
    return { status: "failed", period, error: message };
  }
}
