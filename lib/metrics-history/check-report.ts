/**
 * Counts-only report for the read-only metrics-history check (#95).
 *
 * Why: the check runs unattended in a public Actions log, so it may print
 *   counts, dates and part names only, never a tool or a metric value. It must
 *   fail when a month's collection did not complete, so the failed-workflow
 *   email fires.
 * What: renders rows per collected_date, coverage (history rows for the date
 *   against the tool count), per-part coverage of eligible tools against
 *   `COVERAGE_FLOOR`, one ledger line per expected shard (every part,
 *   shards 0..of-1 from SHARD_COUNTS), a dead-collector line per part, and a
 *   flat-line count per part (tools whose values did not change since the
 *   previous collected_date).
 *   Exit 0: pass, WARN lines allowed. Exit 3: a shard missing or not ok, a dead
 *   collector, or a part's coverage under its floor.
 * Test: `tests/unit/metrics-check-report-95.test.ts`,
 *   `tests/unit/metrics-cron-config-95.test.ts`; run by
 *   `scripts/check-metrics-history.ts` from `.github/workflows/check-metrics-history.yml`.
 */

import { COLLECTOR_PARTS, type CollectorPart, SHARD_COUNTS } from "../metrics-collectors/registry";

export type CoverageFloors = Record<CollectorPart, number | null>;

/**
 * #95: per part, the share of ELIGIBLE tools that must have that part's key for the date
 * (0..1); `null` turns the part's floor off. Eligible: a GitHub URL in `tools.data`
 * (`GITHUB_URL_PATHS`) for github, or the part's key on the previous collected_date for
 * any part. The npm, pypi and vscode collectors find packages by name, so last month's
 * match is their only identifier; on the first month they have no eligible tools.
 * A missing identifier is therefore never a miss. Defaults from the 2026-11-01 run:
 * npm 159, vscode 109 and pypi 24 recorded; a part keeps 90% of last month's matches.
 * github allows 80% because its eligible set is new (URLs the collector never read before)
 * and some of those repos may be renamed or gone. Override: `METRICS_COVERAGE_FLOOR`.
 */
export const COVERAGE_FLOOR: Readonly<CoverageFloors> = { github: 0.8, pypi: 0.9, npm: 0.9, vscode: 0.9 };

/**
 * #95: parses `METRICS_COVERAGE_FLOOR`. Empty or unset: the defaults. `off`: every floor off.
 * Otherwise comma-separated `part=share` overrides, e.g. `github=0.5,npm=off`.
 * Throws on an unknown part or a share outside 0..1.
 */
export function parseCoverageFloors(spec: string | undefined): CoverageFloors {
  const floors: CoverageFloors = { ...COVERAGE_FLOOR };
  const text = (spec ?? "").trim();
  if (text === "") return floors;
  if (text === "off") {
    for (const part of COLLECTOR_PARTS) floors[part] = null;
    return floors;
  }
  for (const entry of text.split(",")) {
    const match = /^\s*([a-z]+)\s*=\s*(off|[0-9]*\.?[0-9]+)\s*$/.exec(entry);
    const part = match?.[1] as CollectorPart | undefined;
    if (!match || !part || !(COLLECTOR_PARTS as readonly string[]).includes(part)) {
      throw new Error("METRICS_COVERAGE_FLOOR must be empty, off, or part=share pairs");
    }
    const share = match[2] === "off" ? null : Number(match[2]);
    if (share !== null && !(share >= 0 && share <= 1)) {
      throw new Error("METRICS_COVERAGE_FLOOR shares must be from 0 to 1");
    }
    floors[part] = share;
  }
  return floors;
}

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

/** #95: per part, eligible tools and how many of them have the part's key for the date. */
export interface PartCoverage {
  part: string;
  eligible: number;
  recorded: number;
}

export interface ReportInput {
  date: string;
  rowsPerDate: DateCount[];
  ledger: LedgerRow[];
  coverage: Coverage;
  /** The latest collected_date before `date`, or null on the first month. */
  previousDate: string | null;
  flat: FlatCount[];
  /** A part with no row has no eligible tools. */
  partCoverage: PartCoverage[];
  /** Defaults to COVERAGE_FLOOR. */
  coverageFloor?: CoverageFloors;
}

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "n/a");

export function renderMetricsHistoryReport(input: ReportInput): { exitCode: number; report: string } {
  const floors = input.coverageFloor ?? COVERAGE_FLOOR;
  const lines = [`Metrics history check for collected_date ${input.date}`, "", "History rows per collected_date:"];
  if (input.rowsPerDate.length === 0) lines.push("  (none)");
  for (const { collected_date, rows } of input.rowsPerDate) lines.push(`  ${collected_date}: ${Number(rows)}`);

  // Coverage. Only counts are printed; the inputs are numbers by contract.
  const tools = Number(input.coverage.tools);
  const covered = Number(input.coverage.rows);
  lines.push("", `Coverage: ${covered} of ${tools} tools have a history row (${pct(covered, tools)})`);

  // #95: the floor is per part and over eligible tools only, so a tool with no identifier
  // for a part never counts as a miss.
  let coverageFail = 0;
  lines.push("", "Coverage per part (eligible tools with the part recorded):");
  for (const part of COLLECTOR_PARTS) {
    const row = input.partCoverage.find((c) => c.part === part);
    const eligible = Number(row?.eligible ?? 0);
    const recorded = Number(row?.recorded ?? 0);
    const floor = floors[part];
    let verdict: string;
    if (floor === null) verdict = "no floor";
    else if (eligible === 0) verdict = "no eligible tools";
    else if (recorded / eligible < floor) {
      coverageFail++;
      verdict = `FAIL under the floor of ${Math.round(floor * 100)}%`;
    } else verdict = `ok, floor ${Math.round(floor * 100)}%`;
    lines.push(`  ${part}: ${recorded} of ${eligible} eligible (${pct(recorded, eligible)}) ${verdict}`);
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
  if (coverageFail > 0) reasons.push(`${coverageFail} part(s) under the coverage floor`);
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
