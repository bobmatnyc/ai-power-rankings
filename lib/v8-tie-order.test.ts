import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIXTURE_DATE } from "../tests/fixtures/v8-board-185";
import { profileRouting } from "./scoring-kind-routing";
import { loadCheckedInScoringProfiles } from "./scoring-profiles";
import { computeRankings } from "./services/ranking-generation.service";
import type { MeasuredTool } from "./v8-board-measurement";
import { v8TieOrder } from "./v8-tie-order";

/**
 * D8f — v8 ties follow the published v7.10 position; new tools go last.
 *
 * Why: equal v8 scores were ranked in `tool_id` order. D8f ranks them by the
 *   published v7.10 position, with tools that have no position last.
 * What: scores synthetic harness tools with the staged v8.0 routing through
 *   `computeRankings()`, ordered by `v8TieOrder()`. Identical tool data gives
 *   an exact tie; a different `users` count gives a different score. Tool ids
 *   are chosen so `tool_id` order disagrees with the v7.10 order.
 * Test: `npx vitest run lib/v8-tie-order.test.ts`
 */

const v8 = profileRouting(loadCheckedInScoringProfiles(), "v8.0");

function tool(id: string, users = 300_000): MeasuredTool {
  return {
    id,
    name: `Synthetic ${id}`,
    slug: `synthetic-${id}`,
    category: "code-editor",
    status: "active",
    kind: "harness",
    data: {
      description: "Synthetic fixture tool for the D8f tie-order tests",
      features: ["one", "two", "three"],
      technical: { context_window: 40_000 },
      metrics: { users },
    },
  };
}

/** v8 board order (tool ids, best first) for `tools` with v7.10 positions `v710`. */
function v8Order(tools: MeasuredTool[], v710: Record<string, number>): string[] {
  const rows = computeRankings(v8TieOrder(tools, new Map(Object.entries(v710))), new Map(), FIXTURE_DATE, v8);
  return rows.map((r) => r.tool_id);
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("v8TieOrder (D8f)", () => {
  it("breaks a two-way tie by published v7.10 position", () => {
    const tools = [tool("tie-a"), tool("tie-b")];
    expect(v8Order(tools, { "tie-a": 2, "tie-b": 1 })).toEqual(["tie-b", "tie-a"]);
  });

  it("breaks a three-way tie by published v7.10 position, whatever the read order", () => {
    const tools = [tool("tie-a"), tool("tie-b"), tool("tie-c")];
    const v710 = { "tie-a": 7, "tie-b": 3, "tie-c": 5 };
    expect(v8Order(tools, v710)).toEqual(["tie-b", "tie-c", "tie-a"]);
    expect(v8Order([...tools].reverse(), v710)).toEqual(["tie-b", "tie-c", "tie-a"]);
  });

  it("puts a new tool (no v7.10 position) after a tied tool that has one", () => {
    // "new-a" sorts before "old-z" by id, so id order alone would put it first.
    const tools = [tool("new-a"), tool("old-z")];
    expect(v8Order(tools, { "old-z": 40 })).toEqual(["old-z", "new-a"]);
  });

  it("orders tied new tools by tool_id, whatever the read order", () => {
    const tools = [tool("new-c"), tool("new-a"), tool("new-b")];
    expect(v8Order(tools, {})).toEqual(["new-a", "new-b", "new-c"]);
    expect(v8Order([...tools].reverse(), {})).toEqual(["new-a", "new-b", "new-c"]);
  });

  it("leaves tools with different v8 scores in score order, even against the v7.10 order", () => {
    const tools = [tool("low", 50_000), tool("mid", 300_000), tool("high", 900_000)];
    const byScore = computeRankings(tools, new Map(), FIXTURE_DATE, v8).map((r) => r.tool_id);
    expect(byScore).toEqual(["high", "mid", "low"]);
    // v7.10 positions reversed: no tie, so they change nothing.
    expect(v8Order(tools, { low: 1, mid: 2, high: 3 })).toEqual(byScore);
  });

  it("returns a permutation of its input and does not mutate it", () => {
    const tools = [tool("b"), tool("a")];
    const ordered = v8TieOrder(tools, new Map([["a", 1]]));
    expect(ordered.map((t) => t.id)).toEqual(["a", "b"]);
    expect(tools.map((t) => t.id)).toEqual(["b", "a"]);
  });
});
