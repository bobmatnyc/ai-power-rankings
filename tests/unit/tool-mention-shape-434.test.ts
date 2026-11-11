/**
 * #434: admin `saveAsArticle` stores mention objects, and every reader accepts both shapes.
 *
 * Why: the admin save path stored bare name strings, so its rows had no
 * `raw_tool` (#187, #432). Writing objects needed the readers that assumed
 * strings — the news detail view, the admin edit page, the JSONB lookups — to
 * read objects too, while old string rows keep rendering and matching.
 * What: drives the analyze route's POST (preprocessed, `saveAsArticle: true`)
 * with auth, the articles repository and the catalogue read replaced, and
 * checks the stored `toolMentions`; checks the name readers and the detail
 * view's tool lookup on both shapes; runs `toolMentionMatches` on PGlite
 * against string, `{tool}`, `{name}` and non-matching rows.
 * Test: `npx vitest run tests/unit/tool-mention-shape-434.test.ts`. No network;
 * PGlite in memory, no real database.
 */
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const created = vi.hoisted(() => ({ createArticle: vi.fn() }));

vi.mock("../../lib/api-auth", () => ({ requireAdmin: async () => ({ error: null }) }));
vi.mock("../../lib/db/repositories/articles.repository", () => ({
  ArticlesRepository: class {
    createArticle = created.createArticle;
  },
}));
vi.mock("../../lib/news-tool-catalogue", async () => {
  const { buildToolCatalogue } = await import("../../lib/news-tool-resolver");
  return {
    readNewsToolCatalogue: async () =>
      buildToolCatalogue([
        { id: "t-github-copilot", slug: "github-copilot", name: "GitHub Copilot", kind: "other", status: "active" },
        { id: "t-cursor", slug: "cursor", name: "Cursor", kind: "other", status: "active" },
      ]),
  };
});

import { POST } from "../../app/api/admin/news/analyze/route";
import { resolveMentionedTools } from "../../components/news/news-detail-content";
import { articles } from "../../lib/db/article-schema";
import { toolMentionMatches } from "../../lib/db/tool-mention-match";
import { toolMentionName, toolMentionNames } from "../../lib/tool-mention-shape";

beforeEach(() => {
  created.createArticle.mockReset();
  created.createArticle.mockImplementation(async (a: { slug: string; title: string }) => ({ id: "a1", ...a }));
});

function saveRequest(toolMentions: unknown[]) {
  return new NextRequest("http://localhost/api/admin/news/analyze", {
    method: "POST",
    body: JSON.stringify({
      type: "preprocessed",
      saveAsArticle: true,
      preprocessedData: {
        title: "Copilot ships agents",
        summary: "Summary.",
        source: "The Verge",
        published_date: "2026-11-01",
        key_topics: [],
        importance_score: 6,
        tool_mentions: toolMentions,
      },
    }),
  });
}

describe("saveAsArticle stores mention objects with tool and raw_tool (#434)", () => {
  it("an aliased mention is stored with the mapped name and the raw name, like ingestion", async () => {
    const res = await POST(
      saveRequest([
        { tool: "VS Code Copilot", context: "c", sentiment: 0.4, relevance: 0.9 },
        { tool: "Unlisted Tool", context: "d", sentiment: 0, relevance: 0.2 },
      ])
    );
    expect(res.status).toBe(200);
    expect(created.createArticle).toHaveBeenCalledTimes(1);
    const stored = created.createArticle.mock.calls[0]![0].toolMentions;
    expect(stored).toEqual([
      { tool: "GitHub Copilot", raw_tool: "VS Code Copilot", context: "c", sentiment: 0.4, relevance: 0.9 },
      { tool: "Unlisted Tool", raw_tool: "Unlisted Tool", context: "d", sentiment: 0, relevance: 0.2 },
    ]);
  });
});

describe("toolMentionName / toolMentionNames read both shapes (#434)", () => {
  it.each([
    ["a bare string (old row)", "Cursor", "Cursor"],
    ["a {tool, raw_tool} object", { tool: "GitHub Copilot", raw_tool: "VS Code Copilot" }, "GitHub Copilot"],
    ["a {name} object", { name: " Cursor " }, "Cursor"],
    ["an object with neither", { context: "x" }, null],
    ["an empty string", "  ", null],
    ["null", null, null],
  ])("%s", (_label, mention, expected) => {
    expect(toolMentionName(mention)).toBe(expected);
  });

  it("joins a mixed array for the admin edit field and ignores a non-array", () => {
    expect(toolMentionNames(["Cursor", { tool: "GitHub Copilot", raw_tool: "Copilot" }, {}]).join(", ")).toBe(
      "Cursor, GitHub Copilot"
    );
    expect(toolMentionNames(undefined)).toEqual([]);
  });
});

describe("news detail view resolves both shapes to tools (#434)", () => {
  const tools = [
    { id: "1", slug: "cursor", name: "Cursor" },
    { id: "2", slug: "github-copilot", name: "GitHub Copilot", info: { website: "https://github.com" } },
  ];

  it("a string row and an object row show the same tools", () => {
    const fromStrings = resolveMentionedTools(["cursor", "GitHub Copilot", "Nope"], tools);
    const fromObjects = resolveMentionedTools(
      [{ tool: "Cursor", raw_tool: "cursor ide" }, { tool: "GitHub Copilot", raw_tool: "VS Code Copilot" }, { tool: "Nope" }],
      tools
    );
    expect(fromStrings.map((t) => t.slug)).toEqual(["cursor", "github-copilot"]);
    expect(fromObjects).toEqual(fromStrings);
    expect(fromObjects[1]!.website).toBe("https://github.com");
  });
});

describe("toolMentionMatches matches every stored shape on Postgres (#434)", () => {
  it("string, {tool} and {name} rows match; other rows do not", async () => {
    const db = new PGlite();
    await db.exec(`CREATE TABLE articles (id text PRIMARY KEY, tool_mentions jsonb)`);
    const rows: Array<[string, unknown]> = [
      ["string-row", ["Cursor", "Other"]],
      ["tool-row", [{ tool: "Cursor", raw_tool: "cursor ide", relevance: 0.9 }]],
      ["name-row", [{ name: "Cursor" }]],
      ["other-row", ["GitHub Copilot", { tool: "Windsurf" }]],
      ["empty-row", []],
    ];
    for (const [id, mentions] of rows) {
      await db.query(`INSERT INTO articles (id, tool_mentions) VALUES ($1, $2::jsonb)`, [id, JSON.stringify(mentions)]);
    }
    const q = new PgDialect().sqlToQuery(
      sql`SELECT id FROM articles WHERE ${toolMentionMatches(articles.toolMentions, "Cursor")} ORDER BY id`
    );
    const { rows: hit } = await db.query<{ id: string }>(q.sql, q.params as unknown[]);
    expect(hit.map((r) => r.id)).toEqual(["name-row", "string-row", "tool-row"]);
    await db.close();
  });
});
