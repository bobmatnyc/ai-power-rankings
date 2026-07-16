/**
 * Business-metric leaves for the historical backfill, sourced from the recovered
 * dataset at `data/historical-metrics/sources/business-metrics-recovery.json`.
 *
 * WHY THIS EXISTS
 * ---------------
 * npm/PyPI/GitHub have time-series APIs, so the generator can retrieve real
 * monthly values for them. The high-leverage business fields the ranking engine
 * actually weights most heavily — ARR, users, SWE-bench, valuation, funding —
 * have no such API. They come from a dated, sourced research pass which already
 * resolved each field to a per-month value WITH a fidelity label.
 *
 * That dataset is therefore the SOURCE OF TRUTH and is consumed as-is: we do not
 * re-derive, re-interpolate, or re-date its values here. Two rules follow:
 *
 *   1. FIDELITY IS NEVER UPGRADED. A `held_flat` or `interpolated` month stays
 *      that way. Only the dataset may call a value `real`.
 *   2. ABSENT MEANS ABSENT. A field the research pass could not substantiate is
 *      listed in the dataset's `not_found` and simply has no series; a month it
 *      could not resolve is a null leaf. Both emit NOTHING, leaving production's
 *      live `tools.data` value untouched. We never fabricate or hold-flat a
 *      value that was never known.
 *
 * Unverified claims (e.g. Google Jules' "52.2% SWE-bench", Lovable's "$5.56M
 * ARR / 140K users") are already excluded by the dataset itself — rule 2 drops
 * them without any special-casing here.
 */

import { readFileSync } from "node:fs";

/** Fidelity labels the recovery dataset emits. Mirrors the generator's `Fidelity`. */
export type BusinessFidelity = "real" | "interpolated" | "held_flat";

/** One month of a recovered series, as stored in the dataset. */
export interface RecoveryLeaf {
  value: number | null;
  fidelity: BusinessFidelity;
  source?: string | null;
  /** Free-text provenance; mapped onto the override leaf's `recovery_note`. */
  note?: string | null;
  as_of?: string | null;
}

/** A recovered field: dated anchors plus the resolved per-month series. */
export interface RecoverySeries {
  anchors?: Array<{ date: string; value: number; source?: string; note?: string }>;
  monthly: Record<string, RecoveryLeaf | null>;
}

/** The dataset file's top-level shape (only the parts we consume are typed). */
export interface RecoveryDataset {
  generated_for?: string;
  conventions?: Record<string, string>;
  tools: Record<string, Record<string, unknown>>;
  not_found?: Record<string, string[]>;
}

/** The provenance leaf shape written into the override files. */
export interface BusinessLeaf {
  value: number;
  fidelity: BusinessFidelity;
  source: string | null;
  as_of: string | null;
  recovery_note: string;
}

/**
 * Dataset field -> the metrics path the engine actually reads.
 *
 * Each path was verified against a read site in lib/ranking-algorithm-v76.ts:
 *   users             -> info.metrics.users            (calculateDeveloperAdoption)
 *   monthly_arr       -> info.metrics.monthly_arr      (calculateMarketTraction)
 *   valuation         -> info.metrics.valuation        (calculateMarketTraction, calculateBusinessSentiment)
 *   funding           -> info.metrics.funding          (calculateMarketTraction, calculateBusinessSentiment)
 *   employees         -> info.metrics.employees        (calculateBusinessSentiment)
 *   swe_bench.verified-> info.metrics.swe_bench.verified (calculateAgenticCapability, calculateTechnicalPerformance)
 *
 * `field` is the key path within a dataset tool record; `path` is the
 * destination within `tools.data.metrics`. They are deliberately distinct: the
 * dataset stores SWE-bench under a FLAT literal key `"swe_bench.verified"`
 * (dot included in the key itself), whereas the engine reads a NESTED
 * `metrics.swe_bench.verified`. Treating the dataset key as a nested path
 * silently matches nothing and drops every SWE-bench leaf.
 */
