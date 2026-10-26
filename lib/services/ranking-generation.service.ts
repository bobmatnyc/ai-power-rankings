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
 *   `rankings_period_list_idx` index is the durable backstop across instances.
 * - #93: `mode` selects what is written. "publish" (the default, used by the
 *   cron and the CLI) is the transaction above. "draft" (admin build) writes a
 *   non-current row and never touches the current one. "dry-run" (admin build
 *   with dry_run, admin preview) writes nothing.
 * - #186: `layout` selects the boards. "combined" (the default) is the legacy
 *   one-board row (`rankings.list = 'combined'`). "per-list" writes one row per
 *   (period, list), each ranking only the tools of its list (`listOfTool()`), with
 *   ranks and D53 tiers counted within the list. Both layouts score through the
 *   same `computeRankings()` call with no scoring argument.
 */

import { existsSync, readFileSync } from "node:fs";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/connection";
import { rankings, tools } from "@/lib/db/schema";
import {
  ALGORITHM_V76_WEIGHTS,
  ALGORITHM_VERSION,
  RankingEngineV76,
  type RankingWeightsV76,
} from "@/lib/ranking-algorithm-v76";
import {
  COMBINED_LIST,
  listOfTool,
  listTier,
  RANKING_LISTS,
  type RankingList,
  type StoredRankingList,
} from "@/lib/rankings/lists";

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
  /** #185: `tools.kind`; read only when `computeRankings()` is handed a `KindWeightRouting`. */
  kind?: string | null;
}

/**
 * #185: per-kind weight tables for one profile set (built by
 * `lib/scoring-kind-routing.ts`). `route()` throws for a kind it cannot score.
 */
