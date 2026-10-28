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
 *   mismatch stops it there: no candidate number is computed. It then checks
 *   the harness list (at least `HARNESS_FLOOR` harness tools, known kinds
 *   only, not every tool harness) and stops if that fails. Otherwise it
 *   scores the candidate set through its kind routing (PR-2: a harness with
 *   the harness profile, a model with the model profile) and returns counts
 *   and shift statistics. The D45 gate ranks harness tools within the harness
 *   list (basis D2e); global rank shift and the models-only rank shift (model
 *   rank within the model list) are information only. Baseline positions are the published
 *   ranks renumbered within each list; candidate ties rank by published v7.10
 *   position (D8f, `v8TieOrder()`). Engine console output, which names tools,
 *   is swallowed while it runs and only counted.
 *   The harness list leaves out tools the kind sheet marks retired, and the
 *   result lists active tools missing from the sheet (ruling 12:33Z).
 *   `formatMeasurementReport()` renders the result as text that names no slug,
 *   id, rank or per-tool score; tool names appear only in its closing private
 *   section of tools missing from the sheet. `candidate.perTool` holds one
 *   row per tool from the same rank and score maps, for the private D8b
 *   table (`lib/v8-board-measurement-per-tool.ts`), which this report never prints.
 * Test: `lib/v8-board-measurement.test.ts`, `lib/v8-board-measurement-per-tool.test.ts`
 */

import { TOOL_KINDS } from "./db/schema";
import type { KindSheetRow } from "./db/tool-kind-sheet";
import type { RankingWeightsV76 } from "./ranking-algorithm-v76";
import { diffSnapshots, type SnapshotRow } from "./ranking-snapshot-diff";
import {
  computeRankings,
  type KindWeightRouting,
  type RankingEntry,
  type RankingSourceTool,
} from "./services/ranking-generation.service";
import { perToolRows, type PerToolRow } from "./v8-board-measurement-per-tool";
import { v8TieOrder } from "./v8-tie-order";

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
  /** #185 PR-2: the staged set under test (v8.0), routed by kind (`profileRouting()`). */
  candidate: KindWeightRouting;
  /** Fewest harness tools the D45 gate accepts. Default {@link HARNESS_FLOOR}; tests lower it. */
  harnessFloor?: number;
  /** #185: the reviewed kind sheet (`docs/refresh/tool-kind-mapping.csv`), by slug. */
  sheet: KindSheetView;
}

/** #185: the kind sheet as the measurement needs it. */
export interface KindSheetView {
  slugs: ReadonlySet<string>;
  retiredSlugs: ReadonlySet<string>;
}

/** #185: build the view from parsed sheet rows (`parseKindSheet`). */
export function kindSheetView(rows: readonly KindSheetRow[]): KindSheetView {
  return {
    slugs: new Set(rows.map((r) => r.slug)),
    retiredSlugs: new Set(rows.filter((r) => r.retired).map((r) => r.slug)),
  };
}

/**
 * #185 (Architect ruling 12:33Z): active tools the sheet does not list. Their
 * names are the one tool-identifying output, printed in a private section and
 * never with a score, rank or factor value.
 */
export interface SheetCoverage {
  notInSheetNames: string[];
  /** Active harness tools the sheet marks retired: the ones left out of the D45 harness list. */
  retiredHarnessActive: number;
  /** Information: active tools of any kind the sheet marks retired. */
  retiredActiveAllKinds: number;
}

/** Header of the only report section that may carry tool names. */
export const PRIVATE_SECTION_HEADER = "Tools not in the kind sheet (private — do not post)";

/** The stored `algorithm_version` the baseline must reproduce. */
export const EXPECTED_BASELINE_VERSION = "7.10";
/** D45: the largest harness rank move allowed. */
export const D45_MAX_HARNESS_SHIFT = 2;
/** A recomputed score further than this from the published one is a mismatch. */
export const SCORE_TOLERANCE = 0.001;
/**
 * #185: the D45 gate refuses a harness list shorter than this. It is the count
 * of non-retired harness rows in `docs/refresh/tool-kind-mapping.csv`: 65
 * harness rows minus 1 retired = 64 (66 until #314: migration 0028 moves
 * claude-artifacts and openclaw, and openclaw's retired aliases, to productivity; Architect ruling 12:16Z). A shorter list
 * means the board changed since that review, or the kinds are wrong, and must
 * be looked at before D45 can be cleared on it. Tools outside the sheet, which
 * keep the column default `harness`, are not counted: the floor is a minimum,
 * so they can only add to the list. Retiring or adding a harness tool means
 * updating the sheet and this floor together.
 */
