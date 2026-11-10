#!/usr/bin/env tsx

/**
 * Compare the per-list boards with point-in-time metrics off and on (#95). READ-ONLY.
 *
 * Why: the live switch passes `usePointInTimeMetrics: true` through
 *   `publishActiveRankings()` on the cron route. The owner clears it only on a
 *   measured diff (plan: docs/research/95-steps-7-9-plan.md, PR A). This script
 *   produces that diff and writes nothing to the database.
 * What: for each `--period`, `comparePeriod()` runs `regenerateRankings()` twice in
 *   `dry-run` mode with the per-list layout and the active profile set: off, then on.
 *   - Database source (default): `DATABASE_URL`, read through
 *     `verifiedReadOnlyRunner()`. Every statement is a single SELECT inside a
 *     READ ONLY transaction whose `transaction_read_only` is probed first; a probe
 *     that is not `on` aborts the run with exit 1 and no output file.
 *   - `--fixtures=<path>`: the same port and runner over a JSON fixture instead.
 *   - `--date=YYYY-MM-DD`: the scoring clock for both runs (default: now).
 *   - `--out=<path>`: the JSON report (default `point-in-time-compare.json`),
 *     written only after every period succeeded. Aggregates only, unless
 *     `--per-tool` adds each tool's off/on rank and score (private: never
 *     pass it in a public workflow).
 *   stdout is the aggregates-only Markdown summary. Every console method is
 *   silenced, so library logs cannot print tool data. An error prints a fixed
 *   message for this script's own errors and the error class name otherwise.
 *   Exit 0: done. Exit 1: an error.
 * Test: `tests/unit/point-in-time-compare-95.test.ts` (`executeCompare` arms),
 *   `tests/unit/point-in-time-compare-source-95.test.ts`
 *
 * Run: npx tsx scripts/compare-point-in-time.ts --period=2026-11 --fixtures=tests/fixtures/point-in-time-compare-95.json
 */

import { readFileSync, writeFileSync } from "node:fs";

import type { DbRow } from "../lib/ranking-compare-db-source";
import { redact } from "../lib/ranking-snapshot-diff";
import {
  comparePeriod,
  type PeriodCompare,
  type PeriodCompareResult,
  renderCompareSummary,
} from "../lib/rankings/point-in-time-compare";
import {
  createReadOnlyComparePersistence,
  neonTransactionDriver,
  PIT_ACTIVE_TOOLS_QUERY,
  PIT_CURRENT_RANKINGS_QUERY,
  PIT_HISTORY_ROWS_QUERY,
  PIT_LATEST_COLLECTED_QUERY,
  PIT_LEDGER_QUERY,
  READ_ONLY_PROBE,
  ReadOnlyCompareWriteError,
  ReadOnlyNotAppliedError,
  type ReadOnlyTransactionDriver,
  verifiedReadOnlyRunner,
} from "../lib/rankings/point-in-time-compare-source";
import type { PerListScoring } from "../lib/services/ranking-generation.service";

const DEFAULT_OUT = "point-in-time-compare.json";

/** #95: an error whose message carries no row data and may be printed. */
class CompareError extends Error {}

/** The `--fixtures` file: rows shaped like the tables the compare reads. */
export interface CompareFixture {
  tools: DbRow[];
  currentRankings?: Record<string, { period: string; data: unknown }>;
  history?: Array<{ tool_id: string; period: string; collected_date: string; metrics: Record<string, unknown> }>;
  ledger?: Array<Record<string, unknown> & { collected_date: string; collector: string }>;
}

const LEDGER_COUNTS = ["attempted", "recorded", "flagged", "not_found", "failed", "skipped_timeout"] as const;

/**
 * A driver that answers the compare's own statements from a fixture, as Postgres
 * would, and reports every transaction read-only. Any other statement throws.
 */
export function fixtureDriver(fixture: CompareFixture): ReadOnlyTransactionDriver {
  const history = fixture.history ?? [];
  const answer = (text: string, params: unknown[]): DbRow[] => {
    const [param] = params as string[];
    switch (text) {
      case READ_ONLY_PROBE:
        return [{ read_only: "on" }];
      case PIT_ACTIVE_TOOLS_QUERY:
        return fixture.tools
          .filter((tool) => tool["status"] === param)
          .sort((a, b) => String(a["slug"]).localeCompare(String(b["slug"])));
      case PIT_CURRENT_RANKINGS_QUERY: {
        const row = fixture.currentRankings?.[param!];
        return row ? [row] : [];
      }
      case PIT_HISTORY_ROWS_QUERY:
        return history.filter((row) => row.period <= param!);
      case PIT_LATEST_COLLECTED_QUERY: {
        const dates = history.filter((row) => row.period <= param!).map((row) => row.collected_date).sort();
        return [{ latest: dates.at(-1) ?? null }];
      }
      case PIT_LEDGER_QUERY: {
        const totals = new Map<string, DbRow>();
        for (const row of fixture.ledger ?? []) {
          if (row.collected_date !== param) continue;
          const sum = totals.get(row.collector) ?? { collector: row.collector };
          for (const key of LEDGER_COUNTS) sum[key] = Number(sum[key] ?? 0) + Number(row[key] ?? 0);
          totals.set(row.collector, sum);
        }
        return [...totals.values()];
      }
      default:
        throw new CompareError("fixture driver received a statement it does not know");
    }
  };
  return async (statements) => statements.map((s) => answer(s.text, s.params));
}

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function argValue(argv: readonly string[], name: string): string | undefined {
  const arg = argv.find((a) => a.startsWith(`--${name}=`));
  return arg?.slice(name.length + 3);
}

