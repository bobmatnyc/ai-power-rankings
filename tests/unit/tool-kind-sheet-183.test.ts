/**
 * #183: the mapping sheet parser and validator refuse every sheet the plan rules out.
 *
 * Why: plan 1.8 — the reviewed sheet (`docs/refresh/tool-kind-mapping.csv`, R-1) is the
 *   only source of the 0017 backfill. The rules run against a small synthetic fixture and
 *   a fixture contract; the committed sheet runs against the real 118-row contract (D91).
 * What: a valid fixture passes; each rule (header, kind set, unique slugs, audit slugs,
 *   counts by kind, retired rows follow their survivor, open_weight only on models,
 *   app_builder only on the listed harnesses, subcategory pattern) has one failing row.
 *   Also: the CSV reader handles quoted commas, the real audit CSV yields 114 tools, the
 *   committed sheet passes the contract (65/19/29/5, six app builders) and a one-row
 *   drift from it is refused.
 * Test: `npx vitest run tests/unit/tool-kind-sheet-183.test.ts`. No database.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditToolSlugs,
  backfillSheetRows,
  buildKindBackfillSql,
  KIND_SHEET_CONTRACT,
  type KindSheetContract,
  parseCsv,
  parseKindSheet,
  validateKindSheet,
} from "../../lib/db/tool-kind-sheet";
import { D91_FAMILY_ROWS, D91_FOLD_PAIRS } from "../../lib/db/model-families";

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
  addedSlugs: [],
  convertedAfter0017: [],
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

  // D91: a row created by a later migration is exempt from the audit check, and only it.
  it("accepts a contract's added slug that is not in the audit", () => {
    const rows = withRow("other-a", "ghost,other,non_ai,,false,,low,");
    expect(problems(rows, { ...FIXTURE_CONTRACT, addedSlugs: ["ghost"] })).toEqual([]);
    expect(problems(rows, { ...FIXTURE_CONTRACT, addedSlugs: ["other-a"] }).join("\n")).toMatch(/ghost: not an active tool/);
  });

  it("refuses a row count off the contract", () => {
    expect(problems(VALID_ROWS, { ...FIXTURE_CONTRACT, rowCount: 7 }).join("\n")).toMatch(/6 rows, expected 7/);
  });
});

const ROOT = path.resolve(__dirname, "../..");
const REAL_SHEET = readFileSync(path.join(ROOT, "docs/refresh/tool-kind-mapping.csv"), "utf8");
const REAL_AUDIT = auditToolSlugs(readFileSync(path.join(ROOT, "docs/refresh/content-ia-audit.csv"), "utf8"));

/** The committed sheet with one line rewritten, checked against the real contract. */
function realSheetProblems(edit: (line: string) => string = (line) => line): string[] {
  const parsed = parseKindSheet(REAL_SHEET.split("\n").map(edit).join("\n"));
  return [...parsed.errors, ...validateKindSheet(parsed.rows, KIND_SHEET_CONTRACT, REAL_AUDIT)];
}

