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
 * Why: migrations 0018/0019 (D91) and the D90 merge retired tool rows as
 *   `status = 'redirect'` with `data.redirect_to` naming the canonical slug.
 *   The published v7.10 snapshot still carries the old ids, so an id-keyed
 *   comparison counted every folded tool as "only published" and the
 *   reproduction failed on the T35 re-measure. A redirect that cannot be
 *   followed (cycle, no row, no target) or two published ids reaching one
 *   canonical id must still fail the reproduction, never pass silently.
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
    expect(result.reproduction.redirects).toEqual({ mapped: 2, unmapped: 0, cycles: 0, collidedIds: 0, collisionTargets: 0 });
    expect(result.exitCode).toBe(EXIT_CODES.ok);
  });

  it("reports two published ids that reach one canonical id as a collision and does not reproduce", () => {
    const { before, published } = foldedBoard();
    const [keep, gone] = [before[3]!, before[9]!];
    const tools = before.filter((t) => t !== gone);
    const result = run(tools, published, [...tools.map(active), redirect(gone.id, gone.slug, keep.slug)]);
    expect(result.reproduction.redirects).toEqual({ mapped: 1, unmapped: 0, cycles: 0, collidedIds: 2, collisionTargets: 1 });
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
    expect(report).toContain("published ids through redirects: mapped 2; unmapped 0; collided 0 onto 0 canonical ids; redirect cycles 0");
    for (const t of [a, b]) {
      expect(report).not.toContain(t.id);
      expect(report).not.toContain(t.slug);
    }
  });
});

describe("v8 board leaves out kind other; the v7.10 reproduction keeps it (#185, ruling 'Dad')", () => {
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
