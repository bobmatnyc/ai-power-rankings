#!/usr/bin/env node
/**
 * Builds migration 0017 (the tools.kind backfill) from the reviewed mapping sheet.
 *
 * Why: #183 (Q-A9) — the per-slug kinds are a data change, reviewed as a sheet and applied
 *   on their own after 0016. Generating the SQL from the sheet keeps the two in step and
 *   refuses a sheet that breaks the plan's contract before any SQL exists.
 * What: reads `docs/refresh/tool-kind-mapping.csv` and the #177 audit CSV, validates the
 *   sheet against `KIND_SHEET_CONTRACT`, and writes
 *   `lib/db/migrations/0017_backfill_tool_kind.sql`, printing the expected count by kind.
 *   Exits 1, writing nothing, on any validation error. Flags: --sheet, --audit, --out.
 *   It never connects to a database; the apply goes through apply-migration.yml.
 * Test: the parts it calls are covered by `tests/unit/tool-kind-sheet-183.test.ts` and
 *   `tests/unit/tool-kind-links-pglite-183.test.ts`.
 */

import fs from "fs";
import path from "path";
import {
  auditToolSlugs,
  backfillSheetRows,
  buildKindBackfillSql,
  KIND_SHEET_CONTRACT,
  parseKindSheet,
  validateKindSheet,
} from "../lib/db/tool-kind-sheet";

function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? (process.argv[index + 1] as string) : fallback;
}

const sheetPath = flag("--sheet", "docs/refresh/tool-kind-mapping.csv");
const auditPath = flag("--audit", "docs/refresh/content-ia-audit.csv");
const outPath = flag("--out", "lib/db/migrations/0017_backfill_tool_kind.sql");

if (!fs.existsSync(sheetPath)) {
  console.error(`No mapping sheet at ${sheetPath}; it is the reviewed R-1 deliverable.`);
  process.exit(1);
}

const { rows, errors: parseErrors } = parseKindSheet(fs.readFileSync(sheetPath, "utf8"));
const errors = [...parseErrors, ...validateKindSheet(rows, KIND_SHEET_CONTRACT, auditToolSlugs(fs.readFileSync(auditPath, "utf8")))];
if (errors.length > 0) {
  console.error(`Refusing to build ${path.basename(outPath)}: ${errors.length} problem(s) in ${sheetPath}`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

// D91: the family rows 0018 creates are not part of 0017; the file stays as applied.
const backfillRows = backfillSheetRows(rows, KIND_SHEET_CONTRACT);
fs.writeFileSync(outPath, buildKindBackfillSql(backfillRows));
const counts = backfillRows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] ?? 0) + 1 }), {});
console.log(`Wrote ${outPath} from ${backfillRows.length} rows. Expected count by kind after the apply:`);
for (const [kind, n] of Object.entries(counts).sort()) console.log(`  ${kind}: ${n}`);
