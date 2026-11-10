/**
 * Point-in-time off/on compare of the per-list boards (#95, PR A of the steps 7-9 plan).
 *
 * Why: passing `usePointInTimeMetrics: true` on the cron publish changes live scores
 *   and ranks. The owner clears that switch only on measured evidence: per list, how
 *   the board moves, whether the period's history is fresh, how many tools fall back
 *   to live data, and how much of each collector part the history covers. The
 *   repository is public and the history private, so the printed summary carries
 *   aggregates only; per-tool rows appear only on request, in the JSON file.
 * What: `comparePeriod()` runs `regenerateRankings()` twice in `dry-run` mode with the
 *   per-list layout and the same port, clock, period and scoring: once with point-in-time
 *   metrics off and once on. A dry-run calls no write method. `diffListBoards()` (pure)
 *   turns the two boards of one list into rank/score/top-10 aggregates.
 *   `renderCompareSummary()` prints only those aggregates and counts, never a tool name,
 *   slug, id or metric value.
 * Test: `tests/unit/point-in-time-compare-95.test.ts`
 */

import { COLLECTOR_PARTS, type CollectorPart } from "@/lib/metrics-collectors/registry";
import type { MetricsHistorySnapshot } from "@/lib/metrics-history/point-in-time";
import type { ComparePersistence, LedgerTotals } from "@/lib/rankings/point-in-time-compare-source";
import { RANKING_LISTS, type RankingList } from "@/lib/rankings/lists";
import {
  type PerListScoring,
  type RankingEntry,
  type RankingGenerationResult,
  regenerateRankings,
} from "@/lib/services/ranking-generation.service";

/** A score move at or above this many points counts as "over threshold". */
export const SCORE_DELTA_THRESHOLD = 1;
/** Size of the head of each board compared for membership and order. */
export const TOP_N = 10;

/** Rank and score aggregates of one list's off and on boards. */
export interface ListRankDiff {
  list: RankingList;
  toolsOff: number;
  toolsOn: number;
  /** Tools on both boards. */
  compared: number;
  /** Tools on one board only (a metric-gated list can change membership). */
  onlyOff: number;
  onlyOn: number;
  /** Compared tools whose rank differs. */
  moved: number;
  maxAbsRankDelta: number;
  medianAbsRankDelta: number;
  /** Compared tools whose score differs at all. */
  scoreChanged: number;
  /** Compared tools whose |score delta| >= SCORE_DELTA_THRESHOLD. */
  scoreOverThreshold: number;
  maxAbsScoreDelta: number;
  top10: {
    /** Tools in the top 10 of both boards. */
    overlap: number;
    /** In the top 10 with history on, not with it off. */
    entered: number;
    left: number;
    /** Top-10 positions held by a different tool. */
    positionChanges: number;
  };
}

/** One tool's off/on rank and score. Private history: JSON file only, on request. */
export interface ToolMove {
  slug: string;
  rankOff: number | null;
  rankOn: number | null;
  scoreOff: number | null;
  scoreOn: number | null;
}

/** Per list: the rank diff plus history fallback and per-part coverage among the list's tools. */
export interface ListCompare extends ListRankDiff {
  /** Tools on the on-board scored live because they have no history at or before the period. */
  fallbackTools: number;
  /** Per part, tools on the on-board with a history leaf set for that part. */
  historyCoverage: Record<CollectorPart, number>;
}

/** Aggregates of one period's compare. Contains no tool identity and no metric value. */
export interface PeriodCompare {
  period: string;
  clock: string;
  profileSet: string;
  algorithmVersion: string;
  freshness: { status: string; latestCollectedDate: string | null; reason: string | null };
  pointInTime: { applied: boolean; snapshotTools: number; fallbackTools: number; skippedLeaves: number };
  /** Ledger totals per part for the newest collection day at or before the period. */
  ledger: { collectedDate: string | null; parts: Record<CollectorPart, Omit<LedgerTotals, "collector">> };
  lists: ListCompare[];
}

