import { describe, expect, it, vi } from "vitest";

/**
 * #187 (M3-5): kind-aware tool matching for news articles.
 *
 * Why: the catalogue resolver (#109) treated every tools row alike. It could tag
 * an article to a retired per-version model row (D91 folded opus-4-6 and six
 * others into four family rows) or to an inactive row, and it gave an article
 * one tool, so an article about a harness running a model lost the model.
 * What: a synthetic catalogue with harness, model and other rows, the seven D91
 * redirect rows and non-active rows. Each case pins one rule: only active rows
 * are tag targets, a redirect row resolves to the active row it names, an
 * article gets one tag per kind, and the catalogue loader reads `kind` and
 * `status` from the table columns. Modules are imported inside each test so a
 * tree without them fails case by case.
 * Test: `npx vitest run tests/unit/news-kind-matcher-187.test.ts`. No database,
 * no network.
 */

const load = () => import("../../lib/news-tool-resolver");

type Row = {
  id: string;
  db_id?: string;
  slug: string;
  name: string;
  kind: string;
  status: string;
  redirect_to?: string;
};

const row = (slug: string, name: string, kind: string, status = "active", redirect_to?: string): Row => ({
  id: `t-${slug}`,
  slug,
  name,
  kind,
  status,
  ...(redirect_to ? { redirect_to } : {}),
});

/** D91 old slug -> family slug, as migration 0019 retired them. */
const D91: Array<[string, string, string]> = [
  ["opus-4-6", "Claude Opus 4.6", "claude-opus"],
  ["opus-4-5", "Claude Opus 4.5", "claude-opus"],
  ["sonnet-4-5", "Claude Sonnet 4.5", "claude-sonnet"],
  ["glm-5-0", "GLM-5.0", "glm"],
  ["zhipu-glm-5-0", "Zhipu GLM-5.0", "glm"],
  ["kimi-2-5", "Kimi 2.5", "kimi"],
  ["moonshot-kimi-2-5", "Moonshot Kimi 2.5", "kimi"],
];

const TOOLS: Row[] = [
  // Redirect rows first, so an index that keeps the first row per key would keep them.
  ...D91.map(([slug, name, family]) => row(slug, name, "model", "redirect", family)),
  row("claude-code", "Claude Code", "harness"),
  row("cursor", "Cursor", "harness"),
  row("claude-opus", "Claude Opus", "model"),
  row("claude-sonnet", "Claude Sonnet", "model"),
  row("glm", "GLM", "model"),
  row("kimi", "Kimi", "model"),
  row("model-context-protocol", "Model Context Protocol", "other"),
  row("trae-agent", "Trae Agent", "harness", "inactive"),
  row("stealth-editor", "Stealth Editor", "harness", "pending_review"),
  row("old-assistant", "Old Assistant", "harness", "deprecated"),
  row("ghost-tool", "Ghost Tool", "harness", "redirect", "no-such-slug"),
  row("trae-classic", "Trae Classic", "harness", "redirect", "trae-agent"),
];

type Article = { title?: unknown; toolMentions?: unknown };

async function tags(article: Article) {
  const { buildToolCatalogue, articleToolTags } = await load();
  return articleToolTags(article, buildToolCatalogue(TOOLS)).map((t) => `${t.slug}:${t.kind}`);
}

async function resolved(article: Article) {
  const { buildToolCatalogue, resolveArticleTools } = await load();
  return resolveArticleTools(article, buildToolCatalogue(TOOLS)).map((t) => t.slug);
}

async function primary(article: Article) {
  const { buildToolCatalogue, primaryArticleTool } = await load();
  return primaryArticleTool(article, buildToolCatalogue(TOOLS))?.slug ?? null;
}

describe("D91 survival: retired per-version names resolve to the family row (#187)", () => {
  it.each(D91)("%s resolves to %s by id, slug, name and title", async (slug, name, family) => {
    expect(await resolved({ toolMentions: [{ toolId: `t-${slug}`, name: "x" }] })).toEqual([family]);
    expect(await resolved({ toolMentions: [{ name: slug }] })).toEqual([family]);
    expect(await resolved({ toolMentions: [{ name }] })).toEqual([family]);
    expect(await resolved({ title: `Benchmarks for ${name} are in` })).toEqual([family]);
    expect(await primary({ toolMentions: [{ name, relevance: 1 }] })).toBe(family);
    expect(await tags({ toolMentions: [{ name, relevance: 1 }] })).toEqual([`${family}:model`]);
  });
});

