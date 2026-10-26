import { describe, expect, it } from "vitest";

/**
 * #285: second-kind and title-fill news tags are gated by relevance.
 *
 * Why: #187 tagged an article with the best mention of each other tool kind
 * whatever its relevance, and filled a kind from the title with no relevance at
 * all, so a passing mention or a headline word produced a tag. Display only.
 * What: a small synthetic catalogue (one harness, one model). Each case pins one
 * rule of `articleToolTags`: a second-kind mention tags only at or above
 * `SECOND_KIND_TAG_MIN_RELEVANCE`, a title match adds no tag, the primary tag
 * does not move.
 * Test: `npx vitest run tests/unit/news-tag-relevance-285.test.ts`. No DB, no network.
 */

const load = () => import("../../lib/news-tool-resolver");

const row = (slug: string, name: string, kind: string) => ({ id: `t-${slug}`, slug, name, kind, status: "active" });
const TOOLS = [row("alpha-code", "Alpha Code", "harness"), row("beta-model", "Beta Model", "model")];

async function tags(article: { title?: unknown; toolMentions?: unknown }) {
  const { buildToolCatalogue, articleToolTags } = await load();
  return articleToolTags(article, buildToolCatalogue(TOOLS)).map((t) => t.slug);
}

const withSecond = async (relevance: unknown) =>
  tags({
    toolMentions: [
      { name: "Alpha Code", relevance: 1 },
      { name: "Beta Model", relevance },
    ],
  });

describe("second-kind tags need a minimum relevance (#285)", () => {
  it("exports the threshold as a number in (0, 1]", async () => {
    const { SECOND_KIND_TAG_MIN_RELEVANCE: t } = await load();
    expect(typeof t).toBe("number");
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThanOrEqual(1);
  });

  it("emits no tag for a weak second-kind mention", async () => {
    expect(await withSecond(0.1)).toEqual(["alpha-code"]);
  });

  it("emits the tag for a strong second-kind mention", async () => {
    expect(await withSecond(0.9)).toEqual(["alpha-code", "beta-model"]);
  });

  it("includes the threshold itself and excludes the value just under it", async () => {
    const { SECOND_KIND_TAG_MIN_RELEVANCE: t } = await load();
    expect(await withSecond(t)).toEqual(["alpha-code", "beta-model"]);
    expect(await withSecond(t - 0.01)).toEqual(["alpha-code"]);
  });

  it("emits no tag for a second-kind mention with no numeric relevance", async () => {
    expect(await withSecond(undefined)).toEqual(["alpha-code"]);
  });
});

describe("title-fill tags have no relevance basis (#285)", () => {
  it("does not tag a kind named only in the title", async () => {
    expect(
      await tags({ title: "Alpha Code adds Beta Model", toolMentions: [{ name: "Alpha Code", relevance: 1 }] })
    ).toEqual(["alpha-code"]);
  });

  it("does not add a second title tool when there are no mentions", async () => {
    expect(await tags({ title: "Alpha Code now runs Beta Model" })).toEqual(["alpha-code"]);
  });
});

describe("the primary tag is unchanged (#285)", () => {
  it("tags a low-relevance primary and a title-only primary as before", async () => {
    expect(await tags({ toolMentions: [{ name: "Beta Model", relevance: 0.1 }] })).toEqual(["beta-model"]);
    expect(await tags({ title: "Beta Model ships" })).toEqual(["beta-model"]);
  });

  it("still tags nothing when the top mention is not in the catalogue", async () => {
    expect(
      await tags({
        toolMentions: [
          { name: "Unknown Tool", relevance: 1 },
          { name: "Beta Model", relevance: 0.9 },
        ],
      })
    ).toEqual([]);
  });
});