export interface KindWeightRouting {
  readonly setId: string;
  route(kind: unknown): { profile: string; weights: RankingWeightsV76 };
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

/**
 * What a run writes (#93).
 * - "publish": the new row becomes current and the prior current row is demoted.
 * - "draft": a non-current row for the period; the current row is untouched.
 * - "dry-run": nothing is written.
 */
export type RegenerateMode = "publish" | "draft" | "dry-run";

const REGENERATE_MODES: readonly RegenerateMode[] = ["publish", "draft", "dry-run"];

/**
 * #186: which boards a run computes.
 * - "combined": the legacy one board of every active tool.
 * - "per-list": one board per list in `RANKING_LISTS`, each ranked within itself.
 */
export type RankingLayout = "combined" | "per-list";

const RANKING_LAYOUTS: readonly RankingLayout[] = ["combined", "per-list"];

/** Summary returned to callers (cron route surfaces this as JSON). */
export interface RankingGenerationResult {
  period: string;
  algorithmVersion: string;
  toolCount: number;
  publishedAt: string;
  topMovers: Array<{ tool_name: string; previous_position: number | null; rank: number; change: number }>;
  /** #93: the mode that ran. */
  mode: RegenerateMode;
  /** #93: the computed rows, for the admin dry-run and draft responses. */
  entries: RankingEntry[];
  /** #186: the layout that ran, and the row count of each board it computed. */
  layout: RankingLayout;
  boards: Array<{ list: StoredRankingList; toolCount: number }>;
}

/** The rows one run computed, as handed to the persistence port. */
export interface RankingSnapshotInput {
  period: string;
  algorithmVersion: string;
  publishedAt: Date;
  data: RankingEntry[];
  /** #186: the list of a per-list board; absent for the legacy combined board. */
  list?: RankingList;
}

/** Injectable persistence boundary so orchestration is DB-agnostic in tests. */
export interface RankingPersistencePort {
  loadActiveTools(): Promise<RankingSourceTool[]>;
  /**
   * #93: `period` is optional so existing ports keep compiling; the DB adapter sets it.
   * #186: `list` names the board; absent means the legacy combined board.
   */
  loadCurrentRankings(list?: StoredRankingList): Promise<{ data: unknown; period?: string } | null>;
  saveSnapshot(input: RankingSnapshotInput): Promise<void>;
  /**
   * #186: publish every per-list board of one run in one transaction: per list, replace
   * the row for (period, list), demote that list's current row and insert the new one as
   * current. Never touches another list's rows. Required for layout "per-list" only.
   */
  saveListSnapshots?(inputs: RankingSnapshotInput[]): Promise<void>;
  /**
   * #93: write a non-current row for `input.period`, replacing only a
   * non-current row for that period. Must never change `is_current` on any
   * row; throws `RankingPeriodIsCurrentError` when the period is the current
   * one. Required for mode "draft" only.
   */
  saveDraft?(input: RankingSnapshotInput): Promise<void>;
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
  /** #93: what to write. Defaults to "publish", the cron and CLI behaviour. */
  mode?: RegenerateMode;
  /** #186: which boards to compute. Defaults to "combined", the cron and CLI behaviour. */
  layout?: RankingLayout;
}

/** Raised when a regeneration for the same period is already in flight. */
export class RankingGenerationInProgressError extends Error {
  constructor(public readonly period: string) {
    super(`Ranking regeneration already in progress for period ${period}`);
    this.name = "RankingGenerationInProgressError";
  }
}

/**
 * #93: a draft was asked for the period that is currently published. Admin
 * build refuses it so the published row is never overwritten from that path.
 */
export class RankingPeriodIsCurrentError extends Error {
  constructor(public readonly period: string) {
    super(`Period ${period} is the current published ranking; a draft cannot replace it`);
    this.name = "RankingPeriodIsCurrentError";
  }
}

// In-process concurrency guard (per-instance). The unique period index in the DB
// is the cross-instance backstop against duplicate snapshots.
const inFlightPeriods = new Set<string>();
// #93: drafts get their own guard so an admin build never blocks the cron publish
// (the publish transaction replaces a same-period draft row anyway).
const inFlightDrafts = new Set<string>();

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

/** #185: the engine for each tool; a routing gets one engine per profile it returns. */
function scoringEngines(scoring: RankingWeightsV76 | KindWeightRouting): (tool: RankingSourceTool) => RankingEngineV76 {
  if (!("route" in scoring)) {
    const engine = new RankingEngineV76(scoring);
    return () => engine;
  }
  const engines = new Map<string, RankingEngineV76>();
  return (tool) => {
    const { profile, weights } = scoring.route(tool.kind);
    let engine = engines.get(profile);
    if (!engine) engines.set(profile, (engine = new RankingEngineV76(weights)));
    return engine;
  };
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
 * #186 PURE: previous ranks renumbered within one list (D2e).
 *
 * Keeps the tools in `memberIds` that have a previous rank and numbers them 1..n in
 * previous-rank order. Used for a list's first per-list run, whose only prior board
 * is the combined one, so a global rank is never reported as a list rank.
 */
export function renumberWithinList(previous: Map<string, number>, memberIds: readonly string[]): Map<string, number> {
  const ranked = memberIds
    .filter((id) => previous.has(id))
    .sort((a, b) => previous.get(a)! - previous.get(b)!);
  return new Map(ranked.map((id, index) => [id, index + 1]));
}

/** #186: D53 tiers for one list's rows (ranks are already 1..n within the list). */
function withListTiers(rows: RankingEntry[]): RankingEntry[] {
  return rows.map((row) => ({ ...row, tier: listTier(row.rank, rows.length) }));
}

/** #186: one board a run computes; `list` is absent for the legacy combined board. */
interface RankingBoard {
  list?: RankingList;
  sourceTools: RankingSourceTool[];
  previousRankMap: Map<string, number>;
}

/**
 * #186: one board per list. Each list ranks only the tools `listOfTool()` puts in it,
 * so no tool is ranked in two lists; a tool in no list (kind `other`, an image or video
 * model) is ranked nowhere. Previous ranks come from the list's current row, else the
 * combined board renumbered within the list.
 */
async function listBoards(
  scoredTools: RankingSourceTool[],
  combinedPrevious: unknown,
  persistence: RankingPersistencePort
): Promise<RankingBoard[]> {
  const previousRows = await Promise.all(RANKING_LISTS.map((list) => persistence.loadCurrentRankings(list)));
  const combinedRanks = buildPreviousRankMap(combinedPrevious);
  return RANKING_LISTS.map((list, index) => {
    const members = scoredTools.filter((tool) => listOfTool(tool.kind, tool.data?.["modality"]) === list);
    const listRow = previousRows[index];
    const previousRankMap = listRow
      ? buildPreviousRankMap(listRow.data)
      : renumberWithinList(combinedRanks, members.map((tool) => tool.id));
    return { list, sourceTools: members, previousRankMap };
  });
}

/**
 * PURE: score, sort, rank, and shape a set of tools into ranking entries.
 * No database, no wall-clock, no side effects — safe to unit test directly.
 *
 * #185: `scoring` is one weight table for every tool, or a `KindWeightRouting`
 * that picks each tool's table by `tool.kind` (and throws for a kind it cannot
 * route). Every publish caller omits it, so they score with
 * `ALGORITHM_V76_WEIGHTS` exactly as before. Per-kind scores are combined
 * without rescaling: each profile sums to its declared total (1.00 for v8), so
 * every score is on the same 0-100 scale, and one sort over all tools gives one
 * global rank (equal scores keep input order).
 * Test: `lib/services/ranking-generation.golden.test.ts`,
 *   `lib/scoring-profiles.inert-185.test.ts`, `lib/scoring-kind-routing.test.ts`
 */
export function computeRankings(
  sourceTools: RankingSourceTool[],
  previousRankMap: Map<string, number>,
  currentDate: Date = new Date(),
  scoring: RankingWeightsV76 | KindWeightRouting = ALGORITHM_V76_WEIGHTS
): RankingEntry[] {
  const engineFor = scoringEngines(scoring);

  const scored = sourceTools
    .map((tool) => {
      const engine = engineFor(tool);
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
 * and the tool is flagged with `data.__reconstructed = true` (plus a
 * `__provenance` block). Tools with no matching override key are returned by
 * reference, completely untouched, so the live scoring path is unaffected when
 * an override file omits a tool.
 *
 * CONTRACT with the engine (metric-path shadowing fix): the engine
 * canonicalizes each tool's metric paths before scoring, with top-level
 * `data.metrics.*` taking precedence over any legacy `data.info.metrics.*`
 * copy (see `canonicalizeMetricPaths` in lib/ranking-algorithm-v76.ts).
 * Merging overrides into `data.metrics.*` therefore makes them authoritative
 * for EVERY factor, for double-nested and flat tools alike. Previously,
 * factors that read `data.info.metrics.*` (developer adoption, market
 * traction) silently ignored these overrides for the 34 double-nested tools.
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
      // Ordered by slug so tools with equal scores rank in slug order, not in the
      // database's read order. A higher score still ranks first (computeRankings).
      const rows = await db
        .select()
        .from(tools)
        .where(eq(tools.status, "active"))
        .orderBy(asc(tools.slug));
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        category: row.category,
        status: row.status,
        data: (row.data ?? {}) as Record<string, unknown>,
        // #186: the per-list layout partitions by kind; the combined layout ignores it.
        kind: row.kind,
      }));
    },

