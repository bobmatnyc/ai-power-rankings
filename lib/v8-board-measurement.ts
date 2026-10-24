/**
 * Aggregate-only measurement of a staged weight profile against v7.10 (#185).
 *
 * Why: D44 changes the harness weights and D45 forbids any harness tool moving
 *   more than 2 places against v7.10. The board can only be measured on real
 *   data, and D19 allows only aggregates out of that run. This module is the
 *   pure core of `scripts/measure-v8-board.ts`; it never reads a database.
 * What: `measureBoard()` first recomputes every tool with the baseline (v7.10)
 *   weights through `computeRankings()`, the publish path, and compares the
 *   result to the published snapshot with the #93 `diffSnapshots()`. Any
 *   mismatch stops it there: no candidate number is computed. Otherwise it
 *   scores the candidate weights and returns counts and shift statistics. The
 *   D45 gate ranks harness tools within the harness list (basis D2e); global
 *   rank shift is information only. Engine console output, which names tools,
 *   is swallowed while it runs and only counted.
 *   `formatMeasurementReport()` renders the result as text that names no tool,
 *   slug, id or per-tool score.
 * Test: `lib/v8-board-measurement.test.ts`
 */

import type { RankingWeightsV76 } from "./ranking-algorithm-v76";
import { diffSnapshots, type SnapshotRow } from "./ranking-snapshot-diff";
import { computeRankings, type RankingEntry, type RankingSourceTool } from "./services/ranking-generation.service";

/** A scored tool row plus its `tools.kind`. */
export interface MeasuredTool extends RankingSourceTool {
  kind: string;
}

/** The current `rankings` row, as read. */
export interface PublishedSnapshot {
  algorithmVersion: string;
  publishedAt: Date;
  rows: SnapshotRow[];
}

export interface MeasureInput {
  tools: MeasuredTool[];
  published: PublishedSnapshot;
  /** The frozen v7.10 weights. */
  baseline: RankingWeightsV76;
  /** The staged profile under test (v8.0 harness). */
  candidate: RankingWeightsV76;
}

/** The stored `algorithm_version` the baseline must reproduce. */
export const EXPECTED_BASELINE_VERSION = "7.10";
/** D45: the largest harness rank move allowed. */
export const D45_MAX_HARNESS_SHIFT = 2;
/** A recomputed score further than this from the published one is a mismatch. */
export const SCORE_TOLERANCE = 0.001;

export const EXIT_CODES = { ok: 0, error: 1, refused: 2, d45Breach: 3, notReproduced: 4 } as const;

const REPRODUCED_FIELDS = ["score", "factor_scores"] as const;

export interface Reproduction {
  publishedVersion: string;
  versionMatches: boolean;
  toolsScored: number;
  publishedRows: number;
  onlyRecomputed: number;
  onlyPublished: number;
  scoreOrFactorDiffs: number;
  scoreOverTolerance: number;
  maxAbsScoreDiff: number;
  /** Tools whose published rank lies outside their recomputed equal-score block. */
  rankDiffs: number;
  /** Information: published rank differs but stays inside the tool's equal-score block. */
  ordinalDiffsInsideTies: number;
}

export interface ShiftStats {
  n: number;
  max: number;
  median: number;
  p95: number;
}

/** Rank-shift histogram: places moved 0, 1, 2, 3 or more. */
export interface ShiftHistogram {
  n: number;
  moved0: number;
  moved1: number;
  moved2: number;
  moved3plus: number;
  max: number;
}

export interface CandidateMeasurement {
  kindCounts: Record<string, number>;
  scoreShiftAll: ShiftStats;
  scoreShiftHarness: ShiftStats;
  /** D45 basis: harness tools ranked within the harness list. */
  harnessRankShift: ShiftHistogram;
  d45Breaches: number;
  /** Information only: harness tools on the global board. */
  harnessGlobalRankShift: ShiftHistogram;
  /** Information only: every tool on the global board. */
  globalRankShift: ShiftHistogram;
  ties: {
    distinctScores: number;
    largestBlocks: number[];
    toolsInTies: number;
    tieOrderChanges: number;
  };
  harnessGaps: { minGap: number | null; under03: number; under06: number; under10: number };
  /** Information only: twice the candidate's delta from baseline, renormalised to 1. */
  stress: { harnessRankShift: ShiftHistogram; breaches: number };
}

export interface MeasurementResult {
  reproduction: Reproduction;
  reproduced: boolean;
  /** Absent unless the baseline reproduced. */
  candidate?: CandidateMeasurement;
  engineLogLinesSuppressed: number;
  exitCode: number;
}

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug"] as const;

