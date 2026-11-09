/**
 * Regression coverage for the v7.10 info-path fold (#101).
 *
 * Bug: double-nested tools keep `technical` / `business` under `data.info.*`,
 * while most factor read sites look at `data.technical` / `data.business`. Those
 * tools scored as if they had no technical or pricing data
 * (technicalPerformance stuck at 40).
 *
 * Invariants pinned here (plan ACs 1-7):
 *  1. Placement invariance: nested-only, top-only and both score identically.
 *  2. Precedence: top-level wins per key; nested-only keys survive.
 *  3. Flat tool: score pinned to the v7.9 value.
 *  4. Nested tool with empty/absent groups: score pinned to the v7.9 value.
 *  5. Input is not mutated.
 *  6. Version is v7.11 everywhere it is stamped (v7.10 introduced the fold; De4 bumped it).
 *  7. An object-valued nested `info.company` is not folded and does not throw.
 *
 * DB-free: builds engine inputs the way `computeRankings()` does.
 */

import { describe, expect, it } from "vitest";
import {
  ALGORITHM_V76_WEIGHTS,
  ALGORITHM_VERSION,
  RankingEngineV76,
  type ToolMetricsV76,
} from "./ranking-algorithm-v76";
import { canonicalizeInfoGroup, canonicalizeInfoGroups } from "./ranking-info-paths";
import { RANKING_ALGORITHM_VERSION } from "./services/ranking-generation.service";

const FIXED_DATE = new Date("2026-07-15T00:00:00Z");

const TECHNICAL = {
  context_window: 200_000,
  language_support: ["typescript", "python", "go", "rust", "java", "c++", "ruby", "php", "kotlin", "swift"],
  llm_providers: ["anthropic", "openai", "google"],
  ide_integration: "VS Code, JetBrains",
  multi_file_support: true,
};

const BUSINESS = {
  pricing_model: "freemium",
  base_price: 20,
  free_tier: true,
  enterprise_pricing: true,
};

const DESCRIPTION = "A code editor tool for testing info path resolution.";

/** Build an engine input the same way computeRankings() does. */
function engineInput(data: Record<string, unknown>, slug = "fixture-tool"): ToolMetricsV76 {
  return {
    tool_id: `id-${slug}`,
    name: slug,
    slug,
    category: "code-editor",
    status: "active",
    info: data,
    metrics: (data["metrics"] as Record<string, unknown>) ?? {},
  } as ToolMetricsV76;
}

/** Double-nested tool with technical/business data at a chosen placement. */
function nestedTool(
  placement: "nested" | "top" | "both",
  groups: Record<string, unknown> = { technical: TECHNICAL, business: BUSINESS }
): ToolMetricsV76 {
  return engineInput({
    description: DESCRIPTION,
    ...(placement !== "nested" ? structuredClone(groups) : {}),
    info: {
      description: DESCRIPTION,
      ...(placement !== "top" ? structuredClone(groups) : {}),
      metrics: { users: 100_000 },
    },
    metrics: { vscode: { installs: 50_000 } },
  });
}

const engine = new RankingEngineV76();
const v79Engine = new RankingEngineV76(ALGORITHM_V76_WEIGHTS, {}, { foldInfoGroups: false });

describe("canonicalizeInfoGroup", () => {
  it("top-level wins per key and nested-only keys survive", () => {
    const merged = canonicalizeInfoGroup(
      { context_window: 1_000_000 },
      { context_window: 8_000, llm_providers: ["openai"] }
    );
    expect(merged).toEqual({ context_window: 1_000_000, llm_providers: ["openai"] });
  });

  it("returns undefined when neither path holds an object", () => {
    expect(canonicalizeInfoGroup(undefined, undefined)).toBeUndefined();
    expect(canonicalizeInfoGroup("n/a", null)).toBeUndefined();
  });

  it("folds only technical and business, never company or other info fields", () => {
    const groups = canonicalizeInfoGroups(
      {},
      { technical: { a: 1 }, business: { b: 2 }, company: { name: "Acme" }, features: ["x"] }
    );
    expect(Object.keys(groups).sort()).toEqual(["business", "technical"]);
  });

  it("keeps a non-object top-level value instead of replacing it", () => {
    expect(canonicalizeInfoGroups({ technical: "unknown" }, { technical: { a: 1 } })).toEqual({});
  });
});

