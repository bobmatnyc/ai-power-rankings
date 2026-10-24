/**
 * Counts-only report for the read-only metrics-history check (#95).
 *
 * Why: the check runs in a public Actions log, so it may print counts and
 *   shard statuses only, never a tool or a metric value. It must fail when any
 *   configured shard has no ledger row or a row that is not `ok`.
 * What: renders rows per collected_date and one ledger line per expected shard
 *   (every part, shards 0..of-1 from SHARD_COUNTS) for the checked date.
 *   Exit 0: every shard ok. Exit 3: a shard missing or not ok.
 * Test: `tests/unit/metrics-cron-config-95.test.ts`; run by
 *   `scripts/check-metrics-history.ts` from `.github/workflows/check-metrics-history.yml`.
 */

import { COLLECTOR_PARTS, SHARD_COUNTS } from "../metrics-collectors/registry";

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

export function renderMetricsHistoryReport(input: {
  date: string;
  rowsPerDate: DateCount[];
  ledger: LedgerRow[];
}): { exitCode: number; report: string } {
  const lines = [`Metrics history check for collected_date ${input.date}`, "", "History rows per collected_date:"];
  if (input.rowsPerDate.length === 0) lines.push("  (none)");
  for (const { collected_date, rows } of input.rowsPerDate) lines.push(`  ${collected_date}: ${rows}`);

  lines.push("", "Ledger per shard:");
  let problems = 0;
  for (const part of COLLECTOR_PARTS) {
    const of = SHARD_COUNTS[part];
    for (let shard = 0; shard < of; shard++) {
      const row = input.ledger.find((r) => r.collector === part && Number(r.shard) === shard);
      if (!row) {
        problems++;
        lines.push(`  ${part} ${shard}/${of}: MISSING`);
        continue;
      }
      if (row.status !== "ok") problems++;
      lines.push(
        `  ${part} ${shard}/${of}: ${row.status} attempted=${row.attempted} recorded=${row.recorded} ` +
          `flagged=${row.flagged} not_found=${row.not_found} failed=${row.failed} skipped_timeout=${row.skipped_timeout}`
      );
    }
  }
  const extra = input.ledger.filter((r) => {
    const of = SHARD_COUNTS[r.collector as keyof typeof SHARD_COUNTS];
    return of === undefined || Number(r.shard) >= of;
  }).length;
  if (extra > 0) lines.push(`  unexpected ledger rows: ${extra}`);

  lines.push("", `Result: ${problems === 0 ? "PASS" : `FAIL (${problems} shard(s) missing or not ok)`}`);
  return { exitCode: problems === 0 ? 0 : 3, report: lines.join("\n") };
}
