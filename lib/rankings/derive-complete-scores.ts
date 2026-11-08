/**
 * Derives the complete nine-dimension factor breakdown for a tool's public API
 * output (#269).
 *
 * Why: a stored `factor_scores` object keys its seven multi-word factors in
 *   camelCase (`agenticCapability`, `technicalPerformance`, …). The two public
 *   routes read them with snake_case keys, so every lookup missed and seven of
 *   eight factors silently fell back to `overall × a fixed multiplier`. This
 *   reads each factor from its real camelCase stored key while the OUTPUT keys
 *   stay snake_case, so the public API field names do not change — only the
 *   source they read from. The multiplier fallback is kept for a genuinely
 *   partial tool, but a present stored value is now always used.
 * What: pure. Reads `overall`/`innovation` (already single-word, unchanged) and
 *   the seven camelCase factors from `partialScores`, falling back to
 *   `base × multiplier` only when a key is truly absent. `base` is the overall
 *   score (or the stored `overall`). Touches no rank/position/score field.
 * Test: `lib/rankings/derive-complete-scores.test.ts`.
 */

/** The nine-dimension factor breakdown, snake_case to match the public API. */
export interface CompleteFactorScores {
  overall: number;
  agentic_capability: number;
  innovation: number;
  technical_performance: number;
  developer_adoption: number;
  market_traction: number;
  business_sentiment: number;
  development_velocity: number;
  platform_resilience: number;
}

/**
 * Derives complete factor scores from a stored `factor_scores` object.
 *
 * @param partialScores the stored object; multi-word factors are camelCase keyed.
 * @param overallScore the tool's overall score, used as the fallback baseline.
 */
export function deriveCompleteScores(
  partialScores: any,
  overallScore: number
): CompleteFactorScores {
  // If we have an overall score, use it to derive genuinely-absent dimensions.
  const base = overallScore || partialScores?.overall || 0;

  return {
    // #269: read factors from their camelCase stored keys; the fixed multiplier
    // is the fallback for a truly-absent factor only.
    overall: partialScores?.overall || base,
    agentic_capability: partialScores?.agenticCapability ?? base * 0.9,
    innovation: partialScores?.innovation ?? base * 0.85,
    technical_performance: partialScores?.technicalPerformance ?? base * 0.82,
    developer_adoption: partialScores?.developerAdoption ?? base * 0.78,
    market_traction: partialScores?.marketTraction ?? base * 0.75,
    business_sentiment: partialScores?.businessSentiment ?? base * 0.85,
    development_velocity: partialScores?.developmentVelocity ?? base * 0.7,
    platform_resilience: partialScores?.platformResilience ?? base * 0.72,
  };
}
