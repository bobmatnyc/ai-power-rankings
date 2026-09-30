/**
 * Unit coverage for the local gate's pure helpers (scripts/local-gate.mjs).
 *
 * Why: The gate posts a commit status whose repo and state come from these helpers;
 * a wrong owner/repo posts nowhere useful, and a wrong state reports a failing head
 * as green.
 * Test: Runs under `npm run test:unit`. No git, `gh`, or network access.
 */

import { describe, expect, it } from "vitest";
import { parseGitHubRemote, summarizeResults } from "../../scripts/local-gate.mjs";

describe("parseGitHubRemote", () => {
  it.each([
    ["git@github.com:bobmatnyc/ai-power-rankings.git", "bobmatnyc/ai-power-rankings"],
    ["https://github.com/bobmatnyc/ai-power-rankings.git", "bobmatnyc/ai-power-rankings"],
    ["https://github.com/bobmatnyc/ai-power-rankings", "bobmatnyc/ai-power-rankings"],
    ["ssh://git@github.com/bobmatnyc/ai-power-rankings.git\n", "bobmatnyc/ai-power-rankings"],
    ["git@gitlab.com:bobmatnyc/ai-power-rankings.git", null],
    ["not a url", null],
  ])("parses %j as %j", (url, expected) => {
    expect(parseGitHubRemote(url)).toBe(expected);
  });
});

describe("summarizeResults", () => {
  it("reports success only when every check passed", () => {
    expect(
      summarizeResults([
        { name: "tsc --noEmit", ok: true },
        { name: "vitest", ok: true },
      ])
    ).toEqual({ state: "success", description: "passed: tsc --noEmit, vitest" });
  });

  it("names each failed check in the description", () => {
    expect(
      summarizeResults([
        { name: "tsc --noEmit", ok: false },
        { name: "vitest", ok: true },
      ])
    ).toEqual({ state: "failure", description: "failed: tsc --noEmit" });
  });
});
