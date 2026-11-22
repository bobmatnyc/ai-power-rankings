/**
 * #476: `outcome` value of the run-level counts entry that leads
 * automated_ingestion_runs.candidate_outcomes. It describes the run, not a
 * candidate, so every reader that counts candidates skips it. Kept in a module
 * with no imports so lib/crawl-monitor and scripts can read it without loading
 * the ingestion service.
 */
export const RUN_COUNTS_OUTCOME = "run_counts" as const;
