import { describe, expect, it } from "vitest";

/**
 * Regression tests for #109 — news articles are attributed only to tools in
 * the tool catalogue.
 *
 * Why: the news routes matched titles against a hand-kept list of 15 coarse
 * slugs ("claude", "gemini", "replit-ai"), none of which matched the catalogue,
 * and ignored the `toolId` every stored mention carries.
 * What: the resolver is fed a fixture catalogue. Each case pins one rule:
 * `toolId` first, then an exact name or slug, then whole-word title matches;
 * no fuzzy or partial match; every returned tool is a catalogue row.
 * The module is imported inside each test so that, on a tree without it, each
 * case fails on its own rather than the file failing to load.
 * Test: `npx vitest run tests/unit/news-tool-resolver-109.test.ts`. No database
 * access, no network.
 */

const load = () => import("../../lib/news-tool-resolver");

const TOOLS = [
  { id: "t-claude-code", slug: "claude-code", name: "Claude Code" },
  { id: "t-claude-artifacts", slug: "claude-artifacts", name: "Claude Artifacts" },
  { id: "t-cursor", slug: "cursor", name: "Cursor" },
  { id: "t-devin", slug: "devin", name: "Devin" },
  { id: "t-copilot", db_id: "uuid-copilot", slug: "github-copilot", name: "GitHub Copilot" },
  { id: "t-gemini", slug: "gemini-code-assist", name: "Gemini Code Assist" },
  { id: "t-v0", slug: "v0-vercel", name: "v0" },
  { id: "t-windsurf", slug: "windsurf", name: "Windsurf" },
];

async function resolve(article: { title?: unknown; toolMentions?: unknown }) {
  const { buildToolCatalogue, resolveArticleTools } = await load();
  return resolveArticleTools(article, buildToolCatalogue(TOOLS)).map((t) => t.slug);
}

describe("resolveArticleTools (#109)", () => {
  it("resolves a mention by its toolId even when its name is not a catalogue name", async () => {
    const slugs = await resolve({
      title: "Google ships agent mode",
      toolMentions: [{ name: "Google Gemini Code Assist", toolId: "t-gemini" }],
    });
    expect(slugs).toEqual(["gemini-code-assist"]);
  });

  it("prefers the toolId over the mention name", async () => {
    const slugs = await resolve({
      title: "An editor update",
      toolMentions: [{ name: "Cursor", toolId: "t-windsurf" }],
    });
    expect(slugs).toEqual(["windsurf"]);
  });

  it("matches a toolId against the row UUID and a string mention against ids", async () => {
    expect(await resolve({ title: "x", toolMentions: [{ name: "?", toolId: "uuid-copilot" }] })).toEqual([
      "github-copilot",
    ]);
    expect(await resolve({ title: "x", toolMentions: ["t-devin"] })).toEqual(["devin"]);
  });

  it("matches a mention name or slug exactly, ignoring case, in mention order", async () => {
    const slugs = await resolve({
      title: "Roundup",
      toolMentions: [{ name: "github copilot" }, { tool: "CLAUDE-CODE" }, " Cursor "],
    });
    expect(slugs).toEqual(["github-copilot", "claude-code", "cursor"]);
  });

  it("never matches a mention name partially", async () => {
    // "Claude" is a prefix of two catalogue names; "Google Gemini Code Assist"
    // contains one. Neither is that tool.
    expect(await resolve({ title: "x", toolMentions: [{ name: "Claude" }] })).toEqual([]);
    expect(
      await resolve({ title: "x", toolMentions: [{ name: "Google Gemini Code Assist" }] })
    ).toEqual([]);
  });

  it("drops an unknown mention and keeps the known ones", async () => {
    const slugs = await resolve({
      title: "Artcraft and Devin",
      toolMentions: [{ name: "Artcraft" }, "Devin"],
    });
    expect(slugs).toEqual(["devin"]);
  });

  it("falls back to whole-word title matches, in title order, longest name first", async () => {
    expect(await resolve({ title: "Using Claude Code daily", toolMentions: [] })).toEqual([
      "claude-code",
    ]);
    expect(
      await resolve({ title: "Cursor vs Claude Code vs Devin Desktop", toolMentions: [{ name: "Artcraft" }] })
    ).toEqual(["cursor", "claude-code", "devin"]);
    expect(await resolve({ title: "Cursor's new agent", toolMentions: [] })).toEqual(["cursor"]);
    expect(await resolve({ title: "v0 launches templates" })).toEqual(["v0-vercel"]);
  });

  it("never matches a title partially", async () => {
    for (const title of [
      "I like cursory reviews",
      "coding with claudecode",
      "The rev0lution in prototyping",
      "Claude gets a new model",
      "Gemini Code helps me",
    ]) {
      expect(await resolve({ title, toolMentions: [] }), title).toEqual([]);
    }
  });

  it("ignores the title when a mention resolves", async () => {
    const slugs = await resolve({
      title: "Cursor vs Devin",
      toolMentions: [{ name: "Windsurf" }],
    });
    expect(slugs).toEqual(["windsurf"]);
  });

  it("returns only catalogue slugs, whatever the input", async () => {
    const catalogueSlugs = new Set(TOOLS.map((t) => t.slug));
    const inputs = [
      { title: "Claude, Gemini, Copilot and Replit Agent", toolMentions: ["claude", "gemini", "replit-ai", "bolt"] },
      { title: "", toolMentions: [{ name: "Amazon CodeWhisperer" }, { toolId: "nope" }, null, 42] },
      { title: undefined, toolMentions: "not-an-array" },
    ];
    for (const input of inputs) {
      for (const slug of await resolve(input)) expect(catalogueSlugs.has(slug), slug).toBe(true);
    }
    expect(await resolve(inputs[0]!)).toEqual([]);
  });
});