    async loadCurrentRankings(list: StoredRankingList = COMBINED_LIST) {
      const db = getDb();
      if (!db) throw new Error("Database connection not available");
      const result = await db
        .select()
        .from(rankings)
        .where(and(eq(rankings.isCurrent, true), eq(rankings.list, list)))
        .limit(1);
      // #93: period lets draft mode refuse the current period before computing.
      return result.length > 0 ? { data: result[0]!.data, period: result[0]!.period } : null;
    },

    async saveSnapshot({ period, algorithmVersion, publishedAt, data }) {
      const db = getDb();
      if (!db) throw new Error("Database connection not available");
      await db.transaction(async (tx) => {
        // Idempotent: drop any prior combined snapshot for this exact period.
        // #186: scoped to the combined list, so per-list rows of the period survive.
        await tx.delete(rankings).where(and(eq(rankings.period, period), eq(rankings.list, COMBINED_LIST)));
        // Demote the previous current combined snapshot (#186: never another list's).
        await tx
          .update(rankings)
          .set({ isCurrent: false })
          .where(and(eq(rankings.isCurrent, true), eq(rankings.list, COMBINED_LIST)));
        // Insert the fresh snapshot as current (list defaults to 'combined').
        await tx.insert(rankings).values({
          period,
          algorithmVersion,
          isCurrent: true,
          publishedAt,
          data: data as never,
        });
      });
    },

