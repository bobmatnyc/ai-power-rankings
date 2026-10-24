/**
 * #183: the mapping sheet parser and validator refuse every sheet the plan rules out.
 *
 * Why: plan 1.8 — the reviewed sheet (`docs/refresh/tool-kind-mapping.csv`, R-1) is the
 *   only source of the 0017 backfill. It is not committed yet, so these tests run the
 *   parser and the validator against a small synthetic fixture and a fixture contract;
 *   the real 114-row contract is checked for internal consistency only.
 * What: a valid fixture passes; each rule (header, kind set, unique slugs, audit slugs,
 *   counts by kind, retired rows follow their survivor, open_weight only on models,
 *   app_builder only on the listed harnesses, subcategory pattern) has one failing row.
 *   Also: the CSV reader handles quoted commas, and the real audit CSV yields 114 tools.
 * Test: `npx vitest run tests/unit/tool-kind-sheet-183.test.ts`. No database.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditToolSlugs,
  buildKindBackfillSql,
  KIND_SHEET_CONTRACT,
  type KindSheetContract,
  parseCsv,
  parseKindSheet,
  validateKindSheet,
} from "../../lib/db/tool-kind-sheet";

const HEADER = "slug,kind,subcategory,open_weight,retired,survivor,confidence,note";
// A synthetic sheet: one row per shape the real sheet has. Not real reviewed data.
const VALID_ROWS = [
  "harness-a,harness,ide_assistant,,false,,normal,",
  "builder-a,harness,app_builder,,false,,normal,",
  "model-a,model,,true,false,,normal,",
  "model-a-old,model,,,true,model-a,normal,retired duplicate",
  "other-a,other,non_ai,,false,,low,\"noindex, keep data\"",
  "harness-a-old,harness,,,true,harness-a,normal,",
];
const FIXTURE_CONTRACT: KindSheetContract = {
  rowCount: 6,
  kindCounts: { harness: 3, model: 2, other: 1, productivity: 0 },
  appBuilders: ["builder-a"],
};
const AUDIT = new Set(["harness-a", "builder-a", "model-a", "model-a-old", "other-a", "harness-a-old", "extra"]);

function sheet(rows: string[]): string {
  return [HEADER, ...rows].join("\n") + "\n";
}

function problems(rows: string[], contract = FIXTURE_CONTRACT): string[] {
  const parsed = parseKindSheet(sheet(rows));
  return [...parsed.errors, ...validateKindSheet(parsed.rows, contract, AUDIT)];
}

/** VALID_ROWS with the row for `slug` replaced. */
function withRow(slug: string, row: string): string[] {
  return VALID_ROWS.map((r) => (r.startsWith(`${slug},`) ? row : r));
}

describe("#183 mapping sheet parser", () => {
  it("parses the fixture sheet into typed rows", () => {
    const { rows, errors } = parseKindSheet(sheet(VALID_ROWS));
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(6);
    expect(rows[2]).toEqual({
      slug: "model-a",
      kind: "model",
      subcategory: null,
      openWeight: true,
      retired: false,
      survivor: null,
      confidence: "normal",
      note: "",
    });
    expect(rows[4]?.note).toBe("noindex, keep data");
  });

  it("reads quoted commas, doubled quotes and CRLF", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\nd,e,f\r\n')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["d", "e", "f"],
    ]);
    expect(() => parseCsv('a,"open')).toThrow(/quoted field/);
  });

  it.each([
    ["a wrong header", "slug,kind\nharness-a,harness\n", /header must be/],
    ["a kind outside the four", sheet(withRow("harness-a", "harness-a,banana,,,false,,normal,")), /kind "banana"/],
    ["a bad flag", sheet(withRow("model-a", "model-a,model,,yes,false,,normal,")), /open_weight must be/],
    ["a short row", sheet(withRow("harness-a", "harness-a,harness")), /2 cells, expected 8/],
  ])("refuses %s", (_name, text, message) => {
    expect(parseKindSheet(text).errors.join("\n")).toMatch(message);
  });
});

describe("#183 mapping sheet validator", () => {
  it("passes the fixture sheet", () => {
    expect(problems(VALID_ROWS)).toEqual([]);
  });

  it.each([
    ["a duplicate slug", [...VALID_ROWS.slice(0, 5), VALID_ROWS[0] as string], /harness-a: duplicate slug/],
    ["a slug not in the audit", withRow("other-a", "ghost,other,non_ai,,false,,low,"), /ghost: not an active tool/],
    ["the default kind left on a model (counts by kind)", withRow("model-a-old", "model-a-old,harness,,,true,harness-a,normal,"), /kind harness: 4 rows, expected 3/],
    ["a retired row with the audit kind, not its survivor's", withRow("model-a-old", "model-a-old,harness,,,true,model-a,normal,"), /differs from its survivor model-a/],
    ["a retired row with no survivor", withRow("model-a-old", "model-a-old,model,,,true,,normal,"), /retired without a survivor/],
    ["a survivor on a live row", withRow("harness-a", "harness-a,harness,,,false,builder-a,normal,"), /survivor set on a row that is not retired/],
    ["open_weight on a harness", withRow("harness-a", "harness-a,harness,,false,false,,normal,"), /open_weight set on a harness/],
    ["app_builder outside the list", withRow("harness-a", "harness-a,harness,app_builder,,false,,normal,"), /harness-a: app_builder outside/],
    ["an app builder without app_builder", withRow("builder-a", "builder-a,harness,,,false,,normal,"), /builder-a: app builder must be/],
    ["a hyphenated subcategory", withRow("harness-a", "harness-a,harness,ide-assistant,,false,,normal,"), /must match/],
  ])("refuses %s", (_name, rows, message) => {
    expect(problems(rows as string[]).join("\n")).toMatch(message);
  });

  it("refuses a row count off the contract", () => {
    expect(problems(VALID_ROWS, { ...FIXTURE_CONTRACT, rowCount: 7 }).join("\n")).toMatch(/6 rows, expected 7/);
  });
});

