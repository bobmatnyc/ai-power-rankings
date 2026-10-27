/**
 * Closed-model seed: pure parser and validator (#308).
 *
 * Why: the current closed models come from a reviewed seed file, never from a collector. A bad
 *   row must stop the run, so every rule throws; nothing warns or skips.
 * What: `parseClosedModelSeed` reads `docs/refresh/closed-models.json` and returns typed rows.
 *   It touches no database and no network, and nothing here writes a row. Loading is a later change.
 * Test: `tests/unit/closed-model-seed-308.test.ts`
 */

export interface ClosedModelSeedRow {
  slug: string;
  name: string;
  vendor: string;
  /** The vendor company, for `tools.data.company`. */
  company: string;
  releaseDate: string;
  sourceUrl: string;
  apiModelId: string;
  description: string;
  /** The quoted vendor sentence that supports the row's date and status. */
  proof: string;
  kind: "model";
  status: "inactive";
  openWeight: false;
  priceInPerMtok: number | null;
  priceOutPerMtok: number | null;
}

export interface ClosedModelSeed {
  checkedAt: string;
  sources: unknown;
  basis: unknown;
  models: ClosedModelSeedRow[];
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HTTPS = /^https:\/\/\S+$/;
// #308: lite and nano tiers and the restricted-access Mythos model are out of scope for the seed.
const EXCLUDED_TIER = /lite|nano|mythos/i;

function rec(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${what} is not an object`);
  return value as Record<string, unknown>;
}

function text(e: Record<string, unknown>, key: string, what: string): string {
  const v = e[key];
  if (typeof v !== "string" || v.trim() === "") throw new Error(`${what}: ${key} is required`);
  return v.trim();
}

function price(e: Record<string, unknown>, key: string, what: string): number | null {
  const v = e[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new Error(`${what}: ${key} must be null or a non-negative number`);
  return v;
}

/** True when `value` is YYYY-MM-DD and names a real calendar day. */
function isCalendarDate(value: string): boolean {
  const m = DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

function parseRow(entry: unknown, i: number, checkedAt: string): ClosedModelSeedRow {
  const e = rec(entry, `models[${i}]`);
  const what = `models[${i}]${typeof e["slug"] === "string" ? ` (${e["slug"]})` : ""}`;
  const slug = text(e, "slug", what);
  const name = text(e, "name", what);
  if (!SLUG.test(slug)) throw new Error(`${what}: slug must match ${SLUG}`);
  if (EXCLUDED_TIER.test(slug) || EXCLUDED_TIER.test(name)) {
    throw new Error(`${what}: slug or name is in an excluded tier (lite, nano or mythos)`);
  }
  const sourceUrl = text(e, "source_url", what);
  if (!HTTPS.test(sourceUrl)) throw new Error(`${what}: source_url must be an https URL`);
  const releaseDate = text(e, "release_date", what);
  if (!isCalendarDate(releaseDate)) throw new Error(`${what}: release_date must be a real YYYY-MM-DD date`);
  // ISO dates compare as strings.
  if (releaseDate > checkedAt) throw new Error(`${what}: release_date ${releaseDate} is after checked_at ${checkedAt}`);
  if (e["kind"] !== "model") throw new Error(`${what}: kind must be "model"`);
  if (e["status"] !== "inactive") throw new Error(`${what}: status must be "inactive"`);
  if (e["open_weight"] !== false) throw new Error(`${what}: open_weight must be false`);
  return {
    slug,
    name,
    vendor: text(e, "vendor", what),
    company: text(e, "company", what),
    releaseDate,
    sourceUrl,
    apiModelId: text(e, "api_model_id", what),
    description: text(e, "description", what),
    proof: text(e, "proof", what),
    kind: "model",
    status: "inactive",
    openWeight: false,
    priceInPerMtok: price(e, "price_in_per_mtok", what),
    priceOutPerMtok: price(e, "price_out_per_mtok", what),
  };
}

/**
 * Why: a closed-model row that is unsourced, future-dated, active, open-weight or in an excluded
 *   tier must never reach a later loader; the first problem stops the run.
 * What: parses the seed JSON text and returns typed rows. Throws an `Error` naming the row and
 *   the rule on: text that is not JSON; no `models` array or an empty one; a missing or invalid
 *   `checked_at`; and, per row, a missing required text field (slug, name, vendor, company,
 *   release_date, source_url, api_model_id, description, proof), a slug failing
 *   `^[a-z0-9][a-z0-9-]*$`, a name or slug matching `/lite|nano|mythos/i`, a non-https
 *   `source_url`, a `release_date` that is not a real calendar day or is after `checked_at`,
 *   `kind` other than "model", `status` other than "inactive", `open_weight` other than false,
 *   a price that is neither null nor a non-negative number, and a duplicate slug. Unknown fields
 *   are ignored, as in the open-weight parser. Pure: no database, no network.
 * Test: `tests/unit/closed-model-seed-308.test.ts` (the shipped seed, one throw per rule, the
 *   no-scoring guard).
 */
export function parseClosedModelSeed(jsonText: string): ClosedModelSeed {
  const doc = rec(JSON.parse(jsonText), "seed");
  const checkedAt = text(doc, "checked_at", "seed");
  if (!isCalendarDate(checkedAt)) throw new Error("seed: checked_at must be a real YYYY-MM-DD date");
  const entries = doc["models"];
  if (!Array.isArray(entries) || entries.length === 0) throw new Error("seed has no models array");
  const models = entries.map((entry, i) => parseRow(entry, i, checkedAt));
  const seen = new Set<string>();
  for (const row of models) {
    if (seen.has(row.slug)) throw new Error(`duplicate slug: ${row.slug}`);
    seen.add(row.slug);
  }
  return { checkedAt, sources: doc["sources"] ?? null, basis: doc["basis"] ?? null, models };
}
