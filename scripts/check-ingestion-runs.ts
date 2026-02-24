#!/usr/bin/env npx tsx
/**
 * Check Recent Ingestion Runs
 *
 * Queries the database for recent automated ingestion run records.
 */

import { getDb } from "../lib/db/connection";
import { automatedIngestionRuns } from "../lib/db/schema";
import { desc } from "drizzle-orm";

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
    console.log(`  Errors: ${run.errorLog?.length || 0}`);
    if (run.errorLog && run.errorLog.length > 0) {
      console.log(`  Error details: ${JSON.stringify(run.errorLog).substring(0, 200)}`);
    }
    console.log("-".repeat(80));
  }
}

main().catch(console.error);
