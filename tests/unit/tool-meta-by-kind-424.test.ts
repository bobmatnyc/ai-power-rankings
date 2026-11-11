import { describe, expect, it, vi } from "vitest";
import { generateToolMetadata } from "../../lib/seo/utils";

const row = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock("../../lib/tools/tool-page-request", () => ({ findToolBySlug: async () => row.current }));
import type { Tool } from "../../types/database";

/**
 * #424: the tool page title and description wording follow the tool's kind.
 *
 * Why: the template said "AI Coding Tool" for every tool, including ChatGPT (productivity).
 * What: calls `generateToolMetadata` per kind and asserts the title noun, the description
 * wording, the 160-character meta rule (#179) and the unchanged canonical and hreflang (#158).
 */
function tool(over: Partial<Tool>): Tool {
  return {
    id: "1",
    slug: "chatgpt",
    name: "ChatGPT",
    description: "A conversational assistant.",
    category: "ai-assistant",
    status: "active",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...over,
  };
}

describe("generateToolMetadata wording by kind (#424)", () => {
  it.each([
    ["harness", "AI Coding Tool", "other AI coding tools"],
    ["model", "AI Model", "other AI models"],
    ["productivity", "AI Productivity Tool", "other AI productivity tools"],
  ])("kind %s", (kind, noun, plural) => {
    const meta = generateToolMetadata(tool({ kind }), "en");
    expect(meta.title).toBe(`ChatGPT - ${noun} Review & Rankings`);
    expect(meta.description).toContain(`Compare ChatGPT with ${plural}.`);
    expect(String(meta.description).length).toBeLessThanOrEqual(160);
  });

  it.each([[undefined], [null], [""], ["widget"], ["constructor"], [42]])(
    "unknown or missing kind %j keeps the coding-tool wording",
    (kind) => {
      const meta = generateToolMetadata(tool({ kind }), "en");
      expect(meta.title).toBe("ChatGPT - AI Coding Tool Review & Rankings");
      expect(meta.description).toBe(
        "A conversational assistant. Compare ChatGPT with other AI coding tools. Features, pricing, performance benchmarks, and user reviews."
      );
      expect(`${meta.title} ${meta.description}`).not.toMatch(/undefined|null/);
    }
  );

  it("cuts a long tool description so the whole stays within 160 characters", () => {
    const long = "word ".repeat(120);
    const meta = generateToolMetadata(tool({ kind: "model", description: long }), "en");
    const description = String(meta.description);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toContain("Compare ChatGPT with other AI models.");
  });

  it("an empty tool description gives no leading space", () => {
    const meta = generateToolMetadata(tool({ kind: "productivity", description: "" }), "en");
    expect(String(meta.description).startsWith("Compare ChatGPT")).toBe(true);
  });

  it("the tool page metadata passes the catalogue row's kind through", async () => {
    row.current = { id: "1", slug: "chatgpt", name: "ChatGPT", category: "ai-assistant", status: "active", kind: "productivity", info: {} };
    const { generateToolMetadata: pageMetadata } = await import("../../app/[lang]/tools/[slug]/metadata");
    expect((await pageMetadata("chatgpt", "en")).title).toBe("ChatGPT - AI Productivity Tool Review & Rankings");
  });

  it("leaves the canonical and hreflang the same for every kind", () => {
    const base = generateToolMetadata(tool({}), "en").alternates;
    for (const kind of ["harness", "model", "productivity"]) {
      expect(generateToolMetadata(tool({ kind }), "en").alternates).toEqual(base);
    }
    expect(JSON.stringify(base)).toContain("x-default");
  });
});