describe("#183 the real contract and audit", () => {
  it("the 114-row contract adds up and names the six app builders (criterion 2, D2b)", () => {
    const total = Object.values(KIND_SHEET_CONTRACT.kindCounts).reduce((a, b) => a + b, 0);
    expect(total).toBe(KIND_SHEET_CONTRACT.rowCount);
    expect(KIND_SHEET_CONTRACT.kindCounts).toEqual({ harness: 75, model: 15, other: 24, productivity: 0 });
    expect(KIND_SHEET_CONTRACT.appBuilders).toHaveLength(6);
  });

  it("the #177 audit CSV lists 114 active tools, including every app builder", () => {
    const audit = readFileSync(path.resolve(__dirname, "../../docs/refresh/content-ia-audit.csv"), "utf8");
    const slugs = auditToolSlugs(audit);
    expect(slugs.size).toBe(114);
    expect(KIND_SHEET_CONTRACT.appBuilders.filter((s) => !slugs.has(s))).toEqual([]);
  });
});

// #183 (critic): each refusal arm of validateKindSheet, with its exact message.
describe("#183 mapping sheet validator messages", () => {
  it.each([
    [
      "a retired row whose kind differs from its survivor's",
      withRow("harness-a-old", "harness-a-old,model,,,true,harness-a,normal,"),
      "harness-a-old: kind model differs from its survivor harness-a (harness)",
    ],
    [
      "app_builder on a slug outside the list",
      withRow("harness-a", "harness-a,harness,app_builder,,false,,normal,"),
      "harness-a: app_builder outside the 1 app builders",
    ],
    [
      "a listed app builder missing from the sheet",
      VALID_ROWS.filter((r) => !r.startsWith("builder-a,")),
      "builder-a: app builder must be kind harness with subcategory app_builder",
    ],
    ["open_weight on a non-model", withRow("other-a", "other-a,other,non_ai,true,false,,low,"), "other-a: open_weight set on a other"],
    ["a duplicate slug", [...VALID_ROWS, VALID_ROWS[0] as string], "harness-a: duplicate slug"],
    ["a slug not in the audit", withRow("other-a", "ghost,other,non_ai,,false,,low,"), "ghost: not an active tool in the audit"],
  ])("refuses %s", (_name, rows, message) => {
    const parsed = parseKindSheet(sheet(rows as string[]));
    expect(parsed.errors).toEqual([]);
    expect(validateKindSheet(parsed.rows, FIXTURE_CONTRACT, AUDIT)).toContain(message);
  });
});

describe("#183 the 0017 builder", () => {
  it("renders one DO block whose guards raise on a missing slug and on a count mismatch", () => {
    const sql = buildKindBackfillSql(parseKindSheet(sheet(VALID_ROWS)).rows);
    const statements = sql.split("--> statement-breakpoint").filter((c) => c.trim() !== "");
    expect(statements).toHaveLength(1);
    expect(sql).toContain("DO $k183b$");
    expect(sql).toContain("RAISE EXCEPTION '#183 0017: sheet slugs missing from tools: %', missing;");
    expect(sql).toContain("RAISE EXCEPTION '#183 0017: counts by kind differ from the sheet: %', mismatched;");
    expect(sql).toContain("(VALUES ('harness', 3), ('model', 2), ('other', 1)) AS e(kind, n)");
    // The missing-slug guard runs before the UPDATE.
    expect(sql.indexOf("sheet slugs missing")).toBeLessThan(sql.indexOf('UPDATE public."tools"'));
  });

  it("the script exits 1 on an invalid sheet and writes no 0017", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kind-sheet-183-"));
    const sheetPath = path.join(dir, "sheet.csv");
    const outPath = path.join(dir, "0017_backfill_tool_kind.sql");
    writeFileSync(sheetPath, sheet(VALID_ROWS)); // 6 rows, off the 114-row contract
    const root = path.resolve(__dirname, "../..");
    const result = spawnSync(
      path.join(root, "node_modules/.bin/tsx"),
      ["scripts/build-tool-kind-backfill.ts", "--sheet", sheetPath, "--out", outPath],
      { cwd: root, encoding: "utf8" }
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Refusing to build 0017_backfill_tool_kind.sql");
    expect(result.stderr).toContain("6 rows, expected 114");
    expect(existsSync(outPath)).toBe(false);
  });
});
