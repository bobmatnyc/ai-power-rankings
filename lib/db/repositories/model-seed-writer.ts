/**
 * Model seed writer: plan and upsert for validated model seed rows (#329).
 *
 * Why: the seed loader must show what a run would change before it writes, and a write must
 *   never activate a row or touch a reviewed status or metric, however often it runs.
 * What: `planModelSeedRows` reads the current `tools` rows for the seed slugs (one SELECT) and
 *   returns, per row, `insert`, `update` (with each changed column), `unchanged` or `refused`.
 *   `applyModelSeedPlans` writes the insert and update plans with one statement each,
 *   `MODEL_SEED_UPSERT_SQL`, inside the caller's transaction. The statement is an upsert keyed
 *   on slug: a new row is created `inactive`, kind `model`, category `other`; on an existing
 *   model row it sets only the seed-owned columns and the `data.modelSeed` provenance key. It
 *   never names `status` or `data.metrics` in its update clause. A curated column (#334) is
 *   filled when stored null and never overwritten unless the caller names it in `overwrites`.
 * Test: `tests/unit/load-model-seeds-329.test.ts`
 */

import type { ModelSeedRow } from "./model-seed.repository";

export interface ModelSeedQueryable {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

export interface ModelSeedDb extends ModelSeedQueryable {
  transaction<T>(fn: (tx: ModelSeedQueryable) => Promise<T>): Promise<T>;
}

/** A validated row plus the seed file it came from, for provenance. */
export interface ModelSeedEntry {
  row: ModelSeedRow;
  seedFile: string;
  checkedAt: string;
}

/** The `tools` columns a seed row owns. Status, name, category and metrics are never among them. */
export const SEED_COLUMNS = [
  "open_weight",
  "hf_repo",
  "licence",
  "parameters_b",
  "active_parameters_b",
  "release_date",
] as const;
type SeedColumn = (typeof SEED_COLUMNS)[number];
type ColumnValue = string | boolean | null;

/**
 * #334: seed columns the seed fills only when the stored value is null. A stored non-null value
 * that differs from the seed is refused unless an owner names that slug and column in
 * `overwrites`. `open_weight` is guarded separately and has no override.
 */
export const CURATED_COLUMNS = ["hf_repo", "licence", "parameters_b", "active_parameters_b", "release_date"] as const;
export type CuratedColumn = (typeof CURATED_COLUMNS)[number];

/** #334: an owner's explicit opt-in to replace one stored curated value with the seed's. */
export interface SeedOverwrite {
  slug: string;
  column: CuratedColumn;
}

export interface ColumnChange {
  column: SeedColumn | "data.modelSeed";
  from: ColumnValue;
  to: ColumnValue;
  /** #334: replaces a stored non-null value, allowed only by an overwrite. */
  overwrite?: true;
}

export type ModelSeedPlan =
  | { slug: string; seedFile: string; outcome: "insert" | "update"; changes: ColumnChange[]; params: unknown[] }
  | { slug: string; seedFile: string; outcome: "unchanged" }
  | { slug: string; seedFile: string; outcome: "refused"; reason: string };

// #329: status and data.redirect_to are read only to refuse a redirect alias; never written.
export const MODEL_SEED_SELECT_SQL = `SELECT slug, kind, status, data->>'redirect_to' AS redirect_to, open_weight, hf_repo, licence,
  parameters_b::text AS parameters_b, active_parameters_b::text AS active_parameters_b,
  release_date::text AS release_date, data->'modelSeed' AS model_seed
FROM tools WHERE slug = ANY($1::text[])`;

// #329: an upsert keyed on slug. The insert hard-codes status 'inactive'; the update clause sets
// only seed-owned columns (COALESCE keeps a column the seed does not state) and replaces only the
// top-level data.modelSeed key, so data.metrics and status are never written on an existing row.
// The WHERE refuses a non-model row, a redirect alias (#329) or one whose open_weight disagrees;
// it then returns no row and the caller rolls back. #334: each curated column also needs the seed
// silent, the stored value null or equal, or the stored value still the one an overwrite named in
// $10 (a jsonb object of column -> planned stored value), so a value changed after planning is
// never overwritten.
export const MODEL_SEED_UPSERT_SQL = `INSERT INTO tools
  (slug, name, category, status, kind, open_weight, hf_repo, licence, parameters_b, active_parameters_b, release_date, data)
VALUES ($1, $2, 'other', 'inactive', 'model', $3, $4, $5, $6::numeric, $7::numeric, $8::date, $9::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  open_weight = EXCLUDED.open_weight,
  hf_repo = COALESCE(EXCLUDED.hf_repo, tools.hf_repo),
  licence = COALESCE(EXCLUDED.licence, tools.licence),
  parameters_b = COALESCE(EXCLUDED.parameters_b, tools.parameters_b),
  active_parameters_b = COALESCE(EXCLUDED.active_parameters_b, tools.active_parameters_b),
  release_date = COALESCE(EXCLUDED.release_date, tools.release_date),
  data = tools.data || jsonb_build_object('modelSeed', EXCLUDED.data->'modelSeed'),
  updated_at = now()
WHERE tools.kind = 'model' AND tools.status <> 'redirect'
  AND (tools.open_weight IS NULL OR tools.open_weight = EXCLUDED.open_weight)
  AND (EXCLUDED.hf_repo IS NULL OR tools.hf_repo IS NULL OR tools.hf_repo = EXCLUDED.hf_repo
    OR tools.hf_repo = $10::jsonb->>'hf_repo')
  AND (EXCLUDED.licence IS NULL OR tools.licence IS NULL OR tools.licence = EXCLUDED.licence
    OR tools.licence = $10::jsonb->>'licence')
  AND (EXCLUDED.parameters_b IS NULL OR tools.parameters_b IS NULL OR tools.parameters_b = EXCLUDED.parameters_b
    OR tools.parameters_b = ($10::jsonb->>'parameters_b')::numeric)
  AND (EXCLUDED.active_parameters_b IS NULL OR tools.active_parameters_b IS NULL
    OR tools.active_parameters_b = EXCLUDED.active_parameters_b
    OR tools.active_parameters_b = ($10::jsonb->>'active_parameters_b')::numeric)
  AND (EXCLUDED.release_date IS NULL OR tools.release_date IS NULL OR tools.release_date = EXCLUDED.release_date
    OR tools.release_date = ($10::jsonb->>'release_date')::date)
RETURNING slug`;

interface ExistingRow {
  slug: string;
  kind: string;
  status: string;
  redirect_to: string | null;
  open_weight: boolean | null;
  hf_repo: string | null;
  licence: string | null;
  parameters_b: string | null;
  active_parameters_b: string | null;
  release_date: string | null;
  model_seed: unknown;
}

/** JSON with sorted object keys, so a jsonb round trip compares equal. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function seedValues(row: ModelSeedRow): Record<SeedColumn, ColumnValue> {
  const fact = (key: keyof ModelSeedRow["facts"]) => {
    const v = row.facts[key]?.value;
    return v === undefined ? null : String(v);
  };
  return {
    open_weight: row.openWeight,
    hf_repo: fact("hf_repo"),
    licence: fact("licence"),
    parameters_b: fact("parameters_b"),
    active_parameters_b: fact("active_parameters_b"),
    release_date: fact("release_date"),
  };
}

/** The provenance stored under `data.modelSeed`: every fact with its source. */
export function modelSeedProvenance(entry: ModelSeedEntry): Record<string, unknown> {
  const { row } = entry;
  const facts: Record<string, unknown> = {};
  for (const [key, fact] of Object.entries(row.facts)) facts[key] = { value: fact.value, source_url: fact.sourceUrl };
  return {
    issue: 329,
    seedFile: entry.seedFile,
    checkedAt: entry.checkedAt,
    vendor: row.vendor,
    sourceUrl: row.sourceUrl,
    licenceReview: row.licenceReview,
    facts,
  };
}

function sameValue(column: SeedColumn, from: ColumnValue, to: ColumnValue): boolean {
  if (to === null) return true; // COALESCE keeps the stored value
  if (column === "parameters_b" || column === "active_parameters_b") return from !== null && Number(from) === Number(to);
  return from === to;
}

function upsertParams(
  entry: ModelSeedEntry,
  values: Record<SeedColumn, ColumnValue>,
  provenance: unknown,
  overwriteFrom: Partial<Record<CuratedColumn, ColumnValue>> = {}
): unknown[] {
  const { row } = entry;
  const data = { info: { description: row.description, company: row.company }, modality: row.modality, modelSeed: provenance };
  return [
    row.slug,
    row.name,
    values.open_weight,
    values.hf_repo,
    values.licence,
    values.parameters_b,
    values.active_parameters_b,
    values.release_date,
    JSON.stringify(data),
    JSON.stringify(overwriteFrom),
  ];
}

/**
 * Why: the dry run is the review step, so it must show every column a write would change.
 * What: one SELECT for all seed slugs, then a pure per-row plan. Refuses a slug held by a row
 *   whose kind is not `model`, a `status = 'redirect'` alias (naming its `data.redirect_to`), and
 *   a row whose stored `open_weight` disagrees with the seed. #334: refuses a row where a curated
 *   column's stored non-null value differs from the seed's, one reason per column, unless
 *   `overwrites` names that slug and column; the change is then marked `overwrite` and its
 *   planned stored value goes to the upsert guard. A stored null is filled; an equal value is no
 *   change. Writes nothing.
 * Test: `tests/unit/load-model-seeds-329.test.ts`, `tests/unit/model-seed-curated-334.test.ts`,
 *   `tests/unit/model-seed-curated-pglite-334.test.ts`
 */
export async function planModelSeedRows(
  db: ModelSeedQueryable,
  entries: readonly ModelSeedEntry[],
  overwrites: readonly SeedOverwrite[] = []
): Promise<ModelSeedPlan[]> {
  const { rows } = await db.query(MODEL_SEED_SELECT_SQL, [entries.map((e) => e.row.slug)]);
  const bySlug = new Map((rows as ExistingRow[]).map((r) => [r.slug, r]));
  return entries.map((entry): ModelSeedPlan => {
    const { slug } = entry.row;
    const base = { slug, seedFile: entry.seedFile };
    const values = seedValues(entry.row);
    const provenance = modelSeedProvenance(entry);
    const existing = bySlug.get(slug);
    if (!existing) {
      const changes = SEED_COLUMNS.filter((c) => values[c] !== null).map((c) => ({ column: c, from: null, to: values[c] }));
      return { ...base, outcome: "insert", changes, params: upsertParams(entry, values, provenance) };
    }
    if (existing.kind !== "model") return { ...base, outcome: "refused", reason: `slug is held by a ${existing.kind} row, not a model` };
    // #329: a redirect alias is hidden; seed facts belong on the row it redirects to.
    if (existing.status === "redirect") {
      return { ...base, outcome: "refused", reason: `slug is a redirect alias (data.redirect_to: ${existing.redirect_to ?? "(none)"})` };
    }
    if (existing.open_weight !== null && existing.open_weight !== entry.row.openWeight) {
      return { ...base, outcome: "refused", reason: `stored open_weight is ${existing.open_weight}; the seed says ${entry.row.openWeight}` };
    }
    // #334: a curated column the seed would change from one non-null value to another.
    const conflicts = CURATED_COLUMNS.filter((c) => existing[c] !== null && !sameValue(c, existing[c], values[c]));
    const allowed = new Set(overwrites.filter((o) => o.slug === slug).map((o) => o.column));
    const blocked = conflicts.filter((c) => !allowed.has(c));
    if (blocked.length > 0) {
      const fields = blocked.map((c) => `stored ${c} is ${existing[c]}; the seed says ${values[c]}`).join("; ");
      const hint = blocked.map((c) => `${slug}:${c}`).join(",");
      return { ...base, outcome: "refused", reason: `${fields} (to replace, pass --overwrite ${hint})` };
    }
    const overwriteFrom = Object.fromEntries(conflicts.map((c) => [c, existing[c]]));
    const params = upsertParams(entry, values, provenance, overwriteFrom);
    const changes: ColumnChange[] = SEED_COLUMNS.filter((c) => !sameValue(c, existing[c], values[c])).map((c) => {
      const change: ColumnChange = { column: c, from: existing[c], to: values[c] };
      return (conflicts as readonly string[]).includes(c) ? { ...change, overwrite: true } : change;
    });
    if (stableJson(existing.model_seed ?? null) !== stableJson(provenance)) {
      changes.push({ column: "data.modelSeed", from: existing.model_seed == null ? null : "(set)", to: "(seed provenance)" });
    }
    return changes.length === 0 ? { ...base, outcome: "unchanged" } : { ...base, outcome: "update", changes, params };
  });
}

/** Writes every insert and update plan through `tx`; throws when a guarded upsert matches no row. */
export async function applyModelSeedPlans(tx: ModelSeedQueryable, plans: readonly ModelSeedPlan[]): Promise<number> {
  let written = 0;
  for (const plan of plans) {
    if (plan.outcome !== "insert" && plan.outcome !== "update") continue;
    const { rows } = await tx.query(MODEL_SEED_UPSERT_SQL, plan.params);
    if (rows.length !== 1) throw new Error(`${plan.slug}: row changed since planning and is no longer an eligible model row, or a curated value changed`);
    written++;
  }
  return written;
}
