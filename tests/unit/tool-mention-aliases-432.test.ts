import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #432: the owner's rulings (D35) on the 42 suspect tool aliases.
 *
 * Why: the suspect aliases sent model, vendor and common-word names to one product
 * (e.g. "claude opus" to Claude Code), which moved that product's score. D35 accepts
 * the per-alias table on #432 and also drops `chatgpt`.
 * What: 34 aliases leave the table, so they no longer map through it; 8 Claude aliases
 * map to the Claude model rows or Claude.AI; a sample of unruled aliases keeps its target.
 * Test: `npx vitest run tests/unit/tool-mention-aliases-432.test.ts`. No database.
 */

import { buildToolCatalogue } from "../../lib/news-tool-resolver";
import { loggers } from "../../lib/logger";
import { mapToolMentionsToCatalogue } from "../../lib/services/tool-mention-catalogue";
import { TOOL_ALIASES } from "../../lib/services/tool-mention-aliases";

const DROPPED = [
  "gpt-4",
  "gpt-4o",
  "gpt-4-turbo",
  "chatgpt",
  "gpt-5",
  "gpt-3.5",
  "gpt-3",
  "openai",
  "claude",
  "claude 3",
  "claude 3.5",
  "claude 4",
  "anthropic",
  "gemini",
  "gemini pro",
  "gemini ultra",
  "gemini 1.5",
  "gemini 2.0",
  "gemini 2.5",
  "gemini 2.5 pro",
  "google ai",
  "bard",
  "microsoft copilot",
  "agent 3",
  "cognition",
  "cognition ai",
  "sourcegraph",
  "magic",
  "pieces",
  "sweep",
  "menlo",
  "menlo security",
  "factory",
  "genie",
] as const;

/** Alias -> the catalogue row slug it must now reach. */
const RETARGETED: Record<string, string> = {
  "claude sonnet": "claude-sonnet",
  "claude 3.5 sonnet": "claude-sonnet",
  "claude 4 sonnet": "claude-sonnet",
  "claude opus": "claude-opus",
  "claude opus 4": "claude-opus",
  "claude opus 4.1": "claude-opus",
  "claude haiku": "claude-haiku",
  "claude canvas": "claude-artifacts",
};

/** Unruled aliases and the row name each must still reach. */
const UNTOUCHED: Record<string, string> = {
  "chatgpt canvas": "ChatGPT Canvas",
  codex: "OpenAI Codex",
  "claude code": "Claude Code",
  "claude artifacts": "Claude.AI",
  "gemini code assist": "Google Gemini Code Assist",
  copilot: "GitHub Copilot",
  "replit agent 3": "Replit Agent",
  devin: "Devin",
  "sourcegraph cody": "Sourcegraph Cody",
  "magic.dev": "Magic",
  "pieces for developers": "Pieces",
  "sweep ai": "Sweep",
  "factory ai": "Factory",
  cosine: "Cosine Genie",
};

// The prod rows the retargets reach (slug, name), as /api/tools served them on 2026-11-11.
const rows = [
  { slug: "claude-sonnet", name: "Claude Sonnet", kind: "model" },
  { slug: "claude-opus", name: "Claude Opus", kind: "model" },
  { slug: "claude-haiku", name: "Claude Haiku 5.5", kind: "model" },
  { slug: "claude-artifacts", name: "Claude.AI", kind: "productivity" },
  { slug: "claude-code", name: "Claude Code", kind: "harness" },
  { slug: "chatgpt-canvas", name: "ChatGPT Canvas", kind: "productivity" },
  { slug: "openai-codex", name: "OpenAI Codex", kind: "harness" },
  { slug: "gemini-code-assist", name: "Google Gemini Code Assist", kind: "harness" },
  { slug: "github-copilot", name: "GitHub Copilot", kind: "harness" },
  { slug: "replit-agent", name: "Replit Agent", kind: "harness" },
  { slug: "devin", name: "Devin", kind: "harness" },
  { slug: "sourcegraph-cody", name: "Sourcegraph Cody", kind: "harness" },
  { slug: "cosine-genie", name: "Cosine Genie", kind: "harness" },
  { slug: "magic-dev", name: "Magic", kind: "harness" },
  { slug: "pieces-app", name: "Pieces", kind: "harness" },
  { slug: "sweep-ai", name: "Sweep", kind: "harness" },
  { slug: "factory-ai", name: "Factory", kind: "harness" },
];
const loader = async () => buildToolCatalogue(rows.map((r) => ({ ...r, id: `t-${r.slug}`, status: "active" })));
const nameOf = (slug: string) => rows.find((r) => r.slug === slug)?.name;

beforeEach(() => {
  vi.spyOn(loggers.api, "warn").mockImplementation(() => undefined);
});

describe("the dropped suspect aliases (#432)", () => {
  it("drops 34 aliases, chatgpt among them", () => {
    expect(DROPPED).toHaveLength(34);
    expect(DROPPED).toContain("chatgpt");
  });

  it.each(DROPPED)("%s is not in the alias table", (alias) => {
    expect(Object.hasOwn(TOOL_ALIASES, alias)).toBe(false);
  });

  it("chatgpt no longer reaches ChatGPT Canvas", async () => {
    const { mentions, report } = await mapToolMentionsToCatalogue([{ tool: "ChatGPT" }], loader);
    expect(mentions[0]?.tool).toBe("ChatGPT");
    expect(report.unmappedNames).toEqual(["ChatGPT"]);
  });

  it("each dropped alias stays unmapped against a catalogue holding every old target but no row of that name", async () => {
    // The catalogue above has rows named Magic, Pieces, Sweep and Factory under other slugs;
    // the bare words must not reach them through the table.
    const wrong: string[] = [];
    for (const alias of DROPPED) {
      const { mentions } = await mapToolMentionsToCatalogue([{ tool: alias }], async () =>
        buildToolCatalogue(
          rows
            .filter((r) => r.name.toLowerCase() !== alias)
            .map((r) => ({ ...r, id: `t-${r.slug}`, status: "active" }))
        )
      );
      if (mentions[0]?.tool !== alias) wrong.push(`${alias}: got ${mentions[0]?.tool}`);
    }
    expect(wrong).toEqual([]);
  });
});

describe("the retargeted Claude aliases (#432)", () => {
  it.each(Object.entries(RETARGETED))("%s maps to %s", async (alias, slug) => {
    const { mentions, report } = await mapToolMentionsToCatalogue([{ tool: alias.toUpperCase() }], loader);
    expect(report.unresolvedAliases).toEqual([]);
    expect(mentions[0]?.tool).toBe(nameOf(slug));
  });
});

describe("unruled aliases keep their targets (#432)", () => {
  it.each(Object.entries(UNTOUCHED))("%s still maps to %s", async (alias, name) => {
    expect(TOOL_ALIASES[alias]).toBe(name);
    const { mentions } = await mapToolMentionsToCatalogue([{ tool: alias }], loader);
    expect(mentions[0]?.tool).toBe(name);
  });
});
