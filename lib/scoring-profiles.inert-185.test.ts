import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { profileRouting } from "./scoring-kind-routing";
import { loadCheckedInScoringProfiles, profileWeights } from "./scoring-profiles";
import golden from "./services/__fixtures__/regenerate-publish.golden.json";
import { GOLDEN_NOW, GOLDEN_PREVIOUS_SNAPSHOT, GOLDEN_TOOLS } from "./services/__fixtures__/regenerate-golden-input";
import {
  buildPreviousRankMap,
  computeRankings,
  RANKING_ALGORITHM_VERSION,
} from "./services/ranking-generation.service";

/**
 * #185 PR-1 and PR-2 are inert: the publish path still scores v7.10.
 *
 * Why: the monthly regenerate cron publishes whatever main computes. PR-1 adds
 *   profiles and a measurement script but must not change a published byte.
 * What: the default `computeRankings()` call (the one `regenerateRankings()`
 *   makes) still equals the #101 v7.10 golden rows and the stored version is
 *   still "7.10"; scoring with the frozen v7.10 profile gives the same rows;
 *   scoring with the staged v8.0 profile does not (so the comparison can fail);
 *   and no publish-path module reads the profile file yet.
 *   PR-2: the active set is still v7.10, the legacy routing reproduces the
 *   golden rows, the v8.0 kind routing does not, `regenerateRankings()` still
 *   calls `computeRankings()` with no scoring argument, and no publish-path
 *   module imports the kind routing.
 * Test: `npx vitest run lib/scoring-profiles.inert-185.test.ts`
 */

const root = join(__dirname, "..");
const config = loadCheckedInScoringProfiles();
const previous = () => buildPreviousRankMap(GOLDEN_PREVIOUS_SNAPSHOT.data);
const goldenRows = golden.saveSnapshotCalls[0]!.data;

describe("PR-1 inert publish path (#185)", () => {
  it("default computeRankings still produces the recorded v7.10 rows and version", () => {
    expect(RANKING_ALGORITHM_VERSION).toBe("7.10");
    expect(golden.saveSnapshotCalls[0]!.algorithmVersion).toBe("7.10");
    expect(computeRankings(GOLDEN_TOOLS, previous(), new Date(GOLDEN_NOW))).toEqual(goldenRows);
  });

  it("the frozen v7.10 profile reproduces the default path exactly", () => {
    const weights = profileWeights(config, "v7.10", "all");
    const fromProfile = computeRankings(GOLDEN_TOOLS, previous(), new Date(GOLDEN_NOW), weights);
    expect(JSON.stringify(fromProfile)).toBe(JSON.stringify(goldenRows));
  });

  it("the staged v8.0 profile scores differently, so the comparison above can fail", () => {
    const weights = profileWeights(config, "v8.0", "harness");
    const v8 = computeRankings(GOLDEN_TOOLS, previous(), new Date(GOLDEN_NOW), weights);
    expect(v8.map((r) => r.score)).not.toEqual(goldenRows.map((r) => r.score));
  });

  it.each([
    "lib/services/ranking-generation.service.ts",
    "lib/ranking-algorithm-v76.ts",
    "app/api/cron/regenerate-rankings/route.ts",
  ])("%s does not read the scoring profiles or the kind routing yet", (file) => {
    const source = readFileSync(join(root, file), "utf8");
    expect(source).not.toMatch(/(from|import\()\s*["'][^"']*scoring-profiles/);
    expect(source).not.toMatch(/(from|import\()\s*["'][^"']*scoring-kind-routing/);
  });

  it("PR-2: the active profile set is still the legacy v7.10 set", () => {
    expect(config.activeProfileSet).toBe("v7.10");
    expect(config.profileSets["v7.10"]!.status).toBe("legacy");
  });

  it("PR-2: the legacy routing reproduces the golden rows; the v8.0 kind routing does not", () => {
    const legacy = computeRankings(GOLDEN_TOOLS, previous(), new Date(GOLDEN_NOW), profileRouting(config, "v7.10"));
    expect(JSON.stringify(legacy)).toBe(JSON.stringify(goldenRows));
    const tools = GOLDEN_TOOLS.map((tool) => ({ ...tool, kind: "model" }));
    const v8 = computeRankings(tools, previous(), new Date(GOLDEN_NOW), profileRouting(config, "v8.0"));
    expect(v8.map((r) => r.score)).not.toEqual(goldenRows.map((r) => r.score));
  });

  it("PR-2: regenerateRankings() scores with no scoring argument, so the publish path keeps one v7.10 table", () => {
    const source = readFileSync(join(root, "lib/services/ranking-generation.service.ts"), "utf8");
    // Every call site in the module (the definition and doc comments are not preceded by `=`).
    const calls = source.match(/=\s*computeRankings\([^)]*\)/g) ?? [];
    expect(calls).toEqual(["= computeRankings(sourceTools, previousRankMap, publishedAt)"]);
  });
});
