import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ALGORITHM_V76_WEIGHTS } from "./ranking-algorithm-v76";
import {
  FACTOR_KEYS,
  loadCheckedInScoringProfiles,
  loadScoringProfiles,
  parseScoringProfiles,
  parseScoringProfilesText,
  profileWeights,
  ScoringProfileError,
} from "./scoring-profiles";

/**
 * #185 — scoring profile loader and the checked-in profiles.
 *
 * Why: the profiles become the source of the published weights in a later PR,
 *   so the loader must refuse a bad file rather than fall back, the frozen
 *   v7.10 set must stay exactly the published weights, and the staged v8.0
 *   harness profile must be exactly D44.
 * What: checks the checked-in file, then feeds the loader one broken config
 *   per rule and expects `ScoringProfileError` each time.
 * Test: `npx vitest run lib/scoring-profiles.test.ts`
 */

const D44_HARNESS = {
  agenticCapability: 0.12,
  innovation: 0.1,
  technicalPerformance: 0.17,
  developerAdoption: 0.17,
  marketTraction: 0.12,
  businessSentiment: 0.12,
  developmentVelocity: 0.12,
  platformResilience: 0.08,
};

type Json = Record<string, any>;

/** A valid two-set config; each test breaks one thing in a copy. */
function validConfig(): Json {
  return {
    schemaVersion: 1,
    activeProfileSet: "v7.10",
    profileSets: {
      "v7.10": {
        label: "v7.10",
        status: "legacy",
        frozen: true,
        profiles: { all: { declaredTotal: 1.02, weights: { ...ALGORITHM_V76_WEIGHTS } } },
      },
      "v8.0": {
        label: "v8.0",
        status: "staged",
        frozen: false,
        profiles: { harness: { declaredTotal: 1, weights: { ...D44_HARNESS } } },
      },
    },
  };
}

const harness = (c: Json) => c["profileSets"]["v8.0"]["profiles"]["harness"];

describe("checked-in config/scoring-profiles.json (#185)", () => {
  const config = loadCheckedInScoringProfiles();

  it("selects v8.0 as the active set, marked active, with no other profile (#185, owner ruling Q3)", () => {
    expect(config.activeProfileSet).toBe("v8.0");
    expect(config.profileSets["v8.0"]!.status).toBe("active");
    expect(Object.hasOwn(config.profileSets["v8.0"]!.profiles, "other")).toBe(false);
  });

  it("freezes v7.10 as legacy with the published weights and their real 1.02 sum", () => {
    const set = config.profileSets["v7.10"]!;
    expect(set.status).toBe("legacy");
    expect(set.frozen).toBe(true);
    expect(set.profiles["all"]!.declaredTotal).toBe(1.02);
    const weights = profileWeights(config, "v7.10", "all");
    expect(weights).toEqual(ALGORITHM_V76_WEIGHTS);
    // Same key order as the engine constant, so the weighted sum adds identically.
    expect(Object.keys(weights)).toEqual(Object.keys(ALGORITHM_V76_WEIGHTS));
  });

  it("stages v8.0 harness at exactly D44: technical and adoption .17, the other six unchanged", () => {
    const set = config.profileSets["v8.0"]!;
    expect(set.label).toBe("v8.0");
    expect(set.status).not.toBe("legacy");
    const weights = profileWeights(config, "v8.0", "harness");
    expect(weights).toEqual(D44_HARNESS);
    for (const key of FACTOR_KEYS) {
      if (key !== "technicalPerformance" && key !== "developerAdoption") {
        expect(weights[key]).toBe(ALGORITHM_V76_WEIGHTS[key]);
      }
    }
  });

  it("every non-legacy profile sums to 1.00 in basis points", () => {
    for (const set of Object.values(config.profileSets).filter((s) => s.status !== "legacy")) {
      for (const profile of Object.values(set.profiles)) {
        const bp = Object.values(profile.weights).reduce((sum, w) => sum + Math.round(w * 10_000), 0);
        expect(bp).toBe(10_000);
      }
    }
  });

  it("returns a copy, so a caller cannot change the loaded weights", () => {
    const weights = profileWeights(config, "v8.0", "harness");
    weights.technicalPerformance = 0.5;
    expect(profileWeights(config, "v8.0", "harness").technicalPerformance).toBe(0.17);
  });
});

