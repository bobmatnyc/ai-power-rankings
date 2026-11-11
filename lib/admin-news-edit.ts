/**
 * Maps one article between the drizzle row and the admin edit page's form shape (#434).
 *
 * Why: GET /api/admin/news/[id] returned the camelCase drizzle row, but the edit
 * page reads snake_case keys (`tool_mentions`, `published_date`, ...), so those
 * fields loaded empty. PUT spread the snake_case body into drizzle `.set`, which
 * ignores unknown keys, so those fields never saved; the page also flattens
 * mentions to names, which would drop `raw_tool` from mention objects.
 * What: `toAdminEditArticle` builds the page shape from a row.
 * `buildAdminEditBody` builds the PUT body from the form fields.
 * `adminEditBodyToUpdates` maps a PUT body to drizzle column keys, and
 * `mergeEditedToolMentions` keeps each stored mention's shape for names that remain.
 * Test: `tests/unit/admin-news-edit-434.test.ts`.
 */
import type { Article } from "@/lib/db/article-schema";
import { type StoredToolMention, toolMentionName, toolMentionNames } from "@/lib/tool-mention-shape";

/** The article as the admin edit page reads and sends it. */
export interface AdminEditArticle {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  content: string;
  author?: string | null;
  published_date: string;
  source?: string | null;
  source_url?: string | null;
  tags?: string[] | null;
  tool_mentions?: StoredToolMention[];
  created_at: string;
  updated_at: string;
  category?: string | null;
  importance_score?: number | null;
}

/** The edit form's field values, as the page holds them. */
export interface AdminEditFields {
  title: string;
  content: string;
  summary: string;
  author: string;
  publishedDate: string;
  source: string;
  sourceUrl: string;
  category: string;
  tags: string;
  toolMentions: string;
  importanceScore: number;
}

const iso = (d: Date | null | undefined): string => (d ? new Date(d).toISOString() : "");

/** The row in the edit page's shape; `tool_mentions` is the stored array as is. */
export function toAdminEditArticle(row: Article): AdminEditArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    content: row.content,
    author: row.author,
    published_date: iso(row.publishedDate),
    source: row.sourceName,
    source_url: row.sourceUrl,
    tags: row.tags,
    tool_mentions: Array.isArray(row.toolMentions) ? (row.toolMentions as StoredToolMention[]) : [],
    created_at: iso(row.createdAt),
    updated_at: iso(row.updatedAt),
    category: row.category,
    importance_score: row.importanceScore,
  };
}

const splitList = (value: string): string[] =>
  value
    ? value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

/**
 * The PUT body the edit page sends: the loaded article overlaid with the form fields.
 * Carries no timestamp of its own, so auto-save's JSON change check stays stable.
 */
export function buildAdminEditBody(article: AdminEditArticle, fields: AdminEditFields) {
  return {
    ...article,
    title: fields.title,
    content: fields.content,
    summary: fields.summary,
    author: fields.author,
    published_date: fields.publishedDate
      ? new Date(fields.publishedDate).toISOString()
      : new Date().toISOString(),
    source: fields.source,
    source_url: fields.sourceUrl || null,
    category: fields.category,
    tags: splitList(fields.tags),
    // Names only; the server keeps each stored mention's shape (mergeEditedToolMentions).
    tool_mentions: splitList(fields.toolMentions),
    importance_score: fields.importanceScore,
  };
}

/**
 * The stored mentions after an edit, each kept in its stored shape.
 *
 * Rule: when the edited names equal the stored names in order, the stored array
 * is returned unchanged. Otherwise each edited name reuses the first unused
 * stored mention with that name (case-insensitive), string or object as stored.
 * A new name is stored as `{ tool, raw_tool }` when the row holds any object
 * mention, else as a bare string. An edited object element is kept as sent.
 */
export function mergeEditedToolMentions(stored: unknown, edited: unknown[]): StoredToolMention[] {
  const storedList = Array.isArray(stored) ? (stored as StoredToolMention[]) : [];
  const editedNames = edited.map(toolMentionName);
  const storedNames = toolMentionNames(storedList);
  if (editedNames.length === storedNames.length && editedNames.every((n, i) => n === storedNames[i])) {
    return storedList;
  }
  const rowUsesObjects = storedList.some((m) => m !== null && typeof m === "object");
  const used = new Set<number>();
  const out: StoredToolMention[] = [];
  edited.forEach((element, i) => {
    const name = editedNames[i];
    if (!name) return;
    if (element !== null && typeof element === "object") {
      out.push(element as StoredToolMention);
      return;
    }
    const key = name.toLowerCase();
    const hit = storedList.findIndex((m, j) => !used.has(j) && toolMentionName(m)?.toLowerCase() === key);
    if (hit >= 0) {
      used.add(hit);
      out.push(storedList[hit] as StoredToolMention);
    } else {
      out.push(rowUsesObjects ? { tool: name, raw_tool: name } : name);
    }
  });
  return out;
}

export type AdminEditUpdates = { updates: Partial<Article> } | { error: string };

const isStr = (v: unknown): v is string => typeof v === "string";
const isStrOrNull = (v: unknown): v is string | null => v === null || typeof v === "string";

/**
 * The drizzle column updates for a PUT body in the edit page's shape.
 * Only the form's fields are read; every other key (id, slug, created_at,
 * camelCase keys) is ignored. A field of the wrong type is an error, not dropped.
 */
export function adminEditBodyToUpdates(body: Record<string, unknown>, existing: Article): AdminEditUpdates {
  const updates: Partial<Article> = {};
  const bad = (field: string): AdminEditUpdates => ({ error: `Invalid ${field}` });

  if ("title" in body) {
    if (!isStr(body["title"])) return bad("title");
    updates.title = body["title"];
  }
  if ("content" in body) {
    if (!isStr(body["content"])) return bad("content");
    updates.content = body["content"];
  }
  const nullableText = [
    ["summary", "summary"],
    ["author", "author"],
    ["source", "sourceName"],
    ["source_url", "sourceUrl"],
    ["category", "category"],
  ] as const;
  for (const [field, column] of nullableText) {
    if (!(field in body)) continue;
    const value = body[field];
    if (!isStrOrNull(value)) return bad(field);
    updates[column] = value;
  }
  if ("published_date" in body) {
    const value = body["published_date"];
    const date = isStr(value) ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return bad("published_date");
    updates.publishedDate = date;
  }
  if ("tags" in body) {
    const value = body["tags"];
    if (!Array.isArray(value) || !value.every(isStr)) return bad("tags");
    updates.tags = value;
  }
  if ("tool_mentions" in body) {
    const value = body["tool_mentions"];
    if (!Array.isArray(value)) return bad("tool_mentions");
    updates.toolMentions = mergeEditedToolMentions(existing.toolMentions, value);
  }
  if ("importance_score" in body) {
    const value = body["importance_score"];
    if (typeof value !== "number" || !Number.isFinite(value)) return bad("importance_score");
    updates.importanceScore = Math.round(value);
  }
  return { updates };
}
