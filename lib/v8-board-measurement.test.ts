import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseKindSheet } from "./db/tool-kind-sheet";

import {
  harnessBoard,
  mixedBoard,
  negativeControlWeights,
  publishedFor,
  SENTINEL,
  tiedHarnessBoard,
} from "../tests/fixtures/v8-board-185";
import { loadCheckedInScoringProfiles, profileWeights } from "./scoring-profiles";
import {
  doubledDelta,
  EXIT_CODES,
  formatMeasurementReport,
  HARNESS_FLOOR,
  measureBoard,
  type MeasuredTool,
  type MeasurementResult,
  type PublishedSnapshot,
} from "./v8-board-measurement";

/**
 * #185 — the v8 board measurement, on synthetic boards only.
 *
 * Why: the production run is the D45 proof, so its gates must be shown to
 *   fail: a reproduction mismatch must stop it, the D45 gate must rank within
 *   the harness list, it must score the weights it is handed, and its output
 *   must name no tool (D19).
 * What: runs `measureBoard()` on the fixtures in `tests/fixtures/v8-board-185.ts`
 *   with the checked-in v7.10 and v8.0 profiles and with the plan's
 *   negative-control weights (technical .12, adoption .24).
 * Test: `npx vitest run lib/v8-board-measurement.test.ts`
 */

const config = loadCheckedInScoringProfiles();
const v710 = profileWeights(config, "v7.10", "all");
const v8 = profileWeights(config, "v8.0", "harness");
const wrong = negativeControlWeights(v710);

/** The fixtures are smaller than the production floor (HARNESS_FLOOR, 66), so the floor is set to their harness count. */
const fixtureFloor = (tools: MeasuredTool[]) => tools.filter((t) => t.kind === "harness").length;

function measure(tools: MeasuredTool[], candidate = v8, published: PublishedSnapshot = quietPublished(tools)) {
  return measureBoard({ tools, published, baseline: v710, candidate, harnessFloor: fixtureFloor(tools) });
}

/** The same run at the production floor. */
function measureAtDefaultFloor(tools: MeasuredTool[]) {
  return measureBoard({ tools, published: quietPublished(tools), baseline: v710, candidate: v8 });
}

/** Every string a report must not contain: names, slugs, ids and per-tool scores. */
function forbidden(tools: MeasuredTool[], published: PublishedSnapshot): string[] {
  const scores = published.rows.map((row) => Number(row["score"]).toFixed(3));
  return [SENTINEL, SENTINEL.toLowerCase(), ...tools.flatMap((t) => [t.name, t.slug, t.id]), ...scores];
}

function expectNoToolData(result: MeasurementResult, tools: MeasuredTool[], published: PublishedSnapshot) {
  const report = formatMeasurementReport(result);
  for (const needle of forbidden(tools, published)) expect(report).not.toContain(needle);
}

afterEach(() => vi.restoreAllMocks());

/** The fixture snapshot, built with the engine's own warnings muted (they are not under test here). */
function quietPublished(tools: MeasuredTool[]): PublishedSnapshot {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return publishedFor(tools, v710);
  } finally {
    warn.mockRestore();
  }
}

