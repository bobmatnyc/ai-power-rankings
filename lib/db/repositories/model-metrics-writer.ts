/**
 * Model metrics writer: plan and write Vals Terminal-Bench figures, and the optional activation (#329).
 *
 * Why: D63 (Q9) writes the first model metrics and activates the seeded model rows in one
 *   transaction. The write must merge two keys only, never touch a redirect row, and never
 *   change status unless activation is asked for and every target row ends with a valid metric.
 *   D0c (owner, 2026-10-28): this figure gate (D86) governs only this loader's `--activate` and the
 *   10-row index threshold. The lifecycle status step (`model-lifecycle.ts`, `--set-status`) may
 *   activate a row without a figure.
 * What: `planModelMetrics` reads the target rows (one SELECT) and returns a per-row metric plan
 *   (`update`, `unchanged` or `refused`) and, when asked, a per-row activation plan.
 *   `applyModelMetricPlans` runs `MODEL_METRIC_UPDATE_SQL` per changed row and, when activating,
 *   one `MODEL_ACTIVATE_SQL`, inside the caller's transaction; a guard that matches fewer rows
 *   than planned throws so the caller rolls back.
 * Test: `tests/unit/load-model-metrics-329.test.ts`, `tests/unit/model-metrics-pglite-329.test.ts`
 */

import { hasCodingMetric, MODEL_TERMINAL_BENCH_SOURCE } from "../../rankings/lists";
import type { ModelMetricRow } from "./model-metrics-seed.repository";
import type { ModelSeedQueryable } from "./model-seed-writer";

// #329: read-only; status and redirect_to are read to refuse redirect aliases and other kinds.
export const MODEL_METRICS_SELECT_SQL = `SELECT slug, kind, status, data->>'redirect_to' AS redirect_to,
  jsonb_typeof(data->'metrics') AS metrics_type, jsonb_typeof(data->'metrics_provenance') AS provenance_type,
  jsonb_build_object('metrics', data->'metrics', 'metrics_provenance', data->'metrics_provenance') AS metric_data
FROM tools WHERE slug = ANY($1::text[])`;

// #329: merges data.metrics.terminal_bench and data.metrics_provenance.terminal_bench only; every
// other key of data, data.metrics and data.metrics_provenance is kept. Never names status. The
// WHERE refuses a non-model row, a redirect alias and a non-object metrics or provenance value.
export const MODEL_METRIC_UPDATE_SQL = `UPDATE tools SET
  data = data
    || jsonb_build_object('metrics', COALESCE(data->'metrics', '{}'::jsonb) || jsonb_build_object('terminal_bench', $2::numeric))
    || jsonb_build_object('metrics_provenance', COALESCE(data->'metrics_provenance', '{}'::jsonb)
      || jsonb_build_object('terminal_bench', jsonb_build_object('source', $3::text, 'as_of', $4::text))),
  updated_at = now()
WHERE slug = $1 AND kind = 'model' AND status <> 'redirect'
  AND (data->'metrics' IS NULL OR jsonb_typeof(data->'metrics') = 'object')
  AND (data->'metrics_provenance' IS NULL OR jsonb_typeof(data->'metrics_provenance') = 'object')
RETURNING slug`;

// D0c: the lifecycle status step activates without this gate; this one stays for --activate.
// #329 (D63 Q9): activation, run only with --apply --activate and after the metric updates in the
// same transaction. Sets status only on the listed model rows that are inactive and now carry a
// positive Vals TB 4.0 figure; a redirect row or another kind never matches.
export const MODEL_ACTIVATE_SQL = `UPDATE tools SET status = 'active', updated_at = now()
WHERE slug = ANY($1::text[]) AND kind = 'model' AND status = 'inactive'
  AND jsonb_typeof(data->'metrics'->'terminal_bench') = 'number'
  AND (data->'metrics'->>'terminal_bench')::numeric > 0
  AND split_part(data->'metrics_provenance'->'terminal_bench'->>'source', '#', 1) = $2
RETURNING slug`;

interface ExistingRow {
  slug: string;
  kind: string;
  status: string;
  redirect_to: string | null;
  metrics_type: string | null;
  provenance_type: string | null;
  metric_data: { metrics: unknown; metrics_provenance: unknown };
}

export interface MetricChange {
  key: "metrics.terminal_bench" | "metrics_provenance.terminal_bench";
  from: string | null;
  to: string;
}

export type ModelMetricPlan =
  | { slug: string; outcome: "update"; changes: MetricChange[]; params: unknown[] }
  | { slug: string; outcome: "unchanged" }
  | { slug: string; outcome: "refused"; reason: string };

export type ModelActivationPlan =
  | { slug: string; outcome: "activate" | "already-active" }
  | { slug: string; outcome: "refused"; reason: string };

export interface ModelMetricsPlan {
  metrics: ModelMetricPlan[];
  /** Empty unless activation was asked for. */
  activation: ModelActivationPlan[];
}

