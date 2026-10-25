/**
 * Private per-tool table for the v8 board measurement (#185, ruling D8b).
 *
 * Why: Bob signs off D4d on the per-tool moves, which the D19 counts-only
 *   report cannot show. The table is opt-in (`PER_TOOL_FLAG`), printed after
 *   the aggregate report to stdout only, and never written to a file.
 * What: `perToolRows()` turns the rank and score maps `measureCandidate()`
 *   already built (published v7.10 order, the D8f `v8TieOrder()` candidate
 *   board, and the D45 within-harness-list ranks) into one row per tool,
 *   sorted by v8 rank. It ranks nothing itself. `formatScriptOutput()` is the
 *   script's whole stdout: the unchanged aggregate report, plus the table
 *   under `PER_TOOL_SECTION_HEADER` when asked. This module imports no `fs`.
 * Test: `lib/v8-board-measurement-per-tool.test.ts`
 */

import { formatMeasurementReport, type MeasuredTool, type MeasurementResult } from "./v8-board-measurement";

/** The script flag that adds the table. */
export const PER_TOOL_FLAG = "--per-tool";

/** Header of the per-tool section: it names tools with ranks and scores. */
export const PER_TOOL_SECTION_HEADER = "Per-tool table, v7.10 against v8 (private — do not post; D8b, for D4d sign-off)";

export const PER_TOOL_COLUMNS = [
  "tool",
  "slug",
  "v7.10 rank",
  "v7.10 score",
  "v8 rank",
  "v8 score",
  "rank shift",
  "score shift",
  "kind",
  "harness-list shift",
  "D45",
] as const;

/** One tool's move. Ranks are global unless named otherwise. */
export interface PerToolRow {
  name: string;
  slug: string;
  kind: string;
  /** Published v7.10 position, as the aggregate report counts it. */
  v710Rank: number;
  v710Score: number;
  v8Rank: number;
  v8Score: number;
  /** v8 rank minus v7.10 rank: positive means the tool moved down. */
  rankShift: number;
  /** v8 score minus v7.10 score. */
  scoreShift: number;
  /** D45 basis: the move within the harness list; null for a tool not on that list. */
  harnessShift: number | null;
  d45Breach: boolean;
}

export interface PerToolInput {
  tools: readonly MeasuredTool[];
  baseRanks: ReadonlyMap<string, number>;
  candRanks: ReadonlyMap<string, number>;
  baseScores: ReadonlyMap<string, number>;
  candScores: ReadonlyMap<string, number>;
  /** Within-harness-list ranks, v7.10 and v8, for the D45 list only. */
  harnessBaseRanks: ReadonlyMap<string, number>;
  harnessCandRanks: ReadonlyMap<string, number>;
  maxHarnessShift: number;
}

/** Postcondition: one row per tool, sorted by `v8Rank`; `d45Breach` only on the harness list. */
export function perToolRows(input: PerToolInput): PerToolRow[] {
  return input.tools
    .map((t) => {
      const harnessBefore = input.harnessBaseRanks.get(t.id);
      const harnessShift = harnessBefore === undefined ? null : input.harnessCandRanks.get(t.id)! - harnessBefore;
      return {
        name: t.name,
        slug: t.slug,
        kind: t.kind,
        v710Rank: input.baseRanks.get(t.id)!,
        v710Score: input.baseScores.get(t.id)!,
        v8Rank: input.candRanks.get(t.id)!,
        v8Score: input.candScores.get(t.id)!,
        rankShift: input.candRanks.get(t.id)! - input.baseRanks.get(t.id)!,
        scoreShift: input.candScores.get(t.id)! - input.baseScores.get(t.id)!,
        harnessShift,
        d45Breach: harnessShift !== null && Math.abs(harnessShift) > input.maxHarnessShift,
      };
    })
    .sort((a, b) => a.v8Rank - b.v8Rank);
}

function signed(n: number, digits = 0): string {
  const text = n.toFixed(digits);
  if (Number(text) === 0) return (0).toFixed(digits);
  return n > 0 ? `+${text}` : text;
}

function cells(row: PerToolRow): string[] {
  return [
    row.name,
    row.slug,
    String(row.v710Rank),
    row.v710Score.toFixed(3),
    String(row.v8Rank),
    row.v8Score.toFixed(3),
    signed(row.rankShift),
    signed(row.scoreShift, 3),
    row.kind,
    row.harnessShift === null ? "-" : signed(row.harnessShift),
    row.d45Breach ? "BREACH" : "",
  ];
}

/** The private section: header, legend, then an aligned table (or why there is none). */
export function formatPerToolTable(result: MeasurementResult): string {
  const rows = result.candidate?.perTool;
  if (!rows) return [PER_TOOL_SECTION_HEADER, "no per-tool table: no candidate measurement"].join("\n");
  const table = [[...PER_TOOL_COLUMNS], ...rows.map(cells)];
  const widths = PER_TOOL_COLUMNS.map((_, i) => Math.max(...table.map((r) => r[i]!.length)));
  const line = (r: string[]) => r.map((c, i) => c.padEnd(widths[i]!)).join(" | ").trimEnd();
  return [
    PER_TOOL_SECTION_HEADER,
    "rank shift = v8 rank - v7.10 rank (+ = moved down); harness-list shift = the D45 basis (- = not on the D45 list)",
    `D45 breaches: ${rows.filter((r) => r.d45Breach).length}; tools: ${rows.length}; sorted by v8 rank`,
    line(table[0]!),
    widths.map((w) => "-".repeat(w)).join("-|-"),
    ...table.slice(1).map(line),
  ].join("\n");
}

/** The script's whole stdout. Without `perTool` it is exactly the aggregate report and a newline. */
export function formatScriptOutput(result: MeasurementResult, options: { perTool: boolean }): string {
  const report = `${formatMeasurementReport(result)}\n`;
  return options.perTool ? `${report}\n${formatPerToolTable(result)}\n` : report;
}
