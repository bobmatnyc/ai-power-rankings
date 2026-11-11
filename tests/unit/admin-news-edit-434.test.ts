/**
 * #434: the admin edit page loads and saves tool mentions of both stored shapes.
 *
 * Why: GET /api/admin/news/[id] returned the camelCase drizzle row while the
 * edit page reads `tool_mentions`, so mentions loaded empty; PUT spread the
 * page's snake_case body into drizzle `.set`, which drops unknown keys, so
 * mentions never saved, and the page sends names only, which would drop
 * `raw_tool` from mention objects.
 * What: runs the route's GET and PUT with the real ArticlesRepository over a
 * PGlite `articles` table; only `requireAdmin` and `getDb` are replaced. The
 * page's load step (`toolMentionNames(article.tool_mentions)`) and its save
 * body (`buildAdminEditBody`) are the page's own code. Each case reads the row
 * back from the database.
 * Test: `npx vitest run tests/unit/admin-news-edit-434.test.ts`. No server, no network.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, getDb, holder } = vi.hoisted(() => {
  const holder = { db: null as unknown };
  return { requireAdmin: vi.fn(), getDb: vi.fn(() => holder.db), holder };
});
vi.mock("../../lib/api-auth", () => ({ requireAdmin }));
vi.mock("../../lib/db/connection", () => ({ getDb }));

import { GET, PUT } from "../../app/api/admin/news/[id]/route";
import { type AdminEditArticle, buildAdminEditBody, mergeEditedToolMentions } from "../../lib/admin-news-edit";
import { toolMentionNames } from "../../lib/tool-mention-shape";

vi.setConfig({ testTimeout: 60_000 });

// `articles` as lib/db/article-schema.ts declares it, without the ingestion-run FK.
const ARTICLES_DDL = `CREATE TABLE public."articles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(255) NOT NULL UNIQUE,
  "title" varchar(500) NOT NULL,
  "summary" text,
  "content" text NOT NULL,
  "ingestion_type" varchar(20) NOT NULL,
  "source_url" varchar(1000),
  "source_name" varchar(255),
  "file_name" varchar(255),
  "file_type" varchar(50),
  "tags" text[] DEFAULT '{}'::text[],
  "category" varchar(100),
  "importance_score" integer DEFAULT 5,
  "sentiment_score" numeric(3,2),
  "tool_mentions" jsonb DEFAULT '[]',
  "company_mentions" jsonb DEFAULT '[]',
  "rankings_snapshot" jsonb,
  "author" varchar(255),
  "published_date" timestamptz,
  "ingested_at" timestamptz DEFAULT now(),
  "ingested_by" varchar(255) DEFAULT 'admin',
  "status" varchar(20) DEFAULT 'active',
  "is_processed" boolean DEFAULT false,
  "processed_at" timestamptz,
  "ingestion_run_id" uuid,
  "is_auto_ingested" boolean DEFAULT false,
  "discovery_source" varchar(50) DEFAULT 'manual',
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
)`;

const STRING_ID = "00000000-0000-4000-8000-000000000001";
const OBJECT_ID = "00000000-0000-4000-8000-000000000002";
const STRING_MENTIONS = ["Cursor", "Claude Code"];
const OBJECT_MENTIONS = [
  { tool: "GitHub Copilot", raw_tool: "Copilot", context: "ships agents", sentiment: 0.4 },
  { tool: "Cursor", raw_tool: "cursor", context: "compared" },
];

let pg: PGlite;
beforeEach(async () => {
  pg = new PGlite();
  await pg.exec(ARTICLES_DDL);
  for (const [id, slug, mentions] of [
    [STRING_ID, "string-row", STRING_MENTIONS],
    [OBJECT_ID, "object-row", OBJECT_MENTIONS],
  ] as const) {
    await pg.query(
      `INSERT INTO public."articles" (id, slug, title, content, ingestion_type, source_name, source_url, published_date, tool_mentions)
       VALUES ($1, $2, 'Title', 'Body', 'text', 'The Verge', 'https://example.com/a', '2026-11-01T00:00:00Z', $3)`,
      [id, slug, JSON.stringify(mentions)]
    );
  }
  holder.db = drizzle(pg);
  requireAdmin.mockReset();
  requireAdmin.mockResolvedValue({ userId: "u", user: {}, error: null });
});
afterEach(async () => {
  await pg.close();
});

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function load(id: string): Promise<AdminEditArticle> {
  const res = await GET(new NextRequest(`http://localhost/api/admin/news/${id}`), ctx(id));
  expect(res.status).toBe(200);
  return (await res.json()).article as AdminEditArticle;
}

/** The form fields as the page sets them from a loaded article (loadArticle). */
function formFrom(article: AdminEditArticle, toolMentions?: string) {
  return {
    title: article.title,
    content: article.content,
    summary: article.summary ?? "",
    author: article.author ?? "",
    publishedDate: article.published_date ? new Date(article.published_date).toISOString().split("T")[0]! : "",
    source: article.source ?? "",
    sourceUrl: article.source_url ?? "",
    category: article.category ?? "",
    tags: article.tags?.join(", ") ?? "",
    toolMentions: toolMentions ?? toolMentionNames(article.tool_mentions).join(", "),
    importanceScore: article.importance_score || 5,
  };
}

