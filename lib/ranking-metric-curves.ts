/**
 * Continuous (log-interpolated) contribution curves for `monthly_arr` and
 * `users` in the v7.6 ranking algorithm.
 *
 * Why: both metrics previously used step bands, so a tool sitting just below a
 * threshold scored identically to one far beneath it, then jumped several
 * points the moment it crossed. Because the live Top-15 is a razor-thin cluster
 * (adjacent score gaps of 0.025-0.66), those step jumps translated into abrupt
 * multi-rank moves month over month. The owner asked for smooth drift instead.
 *
 * What: the original band thresholds are kept verbatim as *anchor points*, and
 * we interpolate between them on a log10 scale. This is deliberately
 * conservative:
 *   - At an exact anchor value the curve returns exactly the old band score
 *     (1M ARR -> 25, 100K users -> 20), so calibration is preserved.
 *   - Below the first anchor the score is 0 and above the last it clamps at the
 *     band maximum (ARR 50, users 30) — identical to today.
 *   - Only *intermediate* values change, and they move upward: the old band
 *     held the lower anchor's score across the whole interval, whereas the
 *     curve rises toward the next anchor. This is the intended smoothing.
 *
 * Log scale (not linear) is the right interpolant here because the anchors
 * themselves are geometric — they step by roughly 10x in value for a
 * near-constant increment in score. Interpolating linearly between 1M and 10M
 * would leave the curve flat across most of the decade and then spike.
 *
 * Test: see `lib/ranking-metric-curves.test.ts`.
 */

/**
 * An (input value -> score contribution) calibration point, taken directly from
 * the v7.6 step bands it replaces.
 */
export interface CurveAnchor {
  /** Metric value at which the original band awarded `score`. */
  value: number;
  /** Score contribution the original band awarded at exactly `value`. */
  score: number;
}

/**
 * ARR anchors — mirrors the original `calculateMarketTraction` bands:
 * 100K->15, 1M->25, 10M->35, 50M->40, 100M->45, 400M->50.
 * Below 100K the band awarded 0; at/above 400M it capped at 50.
 */
export const ARR_ANCHORS: readonly CurveAnchor[] = [
  { value: 100_000, score: 15 },
  { value: 1_000_000, score: 25 },
  { value: 10_000_000, score: 35 },
  { value: 50_000_000, score: 40 },
  { value: 100_000_000, score: 45 },
  { value: 400_000_000, score: 50 },
];

/**
 * User-count anchors — mirrors the original `calculateDeveloperAdoption` bands:
 * 5K->5, 10K->10, 50K->15, 100K->20, 500K->25, 1M->30.
 * Below 5K the band awarded 0; at/above 1M it capped at 30.
 */
export const USERS_ANCHORS: readonly CurveAnchor[] = [
  { value: 5_000, score: 5 },
  { value: 10_000, score: 10 },
  { value: 50_000, score: 15 },
  { value: 100_000, score: 20 },
  { value: 500_000, score: 25 },
  { value: 1_000_000, score: 30 },
];

/**
 * Log-interpolate a metric value through a monotonic anchor table.
 *
 * Contract:
 *   - Precondition: `anchors` is non-empty and strictly increasing in both
 *     `value` and `score`, with every `value > 0` (log10 requires it).
 *   - Postcondition: the result is in `[0, last.score]`, is monotonically
 *     non-decreasing in `value`, and equals `anchors[i].score` exactly at
 *     `anchors[i].value`.
 *
 * @param value - the raw metric (already numerically coerced)
 * @param anchors - calibration table, ascending
 * @returns the score contribution
 */
export function interpolateLogCurve(
  value: number,
  anchors: readonly CurveAnchor[]
): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  const first = anchors[0];
  const last = anchors[anchors.length - 1];

  // Clamp below the first anchor: matches the old bands, which awarded 0 to
  // anything under the entry threshold.
  if (value <= first.value) {
    return value === first.value ? first.score : 0;
  }

  // Clamp above the last anchor at the band maximum, exactly as today.
  if (value >= last.value) {
    return last.score;
  }

  // Locate the bracketing anchor pair and interpolate on log10.
  for (let i = 0; i < anchors.length - 1; i++) {
    const lo = anchors[i];
    const hi = anchors[i + 1];
    if (value >= lo.value && value <= hi.value) {
      const t =
        (Math.log10(value) - Math.log10(lo.value)) /
        (Math.log10(hi.value) - Math.log10(lo.value));
      return lo.score + t * (hi.score - lo.score);
    }
  }

  // Unreachable given the clamps above; keeps the function total.
  return last.score;
}

/**
 * Continuous replacement for the `monthly_arr` step band in market traction.
 *
 * @param arr - monthly/annual recurring revenue in dollars (coerced)
 * @returns 0 below $100K, rising smoothly to a cap of 50 at/above $400M
 */
export function scoreArrContribution(arr: number): number {
  return interpolateLogCurve(arr, ARR_ANCHORS);
}

/**
 * Continuous replacement for the `users` step band in developer adoption.
 *
 * @param users - user count (coerced)
 * @returns 0 below 5K, rising smoothly to a cap of 30 at/above 1M
 */
export function scoreUsersContribution(users: number): number {
  return interpolateLogCurve(users, USERS_ANCHORS);
}

/**
 * Terminal-Bench normalization ceiling (linear anchor), in accuracy-percent.
 *
 * Terminal-Bench (https://www.tbench.ai/leaderboard/terminal-bench/2.1) reports
 * a single bounded accuracy in [0, 100]. Unlike ARR/users — which are unbounded,
 * geometrically-spaced business metrics that call for a log curve — a bounded
 * accuracy is best mapped LINEARLY against a fixed anchor, mirroring how the
 * agentic factor already normalizes SWE-bench (`verified / 70 * 100`).
 *
 * 85 is chosen as the anchor (rather than 100) so the current #1 row (Claude Code
 * @ 83.8%, terminal-bench 2.1) lands at ~98.6 rather than 83.8 — i.e. today's
 * best-in-class earns near-full credit while a small headroom (85→100) is
 * reserved for future gains. The algorithm owner can retune this single constant
 * to make the curve stricter (raise it) or more generous (lower it).
 */
export const TERMINAL_BENCH_ANCHOR = 85;

/**
 * Linear contribution curve for a Terminal-Bench accuracy percentage.
 *
 * Contract:
 *   - Precondition: `accuracy` is a coerced number (already run through
 *     `parseNumeric`); non-finite or ≤ 0 inputs are treated as "no data".
 *   - Postcondition: result ∈ [0, 100], monotonically non-decreasing in
 *     `accuracy`, equals 100 at/above `TERMINAL_BENCH_ANCHOR`, and returns 0 for
 *     absent/invalid data (never a spurious max).
 *
 * @param accuracy - Terminal-Bench accuracy in percent (0–100), coerced
 * @returns 0 for no-data, else `min(100, accuracy / TERMINAL_BENCH_ANCHOR * 100)`
 */
export function scoreTerminalBenchContribution(accuracy: number): number {
  if (!Number.isFinite(accuracy) || accuracy <= 0) {
    return 0;
  }
  return Math.min(100, (accuracy / TERMINAL_BENCH_ANCHOR) * 100);
}
