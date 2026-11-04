/**
 * Point-in-time metrics for ranking regeneration, and the freshness guard (#95 steps 4-5).
 *
 * Why: rankings scored from the live `tools.data` flat-line when collection stalls
 *   and cannot recompute a past month. Step 4 scores a period from the dated
 *   `tool_metrics_history` rows instead; step 5 flags a run whose newest history
 *   snapshot is older than the period it regenerates.
 * What: pure functions only, no DB and no clock. `foldHistoryRows` keeps, per tool and
 *   per collector key (`github`, `npm`, ...), the newest row's leaves. `applyMetricsHistorySnapshot`
 *   merges those leaves into each tool's `data.metrics` and counts every tool with no
 *   history (scored live) and every flagged leaf it skipped (live value kept), so no
 *   fallback is silent and no leaf is replaced by a non-number. `assessMetricsFreshness`
 *   turns the newest `collected_date` at or before the period into fresh / stale.
 * Test: `tests/unit/point-in-time-metrics-95.test.ts`
 */

/** One `tool_metrics_history` row as the regen read returns it. */
export interface MetricsHistoryRow {
  toolId: string;
  collectedDate: string; // YYYY-MM-DD
  /** `{ [part]: { [key]: { value, source, as_of, flags? } } }`, one top-level key per collector. */
  metrics: Record<string, unknown>;
}

/** A tool's point-in-time metrics: the newest leaves per collector key, at or before the period. */
export interface MetricsHistorySnapshot {
  metrics: Record<string, Record<string, unknown>>;
  /** Newest `collected_date` among the collector keys used. */
  collectedDate: string;
  /** `collected_date` of each collector key used. */
  parts: Record<string, string>;
}

/** What a point-in-time run used, returned on `RankingGenerationResult.pointInTime`. */
export interface PointInTimeReport {
  period: string;
  /** False when `metricsOverridePath` took precedence (#95 spec step 4: the file still wins). */
  applied: boolean;
  /** Tools scored from history (at least one collector key). */
  snapshotTools: number;
  /** Slugs of tools with no history row at or before the period, scored from live `tools.data`. */
  fallbackTools: string[];
  /** Leaves flagged `non_numeric` by the collector; the live value was kept for each. */
  skippedLeaves: number;
  reason: string | null;
}