async function save(id: string, body: unknown) {
  const res = await PUT(
    new NextRequest(`http://localhost/api/admin/news/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    ctx(id)
  );
  return res;
}

async function storedMentions(id: string): Promise<unknown> {
  const { rows } = await pg.query<{ tool_mentions: unknown }>(
    `SELECT tool_mentions FROM public."articles" WHERE id = $1`,
    [id]
  );
  return rows[0]?.tool_mentions;
}

describe("#434 GET → edit page mapping", () => {
  it("shows mention names for a string-form row", async () => {
    const article = await load(STRING_ID);
    expect(toolMentionNames(article.tool_mentions)).toEqual(["Cursor", "Claude Code"]);
  });

  it("shows mention names for an object-form row and keeps the objects", async () => {
    const article = await load(OBJECT_ID);
    expect(toolMentionNames(article.tool_mentions)).toEqual(["GitHub Copilot", "Cursor"]);
    expect(article.tool_mentions).toEqual(OBJECT_MENTIONS);
    expect(article.source).toBe("The Verge");
    expect(article.source_url).toBe("https://example.com/a");
    expect(article.published_date).toBe("2026-11-01T00:00:00.000Z");
  });
});

describe("#434 PUT round trip from the edit page", () => {
  it.each([
    ["string", STRING_ID, STRING_MENTIONS],
    ["object", OBJECT_ID, OBJECT_MENTIONS],
  ])("saving untouched mentions leaves a %s row's mentions unchanged", async (_shape, id, mentions) => {
    const article = await load(id);
    const res = await save(id, buildAdminEditBody(article, formFrom(article)));
    expect(res.status).toBe(200);
    expect(await storedMentions(id)).toEqual(mentions);
  });

  it("persists edited mentions, keeping objects for names that remain", async () => {
    const article = await load(OBJECT_ID);
    const res = await save(OBJECT_ID, buildAdminEditBody(article, formFrom(article, "cursor, Windsurf")));
    expect(res.status).toBe(200);
    expect(await storedMentions(OBJECT_ID)).toEqual([
      OBJECT_MENTIONS[1],
      { tool: "Windsurf", raw_tool: "Windsurf" },
    ]);
  });

  it("persists edited mentions on a string row as strings", async () => {
    const article = await load(STRING_ID);
    const res = await save(STRING_ID, buildAdminEditBody(article, formFrom(article, "Claude Code, Windsurf")));
    expect(res.status).toBe(200);
    expect(await storedMentions(STRING_ID)).toEqual(["Claude Code", "Windsurf"]);
  });

  it("persists the other form fields the page sends", async () => {
    const article = await load(STRING_ID);
    const form = { ...formFrom(article), title: "New title", source: "Wired", sourceUrl: "https://example.com/b" };
    const body = buildAdminEditBody(article, { ...form, publishedDate: "2026-10-15", tags: "a, b", importanceScore: 8 });
    expect((await save(STRING_ID, { ...body, category: "LLM", summary: "S", author: "A" })).status).toBe(200);
    const { rows } = await pg.query<Record<string, unknown>>(
      `SELECT title, source_name, source_url, published_date, tags, importance_score, category, summary, author
       FROM public."articles" WHERE id = $1`,
      [STRING_ID]
    );
    expect(rows[0]).toMatchObject({
      title: "New title",
      source_name: "Wired",
      source_url: "https://example.com/b",
      tags: ["a", "b"],
      importance_score: 8,
      category: "LLM",
      summary: "S",
      author: "A",
    });
    expect((rows[0]!["published_date"] as Date).toISOString()).toBe("2026-10-15T00:00:00.000Z");
  });

  it("refuses a wrongly typed field with 400 and writes nothing", async () => {
    const res = await save(OBJECT_ID, { tool_mentions: "Cursor" });
    expect(res.status).toBe(400);
    expect(await storedMentions(OBJECT_ID)).toEqual(OBJECT_MENTIONS);
  });
});

describe("#434 mergeEditedToolMentions", () => {
  it("returns the stored array itself when the names are unchanged", () => {
    const stored = [...OBJECT_MENTIONS, { context: "nameless" }];
    expect(mergeEditedToolMentions(stored, ["GitHub Copilot", "Cursor"])).toBe(stored);
  });
});
