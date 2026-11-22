#!/usr/bin/env npx tsx
/**
 * Check Recent Ingestion Runs
 *
 * Queries the database for recent automated ingestion run records.
 */

import { getDb } from "../lib/db/connection";
import { automatedIngestionRuns } from "../lib/db/schema";
import { desc } from "drizzle-orm";
import { RUN_COUNTS_OUTCOME } from "../lib/services/run-counts-outcome";

async function main() {
  const db = getDb();
  if (!db) {
    console.error("No database connection");
    return;
  }

  const runs = await db
    .select()
    .from(automatedIngestionRuns)
    .orderBy(desc(automatedIngestionRuns.createdAt))
    .limit(10);

  console.log("Recent Ingestion Runs:");
  console.log("=".repeat(80));

  for (const run of runs) {
    console.log(`Run ID: ${run.id}`);
    console.log(`  Created: ${run.createdAt}`);
    console.log(`  Status: ${run.status}`);
    console.log(`  Type: ${run.runType}`);
    console.log(`  Discovered: ${run.articlesDiscovered}`);
    console.log(`  Passed Quality: ${run.articlesPassedQuality}`);
    console.log(`  Ingested: ${run.articlesIngested}`);
    console.log(`  Skipped: ${run.articlesSkipped}`);
    console.log(`  Semantic Skipped: ${run.articlesSkippedSemantic}`);
    // #132: the two columns that tell "no fresh candidate existed" from "one
    // existed and failed to insert".
    console.log(`  Stale Skipped: ${run.articlesSkippedStale}`);
    // #476: the leading run_counts entry is not a candidate.
    const outcomes = (Array.isArray(run.candidateOutcomes) ? run.candidateOutcomes : []).filter(
      (entry) => (entry as { outcome?: unknown } | null)?.outcome !== RUN_COUNTS_OUTCOME
    );
    console.log(`  Candidate Outcomes: ${outcomes.length}`);
    if (outcomes.length > 0) {
      console.log(`  Outcome details: ${JSON.stringify(outcomes).substring(0, 400)}`);
    }
    console.log(`  Errors: ${run.errorLog?.length || 0}`);
    if (run.errorLog && run.errorLog.length > 0) {
      console.log(`  Error details: ${JSON.stringify(run.errorLog).substring(0, 200)}`);
    }
    console.log("-".repeat(80));
  }
}

main().catch(console.error);