/** Raised when the history read fails or cannot run; the run writes nothing (#95). */
export class MetricsHistoryReadError extends Error {
  constructor(
    public readonly period: string,
    reason: string,
    options?: { cause?: unknown }
  ) {
    super(`Point-in-time metrics for period ${period} could not be read: ${reason}`, options);
    this.name = "MetricsHistoryReadError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * PURE: per tool, the newest leaves of each collector key.
 *
 * Postcondition: for each tool and key, the value comes from the row with the greatest
 * `collectedDate` that carries that key, so a collector that missed the newest day keeps
 * its previous reading instead of falling back to live.
 */
export function foldHistoryRows(rows: readonly MetricsHistoryRow[]): Map<string, MetricsHistorySnapshot> {
  const sorted = [...rows].sort((a, b) => (a.collectedDate < b.collectedDate ? 1 : a.collectedDate > b.collectedDate ? -1 : 0));
  const byTool = new Map<string, MetricsHistorySnapshot>();
  for (const row of sorted) {
    if (!isRecord(row.metrics)) continue;
    let snapshot = byTool.get(row.toolId);
    for (const [part, leaves] of Object.entries(row.metrics)) {
      if (!isRecord(leaves) || snapshot?.parts[part]) continue;
      if (!snapshot) {
        snapshot = { metrics: {}, collectedDate: row.collectedDate, parts: {} };
        byTool.set(row.toolId, snapshot);
      }
      snapshot.metrics[part] = leaves;
      snapshot.parts[part] = row.collectedDate;
    }
  }
  return byTool;
}

/** Drops flagged leaves (`flags` non-empty) from one collector key; returns the kept leaves and the drop count. */
function usableLeaves(leaves: Record<string, unknown>): { kept: Record<string, unknown>; skipped: number } {
  const kept: Record<string, unknown> = {};
  let skipped = 0;
  for (const [key, leaf] of Object.entries(leaves)) {
    if (!isRecord(leaf) || !("value" in leaf)) continue;
    if (Array.isArray(leaf["flags"]) && leaf["flags"].length > 0) {
      skipped++;
      continue;
    }
    kept[key] = leaf;
  }
  return { kept, skipped };
}

/** The minimal tool shape this module needs; `RankingSourceTool` satisfies it. */
export interface PointInTimeTool {
  id: string;
  slug: string;
  data: Record<string, unknown> | null;
}

/**
 * PURE: score-ready tools for a point-in-time run.
 *
 * `mergeLeaves` is the ranking service's `mergeOverrideLeaves` (one merge for the file
 * override and the history table, as the spec asks). A tool with a snapshot is cloned,
 * its leaves merged into `data.metrics`, and stamped `__pointInTime` with a provenance
 * block. A tool without one is returned by reference and named in `fallbackTools`.
 * Input tools are never mutated.
 */
export function applyMetricsHistorySnapshot<T extends PointInTimeTool>(
  sourceTools: readonly T[],
  history: ReadonlyMap<string, MetricsHistorySnapshot>,
  period: string,
  mergeLeaves: (target: Record<string, unknown>, override: Record<string, unknown>) => void
): { tools: T[]; report: PointInTimeReport } {
  const fallbackTools: string[] = [];
  let snapshotTools = 0;
  let skippedLeaves = 0;

  const tools = sourceTools.map((tool) => {
    const snapshot = history.get(tool.id);
    if (!snapshot) {
      // #95: no history at or before the period: score live, and say so.
      fallbackTools.push(tool.slug);
      return tool;
    }
    const cloned = structuredClone(tool);
    const data = (cloned.data ?? {}) as Record<string, unknown>;
    cloned.data = data;
    const metrics = isRecord(data["metrics"]) ? data["metrics"] : {};
    data["metrics"] = metrics;

    const override: Record<string, unknown> = {};
    for (const [part, leaves] of Object.entries(snapshot.metrics)) {
      const { kept, skipped } = usableLeaves(leaves);
      skippedLeaves += skipped;
      override[part] = kept;
    }
    mergeLeaves(metrics, override);

    data["__pointInTime"] = true;
    data["__provenance"] = {
      period,
      source: "tool_metrics_history",
      collected_date: snapshot.collectedDate,
      parts: { ...snapshot.parts },
    };
    snapshotTools++;
    return cloned;
  });

  return {
    tools,
    report: { period, applied: true, snapshotTools, fallbackTools, skippedLeaves, reason: null },
  };
}

/** `"off"` skips the guard; `"flag"` (the spec's phase-1 default) records stale state and never blocks. */
export type MetricsFreshnessMode = "off" | "flag";

export const METRICS_FRESHNESS_MODES: readonly MetricsFreshnessMode[] = ["off", "flag"];

export interface MetricsFreshness {
  mode: MetricsFreshnessMode;
  /** `unknown`: the check could not run (read error, or no reader); never reported as fresh. */
  status: "off" | "fresh" | "stale" | "unknown";
  period: string;
  /** Newest `collected_date` at or before the period; null when there is none or the read failed. */
  latestCollectedDate: string | null;
  reason: string | null;
}

/**
 * PURE: fresh when the newest history snapshot at or before `period` was collected in
 * `period` itself; stale when it is older, or when there is none.
 */
export function assessMetricsFreshness(period: string, latestCollectedDate: string | null): MetricsFreshness {
  if (latestCollectedDate === null) {
    return { mode: "flag", status: "stale", period, latestCollectedDate, reason: "no tool_metrics_history snapshot at or before the period" };
  }
  if (latestCollectedDate.slice(0, 7) === period) {
    return { mode: "flag", status: "fresh", period, latestCollectedDate, reason: null };
  }
  return {
    mode: "flag",
    status: "stale",
    period,
    latestCollectedDate,
    reason: `newest tool_metrics_history snapshot (${latestCollectedDate}) predates period ${period}`,
  };
}
