import { describe, expect, it } from "vitest";
import {
  DEFAULT_RANKING_LIST,
  INDEX_MIN_ENTRIES,
  isListIndexable,
  listFromSlug,
  listHasProvisionalNote,
  listOfTool,
  listTier,
  listTierScheme,
  parseRankingListParam,
  RANKING_LISTS,
  rankingListMeta,
  rankingListPath,
} from "../../lib/rankings/lists";

/**
 * #186: the list rules in `lib/rankings/lists.ts`.
 *
 * Why: every reader and writer of the per-list boards takes membership, the default
 *   list, the tier scheme and the indexing rule from this module, so each owner ruling
 *   it encodes (D51, D52, D53, D54) is pinned here at its boundary.
 * What: membership by kind with the D52 modality exclusion; the D51 default and the
 *   400-worthy unknown value; the D53 rule at exactly 9 and exactly 10 entries; the
 *   D54 note on productivity only; the canonical paths.
 * Test: `npx vitest run tests/unit/ranking-lists-186.test.ts`.
 */

describe("listOfTool (#186)", () => {
  it.each([
    ["harness", undefined, "harness"],
    ["model", undefined, "model"],
    ["model", "text", "model"],
    ["productivity", undefined, "productivity"],
    ["other", undefined, null],
    [null, undefined, null],
    ["unknown-kind", undefined, null],
  ])("kind %s (modality %s) is ranked in %s", (kind, modality, expected) => {
    expect(listOfTool(kind, modality)).toBe(expected);
  });

  it.each(["image", "video", "Image", " VIDEO "])("D52: a model of modality %j is in no list", (modality) => {
    expect(listOfTool("model", modality)).toBeNull();
  });

  it("D52 applies to models only: a harness with an image modality stays a harness", () => {
    expect(listOfTool("harness", "image")).toBe("harness");
  });
});

describe("parseRankingListParam (#186, D51)", () => {
  it.each([undefined, null, "", "  "])("an absent value %j is the coding-harness list, marked defaulted", (raw) => {
    expect(parseRankingListParam(raw)).toEqual({ ok: true, list: "harness", defaulted: true });
    expect(DEFAULT_RANKING_LIST).toBe("harness");
  });

  it.each([
    ["model", "model"],
    ["models", "model"],
    ["MODELS", "model"],
    ["harness", "harness"],
    ["coding-harnesses", "harness"],
    ["productivity", "productivity"],
    ["productivity-tools", "productivity"],
  ])("%s names the %s list", (raw, list) => {
    expect(parseRankingListParam(raw)).toEqual({ ok: true, list, defaulted: false });
  });

  it.each(["combined", "other", "image", "all"])("%s is refused, not defaulted", (raw) => {
    const parsed = parseRankingListParam(raw);
    expect(parsed.ok).toBe(false);
  });
});

describe("D53: the 10-entry threshold", () => {
  it("is 10", () => {
    expect(INDEX_MIN_ENTRIES).toBe(10);
  });

  it("a list of exactly 9 entries is noindex and tiers S/A/B by thirds", () => {
    expect(isListIndexable(9)).toBe(false);
    expect(listTierScheme(9)).toBe("thirds");
    const tiers = Array.from({ length: 9 }, (_, i) => listTier(i + 1, 9));
    expect(tiers).toEqual(["S", "S", "S", "A", "A", "A", "B", "B", "B"]);
  });

  it("a list of exactly 10 entries is indexed with the normal tiers", () => {
    expect(isListIndexable(10)).toBe(true);
    expect(listTierScheme(10)).toBe("standard");
    const tiers = Array.from({ length: 10 }, (_, i) => listTier(i + 1, 10));
    expect(tiers).toEqual(["S", "S", "S", "S", "S", "A", "A", "A", "A", "A"]);
  });

  it("a long list keeps the C and D tiers", () => {
    expect(listTier(30, 40)).toBe("C");
    expect(listTier(40, 40)).toBe("D");
  });

  it.each([
    [1, ["S"]],
    [2, ["S", "A"]],
    [4, ["S", "S", "A", "B"]],
  ])("a list of %i entries has no tier below B", (n, expected) => {
    expect(Array.from({ length: n }, (_, i) => listTier(i + 1, n))).toEqual(expected);
  });

  it.each([
    [0, 5],
    [6, 5],
    [1.5, 5],
  ])("refuses rank %s in a list of %s", (rank, n) => {
    expect(() => listTier(rank, n)).toThrow(RangeError);
  });
});

describe("D54: the provisional note", () => {
  it("is on productivity and on no other list", () => {
    expect(RANKING_LISTS.filter(listHasProvisionalNote)).toEqual(["productivity"]);
    expect(rankingListMeta("productivity", 0).provisional_note).toBe(true);
    expect(rankingListMeta("model", 12).provisional_note).toBe(false);
  });
});

describe("list paths (#186)", () => {
  it("the harness list is /rankings and the others live under it", () => {
    expect(rankingListPath("harness")).toBe("/rankings");
    expect(rankingListPath("model")).toBe("/rankings/models");
    expect(rankingListPath("productivity")).toBe("/rankings/productivity-tools");
  });

  it("every slug maps back to its list, and an unknown slug to none", () => {
    expect(listFromSlug("coding-harnesses")).toBe("harness");
    expect(listFromSlug("models")).toBe("model");
    expect(listFromSlug("productivity-tools")).toBe("productivity");
    expect(listFromSlug("combined")).toBeNull();
  });

  it("rankingListMeta reports the threshold result for its count", () => {
    expect(rankingListMeta("productivity", 9)).toMatchObject({ list: "productivity", entry_count: 9, indexable: false, tier_scheme: "thirds" });
    expect(rankingListMeta("productivity", 10)).toMatchObject({ entry_count: 10, indexable: true, tier_scheme: "standard" });
  });
});
