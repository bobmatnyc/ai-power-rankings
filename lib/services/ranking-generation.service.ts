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

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/connection";
import { rankings, tools } from "@/lib/db/schema";
import { ALGORITHM_V76_WEIGHTS, RankingEngineV76 } from "@/lib/ranking-algorithm-v76";

export const RANKING_ALGORITHM_VERSION = "7.6";

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

    return {
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
    const [sourceTools, prevSnapshot] = await Promise.all([
      persistence.loadActiveTools(),
      persistence.loadCurrentRankings(),
    ]);

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
