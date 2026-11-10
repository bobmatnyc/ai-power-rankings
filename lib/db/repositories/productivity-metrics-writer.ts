/**
 * Productivity metrics writer: plan and write the reviewed figures into the 0027 rows (#314, D80).
 *
 * Why: the nine productivity rows need metrics before (or with) 0033 activates seven of them
 *   (D69: same release step). The write must touch only rows 0027 created, merge into
 *   `data.metrics`, `data.metrics_provenance` and `data.info` without dropping other keys, never
 *   change status, and be a no-op on a re-run.
 * What: `planProductivityMetrics` reads the rows (one SELECT) and returns per tool `update` (with
 *   the per-key changes and the merged `data`), `unchanged` or `refused`. `applyProductivityPlans`
 *   writes each update with `PRODUCTIVITY_METRIC_UPDATE_SQL` inside the caller's transaction; a
 *   row that changed since planning matches nothing and the call throws, so the caller rolls back.
 * Test: `tests/unit/productivity-metrics-loader-314.test.ts`
 */

import { PRODUCTIVITY_0027_MARKER, PRODUCTIVITY_SLUGS, type ProductivityToolEntry } from "./productivity-metrics-seed";
import type { ModelSeedQueryable } from "./model-seed-writer";

export const PRODUCTIVITY_METRICS_SELECT_SQL = `SELECT slug, kind, status, data FROM tools WHERE slug = ANY($1::text[])`;

// #314: replaces data with the planned merge only while the row still holds the data that was
// planned against ($3), is kind productivity and carries the 0027 marker. Never names status.
export const PRODUCTIVITY_METRIC_UPDATE_SQL = `UPDATE tools SET data = $2::jsonb, updated_at = now()
WHERE slug = $1 AND kind = 'productivity' AND data->>'createdBy' = $4 AND data = $3::jsonb
RETURNING slug`;

type Json = Record<string, unknown>;

interface ExistingRow {
  slug: string;
  kind: string;
  status: string;
  data: unknown;
}

export interface ProductivityChange {
  key: string;
  from: string | null;
  to: string;
}

export type ProductivityPlan =
  | { slug: string; outcome: "update"; changes: ProductivityChange[]; params: unknown[] }
  | { slug: string; outcome: "unchanged" }
  | { slug: string; outcome: "refused"; reason: string };

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Order-insensitive JSON equality (jsonb reorders object keys). */
export function sameJson(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameJson(v, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => k in b && sameJson(a[k], b[k]));
  }
  return a === b;
}

