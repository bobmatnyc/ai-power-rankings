/**
 * Open-weight model seed: validation, plan and writer (#184).
 *
 * Why: the open-weight models (kind `model`, `open_weight = true`) come from a reviewed seed
 *   file, never from a collector, and the loader must not half-load or overwrite a value
 *   somebody reviewed. The sheet's `tools` columns exist since migration 0016; no new migration.
 * What: `parseOpenWeightSeed` reads the seed JSON. `planOpenWeightRow` is read-only and says
 *   `inserted` (slug absent; the row is created `inactive`, category `other`, so no ranking,
 *   sitemap or API list shows it until the owner activates it), `updated` (an existing model
 *   row: only NULL columns are filled, `open_weight` NULL becomes true) or `unchanged`. It
 *   refuses a bad field, a slug held by a non-model row, and a row already marked closed
 *   (`open_weight = false`). `applyOpenWeightRow` writes one planned row and writes nothing
 *   to any table but `tools`. The seed's sources and basis notes land in `tools.data.openWeightSeed`.
 * Test: `tests/unit/open-weight-seed-184.test.ts`
 */

import { and, type AnyColumn, eq, isNull, or, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { isValidRepoId } from "../../metrics-collectors/huggingface";
import { tools } from "../schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the schema generic differs per caller
export type OpenWeightSeedDb = PgDatabase<PgQueryResultHKT, any>;

export interface OpenWeightSeedRow {
  slug: string;
  name: string;
  vendor: string;
  hfRepo: string;
  licence: string;
  licenceUrl: string;
  parametersB: number;
  activeParametersB: number | null;
  releaseDate: string;
  priceInPerMtok: number | null;
  priceOutPerMtok: number | null;
  sourceUrl: string;
  /** The licence tag the Hub shows; `licence` may differ where a reviewed sheet names it. */
  hubLicence: string;
  /** #184: Hub licence is 'other' or cc-by-nc-*; kept in the seed, text reviewed before activation. */
  restrictedLicence: boolean;
  licenceReview: string;
  flagshipBasis: string;
}

export interface OpenWeightSeed {
  checkedAt: string;
  sources: unknown;
  basis: unknown;
  models: OpenWeightSeedRow[];
}

export type OpenWeightPlan =
  | { ok: true; outcome: "inserted" | "updated" | "unchanged"; patch: Record<string, unknown> }
  | { ok: false; error: Error };

const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HTTPS = /^https:\/\/\S+$/;

function rec(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${what} is not an object`);
  return value as Record<string, unknown>;
}

function text(e: Record<string, unknown>, key: string): string {
  const v = e[key];
  return typeof v === "string" ? v.trim() : "";
}

function num(e: Record<string, unknown>, key: string): number | null {
  const v = e[key];
  return typeof v === "number" ? v : null;
}

/** Throws on a file that is not a seed; field values are checked by `validateOpenWeightRow`. */
export function parseOpenWeightSeed(jsonText: string): OpenWeightSeed {
  const doc = rec(JSON.parse(jsonText), "seed");
  if (!Array.isArray(doc["models"])) throw new Error("seed has no models array");
  const models = doc["models"].map((entry, i) => {
    const e = rec(entry, `models[${i}]`);
    return {
      slug: text(e, "slug"),
      name: text(e, "name"),
      vendor: text(e, "vendor"),
      hfRepo: text(e, "hf_repo"),
      licence: text(e, "licence"),
      licenceUrl: text(e, "licence_url"),
      parametersB: num(e, "parameters_b") ?? Number.NaN,
      activeParametersB: num(e, "active_parameters_b"),
      releaseDate: text(e, "release_date"),
      priceInPerMtok: num(e, "price_in_per_mtok"),
      priceOutPerMtok: num(e, "price_out_per_mtok"),
      sourceUrl: text(e, "source_url"),
      hubLicence: text(e, "hub_licence"),
      restrictedLicence: e["restricted_licence"] === true,
      licenceReview: text(e, "licence_review"),
      flagshipBasis: text(e, "flagship_basis"),
    } satisfies OpenWeightSeedRow;
  });
  return { checkedAt: text(doc, "checked_at"), sources: doc["sources"] ?? null, basis: doc["basis"] ?? null, models };
}

/** #184: the licence tags whose text has not been reviewed or that restrict use. */
export function isRestrictedLicence(hubLicence: string): boolean {
  return hubLicence === "other" || hubLicence.startsWith("cc-by-nc");
}

/** Returns the first problem with a row, or null. */
export function validateOpenWeightRow(row: OpenWeightSeedRow): string | null {
  if (!SLUG.test(row.slug)) return "slug must be lowercase letters, digits and hyphens";
  if (row.name === "" || row.vendor === "" || row.licence === "") return "name, vendor and licence are required";
  if (!isValidRepoId(row.hfRepo)) return "hf_repo must be owner/name";
  if (row.hubLicence === "" || row.flagshipBasis === "") return "hub_licence and flagship_basis are required";
  // #184: the restriction flag follows the Hub licence tag, and a restricted row awaits review.
  if (row.restrictedLicence !== isRestrictedLicence(row.hubLicence)) {
    return "restricted_licence must be true exactly when the Hub licence is 'other' or cc-by-nc-*";
  }
  if (row.licenceReview !== (row.restrictedLicence ? "pending" : "not_required")) {
    return "licence_review must be 'pending' for a restricted row, else 'not_required'";
  }
  if (!HTTPS.test(row.licenceUrl) || !HTTPS.test(row.sourceUrl)) return "licence_url and source_url must be https URLs";
  if (!Number.isFinite(row.parametersB) || row.parametersB <= 0) return "parameters_b must be a positive number";
  const nonNegative = [row.activeParametersB, row.priceInPerMtok, row.priceOutPerMtok];
  if (nonNegative.some((v) => v !== null && (!Number.isFinite(v) || v < 0))) return "numbers must be non-negative";
  if (row.activeParametersB !== null && row.activeParametersB > row.parametersB) {
    return "active_parameters_b exceeds parameters_b";
  }
  if (!DATE.test(row.releaseDate)) return "release_date must be YYYY-MM-DD";
  return null;
}

/** Columns a seed row can set, as `tools` column values (numerics are strings in Drizzle). */
function seedColumns(row: OpenWeightSeedRow) {
  const str = (v: number | null) => (v === null ? null : String(v));
  return {
    licence: row.licence,
    parametersB: str(row.parametersB),
    activeParametersB: str(row.activeParametersB),
    priceInPerMtok: str(row.priceInPerMtok),
    priceOutPerMtok: str(row.priceOutPerMtok),
    releaseDate: row.releaseDate,
    hfRepo: row.hfRepo,
  };
}

/** Read-only: what writing this row would do. */
export async function planOpenWeightRow(db: OpenWeightSeedDb, row: OpenWeightSeedRow): Promise<OpenWeightPlan> {
  const problem = validateOpenWeightRow(row);
  if (problem) return { ok: false, error: new Error(problem) };
  const [existing] = await db.select().from(tools).where(eq(tools.slug, row.slug)).limit(1);
  const columns = seedColumns(row);
  if (!existing) return { ok: true, outcome: "inserted", patch: columns };
  if (existing.kind !== "model") {
    return { ok: false, error: new Error(`slug is held by a ${existing.kind} row, not a model`) };
  }
  if (existing.openWeight === false) {
    return { ok: false, error: new Error("row is marked open_weight = false; resolve that first") };
  }
  // #184: fill NULL columns only, so a reviewed value is never overwritten.
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(columns)) {
    if (value !== null && (existing as Record<string, unknown>)[key] == null) patch[key] = value;
  }
  if (existing.openWeight === null) patch["openWeight"] = true;
  return { ok: true, outcome: Object.keys(patch).length > 0 ? "updated" : "unchanged", patch };
}

function provenance(row: OpenWeightSeedRow, seed: Pick<OpenWeightSeed, "checkedAt" | "sources" | "basis">) {
  return {
    openWeightSeed: {
      issue: 184,
      checkedAt: seed.checkedAt,
      vendor: row.vendor,
      sourceUrl: row.sourceUrl,
      licenceUrl: row.licenceUrl,
      hubLicence: row.hubLicence,
      restrictedLicence: row.restrictedLicence,
      licenceReview: row.licenceReview,
      flagshipBasis: row.flagshipBasis,
      sources: seed.sources,
      basis: seed.basis,
    },
  };
}

/** Writes one row that `planOpenWeightRow` accepted. Only `tools` is written. */
export async function applyOpenWeightRow(
  db: OpenWeightSeedDb,
  row: OpenWeightSeedRow,
  plan: Extract<OpenWeightPlan, { ok: true }>,
  seed: Pick<OpenWeightSeed, "checkedAt" | "sources" | "basis">
): Promise<void> {
  if (plan.outcome === "unchanged") return;
  const data = provenance(row, seed);
  if (plan.outcome === "inserted") {
    await db.insert(tools).values({
      ...(plan.patch as ReturnType<typeof seedColumns>),
      slug: row.slug,
      name: row.name,
      category: "other",
      status: "inactive",
      kind: "model",
      openWeight: true,
      data,
    });
    return;
  }
  // #184: planning ran earlier, so re-check at write time. Each column is COALESCE(column, value),
  // which never overwrites a value set since the plan, and the WHERE re-checks kind and
  // open_weight; a row that no longer qualifies matches nothing and the write throws.
  const fills: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(plan.patch)) {
    if (key === "openWeight") fills[key] = sql`COALESCE(${tools.openWeight}, true)`;
    else fills[key] = sql`COALESCE(${(tools as unknown as Record<string, AnyColumn>)[key]}, ${value})`;
  }
  const written = await db
    .update(tools)
    .set({
      ...fills,
      data: sql`${tools.data} || ${JSON.stringify(data)}::jsonb`,
      updatedAt: sql`now()`,
    })
    .where(
      and(eq(tools.slug, row.slug), eq(tools.kind, "model"), or(isNull(tools.openWeight), eq(tools.openWeight, true)))
    )
    .returning({ id: tools.id });
  if (written.length === 0) throw new Error(`${row.slug}: row changed since planning and is no longer an open-weight-eligible model`);
}