/** `--period=2026-11[,2026-12]`: one or more YYYY-MM periods, de-duplicated, in order. */
export function parsePeriods(argv: readonly string[]): string[] {
  const raw = argValue(argv, "period");
  if (!raw) throw new CompareError("--period=YYYY-MM[,YYYY-MM] is required");
  const periods = [...new Set(raw.split(",").map((p) => p.trim()).filter(Boolean))];
  if (periods.length === 0 || periods.some((p) => !PERIOD_RE.test(p))) {
    throw new CompareError("--period must be YYYY-MM, comma-separated");
  }
  return periods;
}

function parseClock(argv: readonly string[], now: Date): Date {
  const raw = argValue(argv, "date");
  if (raw === undefined) return now;
  const date = new Date(`${raw}T00:00:00Z`);
  if (!DATE_RE.test(raw) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
    throw new CompareError("--date must be a real YYYY-MM-DD day");
  }
  return date;
}

/** The scoring the cron publish uses: the active profile set's per-list routing. */
async function activeScoring(): Promise<PerListScoring> {
  const { resolvePublishScoring } = await import("../lib/rankings/publish-active");
  const { loadCheckedInScoringProfiles } = await import("../lib/scoring-profiles");
  return resolvePublishScoring(loadCheckedInScoringProfiles());
}

export interface CompareDeps {
  argv: readonly string[];
  now: Date;
  connectionString: string | undefined;
  connect?: (connectionString: string) => ReadOnlyTransactionDriver;
  readFile?: (path: string) => string;
  writeFile?: (path: string, content: string) => void;
  resolveScoring?: () => Promise<PerListScoring>;
}

/**
 * Runs the compare and returns what to print and the exit code; never throws.
 * The JSON file is written only after every period succeeded.
 */
export async function executeCompare(deps: CompareDeps): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const periods = parsePeriods(deps.argv);
    const now = parseClock(deps.argv, deps.now);
    const fixtures = argValue(deps.argv, "fixtures");
    const out = argValue(deps.argv, "out") ?? DEFAULT_OUT;
    const perTool = deps.argv.includes("--per-tool");

    let driver: ReadOnlyTransactionDriver;
    if (fixtures) {
      driver = fixtureDriver(JSON.parse((deps.readFile ?? ((p) => readFileSync(p, "utf8")))(fixtures)) as CompareFixture);
    } else {
      if (!deps.connectionString) throw new CompareError("the database connection variable is not set");
      driver = (deps.connect ?? neonTransactionDriver)(deps.connectionString);
    }
    // #95: one port for every period and both runs; every read is a verified READ ONLY transaction.
    const persistence = createReadOnlyComparePersistence(verifiedReadOnlyRunner(driver));
    const scoring = await (deps.resolveScoring ?? activeScoring)();

    const results: PeriodCompareResult[] = [];
    for (const period of periods) results.push(await comparePeriod({ persistence, period, now, scoring }));

    const aggregates: PeriodCompare[] = results.map((r) => r.aggregate);
    const report = {
      generatedBy: "scripts/compare-point-in-time.ts",
      source: fixtures ? "fixtures" : "database",
      periods: aggregates,
      ...(perTool ? { tools: Object.fromEntries(results.map((r) => [r.aggregate.period, r.tools])) } : {}),
    };
    (deps.writeFile ?? ((p, c) => writeFileSync(p, c)))(out, `${JSON.stringify(report, null, 2)}\n`);
    return { exitCode: 0, stdout: `${renderCompareSummary(aggregates)}\n`, stderr: "" };
  } catch (error: unknown) {
    // #95: only this compare's own errors carry a printable message; others print their class name.
    const printable =
      error instanceof CompareError || error instanceof ReadOnlyNotAppliedError || error instanceof ReadOnlyCompareWriteError;
    const detail = printable ? redact(error.message, [deps.connectionString]) : error instanceof Error ? error.name : "unknown error";
    return { exitCode: 1, stdout: "Result: ERROR\n", stderr: `compare-point-in-time failed: ${detail}\n` };
  }
}

if (process.argv[1]?.endsWith("compare-point-in-time.ts")) {
  // #95: nothing but the aggregates summary may reach a public log.
  const quiet = () => {};
  for (const method of ["log", "info", "warn", "error", "debug"] as const) {
    console[method] = quiet;
  }
  void executeCompare({ argv: process.argv, now: new Date(), connectionString: process.env["DATABASE_URL"] }).then(
    ({ exitCode, stdout, stderr }) => {
      process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      process.exit(exitCode);
    }
  );
}
