/**
 * Unit coverage for the current v7.6 ranking engine (RankingEngineV76).
 *
 * Why: `calculateToolScore` is the scoring/weighting entry point behind every
 * generated ranking, yet it had zero tests. This pins the behaviours that the
 * rankings depend on: weighted aggregation of factor scores, the data-
 * completeness confidence multiplier (0.7 with no data → 1.0 with full data),
 * factor-score range invariants, determinism, and the deterministic tiebreakers.
 *
 * Test: DB-free. Constructs plain ToolMetricsV76 fixtures and asserts against the
 * pure scoring output. A fixed `currentDate` keeps maturity/news paths stable.
 */

import { describe, expect, it } from "vitest";
import {
  AGENTIC_BONUS_HEADROOM_SCALE,
  ALGORITHM_V76_WEIGHTS,
  RankingEngineV76,
  SWE_BENCH_ANCHOR,
  TB_BLEND_WEIGHT,
  type ToolMetricsV76,
} from "./ranking-algorithm-v76";

const FIXED_DATE = new Date("2026-01-15T00:00:00Z");

/** A tool with rich, real-world metrics → maximal data completeness. */
const richTool: ToolMetricsV76 = {
  tool_id: "t-rich",
  name: "Alpha Copilot",
  slug: "alpha-copilot",
  category: "code-editor",
  status: "active",
  info: {
    description:
      "An autonomous, enterprise-grade coding agent. ".repeat(10) +
      "It emphasises scalable production integration, architecture, and performance.",
    features: [
      "f1", "f2", "f3", "f4", "f5", "f6",
      "f7", "f8", "f9", "f10", "f11", "f12",
    ],
    company: "OpenAI",
    launch_year: 2023,
    business: {
      pricing_model: "subscription",
      base_price: 100,
      free_tier: true,
      enterprise_pricing: true,
    },
    technical: {
      max_context_window: 1_000_000,
      multi_file_support: true,
      language_support: Array.from({ length: 20 }, (_, i) => `lang-${i}`),
      llm_providers: ["openai", "anthropic", "google", "meta", "mistral"],
    },
    metrics: {
      users: 1_000_000,
      monthly_arr: 400_000_000,
      github_stars: 50_000,
      news_mentions: 20,
      valuation: 5_000_000_000,
      swe_bench: { verified: 65 },
    },
  },
};

/** A tool with essentially no verifiable metrics → minimal data completeness. */
const bareTool: ToolMetricsV76 = {
  tool_id: "t-bare",
  name: "Zeta Tool",
  slug: "zeta-tool",
  category: "app-builder",
  status: "active",
  info: {},
};

