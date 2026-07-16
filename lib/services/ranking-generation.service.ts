/**
 * Ranking Generation Service
 *
 * Single source of truth for (re)generating AI Power Rankings with the v7.6
 * algorithm and persisting a new snapshot. Both the manual
 * `scripts/generate-v76-rankings.ts` CLI and the `/api/cron/regenerate-rankings`
 * Vercel cron route call `regenerateRankings()` so the logic never drifts.
 *
 * Design:
 * - `computeRankings()` is a PURE function (no DB, no clock) that scores + ranks
 *   a set of tools. It is unit-tested directly.
 * - `regenerateRankings()` orchestrates load -> compute -> persist. Its DB access
 *   is injected via a `RankingPersistencePort` so it can be unit-tested with an
 *   in-memory fake (no live database).
 * - Persistence is atomic: within a single transaction we delete any existing
 *   snapshot for the target period (idempotent re-runs), unset the prior
 *   `is_current` row, then insert the new snapshot with `is_current = true`.
 * - An in-process guard rejects concurrent runs for the same period; the unique
 *   `rankings_period_idx` index is the durable backstop across instances.
 */

import { existsSync, readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/connection";
import { rankings, tools } from "@/lib/db/schema";
import { ALGORITHM_V76_WEIGHTS, ALGORITHM_VERSION, RankingEngineV76 } from "@/lib/ranking-algorithm-v76";

/**
 * The version persisted on `rankings` rows. Derived from the engine's
 * `ALGORITHM_VERSION` so the stored value can never drift from the engine that
 * produced the scores. Stored without the leading "v" (schema convention).
 */
export const RANKING_ALGORITHM_VERSION = ALGORITHM_VERSION.replace(/^v/, "");

/** Minimal tool shape required to score a tool. */
export interface RankingSourceTool {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  data: Record<string, unknown> | null;
}

/** A single persisted ranking row (shape stored in the snapshot JSONB). */
export interface RankingEntry {
  tool_id: string;
  tool_name: string;
  tool_slug: string;
  rank: number;
  score: number;
  tier: string;
  factor_scores: Record<string, number>;
  category: string;
  status: string;
  movement: {
    previous_position: number | null;
    change: number;
    direction: "up" | "down" | "same";
  };
  /**
   * True when this row was scored from a period-specific historical metrics
   * override file rather than the live `tools.data`. Absent on live cron runs.
   */
  reconstructed?: boolean;
  /**
   * Provenance block carried through from the override file (period + per-tool
   * fidelity notes). Persisted alongside the row in the existing `rankings.data`
   * JSONB; never populated on live cron runs. No schema migration required.
   */
  provenance?: Record<string, unknown>;
}

/** Summary returned to callers (cron route surfaces this as JSON). */
export interface RankingGenerationResult {
  period: string;
  algorithmVersion: string;
  toolCount: number;
  publishedAt: string;
  topMovers: Array<{ tool_name: string; previous_position: number | null; rank: number; change: number }>;
}

/** Injectable persistence boundary so orchestration is DB-agnostic in tests. */
export interface RankingPersistencePort {
  loadActiveTools(): Promise<RankingSourceTool[]>;
  loadCurrentRankings(): Promise<{ data: unknown } | null>;
  saveSnapshot(input: {
    period: string;
    algorithmVersion: string;
    publishedAt: Date;
    data: RankingEntry[];
  }): Promise<void>;
}

export interface RegenerateRankingsOptions {
  /** Target period, e.g. "2026-07". Defaults to the current UTC month. */
  period?: string;
  /** Injected persistence (defaults to the live Drizzle-backed adapter). */
  persistence?: RankingPersistencePort;
  /** Clock injection for deterministic tests. */
  now?: () => Date;
  /**
   * Optional path to a `data/historical-metrics/<period>.json` override file.
   * When set AND the file exists, the loaded tools' `data.metrics.*` are merged
   * with the reconstructed period-specific values before scoring (additive
   * historical-backfill path). When unset or the file is missing, the live
   * `tools.data` is scored unchanged — the cron path is byte-for-byte identical.
   */
  metricsOverridePath?: string;
}

/** Raised when a regeneration for the same period is already in flight. */
export class RankingGenerationInProgressError extends Error {
  constructor(public readonly period: string) {
    super(`Ranking regeneration already in progress for period ${period}`);
    this.name = "RankingGenerationInProgressError";
  }
}

// In-process concurrency guard (per-instance). The unique period index in the DB
// is the cross-instance backstop against duplicate snapshots.
const inFlightPeriods = new Set<string>();

/** Format a Date as a "YYYY-MM" period string in UTC. */
export function toPeriod(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** Tier assignment by rank (matches the historical v7.6 CLI). */
export function calculateTier(rank: number): string {
  if (rank <= 5) return "S";
  if (rank <= 15) return "A";
  if (rank <= 30) return "B";
  if (rank <= 45) return "C";
  return "D";
}

/** Build a tool_id -> previous rank map from a prior snapshot's JSONB data. */
export function buildPreviousRankMap(prevData: unknown): Map<string, number> {
  const map = new Map<string, number>();
  const list = Array.isArray(prevData)
    ? prevData
    : ((prevData as { rankings?: unknown[] } | null)?.rankings ?? []);

  for (const raw of list as Array<Record<string, unknown>>) {
    const toolId = (raw["tool_id"] ?? raw["id"]) as string | undefined;
    const rank = (raw["rank"] ?? raw["position"]) as number | undefined;
    if (toolId && rank) {
      map.set(toolId, rank);
    }
  }
  return map;
}

/**
 * PURE: score, sort, rank, and shape a set of tools into ranking entries.
 * No database, no wall-clock, no side effects — safe to unit test directly.
 */
export function computeRankings(
  sourceTools: RankingSourceTool[],
  previousRankMap: Map<string, number>,
  currentDate: Date = new Date()
): RankingEntry[] {
  const engine = new RankingEngineV76(ALGORITHM_V76_WEIGHTS);

  const scored = sourceTools
    .map((tool) => {
      const toolData = (tool.data ?? {}) as Record<string, unknown>;
      const metrics = {
        tool_id: tool.id,
        name: tool.name,
        slug: tool.slug,
        category: tool.category,
        status: tool.status,
        info: toolData,
        metrics: (toolData["metrics"] as Record<string, unknown>) ?? {},
      };

      const score = engine.calculateToolScore(metrics as never, currentDate);
      return {
        tool,
        overallScore: score.overallScore,
        factorScores: score.factorScores,
      };
    })
    .sort((a, b) => b.overallScore - a.overallScore);

  return scored.map((entry, index) => {
    const rank = index + 1;
    const prevRank = previousRankMap.get(entry.tool.id);
    const change = prevRank ? prevRank - rank : 0;
    const toolData = entry.tool.data as Record<string, unknown> | null;

    const row: RankingEntry = {
      tool_id: entry.tool.id,
      tool_name: entry.tool.name,
      tool_slug: entry.tool.slug,
      rank,
      score: entry.overallScore,
      tier: calculateTier(rank),
      factor_scores: entry.factorScores,
      category: entry.tool.category,
      status: entry.tool.status,
      movement: {
        previous_position: prevRank ?? null,
        change,
        direction: change > 0 ? "up" : change < 0 ? "down" : "same",
      },
    };

    // Only stamp reconstruction fields when the tool was scored from an override
    // file (applyHistoricalMetricsOverride sets `__reconstructed`). Left absent
    // on the live path so persisted snapshots are unchanged there.
    if (toolData?.["__reconstructed"] === true) {
      row.reconstructed = true;
      const provenance = toolData["__provenance"];
      if (provenance && typeof provenance === "object") {
        row.provenance = provenance as Record<string, unknown>;
      }
    }

    return row;
  });
}

/** A single reconstructed metric leaf in a historical override file. */
export interface HistoricalMetricLeaf {
  /** The numeric value the engine scores (null = intentionally not applicable). */
  value: number | null;
  fidelity?: "real" | "interpolated" | "held_flat" | "not_applicable";
  source?: string | null;
  as_of?: string | null;
  recovery_note?: string;
}

/** Shape of a `data/historical-metrics/<period>.json` override file. */
export interface HistoricalMetricsOverride {
  period?: string;
  reconstructed?: boolean;
  tools: Record<
    string,
    {
      display_name?: string;
      /** Nested tree of metric leaves / containers (npm, github, pypi, users, …). */
      metrics?: Record<string, unknown>;
      provenance?: Record<string, unknown>;
    }
  >;
  [key: string]: unknown;
}

/**
 * Recursively copy the numeric `.value` leaves from an override subtree into the
 * matching path of a target metrics object, preserving nesting. A node is a leaf
 * when it carries a `value` property (e.g. `{ value, fidelity, source, … }`);
 * otherwise it is a container (e.g. `npm`, `github`) and we recurse. Existing
 * target values not named in the override are left untouched (deep merge).
 */
function mergeOverrideLeaves(
  target: Record<string, unknown>,
  override: Record<string, unknown>
): void {
  for (const [key, node] of Object.entries(override)) {
    if (!node || typeof node !== "object") continue;
    if ("value" in (node as Record<string, unknown>)) {
      // Leaf: extract only the scored `.value` (may be null); provenance stays
      // in the override file, not in the scored metrics tree.
      target[key] = (node as HistoricalMetricLeaf).value;
    } else {
      const existing = target[key];
      const child =
        existing && typeof existing === "object"
          ? (existing as Record<string, unknown>)
          : {};
      target[key] = child;
      mergeOverrideLeaves(child, node as Record<string, unknown>);
    }
  }
}

/**
 * PURE: apply a period-specific historical metrics override onto a set of source
 * tools. For every tool whose `slug` matches a key in `overrides.tools`, the
 * override's numeric `.value` leaves are deep-merged into `tool.data.metrics.*`
 * (the exact paths the v7.6 engine reads) and the tool is flagged with
 * `data.__reconstructed = true` (plus a `__provenance` block). Tools with no
 * matching override key are returned by reference, completely untouched, so the
 * live scoring path is unaffected when an override file omits a tool.
 *
 * Does not mutate the input array or its tools (returns fresh clones for matched
 * tools) — safe to unit test directly.
 */
export function applyHistoricalMetricsOverride(
  sourceTools: RankingSourceTool[],
  overrides: HistoricalMetricsOverride
): RankingSourceTool[] {
  const overrideMap = overrides?.tools ?? {};

  return sourceTools.map((tool) => {
    const toolOverride = overrideMap[tool.slug];
    if (!toolOverride) return tool; // untouched pass-through

    const cloned = structuredClone(tool);
    const data = (cloned.data ?? {}) as Record<string, unknown>;
    cloned.data = data;

    const existingMetrics = data["metrics"];
    const metrics =
      existingMetrics && typeof existingMetrics === "object"
        ? (existingMetrics as Record<string, unknown>)
        : {};
    data["metrics"] = metrics;

    if (toolOverride.metrics) {
      mergeOverrideLeaves(metrics, toolOverride.metrics);
    }

    data["__reconstructed"] = true;
    data["__provenance"] = {
      period: overrides.period,
      reconstructed: overrides.reconstructed ?? true,
      ...(toolOverride.provenance ?? {}),
    };

    return cloned;
  });
}

/**
 * Default persistence adapter backed by the live Drizzle connection.
 * The snapshot write is a single atomic transaction.
 */
export function createDbPersistence(): RankingPersistencePort {
  return {
    async loadActiveTools() {
      const db = getDb();
      if (!db) throw new Error("Database connection not available");
      const rows = await db.select().from(tools).where(eq(tools.status, "active"));
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        category: row.category,
        status: row.status,
        data: (row.data ?? {}) as Record<string, unknown>,
      }));
    },

    async loadCurrentRankings() {
      const db = getDb();
      if (!db) throw new Error("Database connection not available");
      const result = await db
        .select()
        .from(rankings)
        .where(eq(rankings.isCurrent, true))
        .limit(1);
      return result.length > 0 ? { data: result[0]!.data } : null;
    },

    async saveSnapshot({ period, algorithmVersion, publishedAt, data }) {
      const db = getDb();
      if (!db) throw new Error("Database connection not available");
      await db.transaction(async (tx) => {
        // Idempotent: drop any prior snapshot for this exact period.
        await tx.delete(rankings).where(eq(rankings.period, period));
        // Demote the previous current snapshot.
        await tx.update(rankings).set({ isCurrent: false }).where(eq(rankings.isCurrent, true));
        // Insert the fresh snapshot as current.
        await tx.insert(rankings).values({
          period,
          algorithmVersion,
          isCurrent: true,
          publishedAt,
          data: data as never,
        });
      });
    },
  };
}

