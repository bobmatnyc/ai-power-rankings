/**
 * Quick script to check automated ingestion runs status
 * Usage: npx tsx scripts/check-ingestion-runs.ts
 */

import * as dotenv from 'dotenv';

// Load environment variables BEFORE any imports that might use them
dotenv.config({ path: '.env.production.local' });
dotenv.config({ path: '.env.local' });

// Override to production to use DATABASE_URL from production config
process.env.NODE_ENV = 'production';

import { desc } from 'drizzle-orm';
import { getDb } from '../lib/db/connection';
import { automatedIngestionRuns } from '../lib/db/schema';

async function checkIngestionRuns() {
  console.log('=== Checking Automated Ingestion Runs ===\n');

  const db = getDb();
  if (!db) {
    console.error('Database not available');
    process.exit(1);
  }

  try {
    // Get last 10 runs
    const runs = await db
      .select()
      .from(automatedIngestionRuns)
      .orderBy(desc(automatedIngestionRuns.createdAt))
      .limit(10);

    if (runs.length === 0) {
      console.log('No ingestion runs found in the database.');
      console.log('This suggests the cron job has never executed successfully.');
      return;
    }

    console.log(`Found ${runs.length} recent runs:\n`);

    for (const run of runs) {
      console.log(`Run ID: ${run.id}`);
      console.log(`  Type: ${run.runType}`);
      console.log(`  Status: ${run.status}`);
      console.log(`  Started: ${run.startedAt?.toISOString() ?? 'N/A'}`);
      console.log(`  Completed: ${run.completedAt?.toISOString() ?? 'N/A'}`);
      console.log(`  Articles Discovered: ${run.articlesDiscovered}`);
      console.log(`  Articles Passed Quality: ${run.articlesPassedQuality}`);
      console.log(`  Articles Ingested: ${run.articlesIngested}`);
      console.log(`  Articles Skipped: ${run.articlesSkipped}`);
      console.log(`  Articles Skipped (Semantic): ${run.articlesSkippedSemantic}`);
      console.log(`  Ranking Changes: ${run.rankingChanges}`);
      console.log(`  Estimated Cost: $${run.estimatedCostUsd}`);

      const errorLog = run.errorLog as string[] | null;
      if (errorLog && errorLog.length > 0) {
        console.log(`  Errors: ${JSON.stringify(errorLog)}`);
      }

      console.log('');
    }
  } catch (error) {
    console.error('Error querying database:', error);
  }

  process.exit(0);
}

checkIngestionRuns();
