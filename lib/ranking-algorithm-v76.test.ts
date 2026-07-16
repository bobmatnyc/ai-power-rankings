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
  ALGORITHM_V76_WEIGHTS,
  RankingEngineV76,
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
    it("reports the current v7.8 methodology and weights", () => {
      const info = RankingEngineV76.getAlgorithmInfo();
      expect(info.version).toBe("v7.8");
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
      expect(score.algorithm_version).toBe("v7.8");
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
});
