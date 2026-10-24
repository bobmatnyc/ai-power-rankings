import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIXTURE_DATE, mixedBoard } from "../tests/fixtures/v8-board-185";
import { TOOL_KINDS } from "./db/schema";
import { ALGORITHM_V76_WEIGHTS, type RankingWeightsV76 } from "./ranking-algorithm-v76";
import { kindRouting, LEGACY_PROFILE, profileRouting } from "./scoring-kind-routing";
import {
  FACTOR_KEYS,
  loadCheckedInScoringProfiles,
  parseScoringProfiles,
  ScoringProfileError,
} from "./scoring-profiles";
import { calculateTier, computeRankings } from "./services/ranking-generation.service";

/**
 * #185 PR-2 — kind routing and the staged v8.0 model profile.
 *
 * Why: v8 scores each tool with the profile for its `tools.kind`. A wrong
 *   table gives a plausible score, so each test here targets one wrong
 *   implementation: harness weights for every tool, a model on harness
 *   weights, an unknown kind falling back, the legacy set routed per kind, a
 *   model table that does not sum to 1.00, and open-weight carrying weight.
 * What: checks the checked-in v8.0 profiles, `kindRouting()` /
 *   `profileRouting()`, and `computeRankings()` handed a routing, on the
 *   synthetic `mixedBoard()` (harness, model and other tools; no real data).
 * Test: `npx vitest run lib/scoring-kind-routing.test.ts`
 */

const config = loadCheckedInScoringProfiles();
const v8 = config.profileSets["v8.0"]!;

/** D44: technical and adoption 0.18 -> 0.17, the rest as v7.10. */
const D44_HARNESS: RankingWeightsV76 = {
  ...ALGORITHM_V76_WEIGHTS,
  technicalPerformance: 0.17,
  developerAdoption: 0.17,
};

/** D4b (provisional until D4d). Innovation, sentiment and resilience as v7.10. */
const D4B_MODEL: RankingWeightsV76 = {
  agenticCapability: 0.18,
  innovation: 0.1,
  technicalPerformance: 0.22,
  developerAdoption: 0.1,
  marketTraction: 0.1,
  businessSentiment: 0.12,
  developmentVelocity: 0.1,
  platformResilience: 0.08,
};

const basisPoints = (w: RankingWeightsV76) => Object.values(w).reduce((sum, x) => sum + Math.round(x * 10_000), 0);

/** The checked-in config as plain JSON, for one-change copies. */
function configJson(): Record<string, any> {
  return JSON.parse(JSON.stringify(config));
}

