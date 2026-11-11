import { beforeEach, describe, expect, it, vi } from "vitest";
import golden from "../fixtures/tool-mapper-golden-187.json";

/**
 * #187: the catalogue lookup keeps every alias of the old `ToolMapper`.
 *
 * Why: dropping the aliases would change which tool an article's ranking change lands
 * on, and so public scores. The ruling is that mapping output stays the same.
 * What: `tests/fixtures/tool-mapper-golden-187.json` holds the output of both old
 * mappers on origin/main c2cd51d8 for every alias key (and its upper-case form),
 * every catalogue name and some unknown names. For each row the new lookup, run
 * against a catalogue holding every old target, must return the old output when the
 * old output came from a table (alias or known name). A row the old mapper answered
 * by fuzzy substring or word overlap is not kept: it must come back unmapped.
 * Test: `npx vitest run tests/unit/tool-mention-aliases-187.test.ts`. No database.
 */

import { buildToolCatalogue } from "../../lib/news-tool-resolver";
import { loggers } from "../../lib/logger";
import { mapToolMentionsToCatalogue } from "../../lib/services/tool-mention-catalogue";
import { TOOL_ALIASES, unresolvedAliasTargets } from "../../lib/services/tool-mention-aliases";

type Via = "known" | "alias" | "case" | "fuzzy" | "none";
type Row = { input: string; ingestion: { out: string; via: Via }; service: { out: string; via: Via } };
const rows = golden.rows as Row[];

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const catalogueOf = (names: string[]) =>
  buildToolCatalogue(names.map((name) => ({ id: `t-${slug(name)}`, slug: slug(name), name, kind: "other", status: "active" })));

const targets = [...new Set(Object.values(TOOL_ALIASES))];
const mention = (tool: string) => ({ tool });

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(loggers.api, "warn").mockImplementation(() => undefined);
});

describe("the alias lookup matches the old mapper's table output (#187)", () => {
  it("returns the old output for every table-derived row, and nothing for a fuzzy one", async () => {
    const loader = async () => catalogueOf(targets);
    const wrong: string[] = [];
    for (const row of rows) {
      const { mentions } = await mapToolMentionsToCatalogue([mention(row.input)], loader);
      const fromTable = row.service.via === "alias" || row.service.via === "known" || row.service.via === "case";
      const expected = fromTable ? row.service.out : row.input;
      if (mentions[0]?.tool !== expected) wrong.push(`${JSON.stringify(row.input)}: got ${mentions[0]?.tool}, want ${expected}`);
    }
    expect(wrong).toEqual([]);
  });

  it("agrees with the ingestion copy on every row that copy answered from its table", async () => {
    const loader = async () => catalogueOf(targets);
    const table = rows.filter((r) => r.ingestion.via === "alias" || r.ingestion.via === "known");
    expect(table.length).toBeGreaterThanOrEqual(150);
    for (const row of table) {
      const { mentions } = await mapToolMentionsToCatalogue([mention(row.input)], loader);
      expect(mentions[0]?.tool, row.input).toBe(row.ingestion.out);
    }
  });

  it("keeps all 153 aliases of the two old copies", () => {
    const tableInputs = new Set(rows.filter((r) => r.service.via !== "fuzzy" && r.service.via !== "none").map((r) => r.input));
    expect(Object.keys(TOOL_ALIASES)).toHaveLength(153);
    for (const key of Object.keys(TOOL_ALIASES)) expect(tableInputs.has(key), key).toBe(true);
  });

  it("does not read a prototype key as an alias", async () => {
    const { report } = await mapToolMentionsToCatalogue([mention("constructor"), mention("toString")], async () => catalogueOf(targets));
    expect(report.unmappedNames).toEqual(["constructor", "toString"]);
  });
});

describe("an alias whose target is not an active catalogue row (#187)", () => {
  it("stays unmapped, is reported and warn-logged, and never falls through to another row", async () => {
    // The catalogue has a model row named "Claude" but no "Claude Code" row.
    const loader = async () => catalogueOf(["Claude", "Cursor"]);
    const { mentions, report } = await mapToolMentionsToCatalogue([mention("Claude"), mention("Cursor")], loader);
    expect(mentions.map((m) => m.tool)).toEqual(["Claude", "Cursor"]);
    expect(report).toMatchObject({
      mapped: 1,
      unmappedNames: ["Claude"],
      unresolvedAliases: [{ alias: "claude", target: "Claude Code" }],
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("Alias target is not an active catalogue tool");
  });

  it("lists the aliases whose target a catalogue lacks", () => {
    const catalogue = catalogueOf(targets.filter((t) => t !== "Bito"));
    expect(unresolvedAliasTargets(catalogue.byKey)).toEqual([
      ["bito", "Bito"],
      ["bito ai", "Bito"],
    ]);
  });
});
