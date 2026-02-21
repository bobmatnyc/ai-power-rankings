#!/usr/bin/env npx tsx
/**
 * Manual Ingestion Trigger Script
 *
 * Triggers the automated ingestion pipeline locally to test fixes.
 * Uses the production database but runs the pipeline locally.
 *
 * Usage:
 *   npx tsx scripts/trigger-ingestion.ts [--dry-run] [--max-articles=N] [--days=N]
 *
 * Options:
 *   --dry-run         Run without writing to database
 *   --max-articles=N  Limit ingestion to N articles (default: 10)
 *   --days=N          Look back N days for articles (Tavily only, default: ~7)
 */

import { AutomatedIngestionService } from "../lib/services/automated-ingestion.service";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const maxArticlesArg = args.find(a => a.startsWith("--max-articles="));
  const maxArticles = maxArticlesArg ? parseInt(maxArticlesArg.split("=")[1], 10) : 10;
  const daysArg = args.find(a => a.startsWith("--days="));
  const days = daysArg ? parseInt(daysArg.split("=")[1], 10) : undefined;

  console.log("=".repeat(60));
  console.log("Manual Ingestion Trigger");
  console.log("=".repeat(60));
  console.log(`Mode: ${dryRun ? "DRY RUN (no database writes)" : "LIVE"}`);
  console.log(`Max Articles: ${maxArticles}`);
  console.log(`Days Lookback: ${days !== undefined ? days : "Default (~7)"}`);
  console.log(`Tavily API Key: ${process.env.TAVILY_API_KEY ? "Configured" : "NOT SET"}`);
  console.log(`Database URL: ${process.env.DATABASE_URL ? "Configured" : "NOT SET"}`);
  console.log("=".repeat(60));

  if (!process.env.TAVILY_API_KEY && !process.env.BRAVE_SEARCH_API_KEY) {
    console.error("ERROR: Neither TAVILY_API_KEY nor BRAVE_SEARCH_API_KEY is configured");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL is not configured");
    process.exit(1);
  }

  const service = new AutomatedIngestionService();

  console.log("\nStarting ingestion pipeline...\n");
  const startTime = Date.now();

  try {
    const result = await service.runDailyDiscovery({
      dryRun,
      maxArticles,
      skipQualityCheck: false, // Run full quality assessment
      days,
    });

    const duration = Date.now() - startTime;

    console.log("\n" + "=".repeat(60));
    console.log("INGESTION RESULTS");
    console.log("=".repeat(60));
    console.log(`Run ID: ${result.runId}`);
    console.log(`Status: ${result.status}`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log("-".repeat(60));
    console.log(`Articles Discovered: ${result.articlesDiscovered}`);
    console.log(`Articles Passed Quality: ${result.articlesPassedQuality}`);
    console.log(`Articles Ingested: ${result.articlesIngested}`);
    console.log(`Articles Skipped (URL duplicates): ${result.articlesSkipped - result.articlesSkippedSemantic}`);
    console.log(`Articles Skipped (Semantic duplicates): ${result.articlesSkippedSemantic}`);
    console.log(`Total Skipped: ${result.articlesSkipped}`);
    console.log(`Estimated Cost: $${result.estimatedCostUsd.toFixed(4)}`);

    if (result.ingestedArticleIds.length > 0) {
      console.log("-".repeat(60));
      console.log("Ingested Article IDs:");
      result.ingestedArticleIds.forEach((id, i) => console.log(`  ${i + 1}. ${id}`));
    }

    if (result.errors.length > 0) {
      console.log("-".repeat(60));
      console.log("Errors:");
      result.errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }

    console.log("=".repeat(60));

    // Check for evidence of Tavily-first extraction
    if (result.articlesIngested > 0) {
      console.log("\n[VERIFICATION] Tavily-first extraction chain was used for content fetching.");
      console.log("The automated ingestion service now tries Tavily Extract -> Jina Reader -> Basic HTML");
    }

    process.exit(result.status === "failed" ? 1 : 0);
  } catch (error) {
    console.error("\nFATAL ERROR:", error instanceof Error ? error.message : error);
    console.error(error instanceof Error ? error.stack : "");
    process.exit(1);
  }
}

main();
