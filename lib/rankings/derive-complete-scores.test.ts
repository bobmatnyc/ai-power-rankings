import { describe, it, expect } from "vitest";
import {
  deriveCompleteScores,
  type CompleteFactorScores,
} from "./derive-complete-scores";

/**
 * #269: `deriveCompleteScores` must read the seven multi-word factors from their
 * camelCase stored keys. Against the pre-fix code these assertions fail, because
 * the old helper read snake_case keys that never exist in the stored object, so
 * every factor collapsed to `overall × multiplier`.
 */
describe("deriveCompleteScores (#269)", () => {
  // A stored factor_scores object exactly as it is persisted: camelCase keys.
  const storedCamelCase = {
    overall: 80,
    agenticCapability: 61,
    innovation: 44,
    technicalPerformance: 73,
    developerAdoption: 58,
    marketTraction: 66,
    businessSentiment: 71,
    developmentVelocity: 39,
    platformResilience: 52,
  };
  const overallScore = 80;

  it("uses the real camelCase stored value for every factor, not overall×multiplier", () => {
    const result = deriveCompleteScores(storedCamelCase, overallScore);

    // Each output factor equals its real stored value (snake_case output key).
    expect(result.agentic_capability).toBe(61);
    expect(result.technical_performance).toBe(73);
    expect(result.developer_adoption).toBe(58);
    expect(result.market_traction).toBe(66);
    expect(result.business_sentiment).toBe(71);
    expect(result.development_velocity).toBe(39);
    expect(result.platform_resilience).toBe(52);

    // innovation (single word) and overall were always correct and stay so.
    expect(result.innovation).toBe(44);
    expect(result.overall).toBe(80);

    // Guard: none of these may be the synthetic overall×multiplier value.
    expect(result.agentic_capability).not.toBe(overallScore * 0.9);
    expect(result.technical_performance).not.toBe(overallScore * 0.82);
    expect(result.development_velocity).not.toBe(overallScore * 0.7);
  });

  it("keeps the public OUTPUT keys snake_case", () => {
    const result = deriveCompleteScores(storedCamelCase, overallScore);
    expect(Object.keys(result).sort()).toEqual(
      [
        "agentic_capability",
        "business_sentiment",
        "developer_adoption",
        "development_velocity",
        "innovation",
        "market_traction",
        "overall",
        "platform_resilience",
        "technical_performance",
      ].sort()
    );
  });

  it("applies the base×multiplier fallback only when a factor key is truly absent", () => {
    // A genuinely partial tool: only two factors stored, the rest absent.
    const partial = { overall: 50, agenticCapability: 48 };
    const result = deriveCompleteScores(partial, 50);

    // Present factor: real stored value.
    expect(result.agentic_capability).toBe(48);
    // Absent factors: degrade gracefully via the fixed multiplier.
    expect(result.technical_performance).toBe(50 * 0.82);
    expect(result.developer_adoption).toBe(50 * 0.78);
    expect(result.market_traction).toBe(50 * 0.75);
    expect(result.business_sentiment).toBe(50 * 0.85);
    expect(result.development_velocity).toBe(50 * 0.7);
    expect(result.platform_resilience).toBe(50 * 0.72);
    expect(result.innovation).toBe(50 * 0.85);
  });

  it("falls back to the multiplier when factor_scores is empty", () => {
    const result = deriveCompleteScores({}, 90);
    expect(result.agentic_capability).toBe(90 * 0.9);
    expect(result.platform_resilience).toBe(90 * 0.72);
    expect(result.overall).toBe(90);
  });
});

/**
 * #269 CONSTRAINT: the fix re-sources only the factor breakdown. It must not
 * change ranking ORDER. `deriveCompleteScores` reads nothing but factor keys and
 * the overall score, and returns only factor fields, so rank/position/score are
 * untouched and the ordering of a board is identical before and after.
 */
describe("deriveCompleteScores does not affect ranking order (#269)", () => {
  // Minimal board rows carrying rank/position/score fields the route reads
  // straight from storage, plus camelCase factor_scores.
  const board = [
    { tool_slug: "b", position: 1, rank: 1, score: 88, factor_scores: { agenticCapability: 70 } },
    { tool_slug: "a", position: 2, rank: 2, score: 77, factor_scores: { agenticCapability: 60 } },
    { tool_slug: "c", position: 3, rank: 3, score: 66, factor_scores: { agenticCapability: 50 } },
  ];

  it("returns only factor fields — no rank/position/score key", () => {
    const result = deriveCompleteScores(board[0].factor_scores, board[0].score);
    const keys = Object.keys(result);
    expect(keys).not.toContain("rank");
    expect(keys).not.toContain("position");
    expect(keys).not.toContain("score");
  });

  it("does not mutate the stored row it reads", () => {
    const row = board[0];
    const before = JSON.stringify(row);
    deriveCompleteScores(row.factor_scores, row.score);
    expect(JSON.stringify(row)).toBe(before);
  });

  it("the sequence of slugs ordered by position is unchanged after deriving factors", () => {
    const orderBefore = board.map((r) => r.tool_slug);

    // Same transform the route performs: attach derived factors, then sort by
    // position exactly as `app/api/rankings/current/route.ts` does.
    const transformed = board.map((r) => ({
      tool_slug: r.tool_slug,
      position: r.position,
      score: r.score,
      factor_scores: deriveCompleteScores(r.factor_scores, r.score) as CompleteFactorScores,
    }));
    transformed.sort((x, y) => (x.position || 999) - (y.position || 999));

    expect(transformed.map((r) => r.tool_slug)).toEqual(orderBefore);
    // Rank-bearing fields pass through untouched.
    expect(transformed.map((r) => r.position)).toEqual([1, 2, 3]);
    expect(transformed.map((r) => r.score)).toEqual([88, 77, 66]);
  });
});
