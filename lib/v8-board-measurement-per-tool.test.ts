import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  activeIdentities,
  FIXTURE_DATE,
  harnessBoard,
  mixedBoard,
  negativeControlWeights,
  publishedFor,
} from "../tests/fixtures/v8-board-185";
import { computeRankings } from "./services/ranking-generation.service";
import { kindRouting, profileRouting } from "./scoring-kind-routing";
import { loadCheckedInScoringProfiles, profileWeights } from "./scoring-profiles";
import {
  formatMeasurementReport,
  measureBoard,
  shiftHistogram,
  shiftStats,
  type MeasuredTool,
} from "./v8-board-measurement";
import {
  formatPerToolTable,
  formatScriptOutput,
  PER_TOOL_COLUMNS,
  PER_TOOL_FLAG,
  PER_TOOL_SECTION_HEADER,
} from "./v8-board-measurement-per-tool";
import { v8TieOrder } from "./v8-tie-order";

/**
 * #185 (ruling D8b) — the private per-tool table, on synthetic boards only.
 *
 * Why: the table is the one output that pairs tool names with ranks and
 *   scores, so it must stay opt-in, leave the default output byte-for-byte
 *   alone, write no file, and agree with the aggregate counts it sits beside.
 * What: freezes the default output against sha256 digests of the base
 *   commit's report on three fixtures, checks the table against the
 *   aggregate histograms, D45 breach count and the D8f candidate board, and
 *   reads the script and module sources for fs writes and the flag.
 * Test: `npx vitest run lib/v8-board-measurement-per-tool.test.ts`
 */

const root = join(__dirname, "..");
const config = loadCheckedInScoringProfiles();
const v710 = profileWeights(config, "v7.10", "all");
const v8 = profileRouting(config, "v8.0");
const profiles = Object.fromEntries(Object.entries(config.profileSets["v8.0"]!.profiles).map(([n, p]) => [n, p.weights]));
const wrong = kindRouting("v8.0-test", { ...profiles, harness: negativeControlWeights(v710) }, "byKind");

function measure(tools: MeasuredTool[], candidate = v8) {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const published = publishedFor(tools, v710);
    const sheet = { slugs: new Set(tools.map((t) => t.slug)), retiredSlugs: new Set<string>() };
    const harnessFloor = tools.filter((t) => t.kind === "harness").length;
    return measureBoard({ tools, published, baseline: v710, candidate, sheet, harnessFloor, toolIdentities: activeIdentities(tools) });
  } finally {
    warn.mockRestore();
  }
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

