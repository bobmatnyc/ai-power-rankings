/**
 * Write-time validation and storage mapping for admin-entered tool metrics.
 *
 * Why: #95 (spec step 6). `monthly_arr`, `users`, `valuation` and
 * `swe_bench.verified` are the heavily weighted fields and none of the
 * collectors can fill them. Hand-entered text such as "$10.2B" scored 0 in the
 * ranking engine, and valid-but-wrong numbers (a percentage stored as `users`)
 * passed unseen. A write must therefore carry a bare finite number, a source
 * URL a reviewer can open, and an as-of date.
 * What: `validateAdminMetrics` checks every field of one request and returns
 * either all errors (nothing may be written) or the validated entries plus any
 * magnitude warnings. `applyAdminMetrics` is the ONLY place that decides where
 * a value lives: `info.metrics.<field>` stays a bare number so existing readers
 * (`parseNumeric` in ranking-algorithm-v76) keep working, and provenance goes to
 * the sibling `info.metrics_provenance.<field> = { source, as_of }`.
 * Test: `tests/unit/admin-metrics-validation-95.test.ts`.
 */

/** The fields an admin may set. `swe_bench.verified` is addressed by its dotted path. */
export const ADMIN_METRIC_FIELDS = ["monthly_arr", "users", "valuation", "swe_bench.verified"] as const;
export type AdminMetricField = (typeof ADMIN_METRIC_FIELDS)[number];

export interface ValidatedMetric {
  field: AdminMetricField;
  value: number;
  source: string;
  as_of: string;
}

export interface MetricIssue {
  field: string;
  message: string;
}

export type MetricsValidation =
  | { ok: true; entries: ValidatedMetric[]; warnings: MetricIssue[] }
  | { ok: false; errors: MetricIssue[] };

/** Above this no real-world figure exists; the value is a typo or a unit mix-up. */
const HARD_MAX = 1e15;

