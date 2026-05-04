#!/usr/bin/env npx tsx
/**
 * Kill Hanging Ingestion Runs
 *
 * Updates any "running" automated_ingestion_runs records to "failed" status.
 * Used to recover from pipeline hangs (e.g., OpenRouter timeouts).
 */

import { getDb } from "../lib/db/connection";
import { automatedIngestionRuns } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = getDb();
  if (!db) {
    console.error("No database connection");
    process.exit(1);
  }

  const runningRuns = await db
    .select()
    .from(automatedIngestionRuns)
    .where(eq(automatedIngestionRuns.status, "running"));

  if (runningRuns.length === 0) {
    console.log("No hanging runs found.");
    return;
  }

  console.log(`Found ${runningRuns.length} hanging run(s). Marking as failed...`);

  for (const run of runningRuns) {
    const errorLog = [
      ...(run.errorLog ?? []),
      `Manually killed at ${new Date().toISOString()}: pipeline was hanging (likely OpenRouter timeout in batchAssess)`,
    ];

    await db
      .update(automatedIngestionRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorLog,
      })
      .where(eq(automatedIngestionRuns.id, run.id));

    console.log(`  ✓ Killed run ${run.id} (created ${run.createdAt})`);
  }

  console.log(`\nMarked ${runningRuns.length} run(s) as failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
