/**
 * #313, #312: the harness input source file, its validator and the generated migration 0024.
 *
 * Why: the De4 corrections are 61 reviewed data changes. The file must hold every one with a
 *   source, touch only input fields on tools in the kind sheet, and the committed SQL must be
 *   exactly what the generator renders, with every group on. A group can be left out at
 *   generation time and that removes exactly its rows.
 * What: parses the committed file, checks counts per group and op, the validator's refusals
 *   (one case each), the generator output against the committed file, and the toggles.
 * Test: `npx vitest run tests/unit/harness-inputs-sheet-313.test.ts`. No server, no network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  countByGroup,
  HARNESS_INPUT_GROUPS,
  type HarnessInputGroup,
  type HarnessInputRow,
  PARENT_LEVEL_TOOLS,
  parseHarnessInputs,
  validateHarnessInputs,
} from "../../lib/db/harness-inputs";
import { buildHarnessInputsSql, HARNESS_INPUTS_MIGRATION } from "../../lib/db/harness-inputs-sql";
import { parseKindSheet } from "../../lib/db/tool-kind-sheet";

const ROOT = path.resolve(__dirname, "../..");
const TEXT = readFileSync(path.join(ROOT, "docs/refresh/harness-inputs-2026-10.json"), "utf8");
const FILE = parseHarnessInputs(TEXT);
const KIND_SLUGS = new Set(parseKindSheet(readFileSync(path.join(ROOT, "docs/refresh/tool-kind-mapping.csv"), "utf8")).rows.map((r) => r.slug));
const COMMITTED = readFileSync(path.join(ROOT, "lib/db/migrations", HARNESS_INPUTS_MIGRATION), "utf8");

const row = (id: number): HarnessInputRow => structuredClone(FILE.rows.find((r) => r.id === id) as HarnessInputRow);
const problems = (r: HarnessInputRow) => validateHarnessInputs([r], KIND_SLUGS).join("\n");

describe("#313 the source file", () => {
  it("parses, validates and holds the De4 counts", () => {
    expect(FILE.errors).toEqual([]);
    expect(validateHarnessInputs(FILE.rows, KIND_SLUGS)).toEqual([]);
    expect(FILE.rows).toHaveLength(100);
    expect(new Set(FILE.rows.map((r) => r.slug)).size).toBe(66);
    expect(countByGroup(FILE.rows)).toEqual({ sourced: 13, a: 1, b: 0, c: 66, d: 20 });
    const ops = FILE.rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.op]: (acc[r.op] ?? 0) + 1 }), {});
    expect(ops).toEqual({ set: 75, replace: 1, delete: 24 });
  });

  it("rows 4, 19 and 20 carry the package or extension identity they assume", () => {
    expect(FILE.rows.filter((r) => r.identity).map((r) => [r.id, r.identity])).toEqual([
      [4, { path: ["metrics", "vscode", "extension_id"], value: "anthropic.claude-code" }],
      [19, { path: ["metrics", "npm", "package_name"], value: "@github/copilot" }],
      [20, { path: ["metrics", "vscode", "extension_id"], value: "GitHub.copilot" }],
    ]);
  });

  it("(c) has one row per active harness tool of the production snapshot, each expecting no count but the eight stored ones", () => {
    const c = FILE.rows.filter((r) => r.group === "c");
    expect(c).toHaveLength(66);
    expect(c.filter((r) => r.expected_old_absent).length).toBe(58);
    expect(c.filter((r) => r.path[0] === "info").map((r) => r.slug).sort()).toEqual(["aider", "claude-code", "cursor", "gemini-code-assist", "github-copilot", "kiro", "tabnine", "windsurf"]);
  });

  it("(d) names exactly the seven parent-level tools and leaves the three borderline ones their figures", () => {
    const d = FILE.rows.filter((r) => r.group === "d");
    expect([...new Set(d.map((r) => r.slug))].sort()).toEqual([...PARENT_LEVEL_TOOLS].sort());
    for (const kept of ["replit-agent", "devin", "sourcegraph-cody"]) {
      expect(FILE.rows.filter((r) => r.slug === kept && r.op === "delete")).toEqual([]);
    }
  });

  it("(b) writes no Cursor npm and shows no per-tool score or rank", () => {
    expect(FILE.rows.filter((r) => r.slug === "cursor" && r.field === "npm")).toEqual([]);
    expect(TEXT).not.toMatch(/\b(scores?|ranks?|ranked|ranking|weights?)\b/i);
  });
});

describe("#313 the validator refuses", () => {
  it.each<[string, number, (r: HarnessInputRow) => void, RegExp]>([
    ["a write with no source", 1, (r) => delete r.source_url, /source_url/],
    ["a write with no as_of", 1, (r) => delete r.as_of, /as_of/],
    ["a delete with no reason", 7, (r) => delete r.reason, /reason/],
    ["a slug missing from the kind sheet", 1, (r) => (r.slug = "no-such-tool"), /kind sheet/],
    ["a path to the company name", 1, (r) => ((r.path = ["info", "company"]), (r.field = "company")), /not an input field|metrics/],
    ["a path to a weight", 1, (r) => ((r.path = ["weights", "traction"]), (r.field = "traction")), /metrics/],
    ["a row with no expected-old guard", 1, (r) => delete r.expected_old_absent, /expected_old/],
    ["an unknown key such as a score", 1, (r) => ((r as unknown as Record<string, unknown>)["score"] = 80), /unknown key/],
    ["a Cursor npm row (b)", 13, (r) => ((r.path = ["metrics", "npm"]), (r.field = "npm")), /@cursor\/sdk/],
    ["an identity outside the row's own field", 4, (r) => (r.identity = { path: ["metrics", "npm", "package_name"], value: "x" }), /identity must be/],
    ["an identity with an empty value", 4, (r) => (r.identity = { path: ["metrics", "vscode", "extension_id"], value: "" }), /identity must be/],
    ["a group d row on a tool outside the seven", 7, (r) => (r.slug = "devin"), /seven parent-level/],
  ])("%s", (_name, id, mutate, expected) => {
    const r = row(id);
    mutate(r);
    expect(problems(r)).toMatch(expected);
  });
});

describe("#313 the generated migration", () => {
  it("is the generator's output with every group on, one DO block", () => {
    expect(COMMITTED).toBe(buildHarnessInputsSql(FILE.rows));
    expect(COMMITTED.match(/^DO \$k313\$$/gm)).toHaveLength(1);
    expect(COMMITTED).toContain("SET LOCAL lock_timeout = '5s';");
    expect(COMMITTED).toContain("FOR UPDATE;");
    expect(COMMITTED).toContain("lib/news-tool-resolver.ts:248");
    // Each resolver line the header cites holds the symbol it names.
    const resolver = readFileSync(path.join(ROOT, "lib/news-tool-resolver.ts"), "utf8").split("\n");
    const cites = [...COMMITTED.matchAll(/lib\/news-tool-resolver\.ts:([\d,]+)\s+(\w+)/g)];
    expect(cites.map((m) => m[2])).toEqual(["buildToolCatalogue", "FORMER_NAMES", "articleToolTags", "primaryArticleTool"]);
    for (const [, lines, symbol] of cites) {
      for (const line of lines!.split(",")) expect([line, resolver[Number(line) - 1]]).toEqual([line, expect.stringContaining(symbol!)]);
    }
    expect(COMMITTED).not.toMatch(/company_name|weights|info', 'company/);
  });

  it.each(HARNESS_INPUT_GROUPS.filter((g) => g !== "b"))("leaving out group %s removes exactly its rows", (group: HarnessInputGroup) => {
    const tuples = (sql: string) => [...sql.matchAll(/^ {4}\((\d+), '(\w+)', /gm)].map((m) => [Number(m[1]), m[2]] as const);
    const full = tuples(COMMITTED);
    const without = tuples(buildHarnessInputsSql(FILE.rows, { excludeGroups: [group] }));
    expect(full).toHaveLength(100);
    expect(without.map(([id]) => id)).toEqual(full.filter(([, g]) => g !== group).map(([id]) => id));
    expect(without.some(([, g]) => g === group)).toBe(false);
    expect(buildHarnessInputsSql(FILE.rows, { excludeGroups: ["c"] })).not.toContain("t313_term");
  });

  it("leaving out an empty group (b) changes only the header", () => {
    const sql = buildHarnessInputsSql(FILE.rows, { excludeGroups: ["b"] });
    expect(sql.replace(/ \(left out: b\)/, "")).toBe(COMMITTED);
  });
});