describe("RankingEngineV76", () => {
  const engine = new RankingEngineV76(ALGORITHM_V76_WEIGHTS);

  describe("getAlgorithmInfo", () => {
    it("reports the current v7.9 methodology and weights", () => {
      const info = RankingEngineV76.getAlgorithmInfo();
      expect(info.version).toBe("v7.9");
      expect(info.weights).toEqual(ALGORITHM_V76_WEIGHTS);
    });

    it("has positive weights that sum to approximately unity", () => {
      const values = Object.values(ALGORITHM_V76_WEIGHTS);
      for (const w of values) {
        expect(w).toBeGreaterThan(0);
        expect(w).toBeLessThanOrEqual(1);
      }
      // NOTE: the v7.6 weights currently total 1.02 (not exactly 1.0). The
      // confidence multiplier and score cap absorb this, but it is pinned here
      // so any future re-weighting is a deliberate, visible change.
      const total = values.reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1.02, 6);
    });
  });

  describe("calculateToolScore", () => {
    it("echoes identifiers and stamps the algorithm version", () => {
      const score = engine.calculateToolScore(richTool, FIXED_DATE);
      expect(score.tool_id).toBe("t-rich");
      expect(score.tool_slug).toBe("alpha-copilot");
      expect(score.algorithm_version).toBe("v7.9");
    });

    it("keeps every factor score within the [0,100] range", () => {
      for (const tool of [richTool, bareTool]) {
        const { factorScores } = engine.calculateToolScore(tool, FIXED_DATE);
        for (const value of Object.values(factorScores)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        }
      }
    });

    it("mirrors legacy factor aliases onto their v7.6 sources", () => {
      const { factorScores } = engine.calculateToolScore(richTool, FIXED_DATE);
      expect(factorScores.technicalCapability).toBe(factorScores.technicalPerformance);
      expect(factorScores.communitySentiment).toBe(factorScores.businessSentiment);
    });

    it("gives a data-complete tool the full confidence multiplier (1.0)", () => {
      const score = engine.calculateToolScore(richTool, FIXED_DATE);
      expect(score.dataCompleteness).toBe(100);
      expect(score.confidenceMultiplier).toBeCloseTo(1.0, 6);
    });

    it("applies the missing-data penalty to an empty tool (0.7 floor)", () => {
      const score = engine.calculateToolScore(bareTool, FIXED_DATE);
      expect(score.dataCompleteness).toBe(0);
      expect(score.confidenceMultiplier).toBeCloseTo(0.7, 6);
    });

    it("ranks a data-backed tool above an unverified one", () => {
      const rich = engine.calculateToolScore(richTool, FIXED_DATE);
      const bare = engine.calculateToolScore(bareTool, FIXED_DATE);
      expect(rich.overallScore).toBeGreaterThan(bare.overallScore);
    });

    it("computes overall score as the confidence-adjusted weighted sum", () => {
      const score = engine.calculateToolScore(richTool, FIXED_DATE);
      const weightedSum = Object.entries(ALGORITHM_V76_WEIGHTS).reduce(
        (total, [factor, weight]) =>
          total + (score.factorScores[factor] ?? 0) * weight,
        0
      );
      const expected = weightedSum * score.confidenceMultiplier;
      // The engine rounds to 3 decimals and adds a sub-0.0015 tiebreaker nudge.
      expect(Math.abs(score.overallScore - expected)).toBeLessThan(0.01);
    });

    it("is deterministic for identical inputs and a fixed clock", () => {
      const a = engine.calculateToolScore(richTool, FIXED_DATE);
      const b = engine.calculateToolScore(richTool, FIXED_DATE);
      expect(a.overallScore).toBe(b.overallScore);
      expect(a.factorScores).toEqual(b.factorScores);
    });

    it("derives a deterministic alphabetical tiebreaker from the tool name", () => {
      const early = engine.calculateToolScore(
        { ...bareTool, name: "Aardvark" },
        FIXED_DATE
      );
      const late = engine.calculateToolScore(
        { ...bareTool, name: "Zzz" },
        FIXED_DATE
      );
      // (122 - 'a'/'z' charCode) * 4  →  'a' scores 100, 'z' scores 0.
      expect(early.tiebreakers.alphabeticalOrder).toBeGreaterThan(
        late.tiebreakers.alphabeticalOrder
      );
      expect(late.tiebreakers.alphabeticalOrder).toBe(0);
    });

    it("rewards higher developer-adoption signals", () => {
      const lowAdoption = engine.calculateToolScore(
        { ...bareTool, info: { metrics: { users: 100 } } },
        FIXED_DATE
      );
      const highAdoption = engine.calculateToolScore(
        { ...bareTool, info: { metrics: { users: 1_000_000 } } },
        FIXED_DATE
      );
      expect(highAdoption.factorScores.developerAdoption).toBeGreaterThan(
        lowAdoption.factorScores.developerAdoption
      );
    });
  });

  /**
   * v7.9 blend + calibration retune. These fixtures carry NO category /
   * description / multi-file signal, so with the default (headroom) bonus model
   * and zero bonus points the agentic factor equals the benchmark base exactly —
   * isolating the SWE-bench-anchor and Terminal-Bench math.
   */
  describe("calculateAgenticCapability — SWE-bench + Terminal-Bench blend", () => {
    /** Minimal tool: only the metrics under test drive the agentic factor. */
    const benchTool = (metrics: Record<string, unknown>): ToolMetricsV76 => ({
      tool_id: "t-bench",
      name: "Bench Tool",
      slug: "bench-tool",
      status: "active",
      info: { metrics },
    });

    const agentic = (metrics: Record<string, unknown>): number =>
      engine.calculateToolScore(benchTool(metrics), FIXED_DATE).factorScores
        .agenticCapability;

    // Normalized-contribution helpers against the CURRENT anchors.
    const swe = (verified: number) => Math.min(100, (verified / SWE_BENCH_ANCHOR) * 100);
    const tb = (acc: number) => Math.min(100, (acc / 85) * 100);

    it("exports a tunable blend weight defaulting to 0.4", () => {
      expect(TB_BLEND_WEIGHT).toBe(0.4);
    });

    it("normalizes SWE-bench against the retuned 88% anchor (leaders unsaturated)", () => {
      expect(SWE_BENCH_ANCHOR).toBe(88);
      // Today's best real SWE-bench (80.9%) must NOT saturate — lands low-90s.
      const leader = agentic({ swe_bench: { verified: 80.9 } });
      expect(leader).toBeCloseTo((80.9 / 88) * 100, 10);
      expect(leader).toBeGreaterThan(90);
      expect(leader).toBeLessThan(95);
    });

    it("uses SWE-bench alone when only SWE-bench is present", () => {
      // 49 / 88 * 100 = 55.6818…
      expect(agentic({ swe_bench: { verified: 49 } })).toBeCloseTo(swe(49), 10);
    });

    it("uses Terminal-Bench alone when only Terminal-Bench is present", () => {
      // 68 / 85 * 100 = 80
      expect(agentic({ terminal_bench: 68 })).toBeCloseTo(80, 10);
    });

    it("blends the two when both are present (0.6·SWE + 0.4·TB)", () => {
      const sweOnly = agentic({ swe_bench: { verified: 49 } }); // ~55.68
      const tbOnly = agentic({ terminal_bench: 68 }); // 80
      const both = agentic({ swe_bench: { verified: 49 }, terminal_bench: 68 });
      expect(both).toBeCloseTo((1 - TB_BLEND_WEIGHT) * swe(49) + TB_BLEND_WEIGHT * tb(68), 10);
      // The blend sits strictly between the two single-signal scores.
      expect(both).toBeGreaterThan(sweOnly);
      expect(both).toBeLessThan(tbOnly);
    });

    it("falls back to the neutral base (50) when neither benchmark is present", () => {
      expect(agentic({})).toBe(50);
    });

    it("coerces string-stored Terminal-Bench accuracy", () => {
      expect(agentic({ terminal_bench: "68" })).toBeCloseTo(80, 10);
    });

    it("ignores a zero/invalid Terminal-Bench value (treated as absent)", () => {
      // TB=0 is no-data, so SWE-bench alone drives the score (no blend down).
      expect(agentic({ swe_bench: { verified: 49 }, terminal_bench: 0 })).toBeCloseTo(
        swe(49),
        10
      );
    });
  });

  /**
   * v7.9 cap interaction. The heuristic bonuses (category etc.) must NOT re-cap
   * the factor to 100 and erase the benchmark blend. These tests pin the
   * headroom-fill model and contrast it with the legacy additive model (used
   * only to reconstruct the impact-analysis baseline).
   */
  describe("calculateAgenticCapability — headroom cap keeps the blend visible", () => {
    /** A tool with a category bonus (code-editor = +15) plus a benchmark. */
    const toolWith = (verified: number, terminal_bench?: number): ToolMetricsV76 => ({
      tool_id: "t-cap",
      name: "Cap Tool",
      slug: "cap-tool",
      category: "code-editor",
      status: "active",
      info: { metrics: { swe_bench: { verified }, ...(terminal_bench ? { terminal_bench } : {}) } },
    });

    const headroom = new RankingEngineV76(ALGORITHM_V76_WEIGHTS); // default: headroom
    const additive = new RankingEngineV76(ALGORITHM_V76_WEIGHTS, {
      sweBenchAnchor: 88,
      bonusModel: "additive",
    });
    const agentic = (eng: RankingEngineV76, tool: ToolMetricsV76) =>
      eng.calculateToolScore(tool, FIXED_DATE).factorScores.agenticCapability;

    it("exports the headroom scale", () => {
      expect(AGENTIC_BONUS_HEADROOM_SCALE).toBe(60);
    });

    it("legacy additive model re-saturates both leaders to 100 (blend erased)", () => {
      // base(80.9)=91.9 and base(74.9)=85.1; +15 category → both clip to 100.
      expect(agentic(additive, toolWith(80.9))).toBeCloseTo(100, 6);
      expect(agentic(additive, toolWith(74.9))).toBeCloseTo(100, 6);
    });

    it("headroom model keeps both leaders below 100 and ordered by benchmark", () => {
      const strong = agentic(headroom, toolWith(80.9));
      const weaker = agentic(headroom, toolWith(74.9));
      expect(strong).toBeLessThan(100);
      expect(weaker).toBeLessThan(100);
      // A higher SWE-bench base yields a strictly higher factor — not tied at 100.
      expect(strong).toBeGreaterThan(weaker);
      // base + (100-base)*15/60 for verified=80.9
      const base = (80.9 / 88) * 100;
      expect(strong).toBeCloseTo(base + (100 - base) * (15 / 60), 6);
    });

    it("Terminal-Bench lifts the final factor even with the category bonus present", () => {
      const withoutTB = agentic(headroom, toolWith(80.9));
      const withTB = agentic(headroom, toolWith(80.9, 83.8));
      expect(withTB).toBeGreaterThan(withoutTB);
    });
  });
});
