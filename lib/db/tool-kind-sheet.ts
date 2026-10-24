/**
 * Tool kind mapping sheet: parser, validator and the 0017 backfill builder (#183).
 *
 * Why: #183 sets a reviewed kind on every tool. The reviewed values live in a committed
 *   sheet (`docs/refresh/tool-kind-mapping.csv`, plan criterion 11) that the owner
 *   acknowledges, and the data change ships as its own migration (0017, Q-A9), separate
 *   from the schema change in 0016. A sheet that left the default on everything, copied
 *   the audit's `coding-harness` onto the retired model duplicates, or put
 *   `app_builder` on a seventh tool must be refused before any SQL is written.
 * What: `parseKindSheet` reads the CSV (header `slug, kind, subcategory, open_weight,
 *   retired, survivor, confidence, note`); `validateKindSheet` checks it against a
 *   contract (row count, counts by kind, the app-builder list) and the audit slugs;
 *   `buildKindBackfillSql` renders one idempotent UPDATE keyed on slug.
 * Test: `tests/unit/tool-kind-sheet-183.test.ts` (parser and validator, fixture sheet),
 *   `tests/unit/tool-kind-links-pglite-183.test.ts` (the backfill on real Postgres).
 */

import { TOOL_KINDS, type ToolKind } from "./schema";

export const KIND_SHEET_COLUMNS = [
  "slug",
  "kind",
  "subcategory",
  "open_weight",
  "retired",
  "survivor",
  "confidence",
  "note",
] as const;

/** #183 (Q-A4): the stored subcategory form; URLs map `_` to `-`. Same text as the CHECK. */
export const SUBCATEGORY_PATTERN = /^[a-z0-9_]+$/;

export interface KindSheetRow {
  slug: string;
  kind: ToolKind;
  subcategory: string | null;
  openWeight: boolean | null;
  retired: boolean;
  survivor: string | null;
  confidence: string;
  note: string;
}

export interface KindSheetContract {
  rowCount: number;
  kindCounts: Readonly<Record<ToolKind, number>>;
  /** The only slugs allowed `subcategory = 'app_builder'`; each must be a harness. */
  appBuilders: readonly string[];
}

/**
 * #183: plan criterion 2 and D2b, for the 114 active tools of the #177 audit. Harness 75
 * (72 survivors, 3 retired), model 15 (9 survivors, 6 retired), other 24 (23 survivors,
 * 1 retired protocol row).
 */
export const KIND_SHEET_CONTRACT: KindSheetContract = {
  rowCount: 114,
  kindCounts: { harness: 75, model: 15, other: 24, productivity: 0 },
  appBuilders: ["bolt-new", "claude-artifacts", "lovable", "rocket-new", "v0-vercel", "wabi"],
};

/** RFC 4180 CSV: quoted fields may hold commas, `""` and newlines. Throws on an open quote. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (quoted) throw new Error("CSV ends inside a quoted field");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function parseFlag(value: string, column: string, line: number, errors: string[]): boolean | null {
  if (value === "") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  errors.push(`line ${line}: ${column} must be true, false or empty, got ${JSON.stringify(value)}`);
  return null;
}

/** Parses the sheet text. A shape error (header, cell count, kind, flag) lands in `errors`. */
export function parseKindSheet(text: string): { rows: KindSheetRow[]; errors: string[] } {
  const errors: string[] = [];
  const [header, ...body] = parseCsv(text);
  if (!header || header.join(",") !== KIND_SHEET_COLUMNS.join(",")) {
    return { rows: [], errors: [`header must be ${KIND_SHEET_COLUMNS.join(",")}`] };
  }
  const rows: KindSheetRow[] = [];
  body.forEach((cells, index) => {
    const line = index + 2;
    if (cells.length !== KIND_SHEET_COLUMNS.length) {
      errors.push(`line ${line}: ${cells.length} cells, expected ${KIND_SHEET_COLUMNS.length}`);
      return;
    }
    const [slug, kind, subcategory, openWeight, retired, survivor, confidence, note] = cells as string[];
    if (!(TOOL_KINDS as readonly string[]).includes(kind as string)) {
      errors.push(`line ${line}: ${slug}: kind ${JSON.stringify(kind)} is not one of ${TOOL_KINDS.join(", ")}`);
      return;
    }
    rows.push({
      slug: slug as string,
      kind: kind as ToolKind,
      subcategory: subcategory === "" ? null : (subcategory as string),
      openWeight: parseFlag(openWeight as string, "open_weight", line, errors),
      retired: parseFlag(retired as string, "retired", line, errors) === true,
      survivor: survivor === "" ? null : (survivor as string),
      confidence: confidence as string,
      note: note as string,
    });
  });
  return { rows, errors };
}

/** Active tool slugs of the #177 audit CSV (`type = tool`). */
export function auditToolSlugs(auditCsv: string): Set<string> {
  const [header, ...body] = parseCsv(auditCsv);
  const slug = header?.indexOf("slug") ?? -1;
  const type = header?.indexOf("type") ?? -1;
  if (slug < 0 || type < 0) throw new Error("audit CSV has no slug or type column");
  return new Set(body.filter((r) => r[type] === "tool").map((r) => r[slug] as string));
}