describe("only active rows are tag targets (#187)", () => {
  it.each([
    ["inactive", "trae-agent", "Trae Agent"],
    ["pending_review", "stealth-editor", "Stealth Editor"],
    ["deprecated", "old-assistant", "Old Assistant"],
    ["redirect to a missing slug", "ghost-tool", "Ghost Tool"],
    ["redirect to an inactive row", "trae-classic", "Trae Classic"],
  ])("never tags a %s row", async (_status, slug, name) => {
    for (const article of [
      { toolMentions: [{ toolId: `t-${slug}`, name: "x", relevance: 1 }] },
      { toolMentions: [{ name: slug, relevance: 1 }] },
      { toolMentions: [{ name, relevance: 1 }] },
      { title: `${name} ships a new release` },
    ]) {
      expect(await resolved(article)).toEqual([]);
      expect(await primary(article)).toBeNull();
      expect(await tags(article)).toEqual([]);
    }
  });

  it("treats a row with no status as non-active", async () => {
    const { buildToolCatalogue, resolveArticleTools } = await load();
    const catalogue = buildToolCatalogue([{ id: "t-x", slug: "x-tool", name: "X Tool", kind: "harness" } as never]);
    expect(resolveArticleTools({ toolMentions: [{ name: "X Tool" }] }, catalogue)).toEqual([]);
  });
});

describe("an article gets one tag per kind (#187)", () => {
  it("tags both the harness and the model named in the mentions, each with its kind", async () => {
    const article = {
      title: "A new default model",
      toolMentions: [
        { toolId: "t-claude-code", name: "Claude Code", relevance: 1 },
        { name: "Claude Opus 4.6", relevance: 0.6 },
      ],
    };
    expect(await tags(article)).toEqual(["claude-code:harness", "claude-opus:model"]);
    expect(await primary(article)).toBe("claude-code");
  });

  it("tags only the first title tool when the article has no mentions (#285: title-fill removed)", async () => {
    expect(await tags({ title: "Claude Code now runs Claude Opus 4.6 by default" })).toEqual(["claude-code:harness"]);
  });

  it("still resolves the title tool for a kind no mention names, but no longer tags it (#285)", async () => {
    const article = {
      title: "Cursor adds Claude Sonnet to its model picker",
      toolMentions: [{ toolId: "t-cursor", name: "Cursor", relevance: 1 }],
    };
    expect(await tags(article)).toEqual(["cursor:harness"]);
    expect(await resolved(article)).toEqual(["cursor", "claude-sonnet"]);
  });

  it("keeps one tool per kind, the primary first, then the highest-relevance mention", async () => {
    const article = {
      toolMentions: [
        { name: "Claude Sonnet", relevance: 0.5 },
        { name: "Cursor", relevance: 1 },
        { name: "Claude Code", relevance: 0.8 },
        { name: "Claude Opus", relevance: 0.7 },
      ],
    };
    expect(await tags(article)).toEqual(["cursor:harness", "claude-opus:model"]);
  });

  it("gives no tags when the top mention is not in the catalogue (#109 rule)", async () => {
    const article = {
      title: "Manus runs on Claude Opus",
      toolMentions: [
        { name: "Manus", relevance: 1 },
        { name: "Claude Code", relevance: 0.3 },
      ],
    };
    expect(await tags(article)).toEqual([]);
  });

  it("tags an active kind-other row with kind other", async () => {
    expect(await tags({ toolMentions: [{ name: "Model Context Protocol", relevance: 1 }] })).toEqual([
      "model-context-protocol:other",
    ]);
  });
});

describe("the tool page groups an article under each kind's tag (#187)", () => {
  it("lists a harness-and-model article on both tool pages", async () => {
    const { buildToolCatalogue } = await load();
    const { groupNewsByPrimaryTool } = await import("../../lib/tools/tool-news");
    const at = new Date("2026-10-01T00:00:00Z");
    const grouped = groupNewsByPrimaryTool(
      [
        {
          id: "a1",
          slug: "a1",
          title: "Claude Code now runs Claude Opus 4.6",
          sourceName: null,
          publishedDate: at,
          createdAt: at,
          toolMentions: [
            { name: "Claude Code", relevance: 1 },
            { name: "Claude Opus 4.6", relevance: 0.8 },
          ],
        },
      ],
      buildToolCatalogue(TOOLS),
      5
    );
    expect(Object.keys(grouped).sort()).toEqual(["claude-code", "claude-opus"]);
  });
});

describe("the catalogue loader reads kind and status from the columns (#187)", () => {
  it("prefers the column status and kind over stale JSONB copies", async () => {
    vi.resetModules();
    const dbRows = [
      {
        id: "uuid-opus-4-6",
        slug: "opus-4-6",
        name: "Claude Opus 4.6",
        category: "other",
        status: "redirect",
        kind: "model",
        companyId: null,
        data: { id: "t-opus-4-6", status: "active", kind: "harness", redirect_to: "claude-opus" },
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    ];
    vi.doMock("../../lib/db/connection", () => ({
      getDb: () => ({ select: () => ({ from: async () => dbRows }) }),
    }));
    try {
      const { ToolsRepository } = await import("../../lib/db/repositories/tools.repository");
      const rows = await new ToolsRepository().findNewsCatalogueRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: "t-opus-4-6",
        db_id: "uuid-opus-4-6",
        slug: "opus-4-6",
        status: "redirect",
        kind: "model",
        redirect_to: "claude-opus",
      });
    } finally {
      vi.doUnmock("../../lib/db/connection");
      vi.resetModules();
    }
  });
});
