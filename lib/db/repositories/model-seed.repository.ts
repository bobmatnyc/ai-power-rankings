/**
 * Model seed: pure parser and validator for the family-row seed format (#329).
 *
 * Why: model rows come from reviewed seed files, never from a collector. A bad row must stop
 *   the run, so every rule throws; nothing warns or skips. The format puts every stated fact
 *   beside its own source URL, so an unsourced fact cannot reach a loader.
 * What: `parseModelSeed` reads one seed document (for example
 *   `docs/refresh/open-weight-models-refresh.json`) and returns typed rows. `parseModelSeedRow`
 *   checks one row and is shared with the closed-seed adapter. Touches no database and no network.
 * Test: `tests/unit/model-seed-329.test.ts`
 */

import { EXCLUDED_MODEL_MODALITIES } from "../../rankings/lists";

/** The facts a seed row may state. Anything else, metrics included, is refused. */
export const MODEL_SEED_FACT_KEYS = [
  "current_version",
  "hf_repo",
  "licence",
  "parameters_b",
  "active_parameters_b",
  "release_date",
  "api_model_id",
] as const;
export type ModelSeedFactKey = (typeof MODEL_SEED_FACT_KEYS)[number];

export interface ModelSeedFact {
  value: string | number;
  sourceUrl: string;
}

export interface ModelSeedRow {
  slug: string;
  name: string;
  vendor: string;
  company: string;
  kind: "model";
  modality: string;
  status: "inactive";
  openWeight: boolean;
  /** The primary page for the row as a whole (name, vendor). */
  sourceUrl: string;
  description: string;
  /** Open-weight rows only; null on closed rows. */
  licenceReview: "not_required" | "pending" | null;
  facts: Partial<Record<ModelSeedFactKey, ModelSeedFact>>;
}

export interface ModelSeed {
  checkedAt: string;
  sources: unknown;
  basis: unknown;
  models: ModelSeedRow[];
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HTTPS = /^https:\/\/\S+$/;
const HF_REPO = /^[A-Za-z0-9][\w.-]*\/[A-Za-z0-9][\w.-]*$/;
// #329: Muse Wonder is excluded until the owner rules on its source.
const EXCLUDED_NAME = /muse[\s_-]*wonder/i;
// #329: neutral descriptions keep vendor marketing words out of the scoring keyword bonus (Q8).
const PROMOTIONAL = /\b(agentic|coding|most capable|most intelligent|state[\s-]of[\s-]the[\s-]art|best|frontier)\b/i;
// #329: only these licence tags need no review; any other tag names a custom licence.
const OSI_LICENCES = new Set(["mit", "apache-2.0", "bsd-3-clause"]);
const ROW_KEYS = new Set([
  "slug",
  "name",
  "vendor",
  "company",
  "kind",
  "modality",
  "status",
  "open_weight",
  "source_url",
  "description",
  "licence_review",
  "facts",
]);
const NUMBER_FACTS: ReadonlySet<ModelSeedFactKey> = new Set(["parameters_b", "active_parameters_b"]);

function rec(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${what} is not an object`);
  return value as Record<string, unknown>;
}

function text(e: Record<string, unknown>, key: string, what: string): string {
  const v = e[key];
  if (typeof v !== "string" || v.trim() === "") throw new Error(`${what}: ${key} is required`);
  return v.trim();
}

/** True when `value` is YYYY-MM-DD and names a real calendar day. */
export function isCalendarDate(value: string): boolean {
  const m = DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

function parseFact(key: string, raw: unknown, what: string, checkedAt: string): ModelSeedFact {
  if (!(MODEL_SEED_FACT_KEYS as readonly string[]).includes(key)) {
    throw new Error(`${what}: facts.${key} is not an allowed fact (${MODEL_SEED_FACT_KEYS.join(", ")})`);
  }
  const f = rec(raw, `${what}: facts.${key}`);
  const sourceUrl = f["source_url"];
  if (typeof sourceUrl !== "string" || !HTTPS.test(sourceUrl.trim())) {
    throw new Error(`${what}: stated fact ${key} needs an https source_url`);
  }
  const value = f["value"];
  if (NUMBER_FACTS.has(key as ModelSeedFactKey)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      throw new Error(`${what}: facts.${key} must be a positive number`);
    }
  } else if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${what}: facts.${key} must be a non-empty string`);
  }
  if (key === "hf_repo" && !HF_REPO.test(String(value))) throw new Error(`${what}: facts.hf_repo must be owner/name`);
  if (key === "release_date") {
    if (!isCalendarDate(String(value))) throw new Error(`${what}: facts.release_date must be a real YYYY-MM-DD date`);
    // ISO dates compare as strings.
    if (String(value) > checkedAt) throw new Error(`${what}: facts.release_date is after checked_at ${checkedAt}`);
  }
  return { value: typeof value === "string" ? value.trim() : value, sourceUrl: sourceUrl.trim() };
}

