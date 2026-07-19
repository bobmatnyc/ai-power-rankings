import { describe, expect, it } from "vitest";
import {
  ARR_ANCHORS,
  TERMINAL_BENCH_ANCHOR,
  USERS_ANCHORS,
  interpolateLogCurve,
  scoreArrContribution,
  scoreTerminalBenchContribution,
  scoreUsersContribution,
} from "./ranking-metric-curves";

/**
 * Reference implementations of the ORIGINAL v7.6 step bands, transcribed
 * verbatim from ranking-algorithm-v76.ts before this change. These exist purely
 * so the calibration tests below compare the new curve against the real old
 * behaviour rather than against a restatement of the new behaviour.
 */
function legacyArrBand(arr: number): number {
  if (arr >= 400_000_000) return 50;
  if (arr >= 100_000_000) return 45;
  if (arr >= 50_000_000) return 40;
  if (arr >= 10_000_000) return 35;
  if (arr >= 1_000_000) return 25;
  if (arr >= 100_000) return 15;
  return 0;
}

function legacyUsersBand(users: number): number {
  if (users >= 1_000_000) return 30;
  if (users >= 500_000) return 25;
  if (users >= 100_000) return 20;
  if (users >= 50_000) return 15;
  if (users >= 10_000) return 10;
  if (users >= 5_000) return 5;
  return 0;
}

describe("anchor calibration — the curve must match the old bands at anchors", () => {
  it("reproduces the legacy ARR band at every anchor value", () => {
    for (const { value } of ARR_ANCHORS) {
      expect(scoreArrContribution(value)).toBeCloseTo(legacyArrBand(value), 10);
    }
  });

  it("reproduces the legacy users band at every anchor value", () => {
    for (const { value } of USERS_ANCHORS) {
      expect(scoreUsersContribution(value)).toBeCloseTo(legacyUsersBand(value), 10);
    }
  });

  it("hits the specific anchors called out by the owner", () => {
    // "at exactly 1M ARR the contribution should still be ~25;
    //  at exactly 100K users still ~20"
    expect(scoreArrContribution(1_000_000)).toBeCloseTo(25, 10);
    expect(scoreUsersContribution(100_000)).toBeCloseTo(20, 10);
  });
});