describe("#183 the real contract and audit", () => {
  // D91: 114 audit rows plus the four model family rows of migration 0018.
  // #314: the contract is the state after migration 0028: three rows are productivity.
  it("the 118-row contract adds up and names the six app builders (criterion 2, D2b, D91, #314)", () => {
    const total = Object.values(KIND_SHEET_CONTRACT.kindCounts).reduce((a, b) => a + b, 0);
    expect(total).toBe(KIND_SHEET_CONTRACT.rowCount);
    expect(KIND_SHEET_CONTRACT.kindCounts).toEqual({ harness: 65, model: 19, other: 29, productivity: 5 });
    expect(KIND_SHEET_CONTRACT.addedSlugs).toEqual(["claude-opus", "claude-sonnet", "glm", "kimi"]);
    expect([...KIND_SHEET_CONTRACT.appBuilders].sort()).toEqual([
      "bolt-new",
      "flint",
      "lovable",
      "rocket-new",
      "v0-vercel",
      "wabi",
    ]);
  });

  // #314: claude-artifacts, openclaw and perplexity become productivity; the three Ambiguous
  // harnesses named in the owner ruling stay harness.
  it("holds claude-artifacts, openclaw, perplexity and openclaw's two retired aliases as productivity and keeps three harnesses (#314)", () => {
    const rows = new Map(parseKindSheet(REAL_SHEET).rows.map((r) => [r.slug, r]));
    expect(KIND_SHEET_CONTRACT.convertedAfter0017.map((c) => c.slug).sort()).toEqual([
      "claude-artifacts",
      "clawdbot",
      "moltbot",
      "openclaw",
      "perplexity",
    ]);
    // clawdbot and moltbot are retired aliases of openclaw and follow its kind.
    for (const slug of ["claude-artifacts", "openclaw", "perplexity", "clawdbot", "moltbot"]) {
      expect(rows.get(slug)?.kind, slug).toBe("productivity");
    }
    for (const slug of ["chatgpt-canvas", "claude-desktop-extensions", "cowork"]) {
      expect([slug, rows.get(slug)?.kind]).toEqual([slug, "harness"]);
    }
  });

  // #314: migration 0017 is applied and immutable, so the 0017 view of the sheet puts the
  // three rows back at the kind and subcategory 0017 wrote.
  it("renders the 0017 view of the converted rows at their 0017 values (#314)", () => {
    const rows = new Map(backfillSheetRows(parseKindSheet(REAL_SHEET).rows, KIND_SHEET_CONTRACT).map((r) => [r.slug, r]));
    expect([rows.get("claude-artifacts")?.kind, rows.get("claude-artifacts")?.subcategory]).toEqual(["harness", "app_builder"]);
    expect([rows.get("openclaw")?.kind, rows.get("openclaw")?.subcategory]).toEqual(["harness", "autonomous_agent"]);
    expect([rows.get("perplexity")?.kind, rows.get("perplexity")?.subcategory]).toEqual(["other", "non_ai"]);
    expect([rows.get("moltbot")?.kind, rows.get("clawdbot")?.kind]).toEqual(["harness", "harness"]);
  });

  it("the committed sheet passes the real contract and the owner rulings (D3c, D38, A86)", () => {
    expect(realSheetProblems()).toEqual([]);
    const kinds = new Map(parseKindSheet(REAL_SHEET).rows.map((r) => [r.slug, [r.kind, r.subcategory, r.retired]]));
    for (const slug of ["crossbeam", "infosys-topaz", "nova-act"]) expect(kinds.get(slug)?.[0]).toBe("other");
    expect(kinds.get("flint")).toEqual(["harness", "app_builder", false]);
    // D91: the seven per-version rows are retired into their family rows, which are live.
    const rows = new Map(parseKindSheet(REAL_SHEET).rows.map((r) => [r.slug, r]));
    for (const { oldSlug, newSlug } of D91_FOLD_PAIRS) {
      expect([oldSlug, rows.get(oldSlug)?.kind, rows.get(oldSlug)?.retired, rows.get(oldSlug)?.survivor]).toEqual([oldSlug, "model", true, newSlug]);
    }
    for (const family of D91_FAMILY_ROWS) {
      expect([family.slug, ...kinds.get(family.slug)!, rows.get(family.slug)?.openWeight]).toEqual([family.slug, "model", null, false, family.openWeight]);
    }
    expect(backfillSheetRows(parseKindSheet(REAL_SHEET).rows, KIND_SHEET_CONTRACT)).toHaveLength(114);
  });

  it.each([
    ["a harness moved to other", (l: string) => (l.startsWith("aider,") ? "aider,other,non_ai,,false,,normal," : l), /kind harness: 64 rows, expected 65/],
    ["flint without app_builder", (l: string) => (l.startsWith("flint,") ? "flint,harness,,,false,,normal," : l), /flint: app builder must be/],
    ["an eighth app builder", (l: string) => (l.startsWith("cursor,") ? "cursor,harness,app_builder,,false,,normal," : l), /cursor: app_builder outside the 6/],
    ["a dropped row", (l: string) => (l.startsWith("zed,") ? "" : l), /117 rows, expected 118/],
  ])("refuses the committed sheet with %s", (_name, edit, message) => {
    expect(realSheetProblems(edit).join("\n")).toMatch(message);
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
    writeFileSync(sheetPath, sheet(VALID_ROWS)); // 6 rows, off the 118-row contract
    const root = path.resolve(__dirname, "../..");
    const result = spawnSync(
      path.join(root, "node_modules/.bin/tsx"),
      ["scripts/build-tool-kind-backfill.ts", "--sheet", sheetPath, "--out", outPath],
      { cwd: root, encoding: "utf8" }
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Refusing to build 0017_backfill_tool_kind.sql");
    expect(result.stderr).toContain("6 rows, expected 118"); // D91: the contract is 118 rows
    expect(existsSync(outPath)).toBe(false);
  });
});