/** Run `fn` with console output swallowed; returns its result and the line count. */
function quietly<T>(fn: () => T): { value: T; lines: number } {
  const saved = CONSOLE_METHODS.map((m) => console[m]);
  let lines = 0;
  for (const m of CONSOLE_METHODS) console[m] = () => void lines++;
  try {
    return { value: fn(), lines };
  } finally {
    CONSOLE_METHODS.forEach((m, i) => (console[m] = saved[i]!));
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]!;
}

export function shiftStats(values: number[]): ShiftStats {
  const sorted = values.map(Math.abs).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length === 0 ? 0 : sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return { n: sorted.length, max: round3(sorted.at(-1) ?? 0), median: round3(median), p95: round3(percentile(sorted, 0.95)) };
}

export function shiftHistogram(shifts: number[]): ShiftHistogram {
  const abs = shifts.map(Math.abs);
  return {
    n: abs.length,
    moved0: abs.filter((s) => s === 0).length,
    moved1: abs.filter((s) => s === 1).length,
    moved2: abs.filter((s) => s === 2).length,
    moved3plus: abs.filter((s) => s >= 3).length,
    max: abs.reduce((a, b) => Math.max(a, b), 0),
  };
}

function rankMap(entries: RankingEntry[]): Map<string, number> {
  return new Map(entries.map((e) => [e.tool_id, e.rank]));
}

function shiftsBetween(before: Map<string, number>, after: Map<string, number>, ids: string[]): number[] {
  return ids.map((id) => after.get(id)! - before.get(id)!);
}

/** Each tool's equal-score block on a board, as the rank range it occupies. */
function tieRanges(entries: RankingEntry[]): Map<string, { first: number; last: number }> {
  const scores = entries.map((e) => e.score);
  return new Map(
    entries.map((e) => {
      const first = 1 + scores.filter((s) => s > e.score).length;
      return [e.tool_id, { first, last: first + scores.filter((s) => s === e.score).length - 1 }];
    })
  );
}

/** Stored rows' `tool_id -> score`, `tool_id -> rank` (rank falls back to `position`). */
function publishedMaps(rows: SnapshotRow[]): { scores: Map<string, number>; ranks: Map<string, number> } {
  const scores = new Map<string, number>();
  const ranks = new Map<string, number>();
  for (const row of rows) {
    const id = String(row["tool_id"]);
    scores.set(id, Number(row["score"]));
    ranks.set(id, Number(row["rank"] ?? row["position"]));
  }
  return { scores, ranks };
}

function checkReproduction(input: MeasureInput, recomputed: RankingEntry[]): Reproduction {
  const { published } = input;
  const diffs = diffSnapshots(recomputed as unknown as SnapshotRow[], published.rows, REPRODUCED_FIELDS);
  const pub = publishedMaps(published.rows);
  const mine = new Map(recomputed.map((e) => [e.tool_id, e.score]));
  const common = [...mine.keys()].filter((id) => pub.scores.has(id));

  const absDiffs = common.map((id) => Math.abs(mine.get(id)! - pub.scores.get(id)!));
  // Rows with equal scores keep input order, and the read order of `tools` is not
  // fixed, so a published rank may differ inside its equal-score block only.
  const myRanks = rankMap(recomputed);
  const blocks = tieRanges(recomputed);
  const moved = common.filter((id) => myRanks.get(id) !== pub.ranks.get(id));
  const insideBlock = (id: string) => {
    const block = blocks.get(id)!;
    const rank = pub.ranks.get(id)!;
    return mine.get(id) === pub.scores.get(id) && rank >= block.first && rank <= block.last;
  };

  return {
    publishedVersion: published.algorithmVersion,
    versionMatches: published.algorithmVersion === EXPECTED_BASELINE_VERSION,
    toolsScored: recomputed.length,
    publishedRows: published.rows.length,
    onlyRecomputed: diffs.filter((d) => d.kind === "only-left").length,
    onlyPublished: diffs.filter((d) => d.kind === "only-right").length,
    scoreOrFactorDiffs: diffs.filter((d) => d.kind === "changed").length,
    scoreOverTolerance: absDiffs.filter((d) => d > SCORE_TOLERANCE).length,
    maxAbsScoreDiff: round3(absDiffs.reduce((a, b) => Math.max(a, b), 0)),
    rankDiffs: moved.filter((id) => !insideBlock(id)).length,
    ordinalDiffsInsideTies: moved.filter(insideBlock).length,
  };
}

/** True only when every hard reproduction check is zero. Ordinal moves inside ties are information. */
export function isReproduced(r: Reproduction): boolean {
  return (
    r.versionMatches &&
    r.toolsScored > 0 &&
    r.onlyRecomputed === 0 &&
    r.onlyPublished === 0 &&
    r.scoreOrFactorDiffs === 0 &&
    r.scoreOverTolerance === 0 &&
    r.rankDiffs === 0
  );
}

