/**
 * Licence-review activation gate (#453).
 *
 * Why: a model row whose licence still needs the owner's review must not go live. Three paths
 *   can make a row `active` (lifecycle `--set-status`, metrics `--activate`, admin PUT); each
 *   asks this module, in the planner and again in its UPDATE, so a row that changed after
 *   planning still cannot activate.
 * What: `licenceActivationRefusal` reads a stored `data.modelSeed` and answers why it may not
 *   activate, or null. `licenceAllowsActivationSql` is the same rule as a SQL condition. Both
 *   fail closed: an unreadable `modelSeed`, an unknown `licenceReview` value or a `reviewed`
 *   value without a well-formed ruling id refuses. A row with no `modelSeed` or a null
 *   `licenceReview` (closed and legacy rows) is allowed. Rows already `active` are the caller's
 *   concern: every path skips this check for them (D83).
 * Test: `tests/unit/licence-gate-453.test.ts`, `tests/unit/licence-gate-pglite-453.test.ts`,
 *   `tests/unit/admin-tool-licence-453.test.ts`
 */

/** The values `data.modelSeed.licenceReview` may hold. Null means no review applies. */
export type LicenceReview = "not_required" | "pending" | "reviewed";

/**
 * #453: an owner ruling id, as the owner writes them (D63, D0c, D9rl3, Dee): D and then one or
 * more of [0-9a-z]. #453 fix: a letter may follow the D (Dee is this gate's own basis). `reviewed` needs one.
 * Kept in step with the POSIX pattern inside `licenceAllowsActivationSql`.
 */
export const RULING_ID = /^D[0-9a-z]+$/;
const RULING_ID_SQL = "^D[0-9a-z]+$";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Why: the planner on each activation path needs one fail-closed answer.
 * What: returns null when a row with this stored `data.modelSeed` may become active, else the
 *   reason. Allowed: no `modelSeed` (undefined or null); `licenceReview` absent, null or
 *   `not_required`; `reviewed` with a `licenceReviewRuling` matching `RULING_ID`. Refused:
 *   `pending`, `reviewed` without a valid ruling, any other value, and a `modelSeed` that is
 *   not an object.
 * Test: `tests/unit/licence-gate-453.test.ts`
 */
export function licenceActivationRefusal(modelSeed: unknown): string | null {
  if (modelSeed === undefined || modelSeed === null) return null;
  if (!isRecord(modelSeed)) return "data.modelSeed is not an object; the licence review cannot be read";
  const review = modelSeed["licenceReview"];
  if (review === undefined || review === null || review === "not_required") return null;
  if (review === "pending") return "licence review is pending; the owner must record a review ruling before activation";
  if (review === "reviewed") {
    const ruling = modelSeed["licenceReviewRuling"];
    if (typeof ruling === "string" && RULING_ID.test(ruling)) return null;
    return "licence review is reviewed but carries no valid licenceReviewRuling";
  }
  return `licence review has an unknown value (${JSON.stringify(review)})`;
}

/**
 * #453: the `licenceActivationRefusal` rule as a SQL condition on the jsonb expression `data`
 * (for example `data` or `"tools"."data"`). True only when the row may become active.
 */
export function licenceAllowsActivationSql(data: string): string {
  const seed = `${data}->'modelSeed'`;
  return `(${seed} IS NULL OR jsonb_typeof(${seed}) = 'null'
    OR (jsonb_typeof(${seed}) = 'object' AND (${seed}->'licenceReview' IS NULL
      OR jsonb_typeof(${seed}->'licenceReview') = 'null'
      OR ${seed}->>'licenceReview' = 'not_required'
      OR (${seed}->>'licenceReview' = 'reviewed' AND ${seed}->>'licenceReviewRuling' ~ '${RULING_ID_SQL}'))))`;
}