beforeEach(() => {
  // The fixture's `other` tool makes the engine warn with its id (#241); not under test here.
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("v8.0 model profile, D4b (#185)", () => {
  it("is exactly the D4b table, sums to 1.00 and is marked provisional pending D4d", () => {
    const model = v8.profiles["model"]!;
    expect(model.weights).toEqual(D4B_MODEL);
    expect(basisPoints(model.weights)).toBe(10_000);
    expect(model.declaredTotal).toBe(1);
    expect(model.provisional).toMatch(/D4d/);
    // The three factors D4b leaves alone keep their v7.10 values.
    for (const key of ["innovation", "businessSentiment", "platformResilience"] as const) {
      expect(model.weights[key]).toBe(ALGORITHM_V76_WEIGHTS[key]);
    }
  });

  it("gives open-weight status no weight: the model table has the eight engine factors only (D2f)", () => {
    expect(Object.keys(v8.profiles["model"]!.weights)).toEqual([...FACTOR_KEYS]);
    const raw = configJson()["profileSets"]["v8.0"]["profiles"]["model"]["weights"];
    expect(Object.keys(raw).filter((k) => /open/i.test(k))).toEqual([]);

    const weighted = configJson();
    const weights = weighted["profileSets"]["v8.0"]["profiles"]["model"]["weights"];
    weights["openWeight"] = 0.02;
    weights["developerAdoption"] = 0.08;
    expect(() => parseScoringProfiles(weighted)).toThrow(/unknown factor\(s\): openWeight/);
  });

  it.each([
    ["sums to 1.01", 0.11],
    ["sums to 0.99", 0.09],
  ])("the loader refuses a model table that %s", (_label, adoption) => {
    const broken = configJson();
    broken["profileSets"]["v8.0"]["profiles"]["model"]["weights"]["developerAdoption"] = adoption;
    expect(() => parseScoringProfiles(broken)).toThrow(ScoringProfileError);
  });

  it("the loader refuses an empty provisional marker", () => {
    const broken = configJson();
    broken["profileSets"]["v8.0"]["profiles"]["model"]["provisional"] = " ";
    expect(() => parseScoringProfiles(broken)).toThrow(/provisional must be a non-empty string/);
  });

  it("keeps the harness profile at D44, and gives productivity and other the D44 weights, marked provisional", () => {
    expect(v8.profiles["harness"]!.weights).toEqual(D44_HARNESS);
    expect(v8.profiles["harness"]!.provisional).toBeUndefined();
    for (const kind of ["productivity", "other"]) {
      expect(v8.profiles[kind]!.weights).toEqual(D44_HARNESS);
      expect(v8.profiles[kind]!.provisional).toMatch(/Architect decision/);
    }
  });
});

describe("kindRouting / profileRouting (#185)", () => {
  const routing = profileRouting(config, "v8.0");

  it("routes each kind to the profile of the same name", () => {
    expect(routing.route("harness")).toEqual({ profile: "harness", weights: D44_HARNESS });
    expect(routing.route("model")).toEqual({ profile: "model", weights: D4B_MODEL });
    expect(routing.route("productivity")).toEqual({ profile: "productivity", weights: D44_HARNESS });
    expect(routing.route("other")).toEqual({ profile: "other", weights: D44_HARNESS });
  });

  it.each([null, undefined, "", "unknown", "Harness", "non_ai", 42])("throws for kind %j, never falls back", (kind) => {
    expect(() => routing.route(kind)).toThrow(ScoringProfileError);
  });

  it("throws for a known kind the set has no profile for", () => {
    const harnessOnly = kindRouting("partial", { harness: D44_HARNESS }, "byKind");
    expect(() => harnessOnly.route("model")).toThrow(/no profile for kind "model"/);
    expect(harnessOnly.route("harness").weights).toEqual(D44_HARNESS);
  });

  it("does not route through an inherited property name", () => {
    const harnessOnly = kindRouting("partial", { harness: D44_HARNESS }, "byKind");
    expect(() => harnessOnly.route("constructor")).toThrow(ScoringProfileError);
  });

  it("keeps one table for every tool in the legacy v7.10 set, whatever the kind", () => {
    const legacy = profileRouting(config, "v7.10");
    for (const kind of [...TOOL_KINDS, null, undefined, "unknown"]) {
      expect(legacy.route(kind)).toEqual({ profile: LEGACY_PROFILE, weights: ALGORITHM_V76_WEIGHTS });
    }
  });

  it("refuses a single-table routing that is not exactly the profile all", () => {
    expect(() => kindRouting("bad", { all: ALGORITHM_V76_WEIGHTS, model: D4B_MODEL }, "single")).toThrow(
      ScoringProfileError
    );
    expect(() => profileRouting(config, "v9")).toThrow(/no profile set "v9"/);
  });

  it("hands out copies, so a caller cannot change the config's weights", () => {
    routing.route("model").weights.agenticCapability = 0.5;
    expect(routing.route("model").weights).toEqual(D4B_MODEL);
  });
});

describe("computeRankings with kind routing (#185)", () => {
  const tools = mixedBoard();
  const routing = profileRouting(config, "v8.0");
  /** One tool scored alone with one table: no other tool can affect it. */
  const alone = (i: number, weights: RankingWeightsV76) => computeRankings([tools[i]!], new Map(), FIXTURE_DATE, weights)[0]!.score;
  const weightsFor = (kind: string) => (kind === "model" ? D4B_MODEL : D44_HARNESS);

  it("scores every tool with the profile for its kind", () => {
    const rows = computeRankings(tools, new Map(), FIXTURE_DATE, routing);
    const byId = new Map(rows.map((r) => [r.tool_id, r.score]));
    tools.forEach((t, i) => expect(byId.get(t.id)).toBe(alone(i, weightsFor(t.kind))));
  });

  it("scores model tools differently from harness weights on this board (so the check above can fail)", () => {
    const models = tools.map((t, i) => [t, i] as const).filter(([t]) => t.kind === "model");
    expect(models.length).toBeGreaterThan(0);
    const differ = models.filter(([, i]) => alone(i, D4B_MODEL) !== alone(i, D44_HARNESS));
    expect(differ.length).toBe(models.length);
  });

  it("puts every kind on one 0-100 board with one global rank", () => {
    const rows = computeRankings(tools, new Map(), FIXTURE_DATE, routing);
    expect(rows.map((r) => r.rank)).toEqual(tools.map((_, i) => i + 1));
    for (const row of rows) {
      expect(row.score).toBeGreaterThanOrEqual(0);
      expect(row.score).toBeLessThanOrEqual(100);
      expect(row.tier).toBe(calculateTier(row.rank));
    }
    // One sort over all per-kind scores, ties in input order: no per-kind rescaling or per-kind rank.
    const expected = tools
      .map((t, i) => ({ id: t.id, score: alone(i, weightsFor(t.kind)), i }))
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .map((e) => e.id);
    expect(rows.map((r) => r.tool_id)).toEqual(expected);
    // The fixture interleaves kinds, so a per-kind list would give a different order.
    const kinds = rows.map((r) => tools.find((t) => t.id === r.tool_id)!.kind);
    const firstModel = kinds.indexOf("model");
    expect(kinds.slice(firstModel).includes("harness")).toBe(true);
  });

  it("throws on a tool with no usable kind, and returns no partial board", () => {
    const board = tools.map((t, i) => (i === 3 ? { ...t, kind: null } : t));
    expect(() => computeRankings(board, new Map(), FIXTURE_DATE, routing)).toThrow(ScoringProfileError);
  });

  it("the legacy v7.10 routing gives exactly the single-table v7.10 board", () => {
    const routed = computeRankings(tools, new Map(), FIXTURE_DATE, profileRouting(config, "v7.10"));
    const single = computeRankings(tools, new Map(), FIXTURE_DATE, ALGORITHM_V76_WEIGHTS);
    expect(JSON.stringify(routed)).toBe(JSON.stringify(single));
  });
});