/** Twice the candidate's per-factor delta from baseline, scaled to sum to 1. */
export function doubledDelta(baseline: RankingWeightsV76, candidate: RankingWeightsV76): RankingWeightsV76 {
  const keys = Object.keys(candidate) as (keyof RankingWeightsV76)[];
  const raw = keys.map((k) => [k, Math.max(0, 2 * candidate[k] - baseline[k])] as const);
  const total = raw.reduce((sum, [, w]) => sum + w, 0);
  return Object.fromEntries(raw.map(([k, w]) => [k, w / total])) as unknown as RankingWeightsV76;
}

function tieStructure(base: RankingEntry[], cand: Map<string, number>): CandidateMeasurement["ties"] {
  const blocks = new Map<number, RankingEntry[]>();
  for (const e of base) blocks.set(e.score, [...(blocks.get(e.score) ?? []), e]);
  const tied = [...blocks.values()].filter((b) => b.length > 1);
  let changes = 0;
  for (const block of tied) {
    const byCandidate = [...block].sort((a, b) => cand.get(a.tool_id)! - cand.get(b.tool_id)!);
    changes += block.filter((e, i) => byCandidate[i]!.tool_id !== e.tool_id).length;
  }
  return {
    distinctScores: blocks.size,
    largestBlocks: tied.map((b) => b.length).sort((a, b) => b - a).slice(0, 5),
    toolsInTies: tied.reduce((n, b) => n + b.length, 0),
    tieOrderChanges: changes,
  };
}

function harnessGaps(harnessBase: RankingEntry[]): CandidateMeasurement["harnessGaps"] {
  const distinct = [...new Set(harnessBase.map((e) => e.score))].sort((a, b) => b - a);
  const gaps = distinct.slice(1).map((s, i) => round3(distinct[i]! - s));
  return {
    minGap: gaps.length > 0 ? Math.min(...gaps) : null,
    under03: gaps.filter((g) => g < 0.3).length,
    under06: gaps.filter((g) => g < 0.6).length,
    under10: gaps.filter((g) => g < 1.0).length,
  };
}

function withinHarness(harness: MeasuredTool[], date: Date, before: Map<string, number>, weights: RankingWeightsV76) {
  const after = rankMap(computeRankings(harness, new Map(), date, weights));
  const histogram = shiftHistogram(shiftsBetween(before, after, harness.map((t) => t.id)));
  return { histogram, breaches: histogram.n - histogram.moved0 - histogram.moved1 - histogram.moved2 };
}

function measureCandidate(input: MeasureInput, base: RankingEntry[]): CandidateMeasurement {
  const { tools, published, baseline, candidate } = input;
  const date = published.publishedAt;
  const harness = tools.filter((t) => t.kind === "harness");
  const harnessIds = harness.map((t) => t.id);
  const allIds = tools.map((t) => t.id);

  const cand = computeRankings(tools, new Map(), date, candidate);
  const baseRanks = rankMap(base);
  const candRanks = rankMap(cand);
  const baseScores = new Map(base.map((e) => [e.tool_id, e.score]));
  const candScores = new Map(cand.map((e) => [e.tool_id, e.score]));
  const scoreShift = (ids: string[]) => shiftStats(ids.map((id) => candScores.get(id)! - baseScores.get(id)!));

  // D2e: harness ranks are counted within the harness list, scored on their own.
  const harnessBase = computeRankings(harness, new Map(), date, baseline);
  const harnessBaseRanks = rankMap(harnessBase);
  const d45 = withinHarness(harness, date, harnessBaseRanks, candidate);
  const stress = withinHarness(harness, date, harnessBaseRanks, doubledDelta(baseline, candidate));

  const kindCounts: Record<string, number> = {};
  for (const t of tools) kindCounts[t.kind] = (kindCounts[t.kind] ?? 0) + 1;

  return {
    kindCounts,
    scoreShiftAll: scoreShift(allIds),
    scoreShiftHarness: scoreShift(harnessIds),
    harnessRankShift: d45.histogram,
    d45Breaches: d45.breaches,
    harnessGlobalRankShift: shiftHistogram(shiftsBetween(baseRanks, candRanks, harnessIds)),
    globalRankShift: shiftHistogram(shiftsBetween(baseRanks, candRanks, allIds)),
    ties: tieStructure(base, candRanks),
    harnessGaps: harnessGaps(harnessBase),
    stress: { harnessRankShift: stress.histogram, breaches: stress.breaches },
  };
}

