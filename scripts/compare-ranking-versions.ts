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
 *   - Default source: the active `tools` rows from `DATABASE_URL`, read with
 *     one SELECT inside a READ ONLY transaction
 *     (`loadActiveToolsReadOnly()` in `lib/ranking-compare-db-source.ts`).
 *     Postgres rejects any write in that transaction.
 *   - `--fixtures=<path>`: a JSON array of tool rows instead of the database.
 *     The database modules are never imported in this mode.
 *   - `--date=YYYY-MM-DD`: scoring clock (default: now).
 *   stdout carries only the table, so a workflow can paste it into the job
 *   summary; the banner goes to stderr. Errors print to stderr with the
 *   connection string, its host, user and password redacted.
 * Test: `lib/ranking-version-compare.test.ts`, `lib/ranking-compare-db-source.test.ts`
 *
 * Run: npx tsx scripts/compare-ranking-versions.ts --fixtures=tests/fixtures/ranking-compare-101.json
 */

import { readFileSync } from "node:fs";

import {
  BASELINE_VERSION,
  CANDIDATE_VERSION,
  buildComparisonTable,
  connectionStringLiterals,
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
  // #101: read DATABASE_URL directly and skip getDb(), which loads .env files
  // and logs the endpoint. Imported lazily so fixture mode never loads a driver.
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const { loadActiveToolsReadOnly, neonReadOnlyRunner } = await import("@/lib/ranking-compare-db-source");
  return loadActiveToolsReadOnly(neonReadOnlyRunner(connectionString));
}

async function main(): Promise<void> {
  const fixtures = argValue("fixtures");
  const date = parseDate(argValue("date"));
  const tools = fixtures
    ? (JSON.parse(readFileSync(fixtures, "utf8")) as RankingSourceTool[])
    : await loadFromDatabase();

  // #101: banner on stderr so stdout is the table alone (the job summary).
  console.error(
    `Ranking compare ${BASELINE_VERSION} -> ${CANDIDATE_VERSION} (read-only; source: ${fixtures ? "fixtures" : "database"}; clock ${date.toISOString().slice(0, 10)})\n`
  );
  console.log(formatComparisonTable(buildComparisonTable(tools, date)));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // #101: also strip the literal host/user/password, which a driver error can
  // print without a URL scheme.
  const literals = connectionStringLiterals(process.env["DATABASE_URL"]);
  console.error(`compare-ranking-versions: failed: ${redactSecrets(message, literals)}`);
  process.exit(1);
});
