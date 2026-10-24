#!/usr/bin/env tsx

/**
 * Measure the staged v8.0 harness weights against published v7.10 (#185). READ-ONLY.
 *
 * Why: D45 (no harness tool moves more than 2 places against v7.10) can only be
 *   proved on the real board, and D19 lets only aggregates out of that run. The
 *   Architect runs this locally with a read-only database credential; it is
 *   never run in GitHub Actions.
 * What: reads the active `tools` rows (with `kind`) and the one current
 *   `rankings` row in a single READ ONLY transaction, after a single-SELECT
 *   check on each statement (`assertSelectOnly`, #93). Weights come from
 *   `config/scoring-profiles.json`: set v7.10 profile `all` (baseline) and set
 *   v8.0 profile `harness` (candidate). `measureBoard()` reproduces v7.10 first
 *   and prints no candidate number unless it reproduces.
 *   stdout is the counts-only report from `formatMeasurementReport()`. All
 *   console output of the code it runs is swallowed (the engine names tools).
 *   An error prints the script's own message or the error class name only.
 *   Exit 0: reproduced, 0 D45 breaches. 3: a D45 breach. 4: v7.10 not
 *   reproduced. 2: refused (running under CI). 1: any other error.
 * Test: `lib/v8-board-measurement.test.ts` (core and report),
 *   `tests/unit/measure-v8-board-script-185.test.ts` (CI refusal, no workflow runs it).
 *
 * Usage: npx tsx scripts/measure-v8-board.ts
 */

import { neon } from "@neondatabase/serverless";

import { naiveUtcTypes } from "@/lib/db/naive-utc-timestamp.mjs";
import { assertSelectOnly, redact } from "@/lib/ranking-snapshot-diff";
import { snapshotRows } from "@/lib/rankings/snapshot-rows";
import { loadCheckedInScoringProfiles, profileWeights } from "@/lib/scoring-profiles";
import {
  EXIT_CODES,
  formatMeasurementReport,
  measureBoard,
  type MeasuredTool,
} from "@/lib/v8-board-measurement";

const CONNECTION_VAR = "DATABASE_URL";

// Same rows `loadActiveTools()` scores, plus kind.
const TOOLS_QUERY = "SELECT id, name, slug, category, status, kind, data FROM tools WHERE status = $1";
const CURRENT_QUERY =
  "SELECT period, algorithm_version, published_at, data FROM rankings WHERE is_current = $1 LIMIT 1";

type Row = Record<string, unknown>;

/** An error whose message carries no row data and may be printed. */
class MeasureError extends Error {}

function refuseUnderCi(): void {
  if (process.env["GITHUB_ACTIONS"] === "true" || process.env["CI"]) {
    process.stderr.write("measure-v8-board: refused, it never runs under CI or GitHub Actions\n");
    process.exit(EXIT_CODES.refused);
  }
}

/** Both SELECTs in one READ ONLY transaction, so the tools and the snapshot are one view. */
async function readBoard(connectionString: string): Promise<{ tools: Row[]; current: Row[] }> {
  assertSelectOnly(TOOLS_QUERY);
  assertSelectOnly(CURRENT_QUERY);
  const sql = neon(connectionString, { types: naiveUtcTypes } as never);
  const [tools, current] = await sql.transaction(
    [sql(TOOLS_QUERY, ["active"]), sql(CURRENT_QUERY, [true])],
    { readOnly: true }
  );
  return { tools: (tools ?? []) as Row[], current: (current ?? []) as Row[] };
}

async function main(): Promise<number> {
  refuseUnderCi();
  const config = loadCheckedInScoringProfiles();
  const baseline = profileWeights(config, "v7.10", "all");
  const candidate = profileWeights(config, "v8.0", "harness");

  const connectionString = process.env[CONNECTION_VAR];
  if (!connectionString) throw new MeasureError("the database connection variable is not set");
  const board = await readBoard(connectionString);

  const current = board.current[0];
  if (!current) throw new MeasureError("no current rankings row");
  const publishedAt = current["published_at"];
  if (!(publishedAt instanceof Date)) throw new MeasureError("current rankings row has no published_at");

  const tools: MeasuredTool[] = board.tools.map((row) => ({
    id: String(row["id"]),
    name: String(row["name"]),
    slug: String(row["slug"]),
    category: String(row["category"]),
    status: String(row["status"]),
    kind: String(row["kind"]),
    data: (row["data"] ?? {}) as Record<string, unknown>,
  }));

  const result = measureBoard({
    tools,
    published: { algorithmVersion: String(current["algorithm_version"]), publishedAt, rows: snapshotRows(current["data"]) },
    baseline,
    candidate,
  });
  process.stdout.write(`${formatMeasurementReport(result)}\n`);
  return result.exitCode;
}

// D19: the engine and app modules log tool names and scores; none of it may print.
const quiet = () => {};
for (const method of ["log", "info", "warn", "error", "debug"] as const) {
  console[method] = quiet;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    const detail =
      error instanceof MeasureError
        ? redact(error.message, [process.env[CONNECTION_VAR]])
        : error instanceof Error
          ? error.name
          : "unknown error";
    process.stdout.write("Result: ERROR\n");
    process.stderr.write(`measure-v8-board failed: ${detail}\n`);
    process.exit(EXIT_CODES.error);
  });
