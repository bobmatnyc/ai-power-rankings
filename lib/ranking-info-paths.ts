/**
 * Canonical resolution of the `technical` and `business` info groups (#101).
 *
 * Why: the 34 double-nested tools store `technical` / `business` under
 *   `data.info.*`, but most factor read sites look at `data.technical` /
 *   `data.business`. Before v7.10 those tools scored as if they had no
 *   technical or pricing data at all (technicalPerformance stuck at 40).
 * What: `canonicalizeInfoGroups` merges each folded group from both paths into
 *   one object. Per key inside a group, the top-level value wins over the
 *   nested one (the #100 rule, owner ruling Q1); nested-only keys are kept.
 *   Only `technical` and `business` fold. The nested `company` is an object and
 *   `calculateCompanyBacking` calls `.includes` on it, so it must never be
 *   hoisted; the other `info.*` fields are tracked in #241.
 * Test: `lib/ranking-algorithm-v76.info-paths.test.ts`
 */

/** The only `info.*` groups that v7.10 folds. See #241 for the others. */
export const FOLDED_INFO_GROUPS = ["technical", "business"] as const;

export type FoldedInfoGroup = (typeof FOLDED_INFO_GROUPS)[number];

/**
 * Engine switches for info-path resolution.
 *
 * `foldInfoGroups: false` reproduces the v7.9 engine exactly (no fold). Only
 * the read-only version-compare script sets it; the publish path never does.
 */
export interface InfoPathOptions {
  foldInfoGroups?: boolean;
}

function asPlainObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Merge one group from both paths: shallow per key, top-level wins.
 *
 * Returns `undefined` when neither path holds a plain object, so a tool with
 * no group at either path never gains an empty `{}` (an empty object is truthy
 * and would change completeness checks).
 */
export function canonicalizeInfoGroup(
  top: unknown,
  nested: unknown
): Record<string, unknown> | undefined {
  const topObj = asPlainObject(top);
  const nestedObj = asPlainObject(nested);
  if (!topObj && !nestedObj) return undefined;
  return { ...(nestedObj ?? {}), ...(topObj ?? {}) };
}

/**
 * Canonical values for every folded group of a double-nested tool.
 *
 * `outer` is `tool.data`; `nestedInfo` is `tool.data.info`. A group is left
 * out of the result (so the caller keeps the existing values) when neither
 * path holds an object, or when the top-level value is present but is not an
 * object: top-level wins, and a non-object top value is kept as it was.
 * Does not mutate either input.
 */
export function canonicalizeInfoGroups(
  outer: Record<string, unknown>,
  nestedInfo: Record<string, unknown> | undefined
): Partial<Record<FoldedInfoGroup, Record<string, unknown>>> {
  const result: Partial<Record<FoldedInfoGroup, Record<string, unknown>>> = {};
  for (const group of FOLDED_INFO_GROUPS) {
    const top = outer[group];
    if (top !== undefined && top !== null && !asPlainObject(top)) continue;
    const merged = canonicalizeInfoGroup(top, nestedInfo?.[group]);
    if (merged) result[group] = merged;
  }
  return result;
}

/**
 * Item count of a list-style technical leaf (`language_support`, `llm_providers`).
 *
 * #101: v7.10 folds nested leaves into read sites that assumed `string[]`, and
 * `scripts/extract-nested-tool-data.ts` types them `string[] | string`.
 * An array counts its elements; a string counts its non-empty comma-separated
 * items; any other value (null, number, boolean, object) counts 0.
 */
export function countLeafItems(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string") return value.split(",").filter((item) => item.trim() !== "").length;
  return 0;
}

/**
 * The v7.9 read of a list-style leaf: `value?.length || 0`, unchanged.
 *
 * #101: kept so `{ foldInfoGroups: false }` stays byte-identical to v7.9; a
 * string scores its character count here. Never throws on a JSON value.
 */
export function legacyLeafLength(value: unknown): number {
  return ((value as { length?: number } | null | undefined)?.length) || 0;
}

/**
 * Whether `ide_integration` names a proprietary IDE or a fork.
 *
 * #101: `.includes` runs only on a string (substring) or an array (element),
 * which are the two shapes v7.9 accepted without throwing; any other value is
 * false instead of a TypeError that aborts the whole ranking run.
 */
export function namesProprietaryIde(value: unknown): boolean {
  if (typeof value !== "string" && !Array.isArray(value)) return false;
  return value.includes("Proprietary") || value.includes("Fork");
}