/**
 * Why: one rule set for every model seed row, whichever file it came from.
 * What: checks one raw row and returns it typed. Throws an `Error` naming the row and the rule on
 *   an unknown row key; a missing slug, name, vendor, company, source_url or description; a slug
 *   failing `^[a-z0-9][a-z0-9-]*$`; a slug or name naming Muse Wonder; `kind` missing or other
 *   than "model"; `status` missing or other than "inactive"; a missing modality or an image or
 *   video one (D52); a non-boolean `open_weight`; a non-https `source_url`; a promotional
 *   description; a missing `facts` object, an unknown fact key, or a fact without an https
 *   `source_url` or with a bad value; no `current_version`; an open-weight row without `hf_repo`
 *   or with a `licence_review` that does not match its licence; a closed row with `hf_repo` or a
 *   `licence_review`; active parameters above total parameters.
 * Test: `tests/unit/model-seed-329.test.ts` (one throw per rule).
 */
export function parseModelSeedRow(entry: unknown, what: string, checkedAt: string): ModelSeedRow {
  const e = rec(entry, what);
  for (const key of Object.keys(e)) if (!ROW_KEYS.has(key)) throw new Error(`${what}: unknown field ${key}`);
  const slug = text(e, "slug", what);
  const name = text(e, "name", what);
  if (!SLUG.test(slug)) throw new Error(`${what}: slug must match ${SLUG}`);
  if (EXCLUDED_NAME.test(slug) || EXCLUDED_NAME.test(name)) {
    throw new Error(`${what}: Muse Wonder is excluded until its source is ruled on`);
  }
  if (e["kind"] !== "model") throw new Error(`${what}: kind must be "model"`);
  if (e["status"] !== "inactive") throw new Error(`${what}: status must be "inactive"; a seed never activates a row`);
  const modality = text(e, "modality", what).toLowerCase();
  if (EXCLUDED_MODEL_MODALITIES.includes(modality)) throw new Error(`${what}: ${modality} models are out of scope (D52)`);
  const openWeight = e["open_weight"];
  if (typeof openWeight !== "boolean") throw new Error(`${what}: open_weight must be true or false`);
  const sourceUrl = text(e, "source_url", what);
  if (!HTTPS.test(sourceUrl)) throw new Error(`${what}: source_url must be an https URL`);
  const description = text(e, "description", what);
  if (PROMOTIONAL.test(description)) throw new Error(`${what}: description must be neutral (no promotional wording)`);

  const rawFacts = rec(e["facts"], `${what}: facts`);
  const facts: ModelSeedRow["facts"] = {};
  for (const [key, raw] of Object.entries(rawFacts)) facts[key as ModelSeedFactKey] = parseFact(key, raw, what, checkedAt);
  if (!facts.current_version) throw new Error(`${what}: facts.current_version is required`);
  const total = facts.parameters_b?.value;
  const active = facts.active_parameters_b?.value;
  if (typeof total === "number" && typeof active === "number" && active > total) {
    throw new Error(`${what}: active_parameters_b exceeds parameters_b`);
  }

  let licenceReview: ModelSeedRow["licenceReview"] = null;
  if (openWeight) {
    if (!facts.hf_repo) throw new Error(`${what}: an open-weight row needs facts.hf_repo`);
    const licence = facts.licence ? String(facts.licence.value).toLowerCase() : null;
    const expected = licence !== null && OSI_LICENCES.has(licence) ? "not_required" : "pending";
    if (e["licence_review"] !== expected) {
      throw new Error(`${what}: licence_review must be "${expected}" for licence ${licence ?? "(not stated)"}`);
    }
    licenceReview = expected;
  } else {
    if (facts.hf_repo) throw new Error(`${what}: a closed row has no hf_repo`);
    if (e["licence_review"] !== undefined) throw new Error(`${what}: a closed row has no licence_review`);
  }

  return {
    slug,
    name,
    vendor: text(e, "vendor", what),
    company: text(e, "company", what),
    kind: "model",
    modality,
    status: "inactive",
    openWeight,
    sourceUrl,
    description,
    licenceReview,
    facts,
  };
}

/** Throws on the first slug that appears twice. */
export function assertUniqueSlugs(rows: readonly ModelSeedRow[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.slug)) throw new Error(`duplicate slug: ${row.slug}`);
    seen.add(row.slug);
  }
}

/**
 * Why: a seed file is checked as a whole before any row is used.
 * What: parses the seed JSON text and returns typed rows. Throws on text that is not JSON, a
 *   missing or invalid `checked_at`, no `models` array or an empty one, any row rule
 *   (`parseModelSeedRow`) and a duplicate slug. Pure: no database, no network.
 * Test: `tests/unit/model-seed-329.test.ts`
 */
export function parseModelSeed(jsonText: string): ModelSeed {
  const doc = rec(JSON.parse(jsonText), "seed");
  const checkedAt = text(doc, "checked_at", "seed");
  if (!isCalendarDate(checkedAt)) throw new Error("seed: checked_at must be a real YYYY-MM-DD date");
  const entries = doc["models"];
  if (!Array.isArray(entries) || entries.length === 0) throw new Error("seed has no models array");
  const models = entries.map((entry, i) => {
    const slug = typeof (entry as Record<string, unknown>)?.["slug"] === "string" ? ` (${(entry as Record<string, unknown>)["slug"]})` : "";
    return parseModelSeedRow(entry, `models[${i}]${slug}`, checkedAt);
  });
  assertUniqueSlugs(models);
  return { checkedAt, sources: doc["sources"] ?? null, basis: doc["basis"] ?? null, models };
}
