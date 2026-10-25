#!/usr/bin/env tsx

/**
 * Measure the staged v8.0 harness weights against published v7.10 (#185). READ-ONLY.
 *
 * Why: D45 (no harness tool moves more than 2 places against v7.10) can only be
 *   proved on the real board, and D19 lets only aggregates out of that run. The
 *   Architect runs this locally with a read-only database credential; it is
 *   never run in GitHub Actions.
 * What: connects only through MEASURE_V8_DATABASE_URL as passed at launch
 *   (`lib/measure-launch-env.ts`, imported first, also stops env-file loading).
 *   Reads the active `tools` rows (with `kind`), every `tools` row's id, slug, status and
 *   `data->>'redirect_to'` and `data->>'carriedFrom'` (to map published ids through
 *   redirects and pick a merge's survivor, #185) and the one
 *   current `rankings` row in a single READ ONLY transaction, after a single-SELECT
 *   check on each statement (`assertSelectOnly`, #93). Weights come from
 *   `config/scoring-profiles.json`: set v7.10 profile `all` (baseline) and set
 *   v8.0 routed by `tools.kind` (candidate, PR-2: each tool scored with the
 *   profile for its kind; a kind with no profile stops the run). `measureBoard()` reproduces v7.10 first,
 *   then checks the harness list, and prints no candidate number unless both pass.
 *   The kind sheet (`docs/refresh/tool-kind-mapping.csv`, read from the repo
 *   root) removes retired tools from the harness list. stdout is the
 *   counts-only report from `formatMeasurementReport()`, except its closing
 *   private section, which names active tools missing from the sheet. All
 *   console output of the code it runs is swallowed (the engine names tools).
 *   With `--per-tool` (ruling D8b), stdout also carries, after that report, a
 *   private per-tool table (name, slug, v7.10 and v8 rank and score, shifts,
 *   kind, D45 breach mark) from `formatScriptOutput()`. It goes to stdout
 *   only; the script writes no file. Without the flag stdout is unchanged.
 *   The flag never changes the exit code.
 *   An error prints the script's own message or the error class name only.
 *   Exit 0: reproduced, 0 D45 breaches. 3: a D45 breach. 4: v7.10 not
 *   reproduced. 5: harness list check failed. 2: refused (running under CI).
 *   1: any other error.
 * Test: `lib/v8-board-measurement.test.ts` (core and report),
 *   `lib/v8-board-measurement-per-tool.test.ts` (per-tool table, unchanged default output),
 *   `tests/unit/measure-v8-board-script-185.test.ts` (CI refusal, no workflow runs it).
 *
 * Usage: MEASURE_V8_DATABASE_URL=<read-only connection string> npx tsx scripts/measure-v8-board.ts [--per-tool]
 *   --per-tool  also print the private per-tool table (do not post it)
 */

// #185: first import, so it records the credential and stops env-file loading before
// any other module (lib/db/connection.ts loads .env files) is evaluated.
import { launchConnectionString, MEASURE_DATABASE_VAR } from "@/lib/measure-launch-env";

import { existsSync, readFileSync } from "node:fs";

import { neon } from "@neondatabase/serverless";

import { naiveUtcTypes } from "@/lib/db/naive-utc-timestamp.mjs";
import { parseKindSheet } from "@/lib/db/tool-kind-sheet";
import { assertSelectOnly, redact } from "@/lib/ranking-snapshot-diff";
import { snapshotRows } from "@/lib/rankings/snapshot-rows";
import { profileRouting } from "@/lib/scoring-kind-routing";
import { loadCheckedInScoringProfiles, profileWeights } from "@/lib/scoring-profiles";
import {
  EXIT_CODES,
  kindSheetView,
  measureBoard,
  type MeasuredTool,
} from "@/lib/v8-board-measurement";
import { formatScriptOutput, PER_TOOL_FLAG } from "@/lib/v8-board-measurement-per-tool";

/** The reviewed 0017 kind sheet, relative to the repo root the script runs from. */
const KIND_SHEET_PATH = "docs/refresh/tool-kind-mapping.csv";

// Same rows `loadActiveTools()` scores, plus kind.
const TOOLS_QUERY = "SELECT id, name, slug, category, status, kind, data FROM tools WHERE status = $1";
// #185: every row, any status, so a published id retired by 0019 or D90 resolves to its canonical row.
// #185 (ruling option a): carriedFrom names the survivor 0019 copied onto a family row.
const IDENTITY_QUERY =
  "SELECT id, slug, status, data->>'redirect_to' AS redirect_to, data->>'carriedFrom' AS carried_from FROM tools";
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

/** All three SELECTs in one READ ONLY transaction, so the tools, redirects and snapshot are one view. */
async function readBoard(connectionString: string): Promise<{ tools: Row[]; identities: Row[]; current: Row[] }> {
  assertSelectOnly(TOOLS_QUERY);
  assertSelectOnly(IDENTITY_QUERY);
  assertSelectOnly(CURRENT_QUERY);
  const sql = neon(connectionString, { types: naiveUtcTypes } as never);
  const [tools, identities, current] = await sql.transaction(
    [sql(TOOLS_QUERY, ["active"]), sql(IDENTITY_QUERY, []), sql(CURRENT_QUERY, [true])],
    { readOnly: true }
  );
  return { tools: (tools ?? []) as Row[], identities: (identities ?? []) as Row[], current: (current ?? []) as Row[] };
}

async function main(): Promise<number> {
  refuseUnderCi();
  const config = loadCheckedInScoringProfiles();
  const baseline = profileWeights(config, "v7.10", "all");
  const candidate = profileRouting(config, "v8.0");

  // #185: only the value passed at launch; a .env* file can never supply it.
  const connectionString = launchConnectionString;
  if (!connectionString) throw new MeasureError(`${MEASURE_DATABASE_VAR} is not set`);

  // #185 (ruling 12:33Z): the reviewed kind sheet, read before the database.
  if (!existsSync(KIND_SHEET_PATH)) throw new MeasureError(`no kind sheet at ${KIND_SHEET_PATH}; run from the repo root`);
  const parsedSheet = parseKindSheet(readFileSync(KIND_SHEET_PATH, "utf8"));
  if (parsedSheet.errors.length > 0) throw new MeasureError(`the kind sheet has ${parsedSheet.errors.length} problem(s)`);
  const sheet = kindSheetView(parsedSheet.rows);

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
    sheet,
    toolIdentities: board.identities.map((row) => ({
      id: String(row["id"]),
      slug: String(row["slug"]),
      status: String(row["status"]),
      redirectTo: typeof row["redirect_to"] === "string" ? row["redirect_to"] : null,
      carriedFrom: typeof row["carried_from"] === "string" ? row["carried_from"] : null,
    })),
  });
  // D8b: private per-tool table for Bob's D4d sign-off
  const perTool = process.argv.slice(2).includes(PER_TOOL_FLAG);
  process.stdout.write(formatScriptOutput(result, { perTool }));
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
        ? redact(error.message, [launchConnectionString])
        : error instanceof Error
          ? error.name
          : "unknown error";
    process.stdout.write("Result: ERROR\n");
    process.stderr.write(`measure-v8-board failed: ${detail}\n`);
    process.exit(EXIT_CODES.error);
  });
