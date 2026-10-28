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
  { id: "t-claude-code", slug: "claude-code", name: "Claude Code", kind: "harness", status: "active" },
  // #314: the row keeps its slug; its name is Claude.AI after migration 0028.
  { id: "t-claude-artifacts", slug: "claude-artifacts", name: "Claude.AI", kind: "productivity", status: "active" },
  { id: "t-cursor", slug: "cursor", name: "Cursor", kind: "harness", status: "active" },
  { id: "t-devin", slug: "devin", name: "Devin", kind: "harness", status: "active" },
  { id: "t-copilot", db_id: "uuid-copilot", slug: "github-copilot", name: "GitHub Copilot", kind: "harness", status: "active" },
  { id: "t-gemini", slug: "gemini-code-assist", name: "Gemini Code Assist", kind: "harness", status: "active" },
  { id: "t-v0", slug: "v0-vercel", name: "v0", kind: "harness", status: "active" },
  { id: "t-windsurf", slug: "windsurf", name: "Windsurf", kind: "harness", status: "active" },
  { id: "t-bolt", slug: "bolt-new", name: "Bolt.new", kind: "harness", status: "active" },
  // Catalogue tools named with ordinary English words (critic probes, #109).
  { id: "t-continue", slug: "continue", name: "Continue", kind: "harness", status: "active" },
  { id: "t-warp", slug: "warp", name: "Warp", kind: "harness", status: "active" },
  { id: "t-harness", slug: "harness", name: "Harness", kind: "harness", status: "active" },
  { id: "t-amp", slug: "amp", name: "Amp", kind: "harness", status: "active" },
  { id: "t-ai", slug: "ai", name: "AI", kind: "harness", status: "active" },
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

  it("falls back to whole-word title matches of multi-word or non-letter names, in title order", async () => {
    expect(await resolve({ title: "Using Claude Code daily", toolMentions: [] })).toEqual([
      "claude-code",
    ]);
    expect(
      await resolve({
        title: "Gemini Code Assist vs Claude Code vs Cursor",
        toolMentions: [{ name: "Artcraft" }],
      })
    ).toEqual(["gemini-code-assist", "claude-code"]);
    expect(await resolve({ title: "Claude Code's new hooks", toolMentions: [] })).toEqual([
      "claude-code",
    ]);
    expect(await resolve({ title: "v0 launches templates" })).toEqual(["v0-vercel"]);
    expect(await resolve({ title: "Bolt.new adds deploys" })).toEqual(["bolt-new"]);
  });

  // #109 critic probes: names that are ordinary English words never match a
  // title, in the headline's own case or in Title Case.
  it.each([
    "Developers continue to adopt agents",
    "Developers Continue To Adopt Agents",
    "Moving at warp speed",
    "Moving At Warp Speed",
    "How to harness agents in CI",
    "How To Harness Agents In CI",
    "Amp up your workflow",
    "Amp Up Your Workflow",
    "What AI means for developers",
    "What AI Means For Developers",
  ])("gives no attribution for the headline %j", async (title) => {
    expect(await resolve({ title, toolMentions: [] })).toEqual([]);
  });

  it("matches title names case-sensitively and never by slug", async () => {
    for (const title of ["using claude code daily", "Using claude-code daily", "CLAUDE CODE ships"]) {
      expect(await resolve({ title, toolMentions: [] }), title).toEqual([]);
    }
  });

  it("still attributes a single-word name through a mention", async () => {
    expect(await resolve({ title: "Moving at warp speed", toolMentions: [{ name: "Warp" }] })).toEqual([
      "warp",
    ]);
    expect(await resolve({ title: "x", toolMentions: [{ name: "?", toolId: "t-continue" }] })).toEqual([
      "continue",
    ]);
    expect(await resolve({ title: "x", toolMentions: ["harness"] })).toEqual(["harness"]);
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
      title: "Claude Code vs GitHub Copilot",
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

  // #314: Claude Artifacts is renamed Claude.AI with its slug kept; both names and the slug resolve.
  it("resolves Claude.AI, claude.ai and the old name Claude Artifacts to the claude-artifacts row (#314)", async () => {
    for (const name of ["Claude.AI", "claude.ai", "Claude Artifacts", "claude artifacts", "claude-artifacts"]) {
      expect(await resolve({ title: "x", toolMentions: [{ name }] }), name).toEqual(["claude-artifacts"]);
    }
    expect(await resolve({ title: "Claude.AI adds file creation", toolMentions: [] })).toEqual(["claude-artifacts"]);
    expect(await resolve({ title: "Claude Artifacts gets sharing", toolMentions: [] })).toEqual(["claude-artifacts"]);
  });

  it("does not alias Claude Artifacts when the row is not in the catalogue (#314)", async () => {
    const { buildToolCatalogue, resolveArticleTools } = await load();
    const catalogue = buildToolCatalogue(TOOLS.filter((t) => t.slug !== "claude-artifacts"));
    expect(resolveArticleTools({ title: "x", toolMentions: [{ name: "Claude Artifacts" }] }, catalogue)).toEqual([]);
  });
});