/**
 * Regenerate the v7.6 rankings and persist a new current snapshot.
 *
 * Idempotent per period (safe to re-run) and guarded against concurrent runs.
 * Does NOT close the DB connection — callers that own the process lifecycle
 * (the CLI script) are responsible for that.
 */
export async function regenerateRankings(
  options: RegenerateRankingsOptions = {}
): Promise<RankingGenerationResult> {
  const now = options.now ?? (() => new Date());
  const publishedAt = now();
  const period = options.period ?? toPeriod(publishedAt);
  const persistence = options.persistence ?? createDbPersistence();

  if (inFlightPeriods.has(period)) {
    throw new RankingGenerationInProgressError(period);
  }
  inFlightPeriods.add(period);

  try {
    const [loadedTools, prevSnapshot] = await Promise.all([
      persistence.loadActiveTools(),
      persistence.loadCurrentRankings(),
    ]);

    // Additive historical-backfill path: if a period-specific override file is
    // provided AND exists on disk, score the reconstructed metrics instead of
    // the live `tools.data`. Otherwise the live tools are scored unchanged.
    let sourceTools = loadedTools;
    if (options.metricsOverridePath && existsSync(options.metricsOverridePath)) {
      const overrides = JSON.parse(
        readFileSync(options.metricsOverridePath, "utf8")
      ) as HistoricalMetricsOverride;
      sourceTools = applyHistoricalMetricsOverride(loadedTools, overrides);
    }

    const previousRankMap = buildPreviousRankMap(prevSnapshot?.data ?? null);
    const data = computeRankings(sourceTools, previousRankMap, publishedAt);

    await persistence.saveSnapshot({
      period,
      algorithmVersion: RANKING_ALGORITHM_VERSION,
      publishedAt,
      data,
    });

    const topMovers = [...data]
      .filter((r) => Math.abs(r.movement.change) >= 5)
      .sort((a, b) => Math.abs(b.movement.change) - Math.abs(a.movement.change))
      .slice(0, 5)
      .map((r) => ({
        tool_name: r.tool_name,
        previous_position: r.movement.previous_position,
        rank: r.rank,
        change: r.movement.change,
      }));

    return {
      period,
      algorithmVersion: RANKING_ALGORITHM_VERSION,
      toolCount: data.length,
      publishedAt: publishedAt.toISOString(),
      topMovers,
    };
  } finally {
    inFlightPeriods.delete(period);
  }
}
