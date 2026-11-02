import { afterEach, describe, expect, it, vi } from "vitest";

import { harnessBoard, mixedBoard, publishedFor } from "../tests/fixtures/v8-board-185";
import { profileRouting } from "./scoring-kind-routing";
import { loadCheckedInScoringProfiles, profileWeights } from "./scoring-profiles";
import {
  EXIT_CODES,
  formatMeasurementReport,
  measureBoard,
  type MeasuredTool,
  type PublishedSnapshot,
} from "./v8-board-measurement";
import type { ToolIdentity } from "./v8-published-id-resolution";

/**
 * #185 — the v7.10 baseline maps published tool ids through redirects.
 *
 * Why: migrations 0018/0019 and the duplicate-tool merge retired tool rows as
 *   `status = 'redirect'` with `data.redirect_to` naming the canonical slug.
 *   The published v7.10 snapshot still carries the old ids, so an id-keyed
 *   comparison counted every folded tool as "only published" and the
 *   reproduction failed on the T35 re-measure. A redirect that cannot be
 *   followed (cycle, no row, no target), or two published ids reaching one
 *   canonical id with no identifiable survivor, must still fail the
 *   reproduction, never pass silently. An explained collision compares the
 *   survivor and renumbers ranks past the retired rows.
 *   After the v8.0 switch (fd7565d6) the v8 board leaves out kind `other`,
 *   which v8.0 cannot route, while the v7.10 reproduction keeps it.
 * What: builds a current board in which some published tools now sit under a
 *   new canonical id, and the rows `tools` holds for the old ids, then runs
 *   `measureBoard()` and reads the counts and the report.
 * Test: `npx vitest run lib/v8-board-measurement-redirects.test.ts`
 */

const config = loadCheckedInScoringProfiles();
const v710 = profileWeights(config, "v7.10", "all");
const v8 = profileRouting(config, "v8.0");


afterEach(() => vi.restoreAllMocks());

function quietPublished(tools: MeasuredTool[]): PublishedSnapshot {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return publishedFor(tools, v710);
  } finally {
    warn.mockRestore();
  }
}

const active = (t: MeasuredTool): ToolIdentity => ({ id: t.id, slug: t.slug, status: "active", redirectTo: null });
const redirect = (id: string, slug: string, to: string | null): ToolIdentity => ({ id, slug, status: "redirect", redirectTo: to });

/** The fixture tool the snapshot published at `rank`. */
function atRank(tools: MeasuredTool[], published: PublishedSnapshot, rank: number): MeasuredTool {
  const id = String(published.rows.find((r) => Number(r["rank"]) === rank)!["tool_id"]);
  return tools.find((t) => t.id === id)!;
}

function run(tools: MeasuredTool[], published: PublishedSnapshot, toolIdentities: ToolIdentity[]) {
  const sheet = { slugs: new Set(tools.map((t) => t.slug)), retiredSlugs: new Set<string>() };
  const harnessFloor = tools.filter((t) => t.kind === "harness").length;
  return measureBoard({ tools, published, baseline: v710, candidate: v8, sheet, harnessFloor, toolIdentities });
}

/**
 * The published board, then a fold: tool 3 now lives under a new id and slug
 * (one hop), and tool 7 under a new id reached through an intermediate retired
 * row (two hops). Scores are unchanged, as 0019 carries data across.
 */
function foldedBoard() {
  const before = harnessBoard();
  const published = quietPublished(before);
  const [a, b] = [before[3]!, before[7]!];
  const tools = before.map((t) =>
    t === a ? { ...t, id: `${t.id}-family`, slug: `${t.slug}-family` } : t === b ? { ...t, id: `${t.id}-new`, slug: `${t.slug}-new` } : t
  );
  const identities = [
    ...tools.map(active),
    redirect(a.id, a.slug, `${a.slug}-family`),
    redirect(b.id, b.slug, `${b.slug}-mid`),
    redirect(`${b.id}-mid`, `${b.slug}-mid`, `${b.slug}-new`),
  ];
  return { before, tools, published, identities, a, b };
}