function sub(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

function show(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

/** Why this row cannot take a metric, or null when it can. */
function rowRefusal(existing: ExistingRow | undefined): string | null {
  if (!existing) return "no tools row with this slug; load the model seed first";
  if (existing.kind !== "model") return `slug is held by a ${existing.kind} row, not a model`;
  // #329: a redirect alias is hidden; never written.
  if (existing.status === "redirect") return `slug is a redirect alias (data.redirect_to: ${existing.redirect_to ?? "(none)"})`;
  if (existing.metrics_type !== null && existing.metrics_type !== "object") return `data.metrics is a ${existing.metrics_type}, not an object`;
  if (existing.provenance_type !== null && existing.provenance_type !== "object") {
    return `data.metrics_provenance is a ${existing.provenance_type}, not an object`;
  }
  return null;
}

function planMetric(row: ModelMetricRow, existing: ExistingRow | undefined): ModelMetricPlan {
  const refusal = rowRefusal(existing);
  if (refusal) return { slug: row.slug, outcome: "refused", reason: refusal };
  const data = existing!.metric_data;
  const fromValue = sub(data.metrics, "terminal_bench");
  const fromProv = sub(data.metrics_provenance, "terminal_bench");
  const toProv = { source: row.source, as_of: row.asOf };
  const changes: MetricChange[] = [];
  if (typeof fromValue !== "number" || fromValue !== row.value) {
    changes.push({ key: "metrics.terminal_bench", from: show(fromValue), to: String(row.value) });
  }
  if (sub(fromProv, "source") !== toProv.source || sub(fromProv, "as_of") !== toProv.as_of || Object.keys(fromProv ?? {}).length !== 2) {
    changes.push({ key: "metrics_provenance.terminal_bench", from: show(fromProv), to: JSON.stringify(toProv) });
  }
  if (changes.length === 0) return { slug: row.slug, outcome: "unchanged" };
  return { slug: row.slug, outcome: "update", changes, params: [row.slug, row.value, row.source, row.asOf] };
}

function planActivation(slug: string, existing: ExistingRow | undefined, metric: ModelMetricRow | undefined): ModelActivationPlan {
  const refusal = rowRefusal(existing);
  if (refusal) return { slug, outcome: "refused", reason: refusal };
  const status = existing!.status;
  if (status !== "inactive" && status !== "active") return { slug, outcome: "refused", reason: `status is ${status}; only inactive rows are activated` };
  // #329 D86: after the write the row must carry a Vals TB 4.0 figure, from this file or already stored.
  if (!metric && !hasCodingMetric(existing!.metric_data)) {
    return { slug, outcome: "refused", reason: "row would carry no Vals Terminal-Bench 4.0 figure after the write" };
  }
  return { slug, outcome: status === "active" ? "already-active" : "activate" };
}

/**
 * Why: the dry run is the review step, so it must show every key a write would change and every
 *   row an activation would flip.
 * What: one SELECT over the metric slugs and the activation targets, then pure per-row plans.
 *   `activationTargets` null means no activation. Writes nothing.
 * Test: `tests/unit/load-model-metrics-329.test.ts`
 */
export async function planModelMetrics(
  db: ModelSeedQueryable,
  rows: readonly ModelMetricRow[],
  activationTargets: readonly string[] | null
): Promise<ModelMetricsPlan> {
  const slugs = [...new Set([...rows.map((r) => r.slug), ...(activationTargets ?? [])])];
  const { rows: found } = await db.query(MODEL_METRICS_SELECT_SQL, [slugs]);
  const bySlug = new Map((found as ExistingRow[]).map((r) => [r.slug, r]));
  const metricBySlug = new Map(rows.map((r) => [r.slug, r]));
  return {
    metrics: rows.map((row) => planMetric(row, bySlug.get(row.slug))),
    activation: (activationTargets ?? []).map((slug) => planActivation(slug, bySlug.get(slug), metricBySlug.get(slug))),
  };
}

/**
 * Writes every metric update and, when the plan carries activations, the activation, through `tx`.
 * Throws when a guarded statement matches fewer rows than planned, so the caller rolls back.
 */
export async function applyModelMetricPlans(tx: ModelSeedQueryable, plan: ModelMetricsPlan): Promise<{ written: number; activated: number }> {
  let written = 0;
  for (const p of plan.metrics) {
    if (p.outcome !== "update") continue;
    const { rows } = await tx.query(MODEL_METRIC_UPDATE_SQL, p.params);
    if (rows.length !== 1) throw new Error(`${p.slug}: row changed since planning and is no longer an eligible model row`);
    written++;
  }
  const toActivate = plan.activation.filter((a) => a.outcome === "activate").map((a) => a.slug);
  if (toActivate.length === 0) return { written, activated: 0 };
  const { rows } = await tx.query(MODEL_ACTIVATE_SQL, [toActivate, MODEL_TERMINAL_BENCH_SOURCE]);
  if (rows.length !== toActivate.length) {
    throw new Error(`activation matched ${rows.length} of ${toActivate.length} row(s); a row changed since planning`);
  }
  return { written, activated: rows.length };
}
