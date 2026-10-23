#!/usr/bin/env tsx

/**
 * Compare ranking engine v7.9 against v7.10 on the same tools (#101). READ-ONLY.
 *
 * Why: v7.10 publishes only after the owner reviews a real-data before/after
 *   table (ruling D15). This script prints that table. It does not publish,
 *   persist or cache anything.
 * What: loads the active tools, scores them with the v7.9 engine logic and the
 *   v7.10 engine, and prints one Markdown row per tool (tool, old rank, new
 *   rank, delta, old score, new score), movers first.
 *   - Default source: the active `tools` rows, through the same read the cron
 *     uses (`createDbPersistence().loadActiveTools()`, a single SELECT). No
 *     other persistence method is called.
 *   - `--fixtures=<path>`: a JSON array of tool rows instead of the database.
 *     The database modules are never imported in this mode.
 *   - `--date=YYYY-MM-DD`: scoring clock (default: now).
 *   Errors print with URL-shaped and credential-like text redacted.
 * Test: `lib/ranking-version-compare.test.ts`
 *
 * Run: npx tsx scripts/compare-ranking-versions.ts --fixtures=tests/fixtures/ranking-compare-101.json
 */

import { readFileSync } from "node:fs";

import {
  BASELINE_VERSION,
  CANDIDATE_VERSION,
  buildComparisonTable,
  formatComparisonTable,
  redactSecrets,
} from "@/lib/ranking-version-compare";
import type { RankingSourceTool } from "@/lib/services/ranking-generation.service";

function argValue(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : undefined;
}

function parseDate(raw: string | undefined): Date {
  if (!raw) return new Date();
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`invalid --date: ${raw}`);
  return date;
}

async function loadFromDatabase(): Promise<RankingSourceTool[]> {
  // Imported lazily so fixture mode never loads the database layer.
  const { createDbPersistence } = await import("@/lib/services/ranking-generation.service");
  const { closeDb } = await import("@/lib/db/connection");
  try {
    return await createDbPersistence().loadActiveTools();
  } finally {
    await closeDb();
  }
}

async function main(): Promise<void> {
  const fixtures = argValue("fixtures");
  const date = parseDate(argValue("date"));
  const tools = fixtures
    ? (JSON.parse(readFileSync(fixtures, "utf8")) as RankingSourceTool[])
    : await loadFromDatabase();

  console.log(
    `Ranking compare ${BASELINE_VERSION} -> ${CANDIDATE_VERSION} (read-only; source: ${fixtures ? "fixtures" : "database"}; clock ${date.toISOString().slice(0, 10)})\n`
  );
  console.log(formatComparisonTable(buildComparisonTable(tools, date)));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`compare-ranking-versions: failed: ${redactSecrets(message)}`);
  process.exit(1);
});
