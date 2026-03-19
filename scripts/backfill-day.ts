#!/usr/bin/env npx tsx
/**
 * Backfill Day Script
 *
 * Ingests articles for a specific target date using Tavily's date-bounded search.
 * Bypasses the 7-day semantic duplicate filter since backfilled days are absent from DB.
 *
 * Usage:
 *   npx tsx scripts/backfill-day.ts --date YYYY-MM-DD [--dry-run] [--max-articles=N]
 *
 * Options:
 *   --date YYYY-MM-DD   Target date to backfill (required)
 *   --dry-run           Discover and analyze but do not write to database
 *   --max-articles=N    Limit ingestion to N articles (default: 20)
 */

import { config } from "dotenv";

// Load env before any service imports
config({ path: ".env.local" });
config({ path: ".env" });

import { ArticleIngestionService } from "../lib/services/article-ingestion.service";
import { AutomatedIngestionService } from "../lib/services/automated-ingestion.service";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);

  const dateArg = args.find((a) => a.startsWith("--date"));
  let targetDate: string | undefined;

  if (dateArg) {
    // Support both "--date=2026-03-15" and "--date 2026-03-15"
    if (dateArg.includes("=")) {
      targetDate = dateArg.split("=")[1];
    } else {
      const idx = args.indexOf("--date");
      targetDate = args[idx + 1];
    }
  }

  const dryRun = args.includes("--dry-run");
  const maxArticlesArg = args.find((a) => a.startsWith("--max-articles="));
  const maxArticles = maxArticlesArg
    ? parseInt(maxArticlesArg.split("=")[1], 10)
    : 20;

  return { targetDate, dryRun, maxArticles };
}

// ---------------------------------------------------------------------------
// Tavily date-bounded search (direct API call — the service only supports
// rolling "days" windows, not absolute from_date/to_date)
// ---------------------------------------------------------------------------

interface TavilyApiResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

interface TavilyApiResponse {
  results: TavilyApiResult[];
}

interface DiscoveredArticle {
  title: string;
  url: string;
  description: string;
  source: string;
  publishedDate: string | null;
  content: string;
}

