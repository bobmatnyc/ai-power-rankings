/**
 * #183 B-2: the tool_links read path, the writer and the loader script on PGlite.
 *
 * Why: the ordering, the active filter, the kind refusal and the all-or-nothing load
 *   are SQL and transaction behaviour; a mocked driver would only echo the test's guess.
 * What: each block builds a fresh PGlite database at migration 0016 with a small set of
 *   tools (`linkedDb`), then drives the repository functions and `loadToolLinks` through
 *   Drizzle. Every refusal asserts the typed code and that `tool_links` is still empty.
 * Test: `npx vitest run tests/unit/tool-links-repository-183.test.ts`. No server, no network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getHarnessesForModel,
  getModelsForHarness,
  type ToolLinkInput,
  ToolLinkRefusedError,
  type ToolLinksDb,
  upsertToolLink,
} from "../../lib/db/repositories/tool-links.repository";
import { TOOL_LINK_KIND_VIOLATIONS_SQL } from "../../lib/db/tool-links";
import { loadToolLinks, parseArgs, parseSeed } from "../../scripts/load-tool-links";
import { type FixtureTool, linkedDb } from "./fixtures/tool-links-183-fixture";

const TOOLS: FixtureTool[] = [
  { slug: "claude-code", name: "Claude Code", kind: "harness" },
  { slug: "cursor", name: "Cursor", kind: "harness" },
  { slug: "windsurf", name: "Windsurf", kind: "harness" },
  { slug: "aider", name: "Aider", kind: "harness", status: "inactive" },
  { slug: "opus-4-6", name: "Opus 4.6", kind: "model" },
  { slug: "sonnet-4-5", name: "Sonnet 4.5", kind: "model" },
  { slug: "alpha-model", name: "Alpha", kind: "model" },
  { slug: "retired-model", name: "Retired", kind: "model", status: "deprecated" },
  { slug: "anthropic", name: "Anthropic", kind: "other" },
];

let pg: PGlite;
let db: ToolLinksDb;

beforeEach(async () => {
  ({ pg, db } = await linkedDb(TOOLS));
});
afterEach(async () => {
  await pg.close();
});

const linkCount = async () => (await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM public."tool_links"`)).rows[0]!.n;
const toolId = async (slug: string) =>
  (await pg.query<{ id: string }>(`SELECT id FROM public."tools" WHERE slug = $1`, [slug])).rows[0]!.id;

async function rawLink(model: string, harness: string, relation: string) {
  await pg.query(`INSERT INTO public."tool_links" (model_tool_id, harness_tool_id, relation) VALUES ($1, $2, $3)`, [
    await toolId(model),
    await toolId(harness),
    relation,
  ]);
}

describe("#183 repository reads", () => {
  beforeEach(async () => {
    await rawLink("sonnet-4-5", "claude-code", "supports");
    await rawLink("alpha-model", "claude-code", "supports");
    await rawLink("opus-4-6", "claude-code", "native");
    await rawLink("retired-model", "claude-code", "native");
    await rawLink("opus-4-6", "cursor", "supports");
    await rawLink("opus-4-6", "aider", "supports");
  });

  it("lists a harness's models native first, then by name, by slug or by id", async () => {
    const bySlug = await getModelsForHarness(db, { slug: "claude-code" });
    // Opus sorts after Alpha by name, but native comes first; the deprecated model is dropped.
    expect(bySlug.map((t) => [t.slug, t.relation])).toEqual([
      ["opus-4-6", "native"],
      ["alpha-model", "supports"],
      ["sonnet-4-5", "supports"],
    ]);
    expect(bySlug[0]).toEqual({ id: await toolId("opus-4-6"), slug: "opus-4-6", name: "Opus 4.6", relation: "native", sourceUrl: null });
    expect(await getModelsForHarness(db, { id: await toolId("claude-code") })).toEqual(bySlug);
  });

  it("lists a model's active harnesses native first, then by name", async () => {
    const harnesses = await getHarnessesForModel(db, { slug: "opus-4-6" });
    expect(harnesses.map((t) => [t.slug, t.relation])).toEqual([
      ["claude-code", "native"],
      ["cursor", "supports"],
    ]); // aider is inactive
  });

  it("returns [] for no links, an unknown tool, or a tool of the other kind", async () => {
    expect(await getModelsForHarness(db, { slug: "windsurf" })).toEqual([]);
    expect(await getHarnessesForModel(db, { slug: "alpha-model" })).toEqual([{ id: await toolId("claude-code"), slug: "claude-code", name: "Claude Code", relation: "supports", sourceUrl: null }]);
    expect(await getModelsForHarness(db, { slug: "no-such-tool" })).toEqual([]);
    expect(await getModelsForHarness(db, { id: "00000000-0000-0000-0000-000000000000" })).toEqual([]);
    expect(await getModelsForHarness(db, { slug: "opus-4-6" })).toEqual([]);
    expect(await getHarnessesForModel(db, { slug: "claude-code" })).toEqual([]);
  });

  it("hides a link whose model side stopped being a model after it was written", async () => {
    await pg.query(`UPDATE public."tools" SET kind = 'other' WHERE slug = 'alpha-model'`);
    expect((await getModelsForHarness(db, { slug: "claude-code" })).map((t) => t.slug)).toEqual(["opus-4-6", "sonnet-4-5"]);
  });
});

describe("#183 writer", () => {
  const opusOnClaudeCode: ToolLinkInput = {
    modelSlug: "opus-4-6",
    harnessSlug: "claude-code",
    relation: "native",
    sourceUrl: "https://example.com/a",
  };
  const updatedAt = async () =>
    (await pg.query<{ t: string }>(`SELECT updated_at::text AS t FROM public."tool_links"`)).rows.map((r) => r.t);

  it("inserts a link, then a same-data re-run writes nothing and keeps updated_at", async () => {
    const first = await upsertToolLink(db, opusOnClaudeCode);
    expect(first.outcome).toBe("inserted");
    const rows = (await pg.query(`SELECT id, relation, source_url FROM public."tool_links"`)).rows;
    expect(rows).toEqual([{ id: first.id, relation: "native", source_url: "https://example.com/a" }]);
    const stamp = await updatedAt();
    expect(await upsertToolLink(db, opusOnClaudeCode)).toEqual({ id: first.id, outcome: "unchanged" });
    expect(await linkCount()).toBe(1);
    expect(await updatedAt()).toEqual(stamp);
    expect((await pg.query(TOOL_LINK_KIND_VIOLATIONS_SQL)).rows).toEqual([]);
  });

  it("updates relation and source URL in place and advances updated_at", async () => {
    const first = await upsertToolLink(db, opusOnClaudeCode);
    await pg.query(`UPDATE public."tool_links" SET updated_at = '2026-01-01T00:00:00Z'`);
    const second = await upsertToolLink(db, { ...opusOnClaudeCode, relation: "supports", sourceUrl: null });
    expect(second).toEqual({ id: first.id, outcome: "updated" });
    const row = (
      await pg.query(`SELECT relation, source_url, updated_at > '2026-01-01T00:00:00Z'::timestamptz AS advanced FROM public."tool_links"`)
    ).rows;
    expect(row).toEqual([{ relation: "supports", source_url: null, advanced: true }]);
  });

  it.each<[string, Partial<ToolLinkInput>, string]>([
    ["an empty slug", { modelSlug: " " }, "empty_slug"],
    ["an unknown relation", { relation: "runs" }, "invalid_relation"],
    ["a self-link", { modelSlug: "claude-code", harnessSlug: "claude-code" }, "self_link"],
    ["an unknown model slug", { modelSlug: "no-such-model" }, "unknown_model_slug"],
    ["an unknown harness slug", { harnessSlug: "no-such-harness" }, "unknown_harness_slug"],
    ["a harness on the model side", { modelSlug: "cursor" }, "model_side_not_model"],
    ["a model on the harness side", { harnessSlug: "sonnet-4-5" }, "harness_side_not_harness"],
    ["a vendor row on the harness side", { harnessSlug: "anthropic" }, "harness_side_not_harness"],
  ])("refuses %s with a typed error and writes nothing", async (_label, override, code) => {
    const attempt = upsertToolLink(db, { ...opusOnClaudeCode, ...override });
    await expect(attempt).rejects.toBeInstanceOf(ToolLinkRefusedError);
    await expect(attempt).rejects.toMatchObject({ code });
    expect(await linkCount()).toBe(0);
  });

  it("refuses every link while all tools are kind='harness', as production is before 0017", async () => {
    await pg.query(`UPDATE public."tools" SET kind = 'harness'`);
    await expect(upsertToolLink(db, opusOnClaudeCode)).rejects.toMatchObject({ code: "model_side_not_model" });
    expect(await linkCount()).toBe(0);
  });
});

describe("#183 load-tool-links script", () => {
  const FIXTURES = path.resolve(__dirname, "fixtures/tool-links-183");
  const seed = (name: string) => parseSeed(name, readFileSync(path.join(FIXTURES, name), "utf8"));
  const run = async (name: string, apply: boolean) => {
    const lines: string[] = [];
    const code = await loadToolLinks(db, seed(name), apply, (l) => void lines.push(l));
    return { code, lines };
  };

  it("parses a dry run by default, --apply on request, and refuses bad arguments", () => {
    expect(parseArgs(["seed.csv"]).options).toEqual({ file: "seed.csv", apply: false });
    expect(parseArgs(["seed.csv", "--dry-run"]).options).toEqual({ file: "seed.csv", apply: false });
    expect(parseArgs(["--apply", "seed.csv"]).options).toEqual({ file: "seed.csv", apply: true });
    expect(parseArgs(["seed.csv", "--apply", "--dry-run"]).errors).toEqual(["--dry-run and --apply are exclusive"]);
    expect(parseArgs([]).errors).toEqual(["pass exactly one seed file path"]);
    expect(parseArgs(["seed.csv", "--force"]).errors).toEqual(["unknown flag --force"]);
  });

  it("parses the CSV and JSON seed shapes and rejects a wrong header", () => {
    expect(seed("good.csv")).toEqual([
      { modelSlug: "opus-4-6", harnessSlug: "claude-code", relation: "native", sourceUrl: "https://example.com/claude-code-models" },
      { modelSlug: "sonnet-4-5", harnessSlug: "claude-code", relation: "native", sourceUrl: null },
      { modelSlug: "opus-4-6", harnessSlug: "cursor", relation: "supports", sourceUrl: "https://example.com/cursor,models" },
    ]);
    expect(seed("one-bad-row.json")).toHaveLength(3);
    expect(() => parseSeed("x.csv", "model,harness\na,b\n")).toThrow(/CSV header must be/);
    expect(() => parseSeed("x.json", `{"model_slug":"a"}`)).toThrow(/must be an array/);
  });

  it("dry run prints the plan and writes nothing", async () => {
    const { code, lines } = await run("good.csv", false);
    expect(code).toBe(0);
    expect(lines).toContain("would insert: row 1 opus-4-6 -> claude-code (native)");
    expect(lines).toContain("dry run: nothing written (pass --apply to write)");
    expect(await linkCount()).toBe(0);
  });

  it("--apply writes every row, and a second --apply leaves them unchanged", async () => {
    expect((await run("good.csv", true)).code).toBe(0);
    expect(await linkCount()).toBe(3);
    const again = await run("good.csv", true);
    expect(again.code).toBe(0);
    expect(again.lines).toContain("will leave unchanged: row 2 sonnet-4-5 -> claude-code (native)");
    expect(await linkCount()).toBe(3);
  });

  it("--apply with one refused row exits 1 and writes nothing, not even the good rows", async () => {
    const { code, lines } = await run("one-bad-row.json", true);
    expect(code).toBe(1);
    expect(lines).toContain("REFUSED: row 3 cursor -> claude-code (supports): cursor has kind 'harness', not 'model'");
    expect(lines).toContain("--apply: nothing written because a row was refused");
    expect(await linkCount()).toBe(0);
  });

  it("refuses the same pair twice in one seed", async () => {
    const rows: ToolLinkInput[] = [
      { modelSlug: "opus-4-6", harnessSlug: "cursor", relation: "native" },
      { modelSlug: "opus-4-6", harnessSlug: "cursor", relation: "supports" },
    ];
    const lines: string[] = [];
    expect(await loadToolLinks(db, rows, true, (l) => void lines.push(l))).toBe(1);
    expect(lines).toContain("REFUSED: row 2 opus-4-6 -> cursor (supports): the same pair appears earlier in the seed");
    expect(await linkCount()).toBe(0);
  });

  it("rolls back every row when a write-time refusal follows a good write", async () => {
    // Plans pass; the kind changes before the write, as a concurrent backfill could do.
    const rows: ToolLinkInput[] = [
      { modelSlug: "opus-4-6", harnessSlug: "claude-code", relation: "native" },
      { modelSlug: "sonnet-4-5", harnessSlug: "cursor", relation: "supports" },
    ];
    const racing: ToolLinksDb = Object.create(db, {
      transaction: {
        value: async (fn: Parameters<ToolLinksDb["transaction"]>[0]) => {
          await pg.query(`UPDATE public."tools" SET kind = 'other' WHERE slug = 'cursor'`);
          return db.transaction(fn);
        },
      },
    });
    const lines: string[] = [];
    expect(await loadToolLinks(racing, rows, true, (l) => void lines.push(l))).toBe(1);
    expect(lines.at(-1)).toBe("--apply: rolled back, nothing written: cursor has kind 'other', not 'harness'");
    expect(await linkCount()).toBe(0);
  });
});