export const HARNESS_FLOOR = 64;
/** `tools.kind` values the D45 gate accepts (CHECK `tools_kind_check`). */
export const KNOWN_KINDS: readonly string[] = TOOL_KINDS;

export const EXIT_CODES = { ok: 0, error: 1, refused: 2, d45Breach: 3, notReproduced: 4, harnessCheck: 5 } as const;

const REPRODUCED_FIELDS = ["score", "factor_scores"] as const;

/**
 * #185: a published rank that differs from the recomputed one inside an
 * equal-score block. D19: it names no tool, slug, id or score, only which
 * block (1 = the highest-ranked tied block), its size, and the tool's
 * position inside it (1-based) as published and as recomputed.
 */
export interface TieSwap {
  block: number;
  blockSize: number;
  publishedPosition: number;
  recomputedPosition: number;
}

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
  /** #185: one anonymous entry per tie swap counted in `ordinalDiffsInsideTies`. */
  tieSwaps: TieSwap[];
  /** #185: published rows beyond the first for a `tool_id` (a Map would hide them). */
  duplicatePublishedIds: number;
  /** #185: published rows sharing a rank with a row of a different score. */
  duplicatePublishedRanksOutsideTies: number;
}

/** #185: the harness list the D45 gate ranks. It must be checkable before PASS can print. */
export interface HarnessCheck {
  /** Harness tools not marked retired in the kind sheet: the D45 list. */
  harnessTools: number;
  floor: number;
  /** Tools whose `kind` is not a known kind (an unmigrated column reads as "null"). */
  unknownKinds: number;
  /** True when every tool is harness: the 0016 default, so the 0017 kinds are not applied. */
  allHarness: boolean;
  ok: boolean;
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
  /** #185 PR-2, information only: model tools (retired excluded) ranked within the model list. */
  models: { scoreShift: ShiftStats; rankShift: ShiftHistogram };
  ties: {
    distinctScores: number;
    largestBlocks: number[];
    toolsInTies: number;
    tieOrderChanges: number;
  };
  harnessGaps: { minGap: number | null; under03: number; under06: number; under10: number };
  /** #185: harness tools in a block of equal published scores within the harness list. */
  harnessToolsInTies: number;
  /** Information only: twice the candidate's delta from baseline, renormalised to 1. */
  stress: { harnessRankShift: ShiftHistogram; breaches: number };
  /** D8b: one row per tool, built from the maps above; printed only behind `--per-tool`. */
  perTool: PerToolRow[];
}

export interface MeasurementResult {
  reproduction: Reproduction;
  reproduced: boolean;
  sheet: SheetCoverage;
  /** Absent when the baseline did not reproduce (the harness list is not checked then). */
  harness?: HarnessCheck;
  /** Absent unless the baseline reproduced and the harness list passed its check. */
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

/** #185: duplicate ids, and duplicate ranks across different scores, in the raw published rows. */
function publishedDuplicates(rows: SnapshotRow[]) {
  const ids = rows.map((row) => String(row["tool_id"]));
  const byRank = new Map<number, Set<number>>();
  const rankRows = new Map<number, number>();
  for (const row of rows) {
    const rank = Number(row["rank"] ?? row["position"]);
    byRank.set(rank, (byRank.get(rank) ?? new Set()).add(Number(row["score"])));
    rankRows.set(rank, (rankRows.get(rank) ?? 0) + 1);
  }
  const clashing = [...rankRows].filter(([rank, n]) => n > 1 && byRank.get(rank)!.size > 1);
  return {
    duplicatePublishedIds: ids.length - new Set(ids).size,
    duplicatePublishedRanksOutsideTies: clashing.reduce((sum, [, n]) => sum + n, 0),
  };
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
  // #185: number the tied blocks from the top, so each swap is logged by block, not by tool.
  const tiedFirsts = [...new Set([...blocks.values()].filter((b) => b.last > b.first).map((b) => b.first))].sort(
    (a, b) => a - b
  );
  const tieSwaps: TieSwap[] = moved
    .filter(insideBlock)
    .map((id) => {
      const { first, last } = blocks.get(id)!;
      return {
        block: tiedFirsts.indexOf(first) + 1,
        blockSize: last - first + 1,
        publishedPosition: pub.ranks.get(id)! - first + 1,
        recomputedPosition: myRanks.get(id)! - first + 1,
      };
    })
    .sort((a, b) => a.block - b.block || a.publishedPosition - b.publishedPosition);

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
    ordinalDiffsInsideTies: tieSwaps.length,
    tieSwaps,
    ...publishedDuplicates(published.rows),
  };
}