describe("v7.10 baseline through redirects (#185)", () => {
  it("reproduces when published ids redirect, one hop and two hops, to the current canonical ids", () => {
    const { tools, published, identities } = foldedBoard();
    const result = run(tools, published, identities);
    expect(result.reproduction.onlyPublished).toBe(0);
    expect(result.reproduction.onlyRecomputed).toBe(0);
    expect(result.reproduced).toBe(true);
    expect(result.reproduction.redirects).toEqual({
      mapped: 2, unmapped: 0, cycles: 0, collidedIds: 0, collisionTargets: 0, retired: 0, unexplainedCollisions: 0,
    });
    expect(result.exitCode).toBe(EXIT_CODES.ok);
  });

  // #185: a collision is compared against its survivor; the rest retire.
  it("family fold: compares the family against its carriedFrom survivor, retires the alias and renumbers ranks", () => {
    const before = harnessBoard();
    const published = quietPublished(before);
    // The alias sits at published rank 2, so every rank below it must be renumbered to match.
    const [survivor, alias] = [atRank(before, published, 6), atRank(before, published, 2)];
    const family = { ...survivor, id: "family-id", slug: "family" };
    const tools = [...before.filter((t) => t !== survivor && t !== alias), family];
    const identities = [
      ...tools.filter((t) => t !== family).map(active),
      { ...active(family), carriedFrom: survivor.slug },
      redirect(survivor.id, survivor.slug, family.slug),
      redirect(alias.id, alias.slug, family.slug),
    ];
    const result = run(tools, published, identities);
    expect(result.reproduction.redirects).toEqual({
      mapped: 2, unmapped: 0, cycles: 0, collidedIds: 2, collisionTargets: 1, retired: 1, unexplainedCollisions: 0,
    });
    expect(result.reproduction.onlyPublished).toBe(0);
    expect(result.reproduction.onlyRecomputed).toBe(0);
    expect(result.reproduction.rankDiffs).toBe(0);
    expect(result.reproduced).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.ok);
  });

  it("duplicate merge: a target that is itself published is its own survivor; the old row retires", () => {
    const before = harnessBoard();
    const published = quietPublished(before);
    const [target, old] = [atRank(before, published, 8), atRank(before, published, 3)];
    const tools = before.filter((t) => t !== old);
    const result = run(tools, published, [...tools.map(active), redirect(old.id, old.slug, target.slug)]);
    expect(result.reproduction.redirects).toEqual({
      mapped: 1, unmapped: 0, cycles: 0, collidedIds: 2, collisionTargets: 1, retired: 1, unexplainedCollisions: 0,
    });
    expect(result.reproduction.rankDiffs).toBe(0);
    expect(result.reproduced).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.ok);
  });

  it.each([
    ["no carriedFrom and the canonical id is not published", (_s: MeasuredTool, _o: MeasuredTool) => null],
    ["carriedFrom naming a tool outside the group", (_s: MeasuredTool, other: MeasuredTool) => other.slug],
    ["carriedFrom naming a slug with no row", (_s: MeasuredTool, _o: MeasuredTool) => "no-such-slug"],
  ])("error arm: an unexplained collision (%s) fails the reproduction", (_label, carried) => {
    const before = harnessBoard();
    const published = quietPublished(before);
    const [survivor, alias, other] = [atRank(before, published, 6), atRank(before, published, 2), atRank(before, published, 10)];
    const family = { ...survivor, id: "family-id", slug: "family" };
    const tools = [...before.filter((t) => t !== survivor && t !== alias), family];
    const identities = [
      ...tools.filter((t) => t !== family).map(active),
      { ...active(family), carriedFrom: carried(survivor, other) },
      redirect(survivor.id, survivor.slug, family.slug),
      redirect(alias.id, alias.slug, family.slug),
    ];
    const result = run(tools, published, identities);
    expect(result.reproduction.redirects.unexplainedCollisions).toBe(1);
    expect(result.reproduction.redirects.retired).toBe(0);
    expect(result.reproduced).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.notReproduced);
  });

  it("error arm: a redirect cycle is counted, ends, and does not reproduce", () => {
    const { before, published } = foldedBoard();
    const gone = before[5]!;
    const tools = before.filter((t) => t !== gone);
    const identities = [...tools.map(active), redirect(gone.id, gone.slug, "loop-b"), redirect("loop-b-id", "loop-b", gone.slug)];
    const result = run(tools, published, identities);
    expect(result.reproduction.redirects.cycles).toBe(1);
    expect(result.reproduced).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.notReproduced);
  });

  it.each([
    ["no current row and no redirect", (_gone: MeasuredTool) => []],
    ["a redirect whose target slug has no row", (gone: MeasuredTool) => [redirect(gone.id, gone.slug, "no-such-slug")]],
    ["a redirect row with no target", (gone: MeasuredTool) => [redirect(gone.id, gone.slug, null)]],
  ])("error arm (fail-open check): %s is an unmapped mismatch, never a pass", (_label, extra) => {
    const { before, published } = foldedBoard();
    const gone = before[5]!;
    const tools = before.filter((t) => t !== gone);
    const result = run(tools, published, [...tools.map(active), ...extra(gone)]);
    expect(result.reproduction.redirects.unmapped).toBe(1);
    expect(result.reproduced).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.notReproduced);
  });

  it("prints the redirect counts and no id or slug", () => {
    const { tools, published, identities, a, b } = foldedBoard();
    const report = formatMeasurementReport(run(tools, published, identities));
    expect(report).toContain("published ids through redirects: mapped 2; unmapped 0; collided 0 onto 0 canonical ids (retired 0, unexplained 0); redirect cycles 0");
    for (const t of [a, b]) {
      expect(report).not.toContain(t.id);
      expect(report).not.toContain(t.slug);
    }
  });
});

describe("v8 board leaves out kind other; the v7.10 reproduction keeps it (#185)", () => {
  it("an other-kind tool tied on score leaves every v8 candidate statistic, ties included, unchanged", () => {
    const without = mixedBoard();
    // Same data as a harness tool, so it ties with it on the v7.10 board.
    const twin = { ...without[2]!, id: `${without[2]!.id}-other`, slug: `${without[2]!.slug}-other`, kind: "other" };
    const withOther = [...without, twin];
    const a = run(without, quietPublished(without), without.map(active));
    const b = run(withOther, quietPublished(withOther), withOther.map(active));
    expect(b.reproduced).toBe(true);
    expect(b.v8ExcludedOtherKind).toBe(1);
    expect(b.candidate!.ties).toEqual(a.candidate!.ties);
    expect(b.candidate).toEqual(a.candidate);
  });

  it("scores the v8 board without the other tool and reports its count", () => {
    const tools = mixedBoard();
    const other = tools.find((t) => t.kind === "productivity")!;
    other.kind = "other";
    const published = quietPublished(tools);
    const result = run(tools, published, tools.map(active));
    expect(result.reproduction.toolsScored).toBe(tools.length);
    expect(result.reproduced).toBe(true);
    expect(result.v8ExcludedOtherKind).toBe(1);
    expect(result.candidate!.perTool).toHaveLength(tools.length - 1);
    expect(result.exitCode).toBe(EXIT_CODES.ok);
    expect(formatMeasurementReport(result)).toContain(
      "tools of kind other left out of the v8 board (kept in the v7.10 reproduction): 1"
    );
  });
});