describe("RankingEngineV76 info-path fold (#101)", () => {
  it("AC1: scores identically whether technical/business live nested, top, or both", () => {
    const nested = engine.calculateToolScore(nestedTool("nested"), FIXED_DATE);
    const top = engine.calculateToolScore(nestedTool("top"), FIXED_DATE);
    const both = engine.calculateToolScore(nestedTool("both"), FIXED_DATE);

    expect(nested.factorScores).toEqual(top.factorScores);
    expect(both.factorScores).toEqual(top.factorScores);
    expect(nested.overallScore).toBe(top.overallScore);
    expect(both.overallScore).toBe(top.overallScore);
    expect(nested.tiebreakers).toEqual(top.tiebreakers);
  });

  it("AC1: nested-only technical data reaches technicalPerformance (v7.9 scored the base 40)", () => {
    const after = engine.calculateToolScore(nestedTool("nested"), FIXED_DATE);
    const before = v79Engine.calculateToolScore(nestedTool("nested"), FIXED_DATE);
    expect(before.factorScores.technicalPerformance).toBe(40);
    expect(after.factorScores.technicalPerformance).toBeGreaterThan(40);
    expect(after.overallScore).toBeGreaterThan(before.overallScore);
  });

  it("AC2: when both paths disagree, the top-level value wins and nested-only keys survive", () => {
    const conflicting = engineInput({
      description: DESCRIPTION,
      technical: { context_window: 1_000_000 },
      info: {
        description: DESCRIPTION,
        technical: { context_window: 8_000, llm_providers: TECHNICAL.llm_providers },
        metrics: { users: 100_000 },
      },
      metrics: { vscode: { installs: 50_000 } },
    });
    const expected = engineInput({
      description: DESCRIPTION,
      technical: { context_window: 1_000_000, llm_providers: TECHNICAL.llm_providers },
      info: { description: DESCRIPTION, metrics: { users: 100_000 } },
      metrics: { vscode: { installs: 50_000 } },
    });

    const got = engine.calculateToolScore(conflicting, FIXED_DATE);
    const want = engine.calculateToolScore(expected, FIXED_DATE);
    expect(got.factorScores).toEqual(want.factorScores);
    expect(got.overallScore).toBe(want.overallScore);
  });

  it("AC3: a flat tool scores exactly as on v7.9", () => {
    const flat = engineInput({
      description: DESCRIPTION,
      technical: TECHNICAL,
      business: BUSINESS,
      metrics: { users: 100_000, vscode: { installs: 50_000 } },
    });
    const score = engine.calculateToolScore(flat, FIXED_DATE);
    // Pinned from origin/main c3384f74 (v7.9).
    expect(score.overallScore).toBe(49.925);
    expect(score.factorScores).toEqual(v79Engine.calculateToolScore(flat, FIXED_DATE).factorScores);
  });

  it("AC4: a nested tool with empty or absent technical/business scores exactly as on v7.9", () => {
    const empty = nestedTool("nested", { technical: {}, business: {} });
    const absent = nestedTool("nested", {});
    for (const tool of [empty, absent]) {
      const after = engine.calculateToolScore(tool, FIXED_DATE);
      const before = v79Engine.calculateToolScore(tool, FIXED_DATE);
      expect(after.factorScores).toEqual(before.factorScores);
      // Pinned from origin/main c3384f74 (v7.9).
      expect(after.overallScore).toBe(34.446);
    }
  });

  it("AC5: does not mutate the input", () => {
    const tool = nestedTool("both");
    const snapshot = structuredClone(tool);
    engine.calculateToolScore(tool, FIXED_DATE);
    expect(tool).toEqual(snapshot);
  });

  it("AC7: an object-valued nested info.company is not folded and does not throw", () => {
    const tool = engineInput({
      description: DESCRIPTION,
      info: {
        description: DESCRIPTION,
        company: { name: "Acme AI" },
        technical: TECHNICAL,
        metrics: { users: 100_000 },
      },
      metrics: {},
    });
    const score = engine.calculateToolScore(tool, FIXED_DATE);
    expect(Number.isFinite(score.overallScore)).toBe(true);
    expect(score.factorScores.technicalPerformance).toBeGreaterThan(40);
  });
});

// #101: folded nested leaves reach read sites that assumed `string[]` / `string`.
describe("malformed technical/business leaves (#101)", () => {
  const MALFORMED: unknown[] = [null, 0, 7, true, {}, { a: 1 }, [], [1, null], "", "Proprietary, Fork"];
  const LEAVES = [
    "ide_integration",
    "language_support",
    "llm_providers",
    "context_window",
    "max_context_window",
    "multi_file_support",
    "subprocess_support",
    "performance",
    "swe_bench_score",
  ];
  const BUSINESS_LEAVES = ["pricing_model", "base_price", "free_tier", "enterprise_pricing"];

  it("never throws or yields NaN for a malformed leaf at either path", () => {
    for (const [group, keys] of [["technical", LEAVES], ["business", BUSINESS_LEAVES]] as const) {
      for (const key of keys) {
        for (const value of MALFORMED) {
          for (const placement of ["nested", "top"] as const) {
            const tool = nestedTool(placement, { [group]: { [key]: value } });
            for (const e of [engine, v79Engine]) {
              const label = `${group}.${key}=${JSON.stringify(value)} (${placement})`;
              const score = (() => {
                try {
                  return e.calculateToolScore(tool, FIXED_DATE).overallScore;
                } catch (error) {
                  throw new Error(`${label} threw: ${(error as Error).message}`);
                }
              })();
              expect(Number.isFinite(score), label).toBe(true);
            }
          }
        }
      }
    }
  });

  it("counts a comma-separated string by its items, not its characters", () => {
    const technical = (language_support: unknown, llm_providers: unknown) =>
      engine.calculateToolScore(nestedTool("nested", { technical: { language_support, llm_providers } }), FIXED_DATE)
        .factorScores;
    const asList = technical(["ts", "py", "go"], ["anthropic", "openai"]);
    expect(technical("ts, py,, go ", "anthropic,openai")).toEqual(asList);
    // A non-list, non-string leaf counts 0, like an absent one.
    expect(technical({ length: 50 }, 12)).toEqual(technical(undefined, undefined));
  });
});

describe("version stamp (#101, De4)", () => {
  it("AC6: engine, score and persisted version all read v7.11", () => {
    expect(ALGORITHM_VERSION).toBe("v7.11");
    expect(RankingEngineV76.getAlgorithmInfo().version).toBe("v7.11");
    const score = engine.calculateToolScore(nestedTool("nested"), FIXED_DATE);
    expect(score.algorithm_version).toBe("v7.11");
    // Stored without the "v"; a string, so "7.10" never collapses to 7.1.
    expect(RANKING_ALGORITHM_VERSION).toBe("7.11");
  });
});
