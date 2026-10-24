/**
 * Read the rows of a stored `rankings.data` snapshot in any of its shapes (#256).
 *
 * Why: the cron and admin-draft writers store `rankings.data` as a bare array;
 *   older rows and the admin PUT store `{ rankings: [...] }`; some legacy rows
 *   hold `{ data: [...] }`. Readers that assumed one shape reported 0 rows.
 * What: `snapshotRows()` returns the row objects of any shape, and [] for null,
 *   empty or malformed data. `snapshotDocument()` builds the
 *   `{ ...fields, rankings: [...] }` object that `public/data/rankings.json` and
 *   the static rankings cache hold, never spreading a bare array into numeric keys.
 * Test: `tests/unit/admin-rankings-bare-array-256.test.ts`.
 */

export type SnapshotRow = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Rows of a stored snapshot: a bare array, `{ rankings: [] }` or `{ data: [] }`; [] otherwise. */
export function snapshotRows(data: unknown): SnapshotRow[] {
  let rows: unknown = data;
  if (isPlainObject(data)) {
    // #256: legacy rows nest the array under `data`, as lib/rankings/current-rankings.ts reads.
    rows = Array.isArray(data["rankings"]) ? data["rankings"] : data["data"];
  }
  // #256: drop non-object entries so a reader never dereferences null.
  return Array.isArray(rows) ? rows.filter(isPlainObject) : [];
}

/**
 * The snapshot as one `{ rankings: [...] }` object, plus `extra` fields.
 * A wrapped snapshot keeps its other fields; a bare array gets `fallback` fields.
 */
export function snapshotDocument(
  data: unknown,
  fallback: Record<string, unknown>,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  const base = isPlainObject(data) ? data : fallback;
  return { ...base, rankings: snapshotRows(data), ...extra };
}
