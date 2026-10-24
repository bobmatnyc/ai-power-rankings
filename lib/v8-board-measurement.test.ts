import { afterEach, describe, expect, it, vi } from "vitest";

import {
  harnessBoard,
  mixedBoard,
  negativeControlWeights,
  publishedFor,
  SENTINEL,
} from "../tests/fixtures/v8-board-185";
import { loadCheckedInScoringProfiles, profileWeights } from "./scoring-profiles";
import {
  doubledDelta,
  EXIT_CODES,
  formatMeasurementReport,
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

function measure(tools: MeasuredTool[], candidate = v8, published: PublishedSnapshot = quietPublished(tools)) {
  return measureBoard({ tools, published, baseline: v710, candidate });
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

  it("counts tools by kind", () => {
    expect(measure(mixedBoard()).candidate!.kindCounts).toEqual({ harness: 12, model: 16, other: 1 });
  });
});

describe("measureBoard v7.10 reproduction gate (#185)", () => {
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
