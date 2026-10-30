import { describe, expect, it } from "vitest";
import checkedIn from "../../config/scoring-profiles.json";
import {
  activeSetProblems,
  loadCheckedInScoringProfiles,
  parseScoringProfiles,
  ScoringProfileError,
} from "../../lib/scoring-profiles";

/**
 * #186: the active-set rule, as the Architect amended the PR-3 criterion.
 *
 * Why: publishing with a provisional profile is refused, except the productivity
 *   profile, which ships with provisional harness weights and a public note on its
 *   page (D54). The amendment allows exactly that case and no other.
 * What: a v8.0 config made active with only the productivity profile provisional is
 *   accepted when that profile carries `publicNote: true` and refused without it; a
 *   provisional profile of any other name is refused even with the flag; the flag is
 *   refused on a non-provisional profile or as a non-true value; a staged set is not
 *   held to the rule. The checked-in config flags productivity only. #185: the checked-in v8.0 set is active with no `other` profile, and the dropped
 *   provisional `other` profile is refused if it comes back.
 * Test: `npx vitest run tests/unit/scoring-profiles-active-set-186.test.ts`.
 */

type Json = Record<string, any>;

/** A copy of the checked-in config (v8.0 active, no `other` profile, #185) with one edit. */
function activeV8(edit: (profiles: Json) => void = () => {}): Json {
  const config = JSON.parse(JSON.stringify(checkedIn)) as Json;
  expect(config["activeProfileSet"]).toBe("v8.0");
  edit(config["profileSets"]["v8.0"]["profiles"]);
  return config;
}

function problems(config: Json): string[] {
  try {
    parseScoringProfiles(config);
    return [];
  } catch (error) {
    expect(error).toBeInstanceOf(ScoringProfileError);
    return (error as ScoringProfileError).problems;
  }
}

describe("active set with a provisional profile (#186 amendment)", () => {
  it("accepts a provisional productivity profile that carries publicNote: true", () => {
    const config = activeV8();
    expect(config["profileSets"]["v8.0"]["profiles"]["productivity"]["provisional"]).toBeTruthy();
    expect(config["profileSets"]["v8.0"]["profiles"]["productivity"]["publicNote"]).toBe(true);
    const parsed = parseScoringProfiles(config);
    expect(parsed.activeProfileSet).toBe("v8.0");
    expect(parsed.profileSets["v8.0"]!.profiles["productivity"]!.publicNote).toBe(true);
  });

  it("refuses a provisional productivity profile without publicNote", () => {
    const config = activeV8((profiles) => delete profiles["productivity"]["publicNote"]);
    expect(problems(config)).toEqual([
      'active set "v8.0" holds the provisional profile "productivity" without publicNote: true',
    ]);
  });

  it("refuses a provisional profile other than productivity, even with publicNote", () => {
    const config = activeV8((profiles) => {
      profiles["model"]["provisional"] = "pending a ruling";
      profiles["model"]["publicNote"] = true;
    });
    expect(problems(config)).toEqual([
      'active set "v8.0" holds the provisional profile "model"; only productivity may be provisional',
    ]);
  });

  it("refuses the dropped provisional other profile if it comes back into the active set (#185)", () => {
    const config = activeV8((profiles) => {
      profiles["other"] = { ...profiles["harness"], provisional: "harness weights, awaiting a decision" };
    });
    expect(problems(config)).toEqual([
      'active set "v8.0" holds the provisional profile "other"; only productivity may be provisional',
    ]);
  });

  it.each([
    ["on a profile that is not provisional", (p: Json) => (p["harness"]["publicNote"] = true), "harness"],
    ["as a value other than true", (p: Json) => (p["productivity"]["publicNote"] = "yes"), "productivity"],
  ])("refuses publicNote %s", (_label, edit, name) => {
    expect(problems(activeV8(edit))).toEqual([
      `profileSets.v8.0.profiles.${name}.publicNote must be true and only on a provisional profile`,
    ]);
  });

  it("holds only the active set to the rule: a provisional other profile in a set that is not active loads", () => {
    const config = activeV8((profiles) => {
      profiles["other"] = { ...profiles["harness"], provisional: "harness weights, awaiting a decision" };
    });
    config["activeProfileSet"] = "v7.10";
    const parsed = parseScoringProfiles(config);
    expect(activeSetProblems("v8.0", parsed.profileSets["v8.0"]!)).toHaveLength(1);
  });

  it("the checked-in config loads with v8.0 active and no active-set problem (#185)", () => {
    const config = loadCheckedInScoringProfiles();
    expect(config.activeProfileSet).toBe("v8.0");
    expect(activeSetProblems("v8.0", config.profileSets["v8.0"]!)).toEqual([]);
  });

  it("the checked-in v8.0 set flags productivity, and only productivity, for a public note (D54)", () => {
    const v8 = loadCheckedInScoringProfiles().profileSets["v8.0"]!;
    const flagged = Object.entries(v8.profiles)
      .filter(([, profile]) => profile.publicNote === true)
      .map(([name]) => name);
    expect(flagged).toEqual(["productivity"]);
  });
});