describe("measureBoard D45 gate (#185)", () => {
  it("passes D44 on the dense harness board with no harness move above 2", () => {
    const result = measure(harnessBoard());
    expect(result.reproduced).toBe(true);
    expect(result.candidate!.d45Breaches).toBe(0);
    expect(result.candidate!.harnessRankShift.max).toBeLessThanOrEqual(2);
    expect(result.exitCode).toBe(EXIT_CODES.ok);
  });

  it("negative control: technical .12 / adoption .24 must breach D45 on the same board", () => {
    // If this stops breaching, the fixture is too weak to test D45 at all.
    const result = measure(harnessBoard(), wrong);
    expect(result.candidate!.d45Breaches).toBeGreaterThan(0);
    expect(result.candidate!.harnessRankShift.max).toBeGreaterThan(2);
    expect(result.exitCode).toBe(EXIT_CODES.d45Breach);
  });

  it("ranks harness tools within the harness list; a global move alone is information", () => {
    const result = measure(mixedBoard(), wrong);
    // The fixture works only if harness tools move more than 2 places globally.
    expect(result.candidate!.harnessGlobalRankShift.max).toBeGreaterThan(2);
    expect(result.candidate!.harnessRankShift.max).toBe(0);
    expect(result.candidate!.d45Breaches).toBe(0);
    expect(result.exitCode).toBe(EXIT_CODES.ok);
  });

  it("scores the candidate weights it is handed, not a fixed table", () => {
    const same = measure(harnessBoard(), v710);
    expect(same.candidate!.scoreShiftAll.max).toBe(0);
    expect(same.candidate!.harnessRankShift.moved0).toBe(same.candidate!.harnessRankShift.n);
    const d44 = measure(harnessBoard(), v8);
    expect(d44.candidate!.scoreShiftAll.max).toBeGreaterThan(0);
    expect(d44.candidate!.scoreShiftAll.max).toBeLessThan(measure(harnessBoard(), wrong).candidate!.scoreShiftAll.max);
  });

  it("baselines on the published order inside a harness tie: reversing it flips D45 to a breach", () => {
    const tools = tiedHarnessBoard();
    const asPublished = quietPublished(tools);
    const pass = measure(tools, v8, asPublished);
    expect(pass.exitCode).toBe(EXIT_CODES.ok);
    expect(pass.candidate!.harnessToolsInTies).toBeGreaterThanOrEqual(4);

    // Reverse the published ranks of the four tied tools; scores are unchanged.
    const tied = asPublished.rows.filter((r) => /-id-t-[a-d]$/.test(String(r["tool_id"])));
    expect(tied).toHaveLength(4);
    const ranks = tied.map((r) => r["rank"]).reverse();
    const reversed = {
      ...asPublished,
      rows: asPublished.rows.map((r) => {
        const i = tied.indexOf(r);
        return i >= 0 ? { ...r, rank: ranks[i] } : r;
      }),
    };
    const flipped = measure(tools, v8, reversed);
    expect(flipped.reproduced).toBe(true);
    expect(flipped.reproduction.ordinalDiffsInsideTies).toBe(4);
    expect(flipped.candidate!.harnessRankShift.max).toBe(3);
    expect(flipped.exitCode).toBe(EXIT_CODES.d45Breach);
  });

  it("ranks candidate ties by tool_id, not by the order the rows were read", () => {
    const tools = tiedHarnessBoard();
    const published = quietPublished(tools);
    const shuffled = [...tools].reverse();
    expect(measure(shuffled, v8, published).candidate).toEqual(measure(tools, v8, published).candidate);
  });

  it("counts tools by kind", () => {
    expect(measure(mixedBoard()).candidate!.kindCounts).toEqual({ harness: 12, model: 16, other: 1 });
  });
});

describe("measureBoard harness list check (#185)", () => {
  const notHarness = (tools: MeasuredTool[]) => tools.map((t) => (t.kind === "harness" ? { ...t, kind: "model" } : t));

  it.each<[string, () => MeasuredTool[], (r: MeasurementResult) => void]>([
    ["no harness tools", () => notHarness(mixedBoard()), (r) => expect(r.harness!.harnessTools).toBe(0)],
    ["fewer harness tools than the floor of 66", () => harnessBoard(), (r) => expect(r.harness!.harnessTools).toBe(24)],
    ["one harness tool below the floor (65)", () => harnessBoard(65), (r) => expect(r.harness!.harnessTools).toBe(65)],
    [
      "an unmigrated kind column (null)",
      () => harnessBoard(80).map((t, i) => (i === 0 ? { ...t, kind: String(null) } : t)),
      (r) => expect(r.harness!.unknownKinds).toBe(1),
    ],
    [
      "every tool harness (the 0016 default, 0017 not applied)",
      () => harnessBoard(80).map((t) => ({ ...t, kind: "harness" })),
      (r) => expect(r.harness!.allHarness).toBe(true),
    ],
  ])("does not exit 0 or print PASS with %s", (_label, board, detail) => {
    const result = measureAtDefaultFloor(board());
    expect(result.reproduced).toBe(true);
    expect(result.harness!.ok).toBe(false);
    detail(result);
    expect(result.candidate).toBeUndefined();
    expect(result.exitCode).toBe(EXIT_CODES.harnessCheck);
    expect(formatMeasurementReport(result)).toMatch(/^Result: FAIL \(harness list check\)/);
  });

  it("HARNESS_FLOOR is the sheet's harness rows minus its retired harness rows (69 - 3 = 66)", () => {
    const sheet = readFileSync(join(__dirname, "..", "docs", "refresh", "tool-kind-mapping.csv"), "utf8");
    const { rows, errors } = parseKindSheet(sheet);
    expect(errors).toEqual([]);
    const harness = rows.filter((r) => r.kind === "harness");
    const retired = harness.filter((r) => r.retired);
    expect(HARNESS_FLOOR).toBe(harness.length - retired.length);
  });

  it("passes the check at the floor of 66 harness tools with other kinds present", () => {
    const result = measureAtDefaultFloor(harnessBoard(66));
    expect(result.harness).toMatchObject({ harnessTools: 66, floor: 66, ok: true });
    expect(result.exitCode).toBe(EXIT_CODES.ok);
  });
});

