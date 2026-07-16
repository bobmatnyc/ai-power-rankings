/**
 * Pure time-series helpers for the historical-metrics generator.
 *
 * These are deliberately dependency-free and side-effect-free so they can be
 * unit-tested directly (see timeseries.test.ts). The generator script imports
 * them; all network I/O lives in the script, not here.
 */

/** A single day of npm/PyPI downloads as returned by the range APIs. */
export interface DailyDownload {
  day: string; // "YYYY-MM-DD"
  downloads: number;
}

/**
 * Sum the daily downloads that fall within a given calendar month.
 *
 * The npm range API (`api.npmjs.org/downloads/range/<start>:<end>/<pkg>`) returns
 * a flat array of `{ day, downloads }` spanning an arbitrary range; to get a
 * tool's "downloads_last_month" for period "YYYY-MM" we sum every day whose
 * `day` begins with that period prefix.
 *
 * @param days   Daily download records (any range; extra days are ignored).
 * @param period Target month as "YYYY-MM".
 * @returns Total downloads for that month (0 if no matching days).
 */
export function sumMonthlyDownloads(days: DailyDownload[], period: string): number {
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new Error(`sumMonthlyDownloads: period must be "YYYY-MM", got "${period}"`);
  }
  const prefix = `${period}-`;
  let total = 0;
  for (const d of days) {
    if (typeof d?.day === "string" && d.day.startsWith(prefix)) {
      total += Number(d.downloads) || 0;
    }
  }
  return total;
}

/** First-of-month UTC timestamp (ms) for a "YYYY-MM" period. */
export function periodToTime(period: string): number {
  const [y, m] = period.split("-").map(Number);
  return Date.UTC(y, m - 1, 1);
}

/**
 * Linear interpolation of a monotone-ish metric (e.g. GitHub stars, user count)
 * between two dated anchor points, evaluated at the first day of `period`.
 *
 * Clamps to the endpoints outside the anchor window so an interpolated value is
 * never extrapolated past a known real reading. Values are rounded to integers.
 *
 * @param startValue Value at `startPeriod`.
 * @param startPeriod "YYYY-MM" of the start anchor.
 * @param endValue   Value at `endPeriod`.
 * @param endPeriod  "YYYY-MM" of the end anchor.
 * @param period     Target "YYYY-MM".
 */
export function interpolateMonthly(
  startValue: number,
  startPeriod: string,
  endValue: number,
  endPeriod: string,
  period: string
): number {
  const t0 = periodToTime(startPeriod);
  const t1 = periodToTime(endPeriod);
  const t = periodToTime(period);

  if (t1 === t0) return Math.round(endValue);
  const frac = (t - t0) / (t1 - t0);
  const clamped = Math.max(0, Math.min(1, frac));
  return Math.round(startValue + (endValue - startValue) * clamped);
}