/**
 * Reproduce v7.10, then (only if it reproduced) measure the candidate.
 *
 * Postcondition: `exitCode` is `notReproduced` whenever `reproduced` is false,
 * and then `candidate` is absent; otherwise it is `d45Breach` exactly when
 * `candidate.d45Breaches > 0`, else `ok`.
 */
export function measureBoard(input: MeasureInput): MeasurementResult {
  const run = quietly(() => {
    const base = computeRankings(input.tools, new Map(), input.published.publishedAt, input.baseline);
    const reproduction = checkReproduction(input, base);
    const reproduced = isReproduced(reproduction);
    return { reproduction, reproduced, candidate: reproduced ? measureCandidate(input, base) : undefined };
  });
  const { reproduction, reproduced, candidate } = run.value;
  const exitCode = !reproduced
    ? EXIT_CODES.notReproduced
    : candidate!.d45Breaches > 0
      ? EXIT_CODES.d45Breach
      : EXIT_CODES.ok;
  return { reproduction, reproduced, ...(candidate ? { candidate } : {}), engineLogLinesSuppressed: run.lines, exitCode };
}

function histogramLine(label: string, h: ShiftHistogram): string {
  return `${label}: n=${h.n}, moved 0/1/2/3+ = ${h.moved0}/${h.moved1}/${h.moved2}/${h.moved3plus}, max ${h.max}`;
}

function statsLine(label: string, s: ShiftStats): string {
  return `${label}: n=${s.n}, max ${s.max.toFixed(3)}, median ${s.median.toFixed(3)}, p95 ${s.p95.toFixed(3)}`;
}

/** Counts-only report (D19). Prints no tool name, slug, id or per-tool score. */
export function formatMeasurementReport(result: MeasurementResult): string {
  const r = result.reproduction;
  const lines = [
    `Result: ${result.exitCode === EXIT_CODES.ok ? "PASS" : result.reproduced ? "FAIL (D45 breach)" : "FAIL (v7.10 not reproduced)"}`,
    "",
    "1. v7.10 reproduction (hard gate)",
    `published algorithm_version: ${r.publishedVersion} (expected ${EXPECTED_BASELINE_VERSION}: ${r.versionMatches ? "yes" : "NO"})`,
    `tools scored: ${r.toolsScored}; published rows: ${r.publishedRows}`,
    `only recomputed: ${r.onlyRecomputed}; only published: ${r.onlyPublished}`,
    `score or factor differences: ${r.scoreOrFactorDiffs}; score off by > ${SCORE_TOLERANCE}: ${r.scoreOverTolerance}; max abs score difference ${r.maxAbsScoreDiff.toFixed(3)}`,
    `rank differences: ${r.rankDiffs}; rank differences inside equal-score blocks (information): ${r.ordinalDiffsInsideTies}`,
    `reproduced: ${result.reproduced ? "yes" : "NO"}`,
  ];
  const c = result.candidate;
  if (!c) {
    lines.push("", "No candidate measurement: the v7.10 baseline did not reproduce.");
  } else {
    lines.push(
      "",
      "2. Tools by kind",
      Object.entries(c.kindCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, n]) => `${k} ${n}`)
        .join(", "),
      "",
      "3. Score shift, candidate minus v7.10 (absolute points)",
      statsLine("all tools", c.scoreShiftAll),
      statsLine("harness", c.scoreShiftHarness),
      "",
      `4. Rank shift (D45 gate: harness rank within the harness list, max ${D45_MAX_HARNESS_SHIFT} places)`,
      histogramLine("harness within harness list (gate)", c.harnessRankShift),
      `D45 breaches: ${c.d45Breaches}`,
      histogramLine("harness on the global board (information)", c.harnessGlobalRankShift),
      histogramLine("all tools on the global board (information)", c.globalRankShift),
      "",
      "5. Ties (v7.10 global board)",
      `distinct scores: ${c.ties.distinctScores}; largest tied blocks: ${c.ties.largestBlocks.join(", ") || "none"}; tools in tied blocks: ${c.ties.toolsInTies}; change order under candidate: ${c.ties.tieOrderChanges}`,
      "",
      "6. Harness adjacent-score gaps (v7.10)",
      `smallest gap: ${c.harnessGaps.minGap === null ? "n/a" : c.harnessGaps.minGap.toFixed(3)}; gaps under 0.3 / 0.6 / 1.0: ${c.harnessGaps.under03} / ${c.harnessGaps.under06} / ${c.harnessGaps.under10}`,
      "",
      "7. Stress: twice the candidate delta, renormalised (information)",
      histogramLine("harness within harness list", c.stress.harnessRankShift),
      `breaches at stress: ${c.stress.breaches}`
    );
  }
  lines.push("", `engine log lines suppressed: ${result.engineLogLinesSuppressed}`);
  return lines.join("\n");
}
