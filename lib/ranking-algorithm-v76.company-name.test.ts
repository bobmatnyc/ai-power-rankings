/**
 * De4: the company name is not a score input.
 *
 * Why: parent-company funding and valuation count for no tool, so a listed
 *   big-name vendor must not out-score an unknown vendor on name alone.
 * What: scores two otherwise identical synthetic tools that differ only in the
 *   company name, then guards the live engine source against a vendor-name list.
 * Test: this file. DB-free, synthetic data only.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RankingEngineV76, type ToolMetricsV76 } from "./ranking-algorithm-v76";

const FIXED_DATE = new Date("2026-07-15T00:00:00Z");

function toolWith(companyFields: Record<string, unknown>): ToolMetricsV76 {
  const data: Record<string, unknown> = {
    description: "An autonomous agent for code review and refactoring workflows.",
    features: ["review", "refactor", "test"],
    metrics: { employees: 30 },
    ...companyFields,
  };
  return {
    tool_id: "id-fixture-name-tool",
    name: "fixture-name-tool",
    slug: "fixture-name-tool",
    category: "autonomous-agent",
    status: "active",
    info: data,
    metrics: data["metrics"] as Record<string, unknown>,
  } as ToolMetricsV76;
}

const BIG_NAMES = ["Google", "Microsoft", "Meta", "Amazon", "GitHub", "Anthropic", "OpenAI"];

describe("RankingEngineV76 — no company-name bonus (De4)", () => {
  const engine = new RankingEngineV76();

  it.each(BIG_NAMES)("scores company %s the same as an unknown vendor", (name) => {
    const unknown = engine.calculateToolScore(toolWith({ company: "Acme Labs" }), FIXED_DATE);
    const listed = engine.calculateToolScore(toolWith({ company: name }), FIXED_DATE);
    expect(listed).toEqual(unknown);
  });

  it("scores a big-name company_name the same as an unknown vendor", () => {
    const unknown = engine.calculateToolScore(toolWith({ company_name: "Acme Labs" }), FIXED_DATE);
    const listed = engine.calculateToolScore(toolWith({ company_name: "Google DeepMind" }), FIXED_DATE);
    expect(listed).toEqual(unknown);
  });

  it("keeps no vendor-name list in the live engine source", () => {
    const source = readFileSync(join(__dirname, "ranking-algorithm-v76.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const name of BIG_NAMES) {
      expect(source, `quoted vendor name ${name}`).not.toMatch(new RegExp(`["'\`]${name}["'\`]`));
    }
    expect(source).not.toMatch(/majorCompanies/);
  });
});