async function searchTavilyForDate(
  query: string,
  fromDate: string,
  toDate: string,
  maxResults: number,
  searchDepth: "basic" | "advanced"
): Promise<DiscoveredArticle[]> {
  const apiKey = process.env.TAVILY_API_KEY!;

  const requestBody = {
    api_key: apiKey,
    query,
    search_depth: searchDepth,
    max_results: maxResults,
    include_answer: false,
    include_raw_content: false,
    topic: "news",
    // Date-bounded parameters — restricts results to this calendar window
    from_date: fromDate,
    to_date: toDate,
  };

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API error: ${response.status} - ${errorText}`);
  }

  const data: TavilyApiResponse = await response.json();

  return data.results.map((r) => {
    let source = "unknown";
    try {
      source = new URL(r.url).hostname.replace(/^www\./, "");
    } catch {
      // ignore
    }
    return {
      title: r.title || "Untitled",
      url: r.url,
      description: r.content?.substring(0, 500) ?? "",
      source,
      publishedDate: r.published_date ?? null,
      content: r.content ?? "",
    };
  });
}

// Run all Tavily queries (primary + supplementary) and deduplicate by URL
async function discoverArticlesForDate(
  date: string,
  maxResults: number
): Promise<DiscoveredArticle[]> {
  const queries = [
    `AI coding assistant news OR AI code generation tools OR GitHub Copilot OR Cursor AI OR Claude Code OR Windsurf OR Devin AI OR Replit Agent OR Amazon Q Developer OR AI developer tools announcement OR agentic coding`,
    "AI coding assistant funding startup investment",
    "autonomous coding agent release update",
    "AI developer tools VS Code JetBrains announcement",
  ];

  const allResults: DiscoveredArticle[] = [];

  for (let i = 0; i < queries.length; i++) {
    const depth = i === 0 ? "advanced" : "basic";
    const perQueryMax = i === 0 ? maxResults : 10;

    try {
      process.stdout.write(
        `  Querying Tavily (query ${i + 1}/${queries.length}, depth=${depth})... `
      );
      const results = await searchTavilyForDate(
        queries[i],
        date,
        date,
        perQueryMax,
        depth
      );
      console.log(`${results.length} results`);
      allResults.push(...results);
    } catch (err) {
      console.log(
        `FAILED: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return allResults.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Date validation
// ---------------------------------------------------------------------------

function validateDate(raw: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    console.error(`ERROR: --date must be in YYYY-MM-DD format, got: "${raw}"`);
    process.exit(1);
  }
  const d = new Date(raw + "T12:00:00Z");
  if (isNaN(d.getTime())) {
    console.error(`ERROR: Invalid date: "${raw}"`);
    process.exit(1);
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { targetDate, dryRun, maxArticles } = parseArgs();

  // Banner
  console.log("=".repeat(60));
  console.log("Backfill Day — AI Power Ranking");
  console.log("=".repeat(60));

  // Require --date
  if (!targetDate) {
    console.error("ERROR: --date YYYY-MM-DD is required");
    console.error(
      "Usage: npx tsx scripts/backfill-day.ts --date 2026-03-15 [--dry-run]"
    );
    process.exit(1);
  }

  const date = validateDate(targetDate);

  // Env checks
  if (!process.env.TAVILY_API_KEY) {
    console.error(
      "ERROR: TAVILY_API_KEY is not set — add it to .env.local and retry"
    );
    process.exit(1);
  }
  if (!dryRun && !process.env.DATABASE_URL) {
    console.error(
      "ERROR: DATABASE_URL is not set — add it to .env.local or use --dry-run"
    );
    process.exit(1);
  }

  console.log(`Target date:   ${date}`);
  console.log(`Mode:          ${dryRun ? "DRY RUN (no DB writes)" : "LIVE"}`);
  console.log(`Max articles:  ${maxArticles}`);
  console.log(`Tavily key:    configured`);
  console.log(
    `Database:      ${process.env.DATABASE_URL ? "configured" : "N/A (dry-run)"}`
  );
  console.log("=".repeat(60));

  const startTime = Date.now();

  // Step 1: Discover articles for the target date
  console.log(`\n[1/4] Discovering articles published on ${date}...`);
  const discovered = await discoverArticlesForDate(date, maxArticles);
  console.log(`      Total discovered (after URL dedup): ${discovered.length}`);

  if (discovered.length === 0) {
    console.log("\nNo articles found for this date. Exiting.");
    process.exit(0);
  }

  // Step 2: Filter URL duplicates already in DB
  console.log("\n[2/4] Checking for URL duplicates in database...");
  const orchestrator = new AutomatedIngestionService();
  const existingUrls = await orchestrator.checkDuplicates(
    discovered.map((r) => r.url)
  );

  const urlDeduped = discovered.filter((r) => !existingUrls.has(r.url));
  const urlDupCount = discovered.length - urlDeduped.length;
  console.log(`      URL duplicates skipped: ${urlDupCount}`);
  console.log(`      Remaining after URL dedup: ${urlDeduped.length}`);

  if (urlDeduped.length === 0) {
    console.log(
      "\nAll discovered articles already exist in the database. Nothing to do."
    );
    process.exit(0);
  }

  // Step 3: Semantic duplicate check — use a 1-day window instead of 7
  // since we're backfilling a specific day; we only care about same-day dupes
  // already in DB (the short window avoids filtering unrelated current content)
  console.log("\n[3/4] Checking semantic duplicates (1-day window)...");
  const recentTitles = await orchestrator.getRecentArticleTitles(1);
  // getRecentArticleTitles is public but uses "last N days" from now, which
  // won't cover a historical date. For backfills we skip cross-DB semantic
  // dedup and only deduplicate within the discovered batch itself (handled
  // below). We still run with 0 existing titles so within-batch dedup works.
  void recentTitles; // acknowledged — not used for historical dates

  // Within-batch semantic dedup using the same title-similarity logic
  // Re-use the orchestrator's private filterSemanticDuplicates by calling
  // runDailyDiscovery would bundle too much; instead we do a simple
  // word-overlap check inline (Jaccard >= 0.35 on normalized tokens).
  const stopWords = new Set([
    "the","a","an","in","on","at","to","for","of","with","by",
    "is","are","was","were","be","been","being","has","have","had",
    "do","does","did","will","would","should","could","may","might",
    "and","or","but","if","then","than","as","from","into","about",
  ]);

  function normalizeTitle(title: string): string[] {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
  }

  function jaccardSimilarity(a: string[], b: string[]): number {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = [...setA].filter((w) => setB.has(w)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  const SEMANTIC_THRESHOLD = 0.35;
  const batchUnique: DiscoveredArticle[] = [];
  const seenNorm: string[][] = [];
  let batchDupCount = 0;

  for (const article of urlDeduped) {
    const norm = normalizeTitle(article.title);
    const isDup = seenNorm.some(
      (prev) => jaccardSimilarity(norm, prev) >= SEMANTIC_THRESHOLD
    );
    if (isDup) {
      batchDupCount++;
      console.log(`  [semantic-dup] "${article.title.substring(0, 70)}"`);
    } else {
      batchUnique.push(article);
      seenNorm.push(norm);
    }
  }

  console.log(`      Semantic duplicates (within batch) skipped: ${batchDupCount}`);
  console.log(`      Candidates for ingestion: ${batchUnique.length}`);

  const toIngest = batchUnique.slice(0, maxArticles);
  if (toIngest.length < batchUnique.length) {
    console.log(
      `      Capped at max-articles limit: ${toIngest.length}`
    );
  }

  // Step 4: Ingest each candidate
  console.log(
    `\n[4/4] ${dryRun ? "Analyzing (dry-run)" : "Ingesting"} ${toIngest.length} articles...\n`
  );

  const ingestionService = new ArticleIngestionService();
  let ingested = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < toIngest.length; i++) {
    const article = toIngest[i];
    const prefix = `  [${String(i + 1).padStart(2, "0")}/${toIngest.length}]`;

    console.log(`${prefix} ${article.title.substring(0, 70)}`);
    console.log(`         URL: ${article.url.substring(0, 80)}`);
    console.log(
      `         Published: ${article.publishedDate ?? "unknown"} | Source: ${article.source}`
    );

    try {
      const result = await ingestionService.ingestArticle({
        type: "url",
        input: article.url,
        dryRun,
        metadata: {
          publishedDate: article.publishedDate ?? undefined,
          isAutoIngested: true,
          discoverySource: "tavily_backfill",
        },
      });

      if (dryRun) {
        console.log(`         -> DRY RUN: would ingest`);
        ingested++;
      } else {
        const fullResult = result as { id?: string };
        if (fullResult.id) {
          console.log(`         -> INGESTED (id: ${fullResult.id})`);
          ingested++;
        } else {
          console.log(`         -> SKIPPED (already exists or no id returned)`);
          skipped++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`         -> ERROR: ${msg.substring(0, 120)}`);
      errors++;
    }

    console.log("");
  }

  // Summary
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("=".repeat(60));
  console.log("BACKFILL SUMMARY");
  console.log("=".repeat(60));
  console.log(`Target date:             ${date}`);
  console.log(`Duration:                ${durationSec}s`);
  console.log(`Discovered:              ${discovered.length}`);
  console.log(`Skipped (URL dup):       ${urlDupCount}`);
  console.log(`Skipped (semantic dup):  ${batchDupCount}`);
  console.log(`${dryRun ? "Would ingest" : "Ingested"}:              ${ingested}`);
  console.log(`Skipped (already in DB): ${skipped}`);
  console.log(`Errors:                  ${errors}`);
  console.log("=".repeat(60));

  process.exit(errors > 0 && ingested === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