describe("parseScoringProfiles fails closed (#185)", () => {
  it("accepts the valid config", () => {
    expect(() => parseScoringProfiles(validConfig())).not.toThrow();
  });

  it.each<[string, (c: Json) => void]>([
    ["weights summing to 0.99 against a declared 1", (c) => (harness(c).weights.platformResilience = 0.07)],
    ["weights summing to 1.01 against a declared 1", (c) => (harness(c).weights.platformResilience = 0.09)],
    ["v7.10 weights relabelled as summing to 1", (c) => (c["profileSets"]["v7.10"]["profiles"]["all"].declaredTotal = 1)],
    ["a non-legacy set declaring 1.02", (c) => {
      harness(c).declaredTotal = 1.02;
      harness(c).weights.technicalPerformance = 0.19;
    }],
    ["a missing factor", (c) => delete harness(c).weights.innovation],
    ["an unknown factor", (c) => (harness(c).weights.hype = 0)],
    ["a NaN weight", (c) => (harness(c).weights.innovation = Number.NaN)],
    ["a negative weight", (c) => {
      harness(c).weights.innovation = -0.1;
      harness(c).weights.agenticCapability = 0.32;
    }],
    ["a weight above 1", (c) => (harness(c).weights.innovation = 1.1)],
    ["a string weight", (c) => (harness(c).weights.innovation = "0.10")],
    ["a weight off the 0.0001 grid", (c) => {
      harness(c).weights.innovation = 0.10005;
      harness(c).weights.agenticCapability = 0.11995;
    }],
    ["a legacy set that is not frozen", (c) => (c["profileSets"]["v7.10"].frozen = false)],
    ["an unknown status", (c) => (c["profileSets"]["v8.0"].status = "live")],
    ["a label that differs from its key", (c) => (c["profileSets"]["v8.0"].label = "v8")],
    ["an active set that does not exist", (c) => (c["activeProfileSet"] = "v9")],
    ["a set with no profiles", (c) => (c["profileSets"]["v8.0"].profiles = {})],
    ["a wrong schema version", (c) => (c["schemaVersion"] = 2)],
  ])("rejects %s", (_label, breakIt) => {
    const config = validConfig();
    breakIt(config);
    expect(() => parseScoringProfiles(config)).toThrow(ScoringProfileError);
  });

  it("does not renormalise: the error names the actual and declared sums", () => {
    const config = validConfig();
    harness(config).weights.platformResilience = 0.07;
    expect(() => parseScoringProfiles(config)).toThrow(/sum to 0\.99, not the declared 1/);
  });

  it("rejects text that does not parse as JSON", () => {
    expect(() => parseScoringProfilesText("{ not json")).toThrow(ScoringProfileError);
  });

  it("loadScoringProfiles reads and validates a file", () => {
    const dir = mkdtempSync(join(tmpdir(), "scoring-profiles-185-"));
    try {
      const good = join(dir, "good.json");
      const bad = join(dir, "bad.json");
      writeFileSync(good, JSON.stringify(validConfig()));
      const broken = validConfig();
      delete harness(broken).weights.innovation;
      writeFileSync(bad, JSON.stringify(broken));
      expect(loadScoringProfiles(good).activeProfileSet).toBe("v7.10");
      expect(() => loadScoringProfiles(bad)).toThrow(ScoringProfileError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("profileWeights throws for an unknown set or profile", () => {
    const config = parseScoringProfiles(validConfig());
    expect(() => profileWeights(config, "v8.0", "model")).toThrow(ScoringProfileError);
    expect(() => profileWeights(config, "v9", "harness")).toThrow(ScoringProfileError);
  });
});