describe("clamping — endpoints match today's behaviour exactly", () => {
  it("ARR scores 0 below the first anchor ($100K)", () => {
    expect(scoreArrContribution(0)).toBe(0);
    expect(scoreArrContribution(1)).toBe(0);
    expect(scoreArrContribution(99_999)).toBe(0);
    expect(legacyArrBand(99_999)).toBe(0); // legacy agrees
  });

  it("ARR clamps at 50 above the last anchor ($400M)", () => {
    expect(scoreArrContribution(400_000_000)).toBeCloseTo(50, 10);
    expect(scoreArrContribution(1_000_000_000)).toBe(50);
    expect(scoreArrContribution(Number.MAX_SAFE_INTEGER)).toBe(50);
  });

  it("users score 0 below the first anchor (5K)", () => {
    expect(scoreUsersContribution(0)).toBe(0);
    expect(scoreUsersContribution(4_999)).toBe(0);
    expect(legacyUsersBand(4_999)).toBe(0); // legacy agrees
  });

  it("users clamp at 30 above the last anchor (1M)", () => {
    expect(scoreUsersContribution(1_000_000)).toBeCloseTo(30, 10);
    expect(scoreUsersContribution(50_000_000)).toBe(30);
  });

  it("treats negative and non-finite inputs as no-data, not as a max score", () => {
    // Infinity is not a measurement, so it scores 0 rather than clamping to the
    // cap. In practice it never reaches here: parseNumeric rejects non-finite
    // numbers to null, which the engine coerces to 0.
    expect(scoreArrContribution(-1)).toBe(0);
    expect(scoreUsersContribution(Number.NaN)).toBe(0);
    expect(scoreArrContribution(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("monotonicity", () => {
  const sweep = (max: number) => {
    const points: number[] = [];
    for (let exp = 0; exp <= Math.log10(max) + 1; exp += 0.05) {
      points.push(10 ** exp);
    }
    return points;
  };

  it("ARR curve is monotonically non-decreasing across the full range", () => {
    let previous = -1;
    for (const value of sweep(1_000_000_000)) {
      const score = scoreArrContribution(value);
      expect(score).toBeGreaterThanOrEqual(previous);
      previous = score;
    }
  });

  it("users curve is monotonically non-decreasing across the full range", () => {
    let previous = -1;
    for (const value of sweep(10_000_000)) {
      const score = scoreUsersContribution(value);
      expect(score).toBeGreaterThanOrEqual(previous);
      previous = score;
    }
  });

  it("stays within [0, max] across the full range", () => {
    for (const value of sweep(1_000_000_000)) {
      const arr = scoreArrContribution(value);
      expect(arr).toBeGreaterThanOrEqual(0);
      expect(arr).toBeLessThanOrEqual(50);
    }
    for (const value of sweep(10_000_000)) {
      const users = scoreUsersContribution(value);
      expect(users).toBeGreaterThanOrEqual(0);
      expect(users).toBeLessThanOrEqual(30);
    }
  });
});

describe("smoothing behaviour between anchors", () => {
  it("interpolates the log midpoint of an ARR decade to the score midpoint", () => {
    // sqrt(1M * 10M) ~= 3.162M is the log-midpoint of the 1M(25)..10M(35)
    // interval, so it should score the arithmetic midpoint, 30.
    expect(scoreArrContribution(Math.sqrt(1_000_000 * 10_000_000))).toBeCloseTo(30, 6);
  });

  it("interpolates the log midpoint of a users interval to the score midpoint", () => {
    // sqrt(100K * 500K) is the log-midpoint of 100K(20)..500K(25) -> 22.5
    expect(scoreUsersContribution(Math.sqrt(100_000 * 500_000))).toBeCloseTo(22.5, 6);
  });

  it("rises above the legacy band between anchors, never below", () => {
    // The old band held the LOWER anchor's score across each interval; the
    // curve climbs toward the next anchor. So the curve is >= the band
    // everywhere, and strictly greater strictly between anchors. This is the
    // intended (upward) disruption and the reason scores shift live.
    for (let exp = 5; exp <= 8.6; exp += 0.01) {
      const value = 10 ** exp;
      expect(scoreArrContribution(value)).toBeGreaterThanOrEqual(
        legacyArrBand(value) - 1e-9
      );
    }
    // Mid-decade example: band says 25, curve says ~32.
    expect(legacyArrBand(5_000_000)).toBe(25);
    expect(scoreArrContribution(5_000_000)).toBeGreaterThan(31);
    expect(scoreArrContribution(5_000_000)).toBeLessThan(33);
  });

  it("produces no discontinuity at an anchor (the jump the owner asked us to remove)", () => {
    // Old band: 999_999 -> 15, 1_000_000 -> 25. A 1-dollar step, 10 points.
    expect(legacyArrBand(999_999) + 10).toBe(legacyArrBand(1_000_000));
    // New curve: the same 1-dollar step moves the score by < 0.001.
    const delta = scoreArrContribution(1_000_000) - scoreArrContribution(999_999);
    expect(Math.abs(delta)).toBeLessThan(0.001);
  });
});

describe("scoreTerminalBenchContribution — linear curve against the 85% anchor", () => {
  it("maps accuracy linearly below the anchor", () => {
    // accuracy / 85 * 100
    expect(scoreTerminalBenchContribution(85)).toBeCloseTo(100, 10);
    expect(scoreTerminalBenchContribution(42.5)).toBeCloseTo(50, 10);
    expect(scoreTerminalBenchContribution(17)).toBeCloseTo(20, 10);
  });

  it("gives today's leaderboard leaders near-full but sub-100 credit", () => {
    // Claude Code #1 = 83.8%, Codex #2 = 83.1% (terminal-bench 2.1).
    expect(scoreTerminalBenchContribution(83.8)).toBeCloseTo((83.8 / 85) * 100, 10);
    expect(scoreTerminalBenchContribution(83.8)).toBeLessThan(100);
    expect(scoreTerminalBenchContribution(83.1)).toBeLessThan(
      scoreTerminalBenchContribution(83.8)
    );
  });

  it("clamps at 100 at/above the anchor (headroom is only 85→100)", () => {
    expect(scoreTerminalBenchContribution(TERMINAL_BENCH_ANCHOR)).toBe(100);
    expect(scoreTerminalBenchContribution(90)).toBe(100);
    expect(scoreTerminalBenchContribution(100)).toBe(100);
  });

  it("treats absent / invalid data as no-data (0), never a max score", () => {
    expect(scoreTerminalBenchContribution(0)).toBe(0);
    expect(scoreTerminalBenchContribution(-5)).toBe(0);
    expect(scoreTerminalBenchContribution(Number.NaN)).toBe(0);
    expect(scoreTerminalBenchContribution(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("is monotonically non-decreasing and bounded across the range", () => {
    let previous = -1;
    for (let acc = 0; acc <= 120; acc += 0.5) {
      const score = scoreTerminalBenchContribution(acc);
      expect(score).toBeGreaterThanOrEqual(previous);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      previous = score;
    }
  });
});

describe("interpolateLogCurve", () => {
  it("returns the anchor score for a single-anchor table", () => {
    const anchors = [{ value: 100, score: 7 }];
    expect(interpolateLogCurve(100, anchors)).toBe(7);
    expect(interpolateLogCurve(50, anchors)).toBe(0);
    expect(interpolateLogCurve(1000, anchors)).toBe(7);
  });

  it("interpolates a simple two-anchor decade", () => {
    const anchors = [
      { value: 10, score: 0 },
      { value: 100, score: 10 },
    ];
    expect(interpolateLogCurve(10, anchors)).toBeCloseTo(0, 10);
    expect(interpolateLogCurve(100, anchors)).toBeCloseTo(10, 10);
    // log-midpoint of 10..100 is sqrt(1000) ~= 31.6 -> 5
    expect(interpolateLogCurve(Math.sqrt(1_000), anchors)).toBeCloseTo(5, 6);
  });
});
