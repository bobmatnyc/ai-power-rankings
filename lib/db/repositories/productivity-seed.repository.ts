/**
 * Productivity-board seed: pure parser and validator (#314).
 *
 * Why: the new productivity rows come from a reviewed seed file, never from a collector. A row
 *   with no vendor source, a slug that is already taken or reserved, or a kind other than
 *   productivity must stop the run, so every rule throws; nothing warns or skips.
 * What: `parseProductivitySeed` reads `docs/refresh/productivity-tools.json` text and returns typed
 *   rows. It touches no database and no network, and writes nothing. The caller passes the slugs
 *   that are already taken and the reserved path segments, so the module imports nothing.
 * Test: `tests/unit/productivity-seed-314.test.ts`
 */

export interface ProductivitySeedRow {
  slug: string;
  name: string;
  vendor: string;
  /** The vendor company, for `tools.data.info.company`. */
  company: string;
  websiteUrl: string;
  category: "productivity";
  subcategory: string;
  description: string;
  /** The vendor-controlled page the row was read from. */
  sourceUrl: string;
  kind: "productivity";
  status: "inactive";
}

export interface ProductivitySeed {
  checkedAt: string;
  basis: unknown;
  products: ProductivitySeedRow[];
}

export interface ProductivitySeedContext {
  /** Slugs held by existing rows (kind sheet, other seeds). A seed slug must not be in this set. */
  takenSlugs: ReadonlySet<string>;
  /** First path segments no tool slug may use (routes, files and locale codes). */
  reservedSegments: ReadonlySet<string>;
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
// Same text as the `tools_subcategory_check` constraint.
const SUBCATEGORY = /^[a-z0-9_]+$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HTTPS = /^https:\/\/\S+$/;

function rec(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${what} is not an object`);
  return value as Record<string, unknown>;
}

function text(e: Record<string, unknown>, key: string, what: string): string {
  const v = e[key];
  if (typeof v !== "string" || v.trim() === "") throw new Error(`${what}: ${key} is required`);
  return v.trim();
}

function httpsUrl(e: Record<string, unknown>, key: string, what: string): string {
  const v = text(e, key, what);
  if (!HTTPS.test(v)) throw new Error(`${what}: ${key} must be an https URL`);
  return v;
}

function isCalendarDate(value: string): boolean {
  const m = DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

function parseRow(entry: unknown, i: number, ctx: ProductivitySeedContext): ProductivitySeedRow {
  const e = rec(entry, `products[${i}]`);
  const what = `products[${i}]${typeof e["slug"] === "string" ? ` (${e["slug"]})` : ""}`;
  const slug = text(e, "slug", what);
  if (!SLUG.test(slug)) throw new Error(`${what}: slug must match ${SLUG}`);
  if (ctx.takenSlugs.has(slug)) throw new Error(`${what}: slug is already taken by an existing row`);
  if (ctx.reservedSegments.has(slug)) throw new Error(`${what}: slug is a reserved path segment`);
  const sourceUrl = httpsUrl(e, "source_url", what);
  if (e["kind"] !== "productivity") throw new Error(`${what}: kind must be "productivity"`);
  if (e["status"] !== "inactive") throw new Error(`${what}: status must be "inactive"`);
  if (e["category"] !== "productivity") throw new Error(`${what}: category must be "productivity"`);
  const subcategory = text(e, "subcategory", what);
  if (!SUBCATEGORY.test(subcategory)) throw new Error(`${what}: subcategory must match ${SUBCATEGORY}`);
  return {
    slug,
    name: text(e, "name", what),
    vendor: text(e, "vendor", what),
    company: text(e, "company", what),
    websiteUrl: httpsUrl(e, "website_url", what),
    category: "productivity",
    subcategory,
    description: text(e, "description", what),
    sourceUrl,
    kind: "productivity",
    status: "inactive",
  };
}

/**
 * Why: a productivity row that is unsourced, active, mis-kinded or colliding with an existing slug
 *   must never reach migration 0022; the first problem stops the run.
 * What: parses the seed JSON text and returns typed rows. Throws an `Error` naming the row and the
 *   rule on: text that is not JSON; a missing or invalid `checked_at`; no `products` array or an
 *   empty one; and, per row, a missing required text field (slug, name, vendor, company,
 *   website_url, subcategory, description, source_url), a slug failing `^[a-z0-9][a-z0-9-]*$`, a
 *   slug in `takenSlugs` or `reservedSegments`, a non-https `source_url` or `website_url`, `kind`
 *   other than "productivity", `status` other than "inactive", `category` other than
 *   "productivity", a subcategory failing `^[a-z0-9_]+$`, and a duplicate slug. Unknown fields are
 *   ignored. Pure: no database, no network.
 * Test: `tests/unit/productivity-seed-314.test.ts` (the shipped seed, one throw per rule).
 */
export function parseProductivitySeed(jsonText: string, ctx: ProductivitySeedContext): ProductivitySeed {
  const doc = rec(JSON.parse(jsonText), "seed");
  const checkedAt = text(doc, "checked_at", "seed");
  if (!isCalendarDate(checkedAt)) throw new Error("seed: checked_at must be a real YYYY-MM-DD date");
  const entries = doc["products"];
  if (!Array.isArray(entries) || entries.length === 0) throw new Error("seed has no products array");
  const products = entries.map((entry, i) => parseRow(entry, i, ctx));
  const seen = new Set<string>();
  for (const row of products) {
    if (seen.has(row.slug)) throw new Error(`duplicate slug: ${row.slug}`);
    seen.add(row.slug);
  }
  return { checkedAt, basis: doc["basis"] ?? null, products };
}
