/**
 * Counts-only report for the read-only metrics-history check (#95).
 *
 * Why: the check runs unattended in a public Actions log, so it may print
 *   counts, dates and part names only, never a tool or a metric value. It must
 *   fail when a month's collection did not complete, so the failed-workflow
 *   email fires.
 * What: renders rows per collected_date, coverage (history rows for the date
 *   against the tool count), one ledger line per expected shard (every part,
 *   shards 0..of-1 from SHARD_COUNTS), a dead-collector line per part, and a
 *   flat-line count per part (tools whose values did not change since the
 *   previous collected_date).
 *   Exit 0: pass, WARN lines allowed. Exit 3: a shard missing or not ok, a dead
 *   collector, or coverage under a set floor.
 * Test: `tests/unit/metrics-check-report-95.test.ts`,
 *   `tests/unit/metrics-cron-config-95.test.ts`; run by
 *   `scripts/check-metrics-history.ts` from `.github/workflows/check-metrics-history.yml`.
 */

import { COLLECTOR_PARTS, SHARD_COUNTS } from "../metrics-collectors/registry";

/**
 * #95: share of tools that must have a history row for the date (0..1).
 * `null` means no floor yet: coverage is reported with a WARN and never fails.
 * The floor is set from the first real run; that change is this one line.
 */
export const COVERAGE_FLOOR: number | null = null;

/** #95: a part WARNs when more than this share of its compared tools is unchanged. */
export const FLAT_WARN_SHARE = 0.5;

export interface DateCount {
  collected_date: string;
  rows: number;
}

export interface LedgerRow {
  collector: string;
  shard: number;
  shard_count: number;
  status: string;
  attempted: number;
  recorded: number;
  flagged: number;
  not_found: number;
  failed: number;
  skipped_timeout: number;
}

/** Tool count and history rows for the checked date. */
export interface Coverage {
  tools: number;
  rows: number;
}

/** Per part: tools present on both dates, and how many of them kept every value. */
export interface FlatCount {
  part: string;
  compared: number;
  unchanged: number;
}

export interface ReportInput {
  date: string;
  rowsPerDate: DateCount[];
  ledger: LedgerRow[];
  coverage: Coverage;
  /** The latest collected_date before `date`, or null on the first month. */
  previousDate: string | null;
  flat: FlatCount[];
  /** Defaults to COVERAGE_FLOOR. */
  coverageFloor?: number | null;
}

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "n/a");

export function renderMetricsHistoryReport(input: ReportInput): { exitCode: number; report: string } {
  const floor = input.coverageFloor === undefined ? COVERAGE_FLOOR : input.coverageFloor;
  const lines = [`Metrics history check for collected_date ${input.date}`, "", "History rows per collected_date:"];
  if (input.rowsPerDate.length === 0) lines.push("  (none)");
  for (const { collected_date, rows } of input.rowsPerDate) lines.push(`  ${collected_date}: ${Number(rows)}`);

  // Coverage. Only counts are printed; the inputs are numbers by contract.
  const tools = Number(input.coverage.tools);
  const covered = Number(input.coverage.rows);
  let coverageFail = 0;
  lines.push("", `Coverage: ${covered} of ${tools} tools have a history row (${pct(covered, tools)})`);
  if (floor === null) {
    lines.push("  WARN: no coverage floor is set; coverage is reported, not enforced");
  } else if (tools > 0 && covered / tools < floor) {
    coverageFail = 1;
    lines.push(`  FAIL: under the coverage floor of ${Math.round(floor * 100)}%`);
  } else {
    lines.push(`  ok: at or above the coverage floor of ${Math.round(floor * 100)}%`);
  }

  lines.push("", "Ledger per shard:");
  let shardProblems = 0;
  for (const part of COLLECTOR_PARTS) {
    const of = SHARD_COUNTS[part];
    for (let shard = 0; shard < of; shard++) {
      const row = input.ledger.find((r) => r.collector === part && Number(r.shard) === shard);
      if (!row) {
        shardProblems++;
        lines.push(`  ${part} ${shard}/${of}: MISSING`);
        continue;
      }
      const status = row.status === "ok" ? "ok" : row.status === "partial" || row.status === "failed" ? row.status : "not-ok";
      if (row.status !== "ok") shardProblems++;
      lines.push(
        `  ${part} ${shard}/${of}: ${status} attempted=${Number(row.attempted)} recorded=${Number(row.recorded)} ` +
          `flagged=${Number(row.flagged)} not_found=${Number(row.not_found)} failed=${Number(row.failed)} ` +
          `skipped_timeout=${Number(row.skipped_timeout)}`
      );
    }
  }
  const extra = input.ledger.filter((r) => {
    const of = SHARD_COUNTS[r.collector as keyof typeof SHARD_COUNTS];
    return of === undefined || Number(r.shard) >= of;
  }).length;
  if (extra > 0) lines.push(`  unexpected ledger rows: ${extra}`);

  // #95: a part that attempted tools but recorded none is dead, whatever its status says.
  lines.push("", "Collectors:");
  let dead = 0;
  for (const part of COLLECTOR_PARTS) {
    const rows = input.ledger.filter((r) => r.collector === part);
    const attempted = rows.reduce((sum, r) => sum + Number(r.attempted), 0);
    const recorded = rows.reduce((sum, r) => sum + Number(r.recorded), 0);
    const isDead = attempted > 0 && recorded === 0;
    if (isDead) dead++;
    lines.push(`  ${part}: attempted=${attempted} recorded=${recorded}${isDead ? " DEAD (recorded none)" : ""}`);
  }

  lines.push("", "Unchanged since the previous collection:");
  if (input.previousDate === null) {
    lines.push("  no previous month");
  } else {
    lines.push(`  previous collected_date: ${input.previousDate}`);
    for (const part of COLLECTOR_PARTS) {
      const row = input.flat.find((f) => f.part === part);
      const compared = Number(row?.compared ?? 0);
      const unchanged = Number(row?.unchanged ?? 0);
      const warn = compared > 0 && unchanged / compared > FLAT_WARN_SHARE;
      lines.push(`  ${part}: ${unchanged} of ${compared} tools unchanged${warn ? " WARN" : ""}`);
    }
  }

  const reasons: string[] = [];
  if (shardProblems > 0) reasons.push(`${shardProblems} shard(s) missing or not ok`);
  if (dead > 0) reasons.push(`${dead} dead collector(s)`);
  if (coverageFail > 0) reasons.push("coverage under the floor");
  lines.push("", `Result: ${reasons.length === 0 ? "PASS" : `FAIL (${reasons.join("; ")})`}`);
  return { exitCode: reasons.length === 0 ? 0 : 3, report: lines.join("\n") };
}

/**
 * Resolves the collected_date to check from the CLI arguments (#95).
 * `--scheduled`: the first day of the current UTC month, so a run on the 2nd
 * checks the 1st's collection. `--date=YYYY-MM-DD`: that date. Neither: today (UTC).
 * Throws on a malformed `--date` or on both flags.
 */
export function resolveCheckDate(argv: readonly string[], now: Date): string {
  const arg = argv.find((a) => a.startsWith("--date="))?.slice("--date=".length);
  const scheduled = argv.includes("--scheduled");
  if (scheduled && arg !== undefined) throw new Error("pass --date or --scheduled, not both");
  if (scheduled) return `${now.toISOString().slice(0, 7)}-01`;
  if (!arg) return now.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arg)) throw new Error("--date must be YYYY-MM-DD");
  return arg;
}
