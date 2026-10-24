/**
 * Read-only check that the admin dry-run matches what is published (#93).
 *
 * Why: #93 moves admin build and preview onto `regenerateRankings()` in
 *   dry-run / draft mode. Before merge, two diffs must be 0 on real data:
 *   A. admin dry-run vs the scheduled publish path, same rows and clock;
 *   B. admin dry-run vs the stored current snapshot, at its publish time.
 * What: two SELECTs (active tools, the current ranking row), each inside a
 *   READ ONLY Postgres transaction, after a single-SELECT check. Both runs use
 *   an in-memory port whose write methods throw, except that Diff A's publish
 *   run captures its rows in memory. Diff B labels tools whose
 *   `tools.updated_at` is after the snapshot's publish time and ignores
 *   `movement` (it depends on the snapshot before).
 *   #93: the workflow is public and dry-run ranks are unpublished, so stdout is
 *   the counts-only report from `renderCheckReport()` and nothing else: no
 *   tool name, slug, id, rank, score, tier or row. Console output from the code
 *   it runs (engine warnings name tools) is suppressed. An error prints a fixed
 *   message (the script's own) or the error class name only, never its text.
 *   Exit 0: both diffs 0. Exit 3: any diff. Exit 1: an error.
 * Test: the diff and report are in `lib/ranking-snapshot-diff.test.ts`. Run by
 *   `.github/workflows/check-admin-regenerate.yml` (dispatch only).
 *
 * Usage: npx tsx scripts/check-admin-regenerate.ts [--date=YYYY-MM-DD]
 */

import { neon } from "@neondatabase/serverless";
import { naiveUtcTypes } from "@/lib/db/naive-utc-timestamp.mjs";
import {
  ALL_ROW_FIELDS,
  assertSelectOnly,
  diffSnapshots,
  redact,
  renderCheckReport,
  SCORE_ROW_FIELDS,
  type SnapshotDiff,
  type SnapshotRow,
} from "@/lib/ranking-snapshot-diff";
import {
  type RankingEntry,
  type RankingPersistencePort,
  type RankingSourceTool,
  regenerateRankings,
} from "@/lib/services/ranking-generation.service";
import { snapshotRows } from "@/lib/services/ranking-preview.service";

const CONNECTION_VAR = "DATABASE_URL";

const TOOLS_QUERY =
  "SELECT id, name, slug, category, status, data, updated_at FROM tools WHERE status = $1";
const CURRENT_QUERY =
  "SELECT period, algorithm_version, published_at, data FROM rankings WHERE is_current = $1 LIMIT 1";

type Row = Record<string, unknown>;

/** #93: an error whose message carries no row data and may be printed. */
class CheckError extends Error {}

function readOnlyRunner(connectionString: string) {
  const sql = neon(connectionString, { types: naiveUtcTypes } as never);
  return async (text: string, params: unknown[]): Promise<Row[]> => {
    assertSelectOnly(text);
    const [rows] = await sql.transaction([sql(text, params)], { readOnly: true });
    return (rows ?? []) as Row[];
  };
}

function refuseWrites(): never {
  throw new CheckError("read-only check: a write was attempted");
}

function port(tools: RankingSourceTool[], current: Row | null): RankingPersistencePort {
  return {
    loadActiveTools: async () => tools,
    loadCurrentRankings: async () => (current ? { data: current["data"], period: String(current["period"]) } : null),
    saveSnapshot: async () => refuseWrites(),
    saveDraft: async () => refuseWrites(),
  };
}

function parseDate(): Date {
  const arg = process.argv.find((a) => a.startsWith("--date="))?.slice("--date=".length);
  if (!arg) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arg)) throw new CheckError("--date must be YYYY-MM-DD");
  return new Date(`${arg}T00:00:00Z`);
}

async function main(): Promise<number> {
  const connectionString = process.env[CONNECTION_VAR];
  if (!connectionString) throw new CheckError("the database connection variable is not set");
  const run = readOnlyRunner(connectionString);

  const toolRows = await run(TOOLS_QUERY, ["active"]);
  const tools: RankingSourceTool[] = toolRows.map((row) => ({
    id: String(row["id"]),
    name: String(row["name"]),
    slug: String(row["slug"]),
    category: String(row["category"]),
    status: String(row["status"]),
    data: (row["data"] ?? {}) as Record<string, unknown>,
  }));
  const [current = null] = await run(CURRENT_QUERY, [true]);

  // Diff A: admin dry-run vs the publish code path, with the publish write captured in memory.
  const clock = parseDate();
  const now = () => clock;
  const dry = await regenerateRankings({ mode: "dry-run", persistence: port(tools, current), now });
  let published: RankingEntry[] = [];
  await regenerateRankings({
    persistence: { ...port(tools, current), saveSnapshot: async ({ data }) => void (published = data) },
    now,
  });
  const diffA = diffSnapshots(dry.entries as unknown as SnapshotRow[], published as unknown as SnapshotRow[], ALL_ROW_FIELDS);

  // Diff B: null when no current snapshot is stored (the check then fails).
  let diffB: SnapshotDiff[] | null = null;
  let changedAfter = new Set<string>();
  if (current) {
    const publishedAt = current["published_at"];
    if (!(publishedAt instanceof Date)) throw new CheckError("current snapshot has no published_at");
    const replay = await regenerateRankings({
      mode: "dry-run",
      period: String(current["period"]),
      persistence: port(tools, current),
      now: () => publishedAt,
    });
    diffB = diffSnapshots(replay.entries as unknown as SnapshotRow[], snapshotRows(current["data"]), SCORE_ROW_FIELDS);
    changedAfter = new Set(
      toolRows
        .filter((row) => row["updated_at"] instanceof Date && (row["updated_at"] as Date) > publishedAt)
        .map((row) => String(row["id"]))
    );
  }

  const { exitCode, report } = renderCheckReport({ toolsCompared: tools.length, diffA, diffB, labelledB: changedAfter });
  process.stdout.write(`${report}\n`);
  return exitCode;
}

// #93: the engine and app modules log tool names and scores; none of it may reach the log.
const quiet = () => {};
for (const method of ["log", "info", "warn", "error", "debug"] as const) {
  console[method] = quiet;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    // #93: only the script's own messages are printed; any other error by class name.
    const detail =
      error instanceof CheckError
        ? redact(error.message, [process.env[CONNECTION_VAR]])
        : error instanceof Error
          ? error.name
          : "unknown error";
    process.stdout.write("Result: ERROR\n");
    process.stderr.write(`check-admin-regenerate failed: ${detail}\n`);
    process.exit(1);
  });