/** Plausible ranges. A value outside `[low, high]` is a WARNING, not a block. */
const WARN_BANDS: Record<Exclude<AdminMetricField, "swe_bench.verified">, [number, number]> = {
  monthly_arr: [1_000, 1e11],
  users: [1_000, 1e9],
  valuation: [1_000_000, 1e13],
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LEAF_KEYS = ["value", "source", "as_of"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** UTC midnight of `s` when it is a real calendar date written YYYY-MM-DD, else null. */
function parseIsoDate(s: string): number | null {
  const m = ISO_DATE.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d
    ? t
    : null;
}

function checkSource(source: unknown): string | null {
  if (typeof source !== "string" || source.trim() === "") return "source URL is required";
  let u: URL;
  try {
    u = new URL(source.trim());
  } catch {
    return "source must be an http(s) URL";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "source must be an http(s) URL";
  if (u.username || u.password) return "source URL must not embed credentials";
  return null;
}

function checkAsOf(asOf: unknown, now: Date): string | null {
  if (typeof asOf !== "string") return "as_of date is required (YYYY-MM-DD)";
  const t = parseIsoDate(asOf);
  if (t === null) return "as_of must be a real date in YYYY-MM-DD form";
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (t > today) return "as_of must not be in the future";
  return null;
}

function checkValue(field: AdminMetricField, value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "value must be a finite number, not text";
  }
  if (value < 0) return "value must not be negative";
  if (value > HARD_MAX) return "value is beyond any real-world figure";
  if (field === "swe_bench.verified" && value > 100) {
    return "swe_bench.verified is a percentage from 0 to 100";
  }
  return null;
}

function validateOne(
  field: AdminMetricField,
  raw: unknown,
  now: Date,
  errors: MetricIssue[],
  warnings: MetricIssue[],
  entries: ValidatedMetric[]
): void {
  if (!isRecord(raw)) {
    errors.push({ field, message: "expected { value, source, as_of }" });
    return;
  }
  const found = [
    Object.keys(raw)
      .filter((k) => !LEAF_KEYS.includes(k))
      .map((k) => `unknown key: ${k}`),
    [checkValue(field, raw["value"]), checkSource(raw["source"]), checkAsOf(raw["as_of"], now)].filter(
      (m): m is string => m !== null
    ),
  ].flat();
  if (found.length > 0) {
    for (const message of found) errors.push({ field, message });
    return;
  }

  const num = raw["value"] as number;
  if (field === "swe_bench.verified") {
    // A fraction (0.8) entered where a percentage (80) belongs.
    if (num > 0 && num <= 1) {
      warnings.push({ field, message: "value is 1 or less; swe_bench.verified is a percentage, not a fraction" });
    }
  } else {
    const [lo, hi] = WARN_BANDS[field];
    if (num < lo || num > hi) {
      warnings.push({
        field,
        message: `value ${num} is outside the usual range ${lo} to ${hi}; check the unit and the source`,
      });
    }
  }
  entries.push({
    field,
    value: num,
    source: (raw["source"] as string).trim(),
    as_of: raw["as_of"] as string,
  });
}

/**
 * Validate the `metrics` object of one admin edit. Accepts
 * `{ monthly_arr, users, valuation, swe_bench: { verified } }`, each a
 * `{ value, source, as_of }` leaf. Every field is checked before the caller
 * writes anything; any error means the caller writes nothing.
 */
export function validateAdminMetrics(input: unknown, now: Date = new Date()): MetricsValidation {
  const errors: MetricIssue[] = [];
  const warnings: MetricIssue[] = [];
  const entries: ValidatedMetric[] = [];
  if (!isRecord(input)) {
    return { ok: false, errors: [{ field: "metrics", message: "metrics must be an object" }] };
  }
  for (const [key, raw] of Object.entries(input)) {
    if (key === "monthly_arr" || key === "users" || key === "valuation") {
      validateOne(key, raw, now, errors, warnings, entries);
    } else if (key === "swe_bench") {
      if (!isRecord(raw) || Object.keys(raw).some((k) => k !== "verified")) {
        errors.push({ field: "swe_bench", message: "only swe_bench.verified is editable" });
      } else if ("verified" in raw) {
        validateOne("swe_bench.verified", raw["verified"], now, errors, warnings, entries);
      }
    } else {
      errors.push({ field: key, message: "not an editable metric" });
    }
  }
  if (errors.length === 0 && entries.length === 0) {
    errors.push({ field: "metrics", message: "no metric given" });
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, entries, warnings };
}

/**
 * Merge validated metrics into a tool's `info` blob and return the new `info`.
 * Sibling keys of `info`, `info.metrics` and `info.metrics.swe_bench` survive.
 *
 * Storage shape (settled in #95): the value is a bare number at
 * `info.metrics.<field>`, because v7.6 readers parse it as a number; provenance
 * is `info.metrics_provenance.<field>`. Change the shape here and nowhere else.
 */
export function applyAdminMetrics(
  info: Record<string, unknown>,
  entries: readonly ValidatedMetric[]
): Record<string, unknown> {
  const metrics: Record<string, unknown> = {
    ...(isRecord(info["metrics"]) ? info["metrics"] : {}),
  };
  const prov: Record<string, unknown> = {
    ...(isRecord(info["metrics_provenance"]) ? info["metrics_provenance"] : {}),
  };
  for (const e of entries) {
    const leaf = { source: e.source, as_of: e.as_of };
    if (e.field === "swe_bench.verified") {
      metrics["swe_bench"] = {
        ...(isRecord(metrics["swe_bench"]) ? metrics["swe_bench"] : {}),
        verified: e.value,
      };
      prov["swe_bench"] = {
        ...(isRecord(prov["swe_bench"]) ? prov["swe_bench"] : {}),
        verified: leaf,
      };
    } else {
      metrics[e.field] = e.value;
      prov[e.field] = leaf;
    }
  }
  return { ...info, metrics, metrics_provenance: prov };
}