describe("measureBoard v7.10 reproduction gate (#185)", () => {
  it("refuses a duplicated published row, which an id-keyed diff would hide", () => {
    const tools = harnessBoard();
    const published = quietPublished(tools);
    const withDuplicate = { ...published, rows: [...published.rows, { ...published.rows[3]! }] };
    const result = measure(tools, v8, withDuplicate);
    expect(result.reproduction.duplicatePublishedIds).toBe(1);
    expect(result.reproduction.publishedRows).toBe(result.reproduction.toolsScored + 1);
    expect(result.exitCode).toBe(EXIT_CODES.notReproduced);
  });

  it("refuses published rows that share a rank across different scores", () => {
    const tools = harnessBoard();
    const published = quietPublished(tools);
    const rows = published.rows.map((r, i) => (i === 1 ? { ...r, rank: published.rows[0]!["rank"] } : r));
    const result = measure(tools, v8, { ...published, rows });
    expect(result.reproduction.duplicatePublishedRanksOutsideTies).toBe(2);
    expect(result.exitCode).toBe(EXIT_CODES.notReproduced);
  });

  it("accepts a shared rank inside a block of equal scores", () => {
    const tools = tiedHarnessBoard();
    const published = quietPublished(tools);
    const tied = published.rows.filter((r) => /-id-t-[a-d]$/.test(String(r["tool_id"])));
    const first = tied[0]!["rank"];
    const rows = published.rows.map((r) => (tied.includes(r) ? { ...r, rank: first } : r));
    const result = measure(tools, v8, { ...published, rows });
    expect(result.reproduction.duplicatePublishedRanksOutsideTies).toBe(0);
    expect(result.reproduced).toBe(true);
  });

  it("exits non-zero with no candidate numbers when one published score differs", () => {
    const tools = harnessBoard();
    const published = quietPublished(tools);
    published.rows[5] = { ...published.rows[5], score: Number(published.rows[5]!["score"]) + 0.01 };
    const result = measure(tools, v8, published);
    expect(result.reproduced).toBe(false);
    expect(result.reproduction.scoreOverTolerance).toBe(1);
    expect(result.candidate).toBeUndefined();
    expect(result.exitCode).toBe(EXIT_CODES.notReproduced);
    const report = formatMeasurementReport(result);
    expect(report).toMatch(/^Result: FAIL \(v7\.10 not reproduced\)/);
    expect(report).not.toContain("D45 breaches");
  });

  it("recomputes with the baseline weights it is given (a v8 baseline cannot reproduce v7.10)", () => {
    const tools = harnessBoard();
    const result = measureBoard({ tools, published: publishedFor(tools, v710), baseline: v8, candidate: v8 });
    expect(result.reproduced).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.notReproduced);
  });

  it.each([
    ["a snapshot from another version", (p: PublishedSnapshot) => ({ ...p, algorithmVersion: "7.9" })],
    ["a tool missing from the snapshot", (p: PublishedSnapshot) => ({ ...p, rows: p.rows.slice(1) })],
    [
      "a published rank outside its score block",
      (p: PublishedSnapshot) => ({ ...p, rows: p.rows.map((r, i) => (i === 0 ? { ...r, rank: 10 } : r)) }),
    ],
  ])("refuses %s", (_label, tamper) => {
    const tools = harnessBoard();
    const result = measure(tools, v8, tamper(publishedFor(tools, v710)));
    expect(result.exitCode).toBe(EXIT_CODES.notReproduced);
    expect(result.candidate).toBeUndefined();
  });

  it("refuses an empty board", () => {
    const result = measure([], v8, { algorithmVersion: "7.10", publishedAt: new Date(), rows: [] });
    expect(result.exitCode).toBe(EXIT_CODES.notReproduced);
  });

  it("accepts a published rank swapped inside an equal-score block and counts it", () => {
    const tools = harnessBoard();
    const published = quietPublished(tools);
    const scores = published.rows.map((r) => r["score"]);
    const i = scores.findIndex((s, k) => k > 0 && s === scores[k - 1]) - 1;
    expect(i).toBeGreaterThanOrEqual(0); // the fixture has one tied pair
    const [a, b] = [published.rows[i]!, published.rows[i + 1]!];
    published.rows[i] = { ...a, rank: b["rank"] };
    published.rows[i + 1] = { ...b, rank: a["rank"] };
    const result = measure(tools, v8, published);
    expect(result.reproduced).toBe(true);
    expect(result.reproduction.ordinalDiffsInsideTies).toBe(2);
  });

  it("logs each tie swap anonymously by block, size and positions, and still passes", () => {
    const tools = tiedHarnessBoard();
    const published = quietPublished(tools);
    const tied = published.rows.filter((r) => /-id-t-[a-d]$/.test(String(r["tool_id"])));
    // Swap the first and last published positions of the four-tool tie.
    const [first, last] = [tied[0]!, tied[3]!];
    const rows = published.rows.map((r) =>
      r === first ? { ...r, rank: last["rank"] } : r === last ? { ...r, rank: first["rank"] } : r
    );
    const result = measure(tools, v8, { ...published, rows });
    expect(result.reproduced).toBe(true);
    expect(result.reproduction.tieSwaps).toEqual([
      { block: 1, blockSize: 4, publishedPosition: 1, recomputedPosition: 4 },
      { block: 1, blockSize: 4, publishedPosition: 4, recomputedPosition: 1 },
    ]);
    const report = formatMeasurementReport(result);
    expect(report).toContain("  tie swap: block 1 (size 4), published position 1, recomputed position 4");
    expect(report).toContain("  tie swap: block 1 (size 4), published position 4, recomputed position 1");
    expectNoToolData(result, tools, { ...published, rows });
  });
});

