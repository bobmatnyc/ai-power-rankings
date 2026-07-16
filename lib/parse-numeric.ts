/**
 * Robust coercion of human-written numeric values to plain numbers.
 *
 * Why: several `tools.info.metrics.*` fields (valuation, funding, monthly_arr,
 * users, employees, swe_bench.*) are stored as free-text strings rather than
 * numbers — e.g. Devin's `valuation = "$10.2B (September 2025)"` and
 * `funding = "$575M+ total raised"`. The ranking engine compared these directly
 * against numeric thresholds (`valuation >= 5_000_000_000`), which is `false`
 * for any string, so a real $10B valuation silently contributed 0 points. The
 * same strings also failed `calculateDataCompleteness`'s `value > 0` check,
 * dragging down the confidence multiplier.
 *
 * What: `parseNumeric` accepts numbers or human-written strings and returns a
 * plain `number`, or `null` when no numeric value can be recovered. Handles
 * currency symbols, thousands separators, K/M/B/T (and long-form) magnitude
 * suffixes, `+`/`~`/`>` qualifiers, percent signs, and trailing prose or
 * parenthetical text.
 *
 * IMPORTANT: this coerces at *read/scoring* time only. Stored data is never
 * mutated — the strings remain the source of truth in the database.
 *
 * Test: see `lib/parse-numeric.test.ts`.
 */

/**
 * Magnitude suffix multipliers. Long forms are included because human-entered
 * data uses them freely ("$1.2 billion total raised").
 */
const MAGNITUDE_MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  m: 1_000_000,
  mm: 1_000_000,
  million: 1_000_000,
  b: 1_000_000_000,
  bn: 1_000_000_000,
  billion: 1_000_000_000,
  t: 1_000_000_000_000,
  trillion: 1_000_000_000_000,
};

/**
 * Matches the first numeric token in a string plus an optional magnitude
 * suffix.
 *
 * Breakdown:
 *   -?                        optional sign
 *   \d[\d,]*(?:\.\d+)?        digits with optional `,` separators and decimals
 *   (?:\s*(<suffixes>)\b)?    optional magnitude suffix, word-bounded
 *
 * The `\b` on the suffix is load-bearing: without it, `"575 total raised"`
 * would read the `t` of "total" as a trillions suffix. `\b` forces the suffix
 * to end a word, so "total" backtracks to "no suffix" and yields 575.
 * Alternatives are ordered so the regex engine can still reach the long forms
 * ("million") after the short form ("m") fails its `\b` check.
 */
const NUMERIC_TOKEN =
  /(-?\d[\d,]*(?:\.\d+)?)(?:\s*(thousand|trillion|million|billion|mm|bn|k|m|b|t)\b)?/i;

/**
 * Coerce a possibly human-written numeric value to a plain number.
 *
 * @param value - a number, a human-written string, or nullish/other
 * @returns the parsed number, or `null` when no numeric value is recoverable
 *
 * @example
 * parseNumeric("$10.2B (September 2025)") // => 10_200_000_000
 * parseNumeric("$575M+ total raised")     // => 575_000_000
 * parseNumeric("1.2k")                    // => 1_200
 * parseNumeric("3,500")                   // => 3_500
 * parseNumeric("N/A")                     // => null
 */
export function parseNumeric(value: unknown): number | null {
  // Already numeric: accept only finite values (NaN/Infinity are not data).
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    // null, undefined, booleans, objects, arrays: no numeric meaning.
    return null;
  }

  const match = NUMERIC_TOKEN.exec(value);
  if (!match) {
    // No digits at all — "N/A", "unknown", "Series B", "".
    return null;
  }

  const [, digits, suffix] = match;

  // Strip thousands separators before parsing; `parseFloat` would stop at the
  // first comma and silently read "3,500" as 3.
  const base = Number.parseFloat(digits.replace(/,/g, ""));
  if (!Number.isFinite(base)) {
    return null;
  }

  if (!suffix) {
    return base;
  }

  const multiplier = MAGNITUDE_MULTIPLIERS[suffix.toLowerCase()];
  // Defensive: the regex can only produce keys present in the table, so a miss
  // would mean the two drifted apart. Fall back to the unscaled value rather
  // than silently returning NaN.
  return multiplier ? base * multiplier : base;
}

/**
 * Convenience wrapper for scoring code that wants a numeric default.
 *
 * The engine's band comparisons treat "missing" and "zero" identically for
 * every field except `monthly_arr`, where `=== 0` gates the pricing-model
 * fallback. Call sites that need to distinguish the two should use
 * `parseNumeric` directly and check for `null`.
 *
 * @param value - a number, a human-written string, or nullish/other
 * @param fallback - value returned when nothing numeric is recoverable
 */
export function parseNumericOr(value: unknown, fallback = 0): number {
  const parsed = parseNumeric(value);
  return parsed === null ? fallback : parsed;
}

/**
 * Truthy-numeric check used by data-completeness scoring.
 *
 * Replaces the old `value !== undefined && value !== null && value > 0`, which
 * returned `false` for every string-stored metric (`"$10.2B" > 0` is `false`),
 * under-reporting completeness and depressing the confidence multiplier.
 *
 * @param value - a number, a human-written string, or nullish/other
 * @returns true when the value parses to a positive number
 */
export function hasPositiveNumeric(value: unknown): boolean {
  const parsed = parseNumeric(value);
  return parsed !== null && parsed > 0;
}