/** True only when every hard reproduction check is zero. Ordinal moves inside ties are information. */
export function isReproduced(r: Reproduction): boolean {
  return (
    r.versionMatches &&
    r.toolsScored > 0 &&
    // #185: a duplicated published row collapses in any id-keyed comparison, so count rows.
    r.publishedRows === r.toolsScored &&
    r.duplicatePublishedIds === 0 &&
    r.duplicatePublishedRanksOutsideTies === 0 &&
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

/** #185: renumber `ids` 1..n in their published order (ties keep the published order, never the read order). */
function publishedOrder(ids: string[], published: Map<string, number>): Map<string, number> {
  const ordered = [...ids].sort((a, b) => published.get(a)! - published.get(b)!);
  return new Map(ordered.map((id, i) => [id, i + 1]));
}

/** #185: rank `list` on its own and histogram each tool's move from `before`. */
function withinList(
  list: MeasuredTool[],
  date: Date,
  before: Map<string, number>,
  scoring: RankingWeightsV76 | KindWeightRouting,
  v710: Map<string, number>
) {
  // D8f: break v8 ties by published v7.10 position
  const after = rankMap(computeRankings(v8TieOrder(list, v710), new Map(), date, scoring));
  const histogram = shiftHistogram(shiftsBetween(before, after, list.map((t) => t.id)));
  return { histogram, breaches: histogram.n - histogram.moved0 - histogram.moved1 - histogram.moved2, after };
}

/** #185: tools of one kind, not retired in the sheet. */
function kindList(tools: MeasuredTool[], sheet: KindSheetView, kind: string): MeasuredTool[] {
  return tools.filter((t) => t.kind === kind && !sheet.retiredSlugs.has(t.slug));
}

/** #185: the D45 harness list: harness kind, not retired in the sheet (as the floor counts it). */
export function d45HarnessList(tools: MeasuredTool[], sheet: KindSheetView): MeasuredTool[] {
  return kindList(tools, sheet, "harness");
}

/** #185: the harness list must be non-trivial and the kinds applied, or D45 proves nothing. */
export function checkHarness(tools: MeasuredTool[], sheet: KindSheetView, floor = HARNESS_FLOOR): HarnessCheck {
  const harnessTools = d45HarnessList(tools, sheet).length;
  const unknownKinds = tools.filter((t) => !KNOWN_KINDS.includes(t.kind)).length;
  const allHarness = tools.length > 0 && tools.every((t) => t.kind === "harness");
  return {
    harnessTools,
    floor,
    unknownKinds,
    allHarness,
    ok: harnessTools > 0 && harnessTools >= floor && unknownKinds === 0 && !allHarness,
  };
}

function measureCandidate(input: MeasureInput, base: RankingEntry[]): CandidateMeasurement {
  const { tools, published, baseline, candidate } = input;
  const date = published.publishedAt;
  // #185: retired sheet rows are out of the harness list for v7.10 and the candidate alike.
  const harness = d45HarnessList(tools, input.sheet);
  const harnessIds = harness.map((t) => t.id);
  const allIds = tools.map((t) => t.id);

  // #185: v7.10 positions are the published ranks; the recomputed order of equal
  // scores follows the unordered SELECT and is never used as the baseline.
  const pub = publishedMaps(published.rows);
  const baseRanks = publishedOrder(allIds, pub.ranks);
  // D8f: break v8 ties by published v7.10 position
  const cand = computeRankings(v8TieOrder(tools, pub.ranks), new Map(), date, candidate);
  const candRanks = rankMap(cand);
  const baseScores = new Map(base.map((e) => [e.tool_id, e.score]));
  const candScores = new Map(cand.map((e) => [e.tool_id, e.score]));
  const scoreShift = (ids: string[]) => shiftStats(ids.map((id) => candScores.get(id)! - baseScores.get(id)!));

  // D2e: harness ranks are counted within the harness list.
  const harnessBaseRanks = publishedOrder(harnessIds, pub.ranks);
  const d45 = withinList(harness, date, harnessBaseRanks, candidate, pub.ranks);
  const stress = withinList(
    harness,
    date,
    harnessBaseRanks,
    doubledDelta(baseline, candidate.route("harness").weights),
    pub.ranks
  );
  // #185 PR-2: the model list, the same way (information only; D45 does not cover it).
  const models = kindList(tools, input.sheet, "model");
  const modelIds = models.map((t) => t.id);
  const modelShift = withinList(models, date, publishedOrder(modelIds, pub.ranks), candidate, pub.ranks);

  const inPublishedOrder = [...base].sort((a, b) => baseRanks.get(a.tool_id)! - baseRanks.get(b.tool_id)!);
  const harnessBase = inPublishedOrder.filter((e) => harnessBaseRanks.has(e.tool_id));
  const harnessScoreCounts = new Map<number, number>();
  for (const e of harnessBase) harnessScoreCounts.set(e.score, (harnessScoreCounts.get(e.score) ?? 0) + 1);

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
    models: { scoreShift: scoreShift(modelIds), rankShift: modelShift.histogram },
    ties: tieStructure(inPublishedOrder, candRanks),
    harnessGaps: harnessGaps(harnessBase),
    harnessToolsInTies: harnessBase.filter((e) => harnessScoreCounts.get(e.score)! > 1).length,
    stress: { harnessRankShift: stress.histogram, breaches: stress.breaches },
    // D8b: private per-tool table for Bob's D4d sign-off (the same maps, no second ranking)
    perTool: perToolRows({
      tools, baseRanks, candRanks, baseScores, candScores, harnessBaseRanks,
      harnessCandRanks: d45.after, maxHarnessShift: D45_MAX_HARNESS_SHIFT,
    }),
  };
}

/**
 * Reproduce v7.10, check the harness list, then measure the candidate.
 *
 * Postcondition: `exitCode` is `notReproduced` whenever `reproduced` is false;
 * else `harnessCheck` when `harness.ok` is false; in both cases `candidate`
 * is absent. Otherwise it is `d45Breach` exactly when `candidate.d45Breaches > 0`,
 * else `ok`.
 */
export function measureBoard(input: MeasureInput): MeasurementResult {
  const run = quietly(() => {
    const base = computeRankings(input.tools, new Map(), input.published.publishedAt, input.baseline);
    const reproduction = checkReproduction(input, base);
    const reproduced = isReproduced(reproduction);
    const harness = reproduced ? checkHarness(input.tools, input.sheet, input.harnessFloor) : undefined;
    const candidate = harness?.ok ? measureCandidate(input, base) : undefined;
    return { reproduction, reproduced, harness, candidate };
  });
  const { reproduction, reproduced, harness, candidate } = run.value;
  const sheet: SheetCoverage = {
    notInSheetNames: input.tools.filter((t) => !input.sheet.slugs.has(t.slug)).map((t) => t.name).sort(),
    // #185: only harness rows leave the D45 list; other retired kinds are counted apart.
    retiredHarnessActive: input.tools.filter((t) => t.kind === "harness" && input.sheet.retiredSlugs.has(t.slug)).length,
    retiredActiveAllKinds: input.tools.filter((t) => input.sheet.retiredSlugs.has(t.slug)).length,
  };
  const exitCode = !reproduced
    ? EXIT_CODES.notReproduced
    : !harness!.ok
      ? EXIT_CODES.harnessCheck
      : candidate!.d45Breaches > 0
        ? EXIT_CODES.d45Breach
        : EXIT_CODES.ok;
  return {
    reproduction,
    reproduced,
    sheet,
    ...(harness ? { harness } : {}),
    ...(candidate ? { candidate } : {}),
    engineLogLinesSuppressed: run.lines,
    exitCode,
  };
}

function resultLabel(result: MeasurementResult): string {
  if (result.exitCode === EXIT_CODES.ok) return "PASS";
  if (!result.reproduced) return "FAIL (v7.10 not reproduced)";
  if (result.exitCode === EXIT_CODES.harnessCheck) return "FAIL (harness list check)";
  return "FAIL (D45 breach)";
}

function histogramLine(label: string, h: ShiftHistogram): string {
  return `${label}: n=${h.n}, moved 0/1/2/3+ = ${h.moved0}/${h.moved1}/${h.moved2}/${h.moved3plus}, max ${h.max}`;
}

function statsLine(label: string, s: ShiftStats): string {
  return `${label}: n=${s.n}, max ${s.max.toFixed(3)}, median ${s.median.toFixed(3)}, p95 ${s.p95.toFixed(3)}`;
}

/**
 * Counts-only report (D19). Prints no slug, id, rank or per-tool score, and no
 * tool name except in the closing private section (`PRIVATE_SECTION_HEADER`).
 */
export function formatMeasurementReport(result: MeasurementResult): string {
  const r = result.reproduction;
  const lines = [
    `Result: ${resultLabel(result)}`,
    "",
    "1. v7.10 reproduction (hard gate)",
    `published algorithm_version: ${r.publishedVersion} (expected ${EXPECTED_BASELINE_VERSION}: ${r.versionMatches ? "yes" : "NO"})`,
    `tools scored: ${r.toolsScored}; published rows: ${r.publishedRows}`,
    `only recomputed: ${r.onlyRecomputed}; only published: ${r.onlyPublished}`,
    `score or factor differences: ${r.scoreOrFactorDiffs}; score off by > ${SCORE_TOLERANCE}: ${r.scoreOverTolerance}; max abs score difference ${r.maxAbsScoreDiff.toFixed(3)}`,
    `rank differences: ${r.rankDiffs}; rank differences inside equal-score blocks (information): ${r.ordinalDiffsInsideTies}`,
    // #185: each counted tie swap, anonymous (block, size, positions inside the block).
    ...r.tieSwaps.map(
      (s) =>
        `  tie swap: block ${s.block} (size ${s.blockSize}), published position ${s.publishedPosition}, recomputed position ${s.recomputedPosition}`
    ),
    `duplicate published tool ids: ${r.duplicatePublishedIds}; duplicate published ranks across different scores: ${r.duplicatePublishedRanksOutsideTies}`,
    `reproduced: ${result.reproduced ? "yes" : "NO"}`,
  ];
  const h = result.harness;
  if (h) {
    lines.push(
      "",
      "1b. Harness list check",
      `harness tools (retired in the sheet excluded): ${h.harnessTools} (floor ${h.floor}); unknown kinds: ${h.unknownKinds}; every tool harness: ${h.allHarness ? "YES" : "no"}; ok: ${h.ok ? "yes" : "NO"}`
    );
  }
  const c = result.candidate;
  if (!c) {
    lines.push(
      "",
      result.reproduced
        ? "No candidate measurement: the harness list failed its check."
        : "No candidate measurement: the v7.10 baseline did not reproduce."
    );
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
      statsLine("models (retired excluded), score shift (information)", c.models.scoreShift),
      histogramLine("models within the model list (information)", c.models.rankShift),
      "",
      "5. Ties (v7.10 global board)",
      `harness tools in equal-score blocks within the harness list: ${c.harnessToolsInTies}`,
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
  lines.push(
    "",
    `active harness tools retired in the kind sheet (left out of the harness list): ${result.sheet.retiredHarnessActive}`,
    `active tools of any kind retired in the kind sheet (information): ${result.sheet.retiredActiveAllKinds}`,
    `engine log lines suppressed: ${result.engineLogLinesSuppressed}`,
    "",
    // #185 (ruling 12:33Z): the one place a tool name may appear; names only, last.
    PRIVATE_SECTION_HEADER,
    `count: ${result.sheet.notInSheetNames.length}`,
    ...result.sheet.notInSheetNames.map((name) => `- ${name}`)
  );
  return lines.join("\n");
}
