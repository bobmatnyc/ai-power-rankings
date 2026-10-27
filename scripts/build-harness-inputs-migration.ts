#!/usr/bin/env node
/**
 * Builds migration 0024 (harness input corrections) from the reviewed source file (#313, #312).
 *
 * Why: the corrections are reviewed as `docs/refresh/harness-inputs-2026-10.json` and applied by
 *   hand. The SQL is generated so the two cannot drift, and a De4 group can be switched off.
 * What: reads the file and the kind sheet, validates, and writes
 *   `lib/db/migrations/0024_correct_harness_inputs.sql`. Exits 1, writing nothing, on any
 *   validation error. Flags: --inputs, --sheet, --out, --exclude-groups a,b,c,d,sourced
 *   (default: none; the committed file is built with every group). Never connects to a database.
 * Test: `tests/unit/harness-inputs-sheet-313.test.ts`, `tests/unit/harness-inputs-0024-313.test.ts`.
 */

import fs from "fs";
import path from "path";
import { parseKindSheet } from "../lib/db/tool-kind-sheet";
import {
  HARNESS_INPUT_GROUPS,
  type HarnessInputGroup,
  parseHarnessInputs,
  validateHarnessInputs,
} from "../lib/db/harness-inputs";
import { buildHarnessInputsSql } from "../lib/db/harness-inputs-sql";

function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? (process.argv[index + 1] as string) : fallback;
}

const inputsPath = flag("--inputs", "docs/refresh/harness-inputs-2026-10.json");
const sheetPath = flag("--sheet", "docs/refresh/tool-kind-mapping.csv");
const outPath = flag("--out", "lib/db/migrations/0024_correct_harness_inputs.sql");
const excludeGroups = flag("--exclude-groups", "")
  .split(",")
  .filter(Boolean) as HarnessInputGroup[];

const unknown = excludeGroups.filter((g) => !HARNESS_INPUT_GROUPS.includes(g));
if (unknown.length > 0) {
  console.error(`Unknown group(s) in --exclude-groups: ${unknown.join(", ")}. Valid: ${HARNESS_INPUT_GROUPS.join(", ")}`);
  process.exit(1);
}

const { rows, errors: parseErrors } = parseHarnessInputs(fs.readFileSync(inputsPath, "utf8"));
const kindSlugs = new Set(parseKindSheet(fs.readFileSync(sheetPath, "utf8")).rows.map((r) => r.slug));
const errors = [...parseErrors, ...(parseErrors.length ? [] : validateHarnessInputs(rows, kindSlugs))];
if (errors.length > 0) {
  console.error(`Refusing to build ${path.basename(outPath)}: ${errors.length} problem(s) in ${inputsPath}`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

fs.writeFileSync(outPath, buildHarnessInputsSql(rows, { excludeGroups }));
const kept = rows.filter((r) => !excludeGroups.includes(r.group));
console.log(`Wrote ${outPath}: ${kept.length} of ${rows.length} rows over ${new Set(kept.map((r) => r.slug)).size} tools.`);