/**
 * #183: every rule the sheet must meet before 0017 is built (plan 1.7 criteria 2-5, 1.8).
 * Returns one message per problem; an empty list means the sheet passes.
 */
export function validateKindSheet(
  rows: readonly KindSheetRow[],
  contract: KindSheetContract,
  auditSlugs: ReadonlySet<string>
): string[] {
  const errors: string[] = [];
  const bySlug = new Map<string, KindSheetRow>();
  for (const row of rows) {
    if (bySlug.has(row.slug)) errors.push(`${row.slug}: duplicate slug`);
    bySlug.set(row.slug, row);
  }
  if (rows.length !== contract.rowCount) errors.push(`${rows.length} rows, expected ${contract.rowCount}`);

  const counts: Record<ToolKind, number> = { model: 0, harness: 0, productivity: 0, other: 0 };
  for (const row of rows) counts[row.kind]++;
  for (const kind of TOOL_KINDS) {
    if (counts[kind] !== contract.kindCounts[kind]) {
      errors.push(`kind ${kind}: ${counts[kind]} rows, expected ${contract.kindCounts[kind]}`);
    }
  }

  for (const row of rows) {
    if (!auditSlugs.has(row.slug)) errors.push(`${row.slug}: not an active tool in the audit`);
    if (row.subcategory !== null && !SUBCATEGORY_PATTERN.test(row.subcategory)) {
      errors.push(`${row.slug}: subcategory ${JSON.stringify(row.subcategory)} must match ${SUBCATEGORY_PATTERN}`);
    }
    if (row.openWeight !== null && row.kind !== "model") errors.push(`${row.slug}: open_weight set on a ${row.kind}`);
    if (row.retired) {
      const survivor = row.survivor === null ? undefined : bySlug.get(row.survivor);
      if (!survivor) errors.push(`${row.slug}: retired without a survivor in the sheet`);
      else if (survivor.retired) errors.push(`${row.slug}: survivor ${survivor.slug} is itself retired`);
      else if (survivor.kind !== row.kind) {
        errors.push(`${row.slug}: kind ${row.kind} differs from its survivor ${survivor.slug} (${survivor.kind})`);
      }
    } else if (row.survivor !== null) {
      errors.push(`${row.slug}: survivor set on a row that is not retired`);
    }
  }

  for (const slug of contract.appBuilders) {
    const row = bySlug.get(slug);
    if (!row || row.kind !== "harness" || row.subcategory !== "app_builder") {
      errors.push(`${slug}: app builder must be kind harness with subcategory app_builder`);
    }
  }
  for (const row of rows) {
    if (row.subcategory === "app_builder" && !contract.appBuilders.includes(row.slug)) {
      errors.push(`${row.slug}: app_builder outside the ${contract.appBuilders.length} app builders`);
    }
  }
  return errors;
}

function literal(value: string | boolean | null): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * #183 (Q-A9): renders migration 0017 from a validated sheet. One UPDATE keyed on slug
 * that writes only rows whose values differ, so a re-run changes nothing. A slug with no
 * tools row is skipped, never inserted.
 */
export function buildKindBackfillSql(rows: readonly KindSheetRow[]): string {
  if (rows.length === 0) throw new Error("no sheet rows to backfill");
  const values = [...rows]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((r) => `  (${literal(r.slug)}, ${literal(r.kind)}, ${literal(r.subcategory)}, ${literal(r.openWeight)})`)
    .join(",\n");
  return [
    "-- Migration: Backfill tools.kind, subcategory and open_weight from the reviewed sheet",
    "-- #183 (Q-A9): generated by scripts/build-tool-kind-backfill.ts from",
    "--   docs/refresh/tool-kind-mapping.csv. Do not edit by hand; regenerate from the sheet.",
    "--   Data only. Apply separately from 0016, after the owner acknowledges the sheet.",
    "--   Writes only rows whose values differ, so a re-run is a no-op.",
    "",
    'UPDATE public."tools" AS t',
    // updated_at is left alone: /api/tools/recent-updates sorts on it, and a kind is not
    // a content update. The casts cover a column whose VALUES are all NULL (typed text).
    "SET kind = v.kind, subcategory = v.subcategory::text, open_weight = v.open_weight::boolean",
    "FROM (VALUES",
    values,
    ") AS v(slug, kind, subcategory, open_weight)",
    "WHERE t.slug = v.slug",
    "  AND (t.kind, t.subcategory, t.open_weight) IS DISTINCT FROM (v.kind, v.subcategory::text, v.open_weight::boolean);",
    "--> statement-breakpoint",
    "",
  ].join("\n");
}

/** #183: tools rows by kind; the before/after check around the 0017 apply. */
export const KIND_COUNT_SQL = 'SELECT kind, count(*)::int AS n FROM public."tools" GROUP BY kind ORDER BY kind';
