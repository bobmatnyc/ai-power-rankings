import { describe, expect, it } from "vitest";

/**
 * Regression tests for #109 — an article's primary tool follows mention relevance.
 *
 * Why: the primary tool was the first mention in stored order that resolved to
 * a catalogue tool. When the article's subject is not in the catalogue, a
 * passing competitor mention became its tool: "Manus Secures $500M Funding"
 * (Manus at relevance 1, not catalogued) was listed on the Cursor page through
 * a 0.3 "competitor" mention.
 * What: the cases go through `groupNewsByPrimaryTool`, the tool page's grouping,
 * which reads the same primary tool as `/api/news` (`tool_slug`) and
 * `/api/news/[slug]` (`tool`). The highest-relevance mention competes alone;
 * ties go to stored order; an unresolved top mention leaves no primary tool.
 * Test: `npx vitest run tests/unit/news-primary-tool-109.test.ts`. No database
 * access, no network.
 */

const TOOLS = [
  { id: "t-cursor", slug: "cursor", name: "Cursor" },
  { id: "t-lovable", slug: "lovable", name: "Lovable" },
  { id: "t-replit", slug: "replit-agent", name: "Replit Agent" },
  { id: "t-claude-code", slug: "claude-code", name: "Claude Code" },
];

type Mention = { name: string; toolId?: string; relevance?: number };

/** The slug whose Related news lists the article, or `null` when none does. */
async function primarySlug(toolMentions: unknown, title = "An article"): Promise<string | null> {
  const { buildToolCatalogue } = await import("../../lib/news-tool-resolver");
  const { groupNewsByPrimaryTool } = await import("../../lib/tools/tool-news");
  const row = {
    id: "a1",
    slug: "a1",
    title,
    sourceName: null,
    publishedDate: new Date("2026-10-01T00:00:00Z"),
    createdAt: new Date("2026-10-01T00:00:00Z"),
    toolMentions,
  };
  const grouped = groupNewsByPrimaryTool([row], buildToolCatalogue(TOOLS), 5);
  return Object.entries(grouped).find(([, items]) => items.some((i) => i.id === "a1"))?.[0] ?? null;
}

describe("primary tool by mention relevance (#109)", () => {
  it("gives no primary tool when the relevance-1 subject is uncatalogued (Manus)", async () => {
    const mentions: Mention[] = [
      { name: "Manus", relevance: 1 },
      { name: "Manus 2.0", relevance: 0.8 },
      { name: "Cue", relevance: 0.7 },
      { name: "Cursor", toolId: "t-cursor", relevance: 0.3 },
      { name: "Lovable", toolId: "t-lovable", relevance: 0.3 },
      { name: "Replit Agent", toolId: "t-replit", relevance: 0.3 },
    ];
    expect(await primarySlug(mentions)).toBeNull();
  });

  it("breaks a relevance tie by stored mention order", async () => {
    const mentions: Mention[] = [
      { name: "Replit Agent", toolId: "t-replit", relevance: 0.5 },
      { name: "Lovable", toolId: "t-lovable", relevance: 0.9 },
      { name: "Cursor", toolId: "t-cursor", relevance: 0.9 },
    ];
    expect(await primarySlug(mentions)).toBe("lovable");
  });

  it("never makes a 0.3 mention primary when an unresolved 0.8 mention exists", async () => {
    const mentions: Mention[] = [
      { name: "Cursor", toolId: "t-cursor", relevance: 0.3 },
      { name: "Uncatalogued Editor", relevance: 0.8 },
    ];
    expect(await primarySlug(mentions)).toBeNull();
  });

  it("gives no primary tool when an unresolved 0.9 mention outranks a resolved 0.6 one", async () => {
    const mentions: Mention[] = [
      { name: "Claude Code", toolId: "t-claude-code", relevance: 0.6 },
      { name: "Pi 1.0", relevance: 0.9 },
    ];
    expect(await primarySlug(mentions)).toBeNull();
  });

  it("picks the highest-relevance mention even when it is stored last", async () => {
    const mentions: Mention[] = [
      { name: "Cursor", toolId: "t-cursor", relevance: 0.4 },
      { name: "Replit Agent", toolId: "t-replit", relevance: 1 },
    ];
    expect(await primarySlug(mentions)).toBe("replit-agent");
  });

  it("keeps a resolved top mention primary (control)", async () => {
    const mentions: Mention[] = [
      { name: "Claude Code", toolId: "t-claude-code", relevance: 1 },
      { name: "Cursor", toolId: "t-cursor", relevance: 0.3 },
    ];
    expect(await primarySlug(mentions)).toBe("claude-code");
  });

  it("ranks a mention without a relevance below every scored mention", async () => {
    expect(
      await primarySlug([{ name: "Cursor", toolId: "t-cursor" }, { name: "Lovable", relevance: 0.1 }])
    ).toBe("lovable");
    // No mention carries a score: stored order among those that resolve.
    expect(await primarySlug([{ name: "Unknown" }, "t-replit", { name: "Cursor" }])).toBe("replit-agent");
  });

  it("reads the title only when there are no mentions", async () => {
    expect(await primarySlug([], "Claude Code ships hooks")).toBe("claude-code");
    // The top mention is unresolved, so the title does not supply a primary tool.
    expect(await primarySlug([{ name: "Artcraft", relevance: 1 }], "Claude Code ships hooks")).toBeNull();
  });

  it("leaves the full resolved list unchanged", async () => {
    const { buildToolCatalogue, resolveArticleTools } = await import("../../lib/news-tool-resolver");
    const slugs = resolveArticleTools(
      {
        title: "x",
        toolMentions: [
          { name: "Manus", relevance: 1 },
          { name: "Cursor", toolId: "t-cursor", relevance: 0.3 },
          { name: "Lovable", toolId: "t-lovable", relevance: 0.3 },
        ],
      },
      buildToolCatalogue(TOOLS)
    ).map((t) => t.slug);
    expect(slugs).toEqual(["cursor", "lovable"]);
  });
});