describe("measurement output is aggregates only (D19, #185)", () => {
  it.each([
    ["D44 on the harness board", harnessBoard, v8],
    ["negative control on the harness board", harnessBoard, wrong],
    ["negative control on the mixed board", mixedBoard, wrong],
  ] as const)("report for %s names no tool and prints no per-tool score", (_label, board, candidate) => {
    const tools = board();
    const published = quietPublished(tools);
    expectNoToolData(measure(tools, candidate, published), tools, published);
  });

  it("a failed reproduction report names no tool either", () => {
    const tools = mixedBoard();
    const published = { ...quietPublished(tools), algorithmVersion: "7.9" };
    expectNoToolData(measure(tools, v8, published), tools, published);
  });

  it("swallows the engine's warnings, which name tools, and only counts them", () => {
    const tools = mixedBoard();
    const published = quietPublished(tools);
    const warn = vi.spyOn(console, "warn");
    const log = vi.spyOn(console, "log");
    const result = measure(tools, v8, published);
    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(result.engineLogLinesSuppressed).toBeGreaterThan(0);
    // The console is restored afterwards.
    console.warn("after");
    expect(warn).toHaveBeenCalledWith("after");
  });
});

describe("doubledDelta stress weights (#185)", () => {
  it("doubles the D44 delta and renormalises to 1", () => {
    const stress = doubledDelta(v710, v8);
    expect(stress.technicalPerformance).toBeCloseTo(0.16 / 0.98, 12);
    expect(stress.innovation).toBeCloseTo(0.1 / 0.98, 12);
    expect(Object.values(stress).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
});
