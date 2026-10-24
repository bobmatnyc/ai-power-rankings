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
 *   run captures its rows in memory. Prints a Markdown report to stdout.
 *   Diff B labels, as information only, tools whose `tools.updated_at` is
 *   after the snapshot's publish time, and ignores `movement` (it depends on
 *   the snapshot before). Exit 0: both diffs 0. Exit 3: any diff, labelled or
 *   not. Exit 1: an error,
 *   printed to stderr with connection details removed.
 * Test: the diff and guards are in `lib/ranking-snapshot-diff.test.ts`. Run by
 *   `.github/workflows/check-admin-regenerate.yml` (dispatch only).
 *
 * Usage: npx tsx scripts/check-admin-regenerate.ts [--date=YYYY-MM-DD]
 */

import { neon } from "@neondatabase/serverless";
import { naiveUtcTypes } from "@/lib/db/naive-utc-timestamp.mjs";
import {
  ALL_ROW_FIELDS,
  assertSelectOnly,
  checkVerdict,
  diffSnapshots,
  redact,
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

function readOnlyRunner(connectionString: string) {
  const sql = neon(connectionString, { types: naiveUtcTypes } as never);
  return async (text: string, params: unknown[]): Promise<Row[]> => {
    assertSelectOnly(text);
    const [rows] = await sql.transaction([sql(text, params)], { readOnly: true });
    return (rows ?? []) as Row[];
  };
}

function refuseWrites(): never {
  throw new Error("read-only check: a write was attempted");
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arg)) throw new Error("--date must be YYYY-MM-DD");
  return new Date(`${arg}T00:00:00Z`);
}

function table(diffs: SnapshotDiff[], expected: Set<string>): string[] {
  if (diffs.length === 0) return ["No differences."];
  const lines = ["| tool | kind | fields | left rank/score | right rank/score | note |", "|---|---|---|---|---|---|"];
  for (const d of diffs) {
    const side = (r?: SnapshotRow) => (r ? `${r["rank"] ?? r["position"]} / ${r["score"]}` : "-");
    const why = expected.has(d.tool_id) ? "data-changed-after-publish" : "";
    lines.push(`| ${d.tool_name} | ${d.kind} | ${d.fields.join(", ")} | ${side(d.left)} | ${side(d.right)} | ${why} |`);
  }
  return lines;
}

async function main(): Promise<number> {
  const connectionString = process.env[CONNECTION_VAR];
  if (!connectionString) throw new Error("the database connection variable is not set");
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

  const out = [
    "### Diff A: admin dry-run vs scheduled publish path",
    "",
    `Clock ${clock.toISOString()}, ${tools.length} active tools, ${dry.entries.length} vs ${published.length} rows, ${diffA.length} differences.`,
    "",
    ...table(diffA, new Set()),
    "",
    "### Diff B: admin dry-run vs stored current snapshot",
    "",
  ];

  // #93: null when no current snapshot is stored (the check then fails).
  let diffB: SnapshotDiff[] | null = null;
  let changedAfter = new Set<string>();
  if (!current) {
    out.push("No current snapshot is stored; Diff B not run.");
  } else {
    const publishedAt = current["published_at"];
    if (!(publishedAt instanceof Date)) throw new Error("current snapshot has no published_at");
    const replay = await regenerateRankings({
      mode: "dry-run",
      period: String(current["period"]),
      persistence: port(tools, current),
      now: () => publishedAt,
    });
    const stored = snapshotRows(current["data"]);
    diffB = diffSnapshots(replay.entries as unknown as SnapshotRow[], stored, SCORE_ROW_FIELDS);
    changedAfter = new Set(
      toolRows
        .filter((row) => row["updated_at"] instanceof Date && (row["updated_at"] as Date) > publishedAt)
        .map((row) => String(row["id"]))
    );
    out.push(
      `Snapshot ${String(current["period"])} (algorithm ${String(current["algorithm_version"])}), replayed at ${publishedAt.toISOString()}.`,
      `${replay.entries.length} replayed vs ${stored.length} stored rows; ${diffB.length} differences.`,
      "Compared: rank, score, tier, factor_scores. Not compared: movement.",
      "",
      ...table(diffB, changedAfter)
    );
  }

  // #93: any difference, labelled or not, fails the check and the result line says so.
  const verdict = checkVerdict(diffA, diffB, changedAfter);
  console.log([verdict.result, "", ...out].join("\n"));
  return verdict.exitCode;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`check-admin-regenerate failed: ${redact(message, [process.env[CONNECTION_VAR]])}`);
    process.exit(1);
  });