    // #186: every list's board of one run, in one transaction.
    async saveListSnapshots(inputs) {
      const db = getDb();
      if (!db) throw new Error("Database connection not available");
      await db.transaction(async (tx) => {
        for (const { period, algorithmVersion, publishedAt, data, list } of inputs) {
          if (!list) throw new Error("saveListSnapshots needs a list on every board");
          await tx.delete(rankings).where(and(eq(rankings.period, period), eq(rankings.list, list)));
          await tx
            .update(rankings)
            .set({ isCurrent: false })
            .where(and(eq(rankings.isCurrent, true), eq(rankings.list, list)));
          await tx.insert(rankings).values({
            period,
            list,
            algorithmVersion,
            isCurrent: true,
            publishedAt,
            data: data as never,
          });
        }
      });
    },

    // #93: admin build. One transaction that never sets or clears is_current.
    async saveDraft({ period, algorithmVersion, data }) {
      const db = getDb();
      if (!db) throw new Error("Database connection not available");
      await db.transaction(async (tx) => {
        // #186: drafts are combined boards; a per-list row of the period is not this draft.
        const existing = await tx
          .select()
          .from(rankings)
          .where(and(eq(rankings.period, period), eq(rankings.list, COMBINED_LIST)))
          .limit(1);
        if (existing[0]?.isCurrent) {
          throw new RankingPeriodIsCurrentError(period);
        }
        // Replace only a non-current row for this period.
        await tx
          .delete(rankings)
          .where(
            and(eq(rankings.period, period), eq(rankings.isCurrent, false), eq(rankings.list, COMBINED_LIST))
          );
        // published_at stays null until set-current publishes the row.
        await tx.insert(rankings).values({
          period,
          algorithmVersion,
          isCurrent: false,
          publishedAt: null,
          data: data as never,
        });
      });
    },
  };
}

/**
 * Regenerate the v7.6 rankings and, by default, persist a new current snapshot.
 *
 * Idempotent per period (safe to re-run) and guarded against concurrent runs.
 * Does NOT close the DB connection — callers that own the process lifecycle
 * (the CLI script) are responsible for that.
 *
 * #93: `mode` "draft" writes through `saveDraft` and refuses the current
 * period; "dry-run" writes nothing. Neither mode takes the publish guard, so
 * neither blocks a publish run. All modes compute rows with the same function and inputs.
 * #186: `layout` "per-list" publishes one current row per list through
 * `saveListSnapshots` (dry-run writes nothing; draft is refused).
 * Test: `lib/services/ranking-generation.golden.test.ts` (publish unchanged),
 * `lib/services/ranking-generation.modes.test.ts` (draft, dry-run),
 * `tests/unit/ranking-generation-per-list-186.test.ts` (per-list layout).
 */
