import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * #231 — the generated changelog module stays in sync with CHANGELOG.md.
 *
 * Why: The runtime imports platform changes from
 * `data/changelog-entries.generated.json` instead of reading CHANGELOG.md.
 * A CHANGELOG edit without a regeneration would ship a stale feed.
 * What: Rebuilds the data from CHANGELOG.md, taking unreleased dates from
 * the committed module, and requires a byte-exact match. Also covers the
 * parser ([Unreleased] kept, non-change sections skipped) and the date order:
 * commit, then previous module, then build date.
 * Test: `npx vitest run tests/unit/changelog-generated-sync.test.ts`.
 */

import {
  buildEntries,
  dateResolver,
  GENERATED_RELATIVE_PATH,
  parseBlamePorcelain,
  parseChangelog,
  renderData,
  splitBullet,
  type ResolvedDate,
} from "../../lib/data/changelog-generator";
import { CHANGELOG_ENTRIES } from "../../lib/data/changelog-entries";

const root = join(__dirname, "..", "..");
const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
const committed = readFileSync(join(root, GENERATED_RELATIVE_PATH), "utf8");

/** Rebuilds the module text from `markdown`, reusing the committed dates. */
function regenerate(markdown: string): string {
  const previous = new Map<string, ResolvedDate>(
    CHANGELOG_ENTRIES.map((e) => [e.id, { date: e.date, dateSource: e.dateSource }])
  );
  const resolve = (_: unknown, id: string): ResolvedDate =>
    previous.get(id) ?? { date: "MISSING", dateSource: "build" };
  return renderData(buildEntries(parseChangelog(markdown), resolve));
}

describe("generated changelog module (#231)", () => {
  it("matches CHANGELOG.md; run `npm run generate-changelog` when this fails", () => {
    expect(regenerate(changelog)).toBe(committed);
  });

  it("goes stale when CHANGELOG.md gains an entry the module lacks", () => {
    const edited = changelog.replace("### Fixed\n", "### Fixed\n- fix(test): a new line\n");
    expect(edited).not.toBe(changelog);
    expect(regenerate(edited)).not.toBe(committed);
  });

  it("includes [Unreleased] entries, each with a valid date", () => {
    const unreleased = CHANGELOG_ENTRIES.filter((e) => e.version === "Unreleased");
    expect(unreleased.length).toBeGreaterThan(0);
    for (const entry of unreleased) {
      expect(Number.isNaN(Date.parse(entry.date))).toBe(false);
      expect(entry.dateSource).not.toBe("release");
    }
  });
});

describe("parseChangelog (#231)", () => {
  const sample = [
    "## [Unreleased]",
    "### Fixed",
    "- fix(auth): first. More text",
    "  - nested detail",
    "### Known Issues",
    "- #95 — not a change",
    "## [1.0.0] - 2026-01-02",
    "### Added",
    "- **Bold Title**: bold description",
  ].join("\n");

  it("keeps [Unreleased] bullets, skips nested bullets and non-change sections", () => {
    const bullets = parseChangelog(sample);
    expect(bullets.map((b) => [b.version, b.releaseDate, b.section, b.line])).toEqual([
      ["Unreleased", null, "Fixed", 3],
      ["1.0.0", "2026-01-02", "Added", 9],
    ]);
  });

  it("dates a released bullet by its release header, not the resolver", () => {
    const entries = buildEntries(parseChangelog(sample), () => ({
      date: "2026-05-05T00:00:00.000Z",
      dateSource: "commit",
    }));
    expect(entries[0]).toMatchObject({ date: "2026-05-05T00:00:00.000Z", dateSource: "commit", changeType: "fix" });
    expect(entries[1]).toMatchObject({ date: "2026-01-02T00:00:00.000Z", dateSource: "release", changeType: "feature" });
  });

  it("splits conventional and bold bullets into scope, title and description", () => {
    expect(splitBullet("fix(auth): first. More text")).toEqual({
      scope: "auth",
      title: "first",
      description: "first. More text",
    });
    expect(splitBullet("**Bold Title**: bold description")).toEqual({
      scope: null,
      title: "Bold Title",
      description: "bold description",
    });
  });
});

describe("unreleased dating order (#231 ruling)", () => {
  const bullet = { version: "Unreleased", releaseDate: null, section: "Fixed", text: "x", line: 3 };
  const buildDate = new Date("2026-10-23T12:00:00.000Z");
  const previous = new Map<string, ResolvedDate>([
    ["id-1", { date: "2026-10-01T00:00:00.000Z", dateSource: "commit" }],
  ]);

  it("uses the commit that introduced the line", () => {
    const blame = parseBlamePorcelain(
      `${"a".repeat(40)} 3 3 1\nauthor x\ncommitter-time 1760000000\n\tline\n`
    );
    expect(dateResolver({ blame, previous, buildDate })(bullet, "id-1")).toEqual({
      date: new Date(1760000000 * 1000).toISOString(),
      dateSource: "commit",
    });
  });

  it("falls back to the previous module's date when the line is not committed", () => {
    const blame = parseBlamePorcelain(`${"0".repeat(40)} 3 3 1\ncommitter-time 1760000000\n\t- x\n`);
    expect(blame.get(3)).toBeNull();
    expect(dateResolver({ blame, previous, buildDate })(bullet, "id-1")).toEqual(previous.get("id-1"));
  });

  // #231: a shallow clone charges older lines to its `boundary` commit.
  it("treats a boundary blame line as unresolved and keeps the previous date", () => {
    const blame = parseBlamePorcelain(
      [
        `${"b".repeat(40)} 3 3 1`,
        "author x",
        "committer-time 1790000000",
        "summary shallow tip",
        "boundary",
        "filename CHANGELOG.md",
        "\t- fix: x",
        "",
      ].join("\n")
    );
    expect(blame.get(3)).toBeNull();
    expect(dateResolver({ blame, previous, buildDate })(bullet, "id-1")).toEqual(previous.get("id-1"));
    expect(dateResolver({ blame, previous, buildDate })(bullet, "id-2")).toEqual({
      date: buildDate.toISOString(),
      dateSource: "build",
    });
  });

  it("falls back to the build date when nothing else resolves, and never drops the entry", () => {
    expect(dateResolver({ blame: null, previous, buildDate })(bullet, "id-2")).toEqual({
      date: buildDate.toISOString(),
      dateSource: "build",
    });
  });
});
