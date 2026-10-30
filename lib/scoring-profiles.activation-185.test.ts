import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolvePublishScoring } from "./rankings/publish-active";
import { profileRouting } from "./scoring-kind-routing";
import { loadCheckedInScoringProfiles, profileWeights, ScoringProfileError } from "./scoring-profiles";
import golden from "./services/__fixtures__/regenerate-publish.golden.json";
import { GOLDEN_NOW, GOLDEN_PREVIOUS_SNAPSHOT, GOLDEN_TOOLS } from "./services/__fixtures__/regenerate-golden-input";
import {
  buildPreviousRankMap,
  computeRankings,
  RANKING_ALGORITHM_VERSION,
} from "./services/ranking-generation.service";

/**
 * #185 PR-3: the publish path is activated; the combined board stays v7.10.
 *
 * Why: this file was `scoring-profiles.inert-185.test.ts`, which proved PR-1 and PR-2
 *   changed no published byte. PR-3 ends that on purpose: the cron and the CLI now
 *   publish per-list boards under the active profile set. The inert assertions that
 *   activation intends to change are replaced by their activation counterparts; the
 *   ones that still hold are kept unchanged.
 * What: kept: the default `computeRankings()` call (the combined layout, still used by
 *   admin drafts and previews) equals the #101 v7.10 golden rows and version 7.10; the
 *   frozen v7.10 profile and the legacy routing reproduce them; v8.0 scores differ.
 *   Replaced: "no publish-path module reads the profiles" becomes "the cron and the CLI
 *   publish only through `publishActiveRankings()`, and only that module reads the
 *   profiles"; "the active set is still v7.10" becomes "the checked-in active set is
 *   v8.0 with no `other` profile, and the publish resolves it" (#185: the switch is the
 *   one config point, `activeProfileSet`; v8.0 drops `other`); "one
 *   `computeRankings()` call with no scoring argument"
 *   becomes "two calls: the v7.10 one and the per-list routing one in tie order".
 * Test: `npx vitest run lib/scoring-profiles.activation-185.test.ts`
 */

const root = join(__dirname, "..");
const config = loadCheckedInScoringProfiles();
const previous = () => buildPreviousRankMap(GOLDEN_PREVIOUS_SNAPSHOT.data);
const goldenRows = golden.saveSnapshotCalls[0]!.data;
const source = (file: string) => readFileSync(join(root, file), "utf8");
const IMPORTS_PROFILES = /(from|import\()\s*["'][^"']*scoring-profiles["']/;
const IMPORTS_ROUTING = /(from|import\()\s*["'][^"']*scoring-kind-routing["']/;

describe("combined layout still v7.10 (#185, kept from PR-1)", () => {
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

  it("the v8.0 harness profile scores differently, so the comparison above can fail", () => {
    const weights = profileWeights(config, "v8.0", "harness");
    const v8 = computeRankings(GOLDEN_TOOLS, previous(), new Date(GOLDEN_NOW), weights);
    expect(v8.map((r) => r.score)).not.toEqual(goldenRows.map((r) => r.score));
  });

  it("the legacy routing reproduces the golden rows; the v8.0 kind routing does not", () => {
    const legacy = computeRankings(GOLDEN_TOOLS, previous(), new Date(GOLDEN_NOW), profileRouting(config, "v7.10"));
    expect(JSON.stringify(legacy)).toBe(JSON.stringify(goldenRows));
    const tools = GOLDEN_TOOLS.map((tool) => ({ ...tool, kind: "model" }));
    const v8 = computeRankings(tools, previous(), new Date(GOLDEN_NOW), profileRouting(config, "v8.0"));
    expect(v8.map((r) => r.score)).not.toEqual(goldenRows.map((r) => r.score));
  });
});

describe("publish path activated (#185 PR-3, replaces the PR-1/PR-2 inert checks)", () => {
  it("the cron route publishes only through publishActiveRankings(), never regenerateRankings()", () => {
    const cron = source("app/api/cron/regenerate-rankings/route.ts");
    expect(cron).toMatch(/from "@\/lib\/rankings\/publish-active"/);
    expect(cron).toMatch(/await publishActiveRankings\(\)/);
    expect(cron).not.toMatch(/regenerateRankings\(/);
  });

  it("the CLI publish run calls publishActiveRankings(); only its offline dry-run calls regenerateRankings()", () => {
    const cli = source("scripts/generate-v76-rankings.ts");
    expect(cli.match(/await publishActiveRankings\(/g)).toHaveLength(1);
    expect(cli.match(/await regenerateRankings\(/g)).toHaveLength(1);
    // The one direct call sits inside the offline dry-run branch, between its roster and its exit.
    const call = cli.indexOf("await regenerateRankings(");
    expect(call).toBeGreaterThan(cli.indexOf("await buildDryRunPersistence()"));
    expect(call).toBeLessThan(cli.indexOf("Dry-run complete"));
    expect(cli.indexOf("await publishActiveRankings(")).toBeGreaterThan(cli.indexOf("Dry-run complete"));
  });

  it.each(["lib/services/ranking-generation.service.ts", "lib/ranking-algorithm-v76.ts", "app/api/cron/regenerate-rankings/route.ts"])(
    "%s does not read the profile file itself; lib/rankings/publish-active.ts does",
    (file) => {
      expect(source(file)).not.toMatch(IMPORTS_PROFILES);
      expect(source(file)).not.toMatch(IMPORTS_ROUTING);
      expect(source("lib/rankings/publish-active.ts")).toMatch(IMPORTS_PROFILES);
    }
  );

  it("the checked-in active set is v8.0 without the other profile, and the publish path resolves it", () => {
    // #185: the switch to v8.0 is `activeProfileSet`; v8.0 dropped `other`.
    expect(config.activeProfileSet).toBe("v8.0");
    expect(Object.hasOwn(config.profileSets["v8.0"]!.profiles, "other")).toBe(false);
    const scoring = resolvePublishScoring(config);
    expect(scoring.algorithmVersion).toBe("8.0");
    expect(() => scoring.routing.route("other")).toThrow(ScoringProfileError);
    // The legacy set, if named again, is still refused.
    expect(() => resolvePublishScoring({ ...config, activeProfileSet: "v7.10" })).toThrow(/legacy one-table set/);
  });

  it("regenerateRankings() has two scoring calls: v7.10 for the combined board, the routing in tie order per list", () => {
    const service = source("lib/services/ranking-generation.service.ts");
    const calls = service.match(/(=|\?|:)\s*computeRankings\([^;]*?\)(?=\s*(:|;|\n))/g) ?? [];
    expect(calls.map((c) => c.replace(/^[=?:]\s*/, ""))).toEqual([
      "computeRankings(v8TieOrder(sourceTools, v710Positions), previousRankMap, publishedAt, scoring.routing)",
      "computeRankings(sourceTools, previousRankMap, publishedAt)",
    ]);
  });
});
