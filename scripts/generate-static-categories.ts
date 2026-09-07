#!/usr/bin/env tsx
/**
 * Generate Static Categories — CLI entry
 *
 * Fetches categories from the database and writes them to
 * `lib/data/static-categories.ts`. Runs as the first half of `npm run build`.
 *
 * Why: #143 — this script used to swallow every failure. With no DATABASE_URL,
 * or on a connection/query error, it fell back to a single "All Categories"
 * placeholder, rewrote the committed file with a fresh `Generated:` timestamp
 * and exited 0, so a local build silently deleted 57 lines of real category
 * data. The write/skip/fail decision now lives in
 * `lib/data/static-categories-generator.ts` and this file only supplies
 * environment, database and filesystem access.
 * What: Reads `--allow-empty` off argv, decides whether a connection string is
 * configured, queries the current rankings snapshot, writes the generated module
 * atomically (temp file in the same directory, then rename) and exits with the
 * code the decision core returns.
 * Test: `tests/unit/generate-static-categories.test.ts` covers the decision
 * core; this entry point holds no branching of its own beyond dependency wiring.
 *
 * Usage:
 *   npm run generate-categories
 *   npm run generate-categories -- --allow-empty
 *   tsx scripts/generate-static-categories.ts
 */

import { renameSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { eq } from "drizzle-orm";
import {
  countCategories,
  decideStaticCategories,
  OUTPUT_RELATIVE_PATH,
  redactConnectionUrls,
  type CategoryFetchResult,
} from "../lib/data/static-categories-generator";
// Imported for its side effects as well as `getDb`: the module loads .env.local
// and .env in development, so the DATABASE_URL check below sees the same
// environment the connection itself would use.
import { getDb } from "../lib/db/connection";
import { rankings } from "../lib/db/schema";

/**
 * Whether a usable connection string is configured.
 *
 * #143: mirrors the variables `getDatabaseUrl()` in lib/db/connection.ts reads,
 * including its rejection of the `.env.example` `YOUR_PASSWORD` placeholder, so
 * "we would skip" and "the connection would fail" cannot disagree.
 */
function hasDatabaseUrl(): boolean {
  const candidates = [
    process.env["DATABASE_URL"],
    process.env["DATABASE_URL_DEVELOPMENT"],
    process.env["DATABASE_URL_STAGING"],
  ];
  return candidates.some(
    (url) => typeof url === "string" && url.length > 0 && !url.includes("YOUR_PASSWORD")
  );
}

/** Reads the current rankings snapshot. Throws rather than returning a fallback. */
async function fetchCategoriesFromDb(): Promise<CategoryFetchResult> {
  const db = getDb();
  if (!db) {
    // getDb() returns null only during the Next.js build phase or under
    // NODE_ENV=test. Either way no read happened, so this is a failure and not
    // an empty result (#143).
    throw new Error("Database connection not available");
  }

  const currentRankings = await db
    .select()
    .from(rankings)
    .where(eq(rankings.isCurrent, true))
    .limit(1);

  return countCategories(currentRankings[0]?.data);
}

/**
 * Writes `contents` to the output path atomically.
 *
 * #143: a crash between truncate and write used to be able to leave the
 * committed module half-written; the rename is atomic within the directory.
 */
function writeStaticCategoriesFile(contents: string): void {
  const outputPath = join(process.cwd(), OUTPUT_RELATIVE_PATH);
  const tempPath = `${outputPath}.${process.pid}.tmp`;

  writeFileSync(tempPath, contents, "utf-8");
  try {
    renameSync(tempPath, outputPath);
  } catch (error) {
    try {
      unlinkSync(tempPath);
    } catch {
      // The temp file is already gone; the rename failure below is what matters.
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const exitCode = await decideStaticCategories({
    hasDatabaseUrl: hasDatabaseUrl(),
    allowEmpty: process.argv.includes("--allow-empty"),
    fetchCategories: fetchCategoriesFromDb,
    writeFile: writeStaticCategoriesFile,
    log: (message) => console.log(message),
    logError: (message) => console.error(message),
  });

  process.exit(exitCode);
}

void main().catch((error: unknown) => {
  // Reached only if the atomic write itself fails; every database and decision
  // failure is already an exit code from decideStaticCategories.
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Generate Categories] ${redactConnectionUrls(message)}`);
  process.exit(1);
});