export const BUSINESS_METRIC_PATHS: ReadonlyArray<{ field: string[]; path: string[] }> = [
  { field: ["users"], path: ["users"] },
  { field: ["monthly_arr"], path: ["monthly_arr"] },
  { field: ["valuation"], path: ["valuation"] },
  { field: ["funding"], path: ["funding"] },
  { field: ["employees"], path: ["employees"] },
  // Flat dataset key -> nested engine path. See note above.
  { field: ["swe_bench.verified"], path: ["swe_bench", "verified"] },
];

/**
 * DATASET SLUG ALIASES — recovery-dataset key -> live `tools.slug`.
 *
 * The dataset is keyed by its own research slugs, which match live `tools.slug`
 * for 31 of 33 tools. These two do not, and were confirmed against the live
 * `tools` table. Without the alias the override key would never match and the
 * tool would silently keep its live values — the same class of bug the
 * SLUG_ALIASES map in ./slugify.ts exists to prevent.
 *
 * Keep flat, alphabetized, append-only.
 */
export const DATASET_SLUG_ALIASES: Record<string, string> = {
  "gemini-cli": "google-gemini-cli",
  intellicode: "microsoft-intellicode",
};

/** Resolve a recovery-dataset key to the live `tools.slug` it describes. */
export function resolveDatasetSlug(datasetKey: string): string {
  return DATASET_SLUG_ALIASES[datasetKey] ?? datasetKey;
}

/** Read + parse the recovered dataset from disk. */
export function loadRecoveryDataset(path: string): RecoveryDataset {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as RecoveryDataset;
  if (!parsed?.tools || typeof parsed.tools !== "object") {
    throw new Error(`Recovery dataset at ${path} has no \`tools\` object`);
  }
  return parsed;
}

/**
 * Index the dataset by live `tools.slug` (applying DATASET_SLUG_ALIASES) so the
 * generator can look tools up by the same key it writes into the override file.
 */
export function indexRecoveryByLiveSlug(
  dataset: RecoveryDataset
): Map<string, Record<string, unknown>> {
  const byLiveSlug = new Map<string, Record<string, unknown>>();
  for (const [datasetKey, record] of Object.entries(dataset.tools)) {
    byLiveSlug.set(resolveDatasetSlug(datasetKey), record);
  }
  return byLiveSlug;
}

/** Walk a dot-path within a dataset tool record. */
function seriesAt(record: Record<string, unknown>, field: string[]): RecoverySeries | null {
  let node: unknown = record;
  for (const key of field) {
    if (!node || typeof node !== "object") return null;
    node = (node as Record<string, unknown>)[key];
  }
  if (!node || typeof node !== "object") return null;
  const candidate = node as Partial<RecoverySeries>;
  return candidate.monthly && typeof candidate.monthly === "object"
    ? (candidate as RecoverySeries)
    : null;
}

/**
 * Resolve every substantiated business leaf for one tool/period.
 *
 * Returns only fields the dataset actually resolved for this month. A missing
 * series, a null month, or a null value all yield nothing (rule 2 above), so the
 * caller never writes a leaf that would overwrite live data with a guess.
 */
export function businessLeavesForPeriod(
  toolRecord: Record<string, unknown> | undefined,
  period: string
): Array<{ path: string[]; leaf: BusinessLeaf }> {
  if (!toolRecord) return [];
  const out: Array<{ path: string[]; leaf: BusinessLeaf }> = [];

  for (const { field, path } of BUSINESS_METRIC_PATHS) {
    const series = seriesAt(toolRecord, field);
    if (!series) continue; // field never substantiated (see dataset.not_found)

    const month = series.monthly[period];
    if (!month || typeof month.value !== "number" || !Number.isFinite(month.value)) {
      continue; // month not resolved -> leave the live value alone
    }

    out.push({
      path,
      leaf: {
        // Plain number: the engine's parser tolerates strings, but overrides emit clean numbers.
        value: month.value,
        // Carried verbatim — never upgraded.
        fidelity: month.fidelity,
        source: month.source ?? null,
        as_of: month.as_of ?? null,
        recovery_note:
          month.note ??
          `Recovered ${path.join(".")} for ${period} (fidelity: ${month.fidelity}).`,
      },
    });
  }

  return out;
}
