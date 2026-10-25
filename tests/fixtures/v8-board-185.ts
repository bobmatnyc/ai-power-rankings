/**
 * Synthetic boards for the #185 v8 measurement tests. No real tool data.
 *
 * Why: the measurement runs the real engine, so the fixtures steer only the
 *   two factors D44 changes. Technical performance follows `context_window`
 *   (50 + cw / 100000 * 20 below 100k) and developer adoption follows `users`
 *   (a continuous curve); every other input is identical, so every other
 *   factor, data completeness and the tiebreakers are equal across tools.
 *   Names and slugs are sentinels a test can search the report for.
 * What: `harnessBoard()` is a dense harness board whose tools trade technical
 *   against adoption. D44 lowers both weights by the same amount, so it keeps
 *   their order, while the negative-control weights (technical .12,
 *   adoption .24) must move some tool more than 2 places. `mixedBoard()` adds
 *   model tools whose global moves are large while harness order is fixed.
 * Test: used by `lib/v8-board-measurement.test.ts`
 */

import type { RankingWeightsV76 } from "../../lib/ranking-algorithm-v76";
import { computeRankings } from "../../lib/services/ranking-generation.service";
import type { MeasuredTool, PublishedSnapshot } from "../../lib/v8-board-measurement";
import type { ToolIdentity } from "../../lib/v8-published-id-resolution";

export const SENTINEL = "Qzsentinel";
export const FIXTURE_DATE = new Date("2026-10-01T09:00:00.000Z");

function tool(id: string, kind: string, contextWindow: number, users: number): MeasuredTool {
  const name = `${SENTINEL} ${kind} ${id}`;
  return {
    id: `${SENTINEL.toLowerCase()}-id-${id}`,
    name,
    slug: `${SENTINEL.toLowerCase()}-${kind}-${id}`,
    category: "code-editor",
    status: "active",
    kind,
    data: {
      description: "Synthetic fixture tool for the v8 measurement tests",
      features: ["one", "two", "three"],
      technical: { context_window: contextWindow },
      metrics: { users },
    },
  };
}

/**
 * Harness tools on a line from technical-heavy to adoption-heavy, so the
 * sum of the two factors is close for all of them, plus one model tool (a
 * board where every tool is harness fails the measurement's kind check).
 */
export function harnessBoard(count = 24): MeasuredTool[] {
  return [...harnessLine(count), tool("x-m0", "model", 60_000, 200_000)];
}

function harnessLine(count: number): MeasuredTool[] {
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    // Technical 52..68 as t rises; users 1M..20K as t rises (adoption falls).
    const contextWindow = Math.round(10_000 + t * 80_000);
    const users = Math.round(1_000_000 * Math.pow(0.02, t));
    return tool(`h${String(i).padStart(2, "0")}`, "harness", contextWindow, users);
  });
}

/**
 * Harness tools with one context window (equal technical) and spread users,
 * so any weights keep their order, plus model tools that trade technical
 * against adoption and cross many harness tools when the weights change.
 */
export function mixedBoard(): MeasuredTool[] {
  const harness = Array.from({ length: 12 }, (_, i) =>
    tool(`m-h${String(i).padStart(2, "0")}`, "harness", 50_000, Math.round(1_000_000 * Math.pow(0.75, i)))
  );
  const models = Array.from({ length: 16 }, (_, i) => {
    const t = i / 15;
    return tool(`m-m${String(i).padStart(2, "0")}`, "model", Math.round(5_000 + t * 90_000), Math.round(900_000 * Math.pow(0.01, t)));
  });
  // An unusable company type makes the engine warn with the tool id (#241).
  // #185: a productivity tool, not `other`: v8.0 has no `other` profile (owner ruling, Q3).
  const productivity = tool("m-p0", "productivity", 30_000, 50_000);
  productivity.data = { ...productivity.data, company: 42 };
  return [...harness, ...models, productivity];
}

/**
 * #185: four identical harness tools (an exact tie under any weights) among
 * distinct ones. A candidate run ranks the tie by published v7.10 position
 * (D8f), so reversing the published order inside the tie moves no tool; under
 * the earlier `tool_id` order it moved one tool 3 places.
 */
export function tiedHarnessBoard(): MeasuredTool[] {
  const tie = ["t-a", "t-b", "t-c", "t-d"].map((id) => tool(id, "harness", 40_000, 300_000));
  const spread = [tool("t-e", "harness", 80_000, 900_000), tool("t-f", "harness", 20_000, 30_000)];
  return [...tie, ...spread, tool("t-m0", "model", 60_000, 200_000)];
}

/**
 * #185: `mixedBoard()` plus one technical-heavy harness tool (`-r0`). The other
 * harness tools share one context window, so they keep their order under any
 * weights; under the negative-control weights the extra tool drops more than
 * 2 places among them.
 */
export function retiredMoverBoard(): MeasuredTool[] {
  return [...mixedBoard(), tool("r0", "harness", 95_000, 60_000)];
}

/** #185: the `tools` identity rows of a board with no redirects: every tool active under its own id. */
export function activeIdentities(tools: MeasuredTool[]): ToolIdentity[] {
  return tools.map((t) => ({ id: t.id, slug: t.slug, status: "active", redirectTo: null }));
}

/** The snapshot `computeRankings()` would have published for `tools` with `weights`. */
export function publishedFor(tools: MeasuredTool[], weights: RankingWeightsV76, version = "7.10"): PublishedSnapshot {
  const rows = computeRankings(tools, new Map(), FIXTURE_DATE, weights);
  return { algorithmVersion: version, publishedAt: FIXTURE_DATE, rows: JSON.parse(JSON.stringify(rows)) };
}

/** Negative control: the "wrong implementation" weights from the #185 plan (technical .12, adoption .24). */
export function negativeControlWeights(base: RankingWeightsV76): RankingWeightsV76 {
  return { ...base, technicalPerformance: 0.12, developerAdoption: 0.24 };
}
