/**
 * Model metrics seed: pure parser and validator for the Terminal-Bench figures of model rows (#329).
 *
 * Why: D63 makes the Vals Terminal-Bench 4.0 leaderboard the only source of a model's
 *   `terminal_bench`, and a figure reaches production only through a reviewed file. A bad row
 *   must stop the run, so every rule throws. The real figures stay out of this public repo: the
 *   file lives at a gitignored path (`MODEL_METRICS_DEFAULT_PATH`) or is supplied at apply time.
 * What: `parseModelMetricsSeed` reads one metrics document and returns typed rows. Each row names
 *   a model family slug listed in the model seed files, the field `terminal_bench`, a positive
 *   finite value of at most 100, the Vals page as source (exactly `MODEL_TERMINAL_BENCH_SOURCE`)
 *   and an `as_of` date no later than the file's `checked_at`. `version` names the version or
 *   snapshot the figure was measured on when it is not the seeded flagship. Pure: no database,
 *   no network.
 * Test: `tests/unit/model-metrics-seed-329.test.ts`
 */

import { MODEL_TERMINAL_BENCH_SOURCE } from "../../rankings/lists";
import { isCalendarDate } from "./model-seed.repository";

/** #329: the gitignored default location of the real-figures file (never committed). */
export const MODEL_METRICS_DEFAULT_PATH = "data/private/model-metrics.json";

/** #329 (D63): the only metric field this file may set. */
export const MODEL_METRIC_FIELDS = ["terminal_bench"] as const;
export type ModelMetricField = (typeof MODEL_METRIC_FIELDS)[number];

/** #329: Muse Wonder stays excluded until the owner rules on its source. */
export const EXCLUDED_METRIC_SLUGS: readonly string[] = ["muse-wonder"];

const ROW_KEYS = new Set(["slug", "field", "value", "source", "as_of", "version"]);

export interface ModelMetricRow {
  slug: string;
  field: ModelMetricField;
  value: number;
  source: string;
  asOf: string;
  /** The version or snapshot measured, when it is not the seeded flagship; else null. */
  version: string | null;
}

export interface ModelMetricsSeed {
  checkedAt: string;
  rows: ModelMetricRow[];
}

function rec(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${what} is not an object`);
  return value as Record<string, unknown>;
}

function text(e: Record<string, unknown>, key: string, what: string): string {
  const v = e[key];
  if (typeof v !== "string" || v.trim() === "") throw new Error(`${what}: ${key} is required`);
  return v.trim();
}

/**
 * Why: one row is one figure that may reach `tools.data`; each rule guards a D63 ruling.
 * What: returns the typed row or throws naming the row and the rule it broke.
 * Test: `tests/unit/model-metrics-seed-329.test.ts`
 */
export function parseModelMetricRow(entry: unknown, what: string, knownSlugs: ReadonlySet<string>, checkedAt: string): ModelMetricRow {
  const e = rec(entry, what);
  for (const key of Object.keys(e)) if (!ROW_KEYS.has(key)) throw new Error(`${what}: unknown key ${key}`);
  const slug = text(e, "slug", what);
  // #329: Muse Wonder is excluded by ruling, even if a seed file ever lists it.
  if (EXCLUDED_METRIC_SLUGS.includes(slug)) throw new Error(`${what}: ${slug} is excluded`);
  if (!knownSlugs.has(slug)) throw new Error(`${what}: unknown slug ${slug}; a metric attaches only to a seeded model family row`);
  const field = text(e, "field", what);
  if (!(MODEL_METRIC_FIELDS as readonly string[]).includes(field)) {
    throw new Error(`${what}: field ${field} is not allowed (only ${MODEL_METRIC_FIELDS.join(", ")})`);
  }
  const value = e["value"];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 100) {
    throw new Error(`${what}: value must be a finite number above 0 and at most 100`);
  }
  const source = text(e, "source", what);
  // #329 D63: Vals TB 4.0 only, the exact page URL.
  if (source !== MODEL_TERMINAL_BENCH_SOURCE) throw new Error(`${what}: source must be ${MODEL_TERMINAL_BENCH_SOURCE}`);
  const asOf = text(e, "as_of", what);
  if (!isCalendarDate(asOf)) throw new Error(`${what}: as_of must be a real YYYY-MM-DD date`);
  if (asOf > checkedAt) throw new Error(`${what}: as_of ${asOf} is after checked_at ${checkedAt}`);
  let version: string | null = null;
  if (e["version"] !== undefined) version = text(e, "version", what);
  return { slug, field: field as ModelMetricField, value, source, asOf, version };
}

/**
 * Why: the metrics file is checked as a whole before any figure is planned or written.
 * What: parses the JSON text against the slugs the model seed files list. Throws on text that
 *   is not JSON, a missing or invalid `checked_at`, no `metrics` array or an empty one, any row
 *   rule (`parseModelMetricRow`) and a slug used twice. Pure.
 * Test: `tests/unit/model-metrics-seed-329.test.ts`
 */
export function parseModelMetricsSeed(jsonText: string, knownSlugs: ReadonlySet<string>): ModelMetricsSeed {
  const doc = rec(JSON.parse(jsonText), "metrics seed");
  const checkedAt = text(doc, "checked_at", "metrics seed");
  if (!isCalendarDate(checkedAt)) throw new Error("metrics seed: checked_at must be a real YYYY-MM-DD date");
  const entries = doc["metrics"];
  if (!Array.isArray(entries) || entries.length === 0) throw new Error("metrics seed has no metrics array");
  const seen = new Set<string>();
  const rows = entries.map((entry, i) => {
    const row = parseModelMetricRow(entry, `metrics[${i}]`, knownSlugs, checkedAt);
    if (seen.has(row.slug)) throw new Error(`metrics[${i}]: duplicate slug ${row.slug}`);
    seen.add(row.slug);
    return row;
  });
  return { checkedAt, rows };
}

/** #329: the `tools.data` keys a metric row writes, in the #95 storage shape. */
export function metricDataAfterWrite(row: ModelMetricRow): {
  metrics: { terminal_bench: number };
  metrics_provenance: { terminal_bench: { source: string; as_of: string } };
} {
  return {
    metrics: { terminal_bench: row.value },
    metrics_provenance: { terminal_bench: { source: row.source, as_of: row.asOf } },
  };
}