export async function regenerateRankings(
  options: RegenerateRankingsOptions = {}
): Promise<RankingGenerationResult> {
  const now = options.now ?? (() => new Date());
  const publishedAt = now();
  const period = options.period ?? toPeriod(publishedAt);
  const persistence = options.persistence ?? createDbPersistence();
  // #93: default keeps the cron and CLI on the publish path.
  const mode = options.mode ?? "publish";
  if (!REGENERATE_MODES.includes(mode)) {
    throw new Error(`Unknown regenerate mode: ${String(mode)}`);
  }
  if (mode === "draft" && !persistence.saveDraft) {
    throw new Error("Draft mode needs a persistence port with saveDraft");
  }
  // #186: the combined board stays the default until activation switches it.
  const layout = options.layout ?? "combined";
  if (!RANKING_LAYOUTS.includes(layout)) {
    throw new Error(`Unknown ranking layout: ${String(layout)}`);
  }
  if (layout === "per-list" && mode === "draft") {
    throw new Error("Per-list drafts are not supported; use dry-run or publish (#186)");
  }
  if (layout === "per-list" && mode === "publish" && !persistence.saveListSnapshots) {
    throw new Error("Per-list publish needs a persistence port with saveListSnapshots");
  }
  // #93: a dry-run writes nothing, so it takes no slot in either guard.
  const guard = mode === "publish" ? inFlightPeriods : mode === "draft" ? inFlightDrafts : null;
  // #186: a per-list run writes other rows than a combined run of the same period.
  const guardKey = layout === "combined" ? period : `${period}:${layout}`;

  if (guard?.has(guardKey)) {
    throw new RankingGenerationInProgressError(period);
  }
  guard?.add(guardKey);

  try {
    const [loadedTools, prevSnapshot] = await Promise.all([
      persistence.loadActiveTools(),
      persistence.loadCurrentRankings(),
    ]);

    // Additive historical-backfill path: if a period-specific override file is
    // provided AND exists on disk, score the reconstructed metrics instead of
    // the live `tools.data`. Otherwise the live tools are scored unchanged.
    let scoredTools = loadedTools;
    if (options.metricsOverridePath && existsSync(options.metricsOverridePath)) {
      const overrides = JSON.parse(
        readFileSync(options.metricsOverridePath, "utf8")
      ) as HistoricalMetricsOverride;
      scoredTools = applyHistoricalMetricsOverride(loadedTools, overrides);
    }

    // #93: refuse before scoring; saveDraft re-checks inside its transaction.
    if (mode === "draft" && prevSnapshot?.period === period) {
      throw new RankingPeriodIsCurrentError(period);
    }

    // #186: one board for the combined layout, one per list for the per-list layout.
    const boards: RankingBoard[] =
      layout === "combined"
        ? [{ sourceTools: scoredTools, previousRankMap: buildPreviousRankMap(prevSnapshot?.data ?? null) }]
        : await listBoards(scoredTools, prevSnapshot?.data ?? null, persistence);

    const snapshots: RankingSnapshotInput[] = boards.map(({ list, sourceTools, previousRankMap }) => {
      const data = computeRankings(sourceTools, previousRankMap, publishedAt);
      // #186: a list board's ranks are already within the list; its tiers follow D53.
      return list
        ? { period, algorithmVersion: RANKING_ALGORITHM_VERSION, publishedAt, data: withListTiers(data), list }
        : { period, algorithmVersion: RANKING_ALGORITHM_VERSION, publishedAt, data };
    });

    if (mode === "publish") {
      if (layout === "combined") {
        await persistence.saveSnapshot(snapshots[0]!);
      } else {
        await persistence.saveListSnapshots!(snapshots);
      }
    } else if (mode === "draft") {
      await persistence.saveDraft!(snapshots[0]!);
    }

    const data = snapshots.flatMap((snapshot) => snapshot.data);
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
      mode,
      entries: data,
      layout,
      boards: snapshots.map((snapshot) => ({ list: snapshot.list ?? COMBINED_LIST, toolCount: snapshot.data.length })),
    };
  } finally {
    guard?.delete(guardKey);
  }
}
