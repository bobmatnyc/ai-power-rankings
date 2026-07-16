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
 *
 * Two further rules exist because the dataset resolves values it should not
 * hand to the engine unqualified:
 *
 *   3. SEMANTIC EXCLUSION. The dataset's `users` series frequently holds a
 *      number that is NOT a count of that tool's users — a parent product's
 *      WAU, an installs/stars/downloads proxy, a quota, a percentage, or a
 *      customer/business count. The dataset flags this inline in prose (its own
 *      `conventions.users_note` says such values "should be treated as a
 *      different KIND of metric"), but prose is invisible to the engine, which
 *      would weight the number as a user count. See USERS_SEMANTIC_EXCLUSIONS.
 *   4. SOURCE INTEGRITY. A leaf may not be emitted unless the anchors its value
 *      derives from carry a source URL. See `periodIsSourceBacked`.
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

/**
 * USERS SEMANTIC EXCLUSIONS — live `tools.slug` -> why the dataset's `users`
 * series is not a count of THIS tool's users.
 *
 * The engine reads `metrics.users` in `calculateDeveloperAdoption` and weights
 * it as "how many people use this tool". Every entry below fails that meaning in
 * one of five ways, per the dataset's OWN inline note on the anchor:
 *
 *   - PARENT/PLATFORM COUNT: the number belongs to a larger product or company,
 *     not this tool. Note this is NOT the parent-attribution policy question:
 *     the owner has explicitly allowed a parent's FINANCIALS (valuation/funding/
 *     monthly_arr) to flow to a sub-feature, and those still flow. A parent's
 *     USER COUNT restated as the sub-feature's own user count is a factual
 *     mislabel, not a valuation judgement, so it is excluded here while the
 *     parent's financials on the same tool are kept.
 *   - PROXY METRIC: installs / GitHub stars / downloads — a different KIND of
 *     metric, per `conventions.users_note`.
 *   - NOT A COUNT: a quota or a percentage.
 *   - CUSTOMER COUNT: businesses/organizations/paying accounts, not users.
 *   - DEFINITION SPLICE: the series changes definition mid-flight, so any curve
 *     across it reads a redefinition as real growth or decline.
 *
 * Excluding the field emits NOTHING, so production keeps the live `tools.data`
 * value (rule 2) — it does not zero the tool's adoption score.
 *
 * Keep alphabetized. Each entry MUST cite the dataset note that justifies it.
 */
export const USERS_SEMANTIC_EXCLUSIONS: Record<string, string> = {
  "amazon-q-developer":
    "NOT THIS TOOL'S USERS: 1,000 = developers who benefited from the Java upgrade transformation FEATURE, not Amazon Q Developer's user base.",
  "chatgpt-canvas":
    "PARENT COUNT: the series is ChatGPT's weekly active users (dataset note: 'ChatGPT WAU (corporate, not Canvas-specific)'), not Canvas users. Canvas's parent valuation/ARR are still emitted — attribution is allowed; a parent's user count restated as Canvas's own is a mislabel.",
  "claude-artifacts":
    "NOT A USER COUNT: 500M = cumulative Artifacts CREATED (dataset note: 'over half a billion Artifacts created cumulatively; millions of users (imprecise)'). No sourced Artifacts-specific user figure exists.",
  cline:
    "PROXY METRIC: 2.7M = VS Code Marketplace + Open VSX INSTALLS, which conventions.users_note calls a different KIND of metric.",
  coderabbit:
    "CUSTOMER COUNT: 8,000 = paying BUSINESSES (dataset note also cites '9,000+ organizations'), not individual users.",
  cursor:
    "DEFINITION SPLICE: 360K paying customers (2024-12, sourced) then 50K enterprise business customers (2025-11, unsourced) — the dataset itself calls these a 'distinct metric'. Holding the 50K flat reads a definition change as a 7x decline. No sourced anchor under a single definition falls inside the Dec-2025..Jun-2026 window, so no month is emitted. (The unsourced 2025-11 anchor independently fails the source-integrity rule.)",
  "gemini-code-assist":
    "NOT A COUNT: 180,000 = a free-tier QUOTA of code completions/month per individual (dataset note: 'a quota, not a user count').",
  "github-copilot":
    "DEFINITION SPLICE: 20M cumulative all-time users (2025-07, sourced) then 4.7M paid subscribers (2026-01, unsourced) — dataset note: 'distinct metric from cumulative all-time users above, not a decline'. The Dec-2025 month interpolates ACROSS that redefinition.",
  "google-gemini-cli":
    "PROXY METRIC: 100,000 = GitHub stars (dataset note: 'GitHub-proxy metric, not a user count'); the series interpolates from 0 at launch to a star count.",
  "google-jules":
    "NOT A USER COUNT: 140,000 = code improvements shared publicly during beta (dataset note: 'not a discrete user headcount; official GA post gives no absolute user number').",
  "jetbrains-ai":
    "NOT A COUNT: the value is 9 = PERCENT of surveyed developers (dataset note: 'Value is a PERCENT, not a raw count -- do not treat as a user headcount'). Emitting it as `users` would tell the engine JetBrains AI has nine users.",
  "microsoft-intellicode":
    "PROXY METRIC: 70M = cumulative extension DOWNLOADS, not users. (Also unsourced: the dataset could not page-verify it, HTTP 403.)",
  "openai-codex-cli":
    "PARENT COUNT: the series is the wider OpenAI Codex PRODUCT's weekly active users, not the Codex CLI's own users.",
  openhands:
    "PROXY METRIC: 3M = downloads, and the earlier anchor is ~30,000 GitHub stars (dataset note: 'GitHub-proxy metric, not a user count').",
  "qodo-gen":
    "PLATFORM COUNT: 1M = developers who have used \"Qodo's solutions\" company-wide across Qodo's product line, not Qodo Gen specifically.",
  "snyk-code":
    "PLATFORM COUNT: 3,100 = Snyk company-wide CUSTOMERS (dataset note: 'company-wide, not Snyk-Code-specific count') — both the wrong scope and the wrong unit.",
  "sourcegraph-cody":
    "PLATFORM COUNT: 2.5M = developers on the Sourcegraph platform (dataset note: 'not Cody-specific').",
  "v0-vercel":
    "NOT A USER COUNT: 100,000 = WAITLIST signups; the second anchor (5,000) is a 'distinct cohort' beta expansion, so the series also splices definitions.",
};

/**
 * Live `tools.slug` values whose `users` series survives the audit: a sourced,
 * tool-specific, definitionally consistent count. Used only to assert the
 * exclusion list is exhaustive over the shipped dataset (see the test), so a
 * dataset reshape that introduces a new `users` series fails loudly rather than
 * silently feeding the engine a proxy.
 */
export const USERS_SEMANTICALLY_VALID: ReadonlySet<string> = new Set([
  "claude-code", // 115K developers -> 2M WAU; both count Claude Code's own users.
  "bolt-new", // 1M DAU (sourced) vs 7M total (unsourced) — sourcing rule decides.
  "kiro", // 250K developers who have used Kiro.
  "lovable", // 8M users.
  "replit-agent", // 22.5M -> 40M -> 50M users, one definition throughout.
  "sourcery", // 300K developers (no in-window month resolved).
  "tabnine", // 1M+ users, reaffirmed unchanged through Sep 2025.
  "windsurf", // 700K+ active developers.
  "zed", // 150K+ active developers.
]);

/**
 * Is `period`'s value backed by anchors that actually carry a source URL?
 *
 * The dataset resolves each month from dated anchors, and an `interpolated`
 * month legitimately has no `source` of its own (it is derived — its note names
 * the two anchors it sits between). So "the month has no source URL" is only a
 * defect when the month claims `real`. The deeper defect is provenance: a month
 * interpolated TOWARD, or held flat FROM, an anchor with no source is just as
 * unsupported as an unsourced `real` reading, and must not be emitted.
 *
 *   real / held_flat -> the most recent anchor at-or-before `period` must be sourced.
 *   interpolated     -> BOTH bracketing anchors must be sourced.
 *
 * A series with no `anchors` array cannot be provenance-checked; only the
 * `real`-needs-a-source rule applies to it.
 */
export function periodIsSourceBacked(series: RecoverySeries, period: string): boolean {
  const month = series.monthly[period];
  if (!month) return false;

  // A `real` reading asserts a directly reported figure: it must cite one.
  if (month.fidelity === "real" && !month.source) return false;

  const anchors = (series.anchors ?? [])
    .filter((a) => typeof a.date === "string")
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  if (anchors.length === 0) return true;

  // YYYY-MM string compare is ordinal, so slicing the anchor date is sufficient.
  const prev = anchors.filter((a) => a.date.slice(0, 7) <= period).pop();
  const next = anchors.find((a) => a.date.slice(0, 7) > period);

  if (month.fidelity === "interpolated") {
    return Boolean(prev?.source) && Boolean(next?.source);
  }
  // real / held_flat both carry the most recent anchor's value forward.
  return Boolean(prev?.source);
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

/**
 * The dataset's TOOL-LEVEL `parent_note`, if any.
 *
 * Present for the 17 tools that are features/subsidiaries of a larger product
 * (e.g. "Canvas is a ChatGPT feature; SWE-bench scores below are the underlying
 * OpenAI model…"). Under the owner's parent-attribution policy these tools DO
 * carry their parent's financials, so the note is threaded into the override
 * file's per-tool provenance block: the attribution stays auditable instead of
 * silently presenting a parent's valuation as the feature's own.
 */
export function parentNote(toolRecord: Record<string, unknown> | undefined): string | null {
  const note = toolRecord?.parent_note;
  return typeof note === "string" && note.length > 0 ? note : null;
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
 * Returns only fields the dataset actually resolved for this month AND that
 * survive the semantic + source-integrity audits. A missing series, a null
 * month, a null value, a semantically mislabeled `users` series, or a value
 * resting on an unsourced anchor all yield nothing, so the caller never writes
 * a leaf that would overwrite live data with a guess or a mislabel.
 *
 * `liveSlug` is required (not optional) so a new call site cannot silently
 * bypass the semantic exclusions by forgetting to pass it.
 */
export function businessLeavesForPeriod(
  liveSlug: string,
  toolRecord: Record<string, unknown> | undefined,
  period: string
): Array<{ path: string[]; leaf: BusinessLeaf }> {
  if (!toolRecord) return [];
  const out: Array<{ path: string[]; leaf: BusinessLeaf }> = [];

  for (const { field, path } of BUSINESS_METRIC_PATHS) {
    // Rule 3: the dataset's number is not a count of this tool's users.
    if (field[0] === "users" && liveSlug in USERS_SEMANTIC_EXCLUSIONS) continue;

    const series = seriesAt(toolRecord, field);
    if (!series) continue; // field never substantiated (see dataset.not_found)

    const month = series.monthly[period];
    if (!month || typeof month.value !== "number" || !Number.isFinite(month.value)) {
      continue; // month not resolved -> leave the live value alone
    }

    // Rule 4: never emit a value whose provenance chain is unsourced.
    if (!periodIsSourceBacked(series, period)) continue;

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