function show(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

/** Why this row cannot take the write, or null when it can. */
function rowRefusal(entry: ProductivityToolEntry, row: ExistingRow | undefined): string | null {
  if (!row) return "no tools row with this slug; apply 0027 first";
  if (row.kind !== "productivity") return `slug is held by a ${row.kind} row, not productivity`;
  if (!isObject(row.data) || row.data["createdBy"] !== PRODUCTIVITY_0027_MARKER) {
    return "row does not carry the 0027 marker (data.createdBy); it was not created by 0027";
  }
  const data = row.data;
  for (const key of ["metrics", "metrics_provenance", "info"]) {
    if (data[key] !== undefined && !isObject(data[key])) return `data.${key} is not an object`;
  }
  for (const m of entry.metrics) {
    const group = m.path.includes(".") ? m.path.split(".")[0]! : null;
    if (group && isObject(data["metrics"]) && data["metrics"][group] !== undefined && !isObject(data["metrics"][group])) {
      return `data.metrics.${group} is not an object`;
    }
  }
  if (isObject(data["info"]) && data["info"]["business"] !== undefined && !isObject(data["info"]["business"])) {
    return "data.info.business is not an object";
  }
  return null;
}

/**
 * The row's data after the write: every metric value at its path, every provenance entry
 * replaced whole, and the info fields the file states. Every other key is kept. Pure.
 */
export function mergeProductivityData(data: Json, entry: ProductivityToolEntry): Json {
  const metrics: Json = { ...((data["metrics"] as Json | undefined) ?? {}) };
  const provenance: Json = { ...((data["metrics_provenance"] as Json | undefined) ?? {}) };
  for (const m of entry.metrics) {
    const [head, leaf] = m.path.split(".") as [string, string | undefined];
    if (leaf === undefined) metrics[head] = m.value;
    else metrics[head] = { ...((metrics[head] as Json | undefined) ?? {}), [leaf]: m.value };
    // #314: flat dotted key (github.stars), as the file's metric paths are named.
    provenance[m.path] = { ...m.provenance };
  }
  const info: Json = { ...((data["info"] as Json | undefined) ?? {}) };
  if (entry.info.description !== undefined) info["description"] = entry.info.description;
  if (entry.info.features !== undefined) info["features"] = [...entry.info.features];
  if (entry.info.company !== undefined) info["company"] = entry.info.company;
  if (Object.keys(entry.info.business).length > 0) {
    info["business"] = { ...((info["business"] as Json | undefined) ?? {}), ...entry.info.business };
  }
  return { ...data, metrics, metrics_provenance: provenance, info };
}

const RECURSE_KEYS = new Set(["metrics", "metrics_provenance", "info", "business", "github", "pypi"]);

function diffKeys(before: Json, after: Json, prefix: string, out: ProductivityChange[]): void {
  for (const key of Object.keys(after)) {
    const from = before[key];
    const to = after[key];
    if (sameJson(from, to)) continue;
    // #314: recurse into the touched objects so the diff names each key, not a whole blob.
    if (isObject(to) && (from === undefined || isObject(from)) && RECURSE_KEYS.has(key)) {
      diffKeys(isObject(from) ? from : {}, to, `${prefix}${key}.`, out);
    } else {
      out.push({ key: `${prefix}${key}`, from: show(from), to: JSON.stringify(to) });
    }
  }
}

function planTool(entry: ProductivityToolEntry, row: ExistingRow | undefined): ProductivityPlan {
  const refusal = rowRefusal(entry, row);
  if (refusal) return { slug: entry.slug, outcome: "refused", reason: refusal };
  const before = row!.data as Json;
  const after = mergeProductivityData(before, entry);
  if (sameJson(before, after)) return { slug: entry.slug, outcome: "unchanged" };
  const changes: ProductivityChange[] = [];
  diffKeys(before, after, "", changes);
  return {
    slug: entry.slug,
    outcome: "update",
    changes,
    params: [entry.slug, JSON.stringify(after), JSON.stringify(before), PRODUCTIVITY_0027_MARKER],
  };
}

/**
 * Why: the dry run is the review step, so it must show every key a write would change.
 * What: one SELECT over the allowlisted slugs of `entries`, then a pure plan per tool. Writes nothing.
 * Test: `tests/unit/productivity-metrics-loader-314.test.ts`
 */
export async function planProductivityMetrics(db: ModelSeedQueryable, entries: readonly ProductivityToolEntry[]): Promise<ProductivityPlan[]> {
  // #314: defence in depth; the parser already refuses a slug outside the allowlist.
  const outside = entries.filter((e) => !(PRODUCTIVITY_SLUGS as readonly string[]).includes(e.slug));
  if (outside.length > 0) throw new Error(`not productivity slugs: ${outside.map((e) => e.slug).join(", ")}`);
  const { rows } = await db.query(PRODUCTIVITY_METRICS_SELECT_SQL, [entries.map((e) => e.slug)]);
  const bySlug = new Map((rows as ExistingRow[]).map((r) => [r.slug, r]));
  return entries.map((e) => planTool(e, bySlug.get(e.slug)));
}

/**
 * Writes every `update` plan through `tx`; throws when a row changed since planning, so the caller
 * rolls back. The caller must not pass plans with a refusal (the loader stops before this).
 */
export async function applyProductivityPlans(tx: ModelSeedQueryable, plans: readonly ProductivityPlan[]): Promise<number> {
  let written = 0;
  for (const p of plans) {
    if (p.outcome !== "update") continue;
    const { rows } = await tx.query(PRODUCTIVITY_METRIC_UPDATE_SQL, p.params);
    if (rows.length !== 1) throw new Error(`${p.slug}: row changed since planning; nothing written`);
    written++;
  }
  return written;
}