describe("per-tool table (#185, D8b)", () => {
  // Digests of `${formatMeasurementReport(result)}\n` at base commit 9daf1d27.
  // #185: the mixed-board digest is re-pinned after its `other` tool became a productivity
  // tool (v8.0 has no other profile); the one changed line is the kind count.
  // #185: re-pinned again for the added redirect-count line and the 1c v8 board scope section.
  it.each([
    ["harness board, v8.0", () => measure(harnessBoard()), "55cb1756895a659df73fe2618f8b49ed6e1bf4f5fae8f8253ce99ccbac51057b"],
    ["harness board, negative control", () => measure(harnessBoard(), wrong), "674cd57d89a59f6cb090b2962ed2dc30104554bf069fc8816182d442d59ae569"],
    ["mixed board, v8.0", () => measure(mixedBoard()), "96e821180435668b679c63cc77cc7ba4620320c400f6d4c721f4a895a317cd82"],
  ])("without the flag the output is byte-for-byte the base report (%s)", (_label, run, digest) => {
    const result = run();
    const output = formatScriptOutput(result, { perTool: false });
    expect(output).toBe(`${formatMeasurementReport(result)}\n`);
    expect(sha256(output)).toBe(digest);
  });

  it("with the flag it appends the private table after the unchanged report", () => {
    const result = measure(mixedBoard());
    const plain = formatScriptOutput(result, { perTool: false });
    const output = formatScriptOutput(result, { perTool: true });
    expect(output.startsWith(plain)).toBe(true);
    const lines = output.slice(plain.length).split("\n");
    expect(lines[0]).toBe("");
    expect(lines[1]).toBe(PER_TOOL_SECTION_HEADER);
    expect(lines[4]!.split("|").map((c) => c.trim())).toEqual([...PER_TOOL_COLUMNS]);
    // Header, legend, count line, column header, rule, one line per tool, trailing newline.
    expect(lines).toHaveLength(2 + 4 + mixedBoard().length + 1);
  });

  it.each([
    ["mixed board, v8.0", () => measure(mixedBoard())],
    ["harness board, negative control", () => measure(harnessBoard(), wrong)],
  ])("rows agree with the aggregate histograms and the D45 breach count (%s)", (_label, run) => {
    const c = run().candidate!;
    const rows = c.perTool;
    expect(shiftHistogram(rows.map((r) => r.rankShift))).toEqual(c.globalRankShift);
    expect(shiftStats(rows.map((r) => r.scoreShift))).toEqual(c.scoreShiftAll);
    const onList = rows.filter((r) => r.harnessShift !== null);
    expect(shiftHistogram(onList.map((r) => r.harnessShift!))).toEqual(c.harnessRankShift);
    expect(rows.filter((r) => r.d45Breach).length).toBe(c.d45Breaches);
    expect(rows.map((r) => r.v8Rank)).toEqual(rows.map((_, i) => i + 1));
  });

  it("marks breaches on the negative control, and the table prints the same count", () => {
    const result = measure(harnessBoard(), wrong);
    const breaches = result.candidate!.d45Breaches;
    expect(breaches).toBeGreaterThan(0);
    const table = formatPerToolTable(result);
    expect(table.split("\n").filter((l) => l.endsWith("BREACH"))).toHaveLength(breaches);
    expect(table).toContain(`D45 breaches: ${breaches};`);
  });

  it("v8 ranks are the D8f candidate board the aggregates use", () => {
    const tools = mixedBoard();
    const result = measure(tools);
    const published = publishedFor(tools, v710);
    const v710Ranks = new Map(published.rows.map((r) => [String(r["tool_id"]), Number(r["rank"])]));
    const board = computeRankings(v8TieOrder(tools, v710Ranks), new Map(), FIXTURE_DATE, v8);
    const bySlug = new Map(tools.map((t) => [t.id, t.slug]));
    expect(result.candidate!.perTool.map((r) => r.slug)).toEqual(board.map((e) => bySlug.get(e.tool_id)));
    for (const row of result.candidate!.perTool) expect(row.v710Rank).toBe(v710Ranks.get(tools.find((t) => t.slug === row.slug)!.id));
  });

  it("states that there is no table when no candidate was measured", () => {
    const tools = harnessBoard();
    const result = measureBoard({
      tools,
      published: { ...publishedFor(tools, v710), algorithmVersion: "7.9" },
      baseline: v710,
      candidate: v8,
      sheet: { slugs: new Set(tools.map((t) => t.slug)), retiredSlugs: new Set() },
      harnessFloor: 1,
      toolIdentities: activeIdentities(tools),
    });
    expect(result.candidate).toBeUndefined();
    expect(formatPerToolTable(result)).toBe(`${PER_TOOL_SECTION_HEADER}\nno per-tool table: no candidate measurement`);
  });

  it("the script and the module write no file, and the flag never sets the exit code", () => {
    const script = readFileSync(join(root, "scripts", "measure-v8-board.ts"), "utf8");
    const modules = ["v8-board-measurement-per-tool.ts", "v8-board-measurement.ts"].map((f) =>
      readFileSync(join(__dirname, f), "utf8")
    );
    const fsWrite = /\b(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|writeSync|openSync|mkdirSync|copyFileSync|renameSync|fs\/promises)\b/;
    for (const source of [script, ...modules]) expect(source).not.toMatch(fsWrite);
    for (const source of modules) expect(source).not.toMatch(/from "(node:)?fs"/);
    expect([...script.matchAll(/import \{([^}]*)\} from "node:fs"/g)].map((m) => m[1]!.trim())).toEqual([
      "existsSync, readFileSync",
    ]);
    expect(script).toContain(`${PER_TOOL_FLAG}`);
    expect(script).toContain("process.stdout.write(formatScriptOutput(result, { perTool }))");
    expect(script).toContain("return result.exitCode;");
    expect(script).toContain("// D8b: private per-tool table for Bob's D4d sign-off");
  });
});
