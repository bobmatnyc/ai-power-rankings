import { describe, expect, it } from "vitest";

import {
  buildEntries,
  isPublicBullet,
  parseChangelog,
  type ResolvedDate,
} from "../../lib/data/changelog-generator";

/**
 * #303 — the public feed lists only content or feature changes.
 *
 * Why: Owner ruling 2026-10-26: an infrastructure entry (vendor-logo L1) is
 * not a valid public update. The rule lives in the generator, fail closed.
 * What: Builds entries from a fixture CHANGELOG and checks which survive.
 * Test: `npx vitest run tests/unit/changelog-public-filter-303.test.ts`.
 */

const resolve = (): ResolvedDate => ({ date: "2026-01-01T00:00:00.000Z", dateSource: "build" });

function publicTitles(bullets: string[]): string[] {
  const md = `## [Unreleased]\n\n### Added\n${bullets.map((b) => `- ${b}`).join("\n")}\n`;
  return buildEntries(parseChangelog(md), resolve).map((e) => e.description);
}

describe("public changelog filter (#303)", () => {
  it("excludes infra, test, refactor, ci, docs and chore entries", () => {
    const out = publicTitles([
      "chore(logos): vendor-logo infrastructure",
      "test(design): colour ratchet exemption",
      "refactor(design): admin components take tokens",
      "ci: a manual workflow",
      "docs(db): merge workflow note",
    ]);
    expect(out).toEqual([]);
  });

  it("includes feature, fix and data entries", () => {
    const out = publicTitles([
      "feat(tools): tool pages list linked models",
      "fix(news): article dates render in UTC",
      "data: reconstructed ranking snapshots",
    ]);
    expect(out).toHaveLength(3);
  });

  it("excludes an entry with no classification", () => {
    expect(publicTitles(["**Plain**: no conventional type", "vendor logos were added"])).toEqual([]);
    expect(isPublicBullet("Fix: wrong case type")).toBe(false);
  });
});
