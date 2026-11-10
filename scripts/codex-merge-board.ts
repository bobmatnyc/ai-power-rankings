/**
 * Before and after harness scores for the Codex merge (ar-Te2/T76). Read-only.
 *
 * Why: the owner judges the merge by where Codex lands. The rules forbid a rank override and
 *   a scoring change, so the dry run must show what the live publish code would rank, not
 *   an estimate.
 * What: `loadBoardInputs` reads the active tools and the current ranking rows (SELECT only).
 *   `scoreHarnessBoard` runs the publish path itself, `regenerateRankings` in mode "dry-run"
 *   with the per-list layout and the active profile set (`resolvePublishScoring`, v8.1),
 *   over an in-memory persistence port whose writes throw. `boardReport` scores the board
 *   twice, as stored (before) and with the merge applied in memory (after: the CLI row out,
 *   the survivor's data replaced), and prints the published, before and after rank and score
 *   of both Codex rows and the harness top 10 before and after. Slugs, ranks and scores only.
 * Test: `tests/unit/codex-merge-t76.test.ts` ("board report").
 */

import { loadCheckedInScoringProfiles } from "../lib/scoring-profiles";
import { listOfTool } from "../lib/rankings/lists";
import { resolvePublishScoring } from "../lib/rankings/publish-active";
import { snapshotRows } from "../lib/rankings/snapshot-rows";
import {
  type RankingEntry,
  type RankingPersistencePort,
  type RankingSourceTool,
  regenerateRankings,
} from "../lib/services/ranking-generation.service";
import { CODEX_OLD, CODEX_SURVIVOR } from "./codex-merge";
import type { Queryable } from "./duplicate-tool-merge";

export interface BoardInputs {
  tools: RankingSourceTool[];
  /** Current ranking row per stored list (`combined`, `harness`, ...). */
  current: Map<string, { data: unknown; period: string }>;
}

// The rows `createDbPersistence().loadActiveTools()` scores, in its slug order.
const TOOLS_SQL = `SELECT id::text AS id, name, slug, category, status, kind, data FROM public."tools"
  WHERE status = 'active' ORDER BY slug`;
const CURRENT_SQL = `SELECT list, period, data FROM public."rankings" WHERE is_current = true ORDER BY list`;

export async function loadBoardInputs(q: Queryable): Promise<BoardInputs> {
  const tools = (await q.query(TOOLS_SQL)).rows as RankingSourceTool[];
  const rows = (await q.query(CURRENT_SQL)).rows as Array<{ list: string; period: string; data: unknown }>;
  return { tools: tools.map((t) => ({ ...t, data: t.data ?? {} })), current: new Map(rows.map((r) => [r.list, { data: r.data, period: r.period }])) };
}

const refuse = async (): Promise<never> => {
  throw new Error("codex board report: the in-memory port never writes");
};

/** The harness list as the v8.1 publish would rank `tools` at `now`. Writes nothing. */
export async function scoreHarnessBoard(tools: readonly RankingSourceTool[], current: BoardInputs["current"], now: Date): Promise<RankingEntry[]> {
  const persistence: RankingPersistencePort = {
    loadActiveTools: async () => tools.map((t) => ({ ...t })),
    loadCurrentRankings: async (list = "combined") => current.get(list) ?? null,
    saveSnapshot: refuse,
    saveListSnapshots: refuse,
    saveDraft: refuse,
  };
  // The engine logs tool names on odd inputs; keep the report to its own lines.
  const saved = { log: console.log, info: console.info, warn: console.warn, debug: console.debug };
  Object.assign(console, { log: () => {}, info: () => {}, warn: () => {}, debug: () => {} });
  try {
    const result = await regenerateRankings({
      mode: "dry-run",
      layout: "per-list",
      scoring: resolvePublishScoring(loadCheckedInScoringProfiles()),
      persistence,
      now: () => now,
      metricsFreshness: "off",
    });
    const harness = new Set(tools.filter((t) => listOfTool(t.kind, t.data?.["modality"]) === "harness").map((t) => t.id));
    return result.entries.filter((e) => harness.has(e.tool_id));
  } finally {
    Object.assign(console, saved);
  }
}

/** The board with the merge applied in memory: the CLI row gone, the survivor's data replaced. */
export function mergedTools(tools: readonly RankingSourceTool[], survivorData: Record<string, unknown>): RankingSourceTool[] {
  return tools
    .filter((t) => t.slug !== CODEX_OLD.slug)
    .map((t) => (t.slug === CODEX_SURVIVOR.slug ? { ...t, data: survivorData } : t));
}

const score = (n: number) => n.toFixed(2);

function place(rows: readonly RankingEntry[], slug: string): string {
  const row = rows.find((r) => r.tool_slug === slug);
  return row ? `rank ${row.rank} score ${score(row.score)}` : "not on the board";
}

function top10(label: string, rows: readonly RankingEntry[]): string[] {
  return [`board: harness top 10 ${label}:`, ...rows.slice(0, 10).map((r) => `  ${String(r.rank).padStart(2)}. ${r.tool_slug} ${score(r.score)}`)];
}

/**
 * The report lines. `survivorData` null means there is nothing to merge (already merged):
 * before and after are then the same board.
 */
export async function boardReport(inputs: BoardInputs, survivorData: Record<string, unknown> | null, now: Date): Promise<string[]> {
  const before = await scoreHarnessBoard(inputs.tools, inputs.current, now);
  const after = survivorData ? await scoreHarnessBoard(mergedTools(inputs.tools, survivorData), inputs.current, now) : before;
  const published = inputs.current.get("harness");
  const publishedRows = snapshotRows(published?.data).map((r) => ({
    tool_slug: String(r["tool_slug"] ?? r["slug"] ?? ""),
    rank: Number(r["rank"] ?? r["position"]),
    score: Number(r["score"]),
  })) as RankingEntry[];
  const lines = [
    `board: v8.1 harness list, scored as of ${now.toISOString().slice(0, 10)} by the publish code in dry-run mode (nothing written)`,
    `board: published ${published?.period ?? "(no current harness row)"}: ${CODEX_SURVIVOR.slug} ${place(publishedRows, CODEX_SURVIVOR.slug)}; ${CODEX_OLD.slug} ${place(publishedRows, CODEX_OLD.slug)}`,
    `board: before: ${CODEX_SURVIVOR.slug} ${place(before, CODEX_SURVIVOR.slug)}; ${CODEX_OLD.slug} ${place(before, CODEX_OLD.slug)}`,
    `board: after:  ${CODEX_SURVIVOR.slug} ${place(after, CODEX_SURVIVOR.slug)}; ${CODEX_OLD.slug} ${place(after, CODEX_OLD.slug)}`,
  ];
  const factors = after.find((r) => r.tool_slug === CODEX_SURVIVOR.slug)?.factor_scores;
  if (factors) {
    const parts = Object.entries(factors).map(([k, v]) => `${k} ${typeof v === "number" ? score(v) : String(v)}`);
    lines.push(`board: after, ${CODEX_SURVIVOR.slug} factors: ${parts.join(", ")}`);
  }
  return [...lines, ...top10("before", before), ...top10("after", after)];
}