export interface PeriodCompareResult {
  aggregate: PeriodCompare;
  /** Per list, every tool's move. Private; never printed. */
  tools: Record<RankingList, ToolMove[]>;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const round = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * PURE: aggregates of one list's off and on boards, matched by `tool_id`.
 *
 * Postcondition: `compared + onlyOff = off.length`, `compared + onlyOn = on.length`,
 * `moved <= compared`, and identical boards give zero for every move and change count.
 */
export function diffListBoards(
  list: RankingList,
  off: readonly RankingEntry[],
  on: readonly RankingEntry[]
): { diff: ListRankDiff; tools: ToolMove[] } {
  const onById = new Map(on.map((row) => [row.tool_id, row]));
  const offIds = new Set(off.map((row) => row.tool_id));
  const rankDeltas: number[] = [];
  let scoreChanged = 0;
  let scoreOverThreshold = 0;
  let maxAbsScoreDelta = 0;
  const tools: ToolMove[] = [];

  for (const row of off) {
    const other = onById.get(row.tool_id);
    tools.push({
      slug: row.tool_slug,
      rankOff: row.rank,
      rankOn: other?.rank ?? null,
      scoreOff: row.score,
      scoreOn: other?.score ?? null,
    });
    if (!other) continue;
    rankDeltas.push(Math.abs(other.rank - row.rank));
    const scoreDelta = Math.abs(other.score - row.score);
    if (scoreDelta > 0) scoreChanged++;
    if (scoreDelta >= SCORE_DELTA_THRESHOLD) scoreOverThreshold++;
    maxAbsScoreDelta = Math.max(maxAbsScoreDelta, scoreDelta);
  }
  for (const row of on) {
    if (!offIds.has(row.tool_id)) {
      tools.push({ slug: row.tool_slug, rankOff: null, rankOn: row.rank, scoreOff: null, scoreOn: row.score });
    }
  }

  const head = (rows: readonly RankingEntry[]) => [...rows].sort((a, b) => a.rank - b.rank).slice(0, TOP_N);
  const topOff = head(off).map((row) => row.tool_id);
  const topOn = head(on).map((row) => row.tool_id);
  const topOffSet = new Set(topOff);
  const topOnSet = new Set(topOn);
  const overlap = topOn.filter((id) => topOffSet.has(id)).length;
  let positionChanges = 0;
  for (let i = 0; i < Math.max(topOff.length, topOn.length); i++) {
    if (topOff[i] !== topOn[i]) positionChanges++;
  }

  const compared = rankDeltas.length;
  return {
    diff: {
      list,
      toolsOff: off.length,
      toolsOn: on.length,
      compared,
      onlyOff: off.length - compared,
      onlyOn: on.length - compared,
      moved: rankDeltas.filter((d) => d > 0).length,
      maxAbsRankDelta: rankDeltas.length > 0 ? Math.max(...rankDeltas) : 0,
      medianAbsRankDelta: median(rankDeltas),
      scoreChanged,
      scoreOverThreshold,
      maxAbsScoreDelta: round(maxAbsScoreDelta),
      top10: {
        overlap,
        entered: topOn.filter((id) => !topOffSet.has(id)).length,
        left: topOff.filter((id) => !topOnSet.has(id)).length,
        positionChanges,
      },
    },
    tools: tools.sort((a, b) => (a.rankOn ?? Infinity) - (b.rankOn ?? Infinity)),
  };
}

/** The rows of each list board of a per-list result (`entries` is the boards' rows in board order). */
export function entriesByList(result: RankingGenerationResult): Map<string, RankingEntry[]> {
  const byList = new Map<string, RankingEntry[]>();
  let offset = 0;
  for (const board of result.boards) {
    byList.set(board.list, result.entries.slice(offset, offset + board.toolCount));
    offset += board.toolCount;
  }
  if (offset !== result.entries.length) {
    throw new Error("per-list result rows do not match its board counts");
  }
  return byList;
}

function emptyParts<T>(make: () => T): Record<CollectorPart, T> {
  return Object.fromEntries(COLLECTOR_PARTS.map((part) => [part, make()])) as Record<CollectorPart, T>;
}

function historyCoverage(
  rows: readonly RankingEntry[],
  history: ReadonlyMap<string, MetricsHistorySnapshot>
): Record<CollectorPart, number> {
  const coverage = emptyParts(() => 0);
  for (const row of rows) {
    const parts = history.get(row.tool_id)?.parts ?? {};
    for (const part of COLLECTOR_PARTS) if (parts[part]) coverage[part]++;
  }
  return coverage;
}

export interface ComparePeriodOptions {
  persistence: ComparePersistence;
  period: string;
  now: Date;
  scoring: PerListScoring;
}

/**
 * Score `period` with point-in-time metrics off, then on, and diff the boards.
 *
 * Both runs are `dry-run`, so `regenerateRankings()` calls no write method; the
 * compare port also throws on any write. A history read error propagates.
 */
export async function comparePeriod({ persistence, period, now, scoring }: ComparePeriodOptions): Promise<PeriodCompareResult> {
  const base = { mode: "dry-run", layout: "per-list", period, scoring, persistence, now: () => now } as const;
  const off = await regenerateRankings(base);
  const on = await regenerateRankings({ ...base, usePointInTimeMetrics: true });
  for (const result of [off, on]) {
    // #95: never trust a result that is not a dry-run of the per-list boards.
    if (result.mode !== "dry-run" || result.layout !== "per-list") throw new Error("compare ran a non-dry-run");
  }

  const history = await persistence.loadMetricsHistoryForPeriod(period);
  const latest = await persistence.loadLatestMetricsCollectedDate(period);
  const ledgerRows = latest ? await persistence.loadLedgerTotals(latest) : [];
  const ledgerParts = emptyParts(() => ({ attempted: 0, recorded: 0, flagged: 0, not_found: 0, failed: 0, skipped_timeout: 0 }));
  for (const { collector, ...totals } of ledgerRows) {
    if ((COLLECTOR_PARTS as readonly string[]).includes(collector)) ledgerParts[collector as CollectorPart] = totals;
  }

  const offLists = entriesByList(off);
  const onLists = entriesByList(on);
  const fallback = new Set(on.pointInTime?.fallbackTools ?? []);
  const lists: ListCompare[] = [];
  const tools = {} as Record<RankingList, ToolMove[]>;
  for (const list of RANKING_LISTS) {
    const onRows = onLists.get(list) ?? [];
    const { diff, tools: moves } = diffListBoards(list, offLists.get(list) ?? [], onRows);
    lists.push({
      ...diff,
      fallbackTools: onRows.filter((row) => fallback.has(row.tool_slug)).length,
      historyCoverage: historyCoverage(onRows, history),
    });
    tools[list] = moves;
  }

  const pit = on.pointInTime;
  return {
    aggregate: {
      period,
      clock: now.toISOString(),
      profileSet: scoring.setId,
      algorithmVersion: on.algorithmVersion,
      freshness: {
        status: on.metricsFreshness.status,
        latestCollectedDate: on.metricsFreshness.latestCollectedDate,
        reason: on.metricsFreshness.reason,
      },
      pointInTime: {
        applied: pit?.applied ?? false,
        snapshotTools: pit?.snapshotTools ?? 0,
        fallbackTools: pit?.fallbackTools.length ?? 0,
        skippedLeaves: pit?.skippedLeaves ?? 0,
      },
      ledger: { collectedDate: latest, parts: ledgerParts },
      lists,
    },
    tools,
  };
}

/**
 * PURE: the public summary of one or more periods. Aggregates and counts only:
 * no tool name, slug, id or metric value.
 */
export function renderCompareSummary(periods: readonly PeriodCompare[]): string {
  const lines: string[] = [];
  for (const p of periods) {
    lines.push(
      `### Period ${p.period}`,
      "",
      `Clock ${p.clock}; profile set ${p.profileSet}; algorithm ${p.algorithmVersion}; dry-run, nothing written.`,
      "",
      `- Freshness: ${p.freshness.status}; newest collected_date ${p.freshness.latestCollectedDate ?? "none"}` +
        (p.freshness.reason ? ` (${p.freshness.reason})` : ""),
      `- Point-in-time: applied=${p.pointInTime.applied}; from history ${p.pointInTime.snapshotTools}; ` +
        `fallbackTools ${p.pointInTime.fallbackTools}; skippedLeaves ${p.pointInTime.skippedLeaves}`,
      `- Ledger ${p.ledger.collectedDate ?? "(none)"}: ` +
        COLLECTOR_PARTS.map((part) => {
          const t = p.ledger.parts[part];
          return `${part} recorded ${t.recorded}/${t.attempted} (not_found ${t.not_found}, failed ${t.failed}, skipped_timeout ${t.skipped_timeout}, flagged ${t.flagged})`;
        }).join("; "),
      "",
      `| List | Tools off/on | Moved | Max abs rank move | Median abs rank move | Score changed | Score move >= ${SCORE_DELTA_THRESHOLD} | Max abs score move | Top-10 overlap | Top-10 entered/left | Top-10 position changes | Fallback tools | History github/pypi/npm/vscode |`,
      "|---|---|---|---|---|---|---|---|---|---|---|---|---|"
    );
    for (const l of p.lists) {
      const cov = COLLECTOR_PARTS.map((part) => l.historyCoverage[part]).join("/");
      lines.push(
        `| ${l.list} | ${l.toolsOff}/${l.toolsOn} | ${l.moved} | ${l.maxAbsRankDelta} | ${l.medianAbsRankDelta} | ${l.scoreChanged} | ` +
          `${l.scoreOverThreshold} | ${l.maxAbsScoreDelta} | ${l.top10.overlap} | ${l.top10.entered}/${l.top10.left} | ` +
          `${l.top10.positionChanges} | ${l.fallbackTools} | ${cov} of ${l.toolsOn} |`
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
