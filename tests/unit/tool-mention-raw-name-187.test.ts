import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #187 / #432: a stored tool mention keeps the name the model emitted.
 *
 * Why: only the mapped name was stored, so the alias counts #432 needs
 * (how often `microsoft copilot` produced a mapping) could not be read back.
 * What: `mapToolMentionsToCatalogue` sets `raw_tool` (trimmed, original casing)
 * on every mention it returns, mapped or not, and keeps a `raw_tool` already
 * present when a mapped mention is mapped again (the preprocessed path).
 * `validateToolMention` / `cleanToolMentions`, which shape the stored row,
 * carry `raw_tool` through and add nothing to an old mention without one.
 * Test: `npx vitest run tests/unit/tool-mention-raw-name-187.test.ts`. No database.
 */

import { buildToolCatalogue } from "../../lib/news-tool-resolver";
import { loggers } from "../../lib/logger";
import { mapToolMentionsToCatalogue } from "../../lib/services/tool-mention-catalogue";
import { cleanToolMentions, validateToolMention } from "../../lib/types/article-analysis";

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const loader = async () =>
  buildToolCatalogue(
    ["GitHub Copilot", "Cursor"].map((name) => ({ id: `t-${slug(name)}`, slug: slug(name), name, kind: "other", status: "active" }))
  );
const mention = (tool: string) => ({ tool, context: "c", sentiment: 0.2, relevance: 0.9 });

beforeEach(() => {
  vi.spyOn(loggers.api, "warn").mockImplementation(() => undefined);
});

describe("mapToolMentionsToCatalogue keeps the model-emitted name in raw_tool (#187)", () => {
  it("an aliased mention stores the mapped name and the raw name", async () => {
    const { mentions, report } = await mapToolMentionsToCatalogue([mention("Microsoft Copilot")], loader);
    expect(report.mapped).toBe(1);
    expect(mentions[0]).toMatchObject({ tool: "GitHub Copilot", raw_tool: "Microsoft Copilot" });
  });

  it("an unmapped mention stores raw_tool and keeps its name", async () => {
    const { mentions, report } = await mapToolMentionsToCatalogue([mention("Unheard Of")], loader);
    expect(report.unmapped).toBe(1);
    expect(mentions[0]).toMatchObject({ tool: "Unheard Of", raw_tool: "Unheard Of" });
  });

  it("a direct-name mention stores raw_tool equal to its input, trimmed, casing kept", async () => {
    const { mentions } = await mapToolMentionsToCatalogue([mention("cursor"), mention("  Cursor ")], loader);
    expect(mentions.map((m) => [m.tool, m.raw_tool])).toEqual([
      ["Cursor", "cursor"],
      ["Cursor", "Cursor"],
    ]);
  });

  it("mapping an already-mapped mention again keeps the first raw_tool", async () => {
    const first = await mapToolMentionsToCatalogue([mention("Microsoft Copilot")], loader);
    const again = await mapToolMentionsToCatalogue(first.mentions, loader);
    expect(again.mentions[0]).toMatchObject({ tool: "GitHub Copilot", raw_tool: "Microsoft Copilot" });
  });
});

describe("the stored-row shape carries raw_tool (#187)", () => {
  it("validateToolMention preserves raw_tool next to the mapped name", () => {
    const stored = validateToolMention({ tool: "GitHub Copilot", raw_tool: "Microsoft Copilot", relevance: 0.9, sentiment: 0.2, context: "c" });
    expect(stored).toEqual({ name: "GitHub Copilot", raw_tool: "Microsoft Copilot", relevance: 0.9, sentiment: 0.2, context: "c" });
  });

  it("the ingestion write path (map, then cleanToolMentions) stores raw_tool for every mention", async () => {
    const { mentions } = await mapToolMentionsToCatalogue([mention("Microsoft Copilot"), mention("Unheard Of"), mention("Cursor")], loader);
    expect(cleanToolMentions(mentions).map((m) => [m.name, m.raw_tool])).toEqual([
      ["GitHub Copilot", "Microsoft Copilot"],
      ["Unheard Of", "Unheard Of"],
      ["Cursor", "Cursor"],
    ]);
  });

  it("an old row without raw_tool is cleaned exactly as before", () => {
    expect(validateToolMention({ name: "Cursor", relevance: 0.4, sentiment: 0, context: "" })).toEqual({
      name: "Cursor",
      relevance: 0.4,
      sentiment: 0,
      context: "",
    });
    expect(validateToolMention("Cursor")).toEqual({ name: "Cursor", relevance: 0.5, sentiment: 0, context: "" });
  });
});
