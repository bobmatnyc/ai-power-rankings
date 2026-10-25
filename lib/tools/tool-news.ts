/**
 * Groups news articles under the tool each one is about (#193).
 *
 * Why: the tool page lists a tool's latest articles. Attribution is not stored;
 * `/api/news` computes it at read time, so the page must compute it the same way
 * or the page and the API would disagree about an article's tool.
 * What: pure, no DB access. Each article goes to its tags (`articleToolTags`):
 * the primary tool (`/api/news` `tool_slug`) and, since #187, the top tool of
 * each other kind, so a harness-and-model article is on both pages. A second
 * tool of the same kind never counts. Per slug, newest first by
 * `published_date`, else `created_at`, then `id` descending; at most `perTool`
 * items.
 * Test: `tests/unit/tool-news-193.test.tsx`, `tests/unit/news-kind-matcher-187.test.ts`.
 */
import { articleToolTags, type CatalogueTool, type ToolCatalogue } from "@/lib/news-tool-resolver";

/** The row fields grouping reads; `ToolNewsRow` from the news repository satisfies it. */
export interface ToolNewsSource {
  id: string;
  slug: string;
  title: string;
  sourceName: string | null;
  publishedDate: Date | string | null;
  createdAt: Date | string;
  toolMentions: unknown;
}

/** One related-news item as cached and rendered. `date` is an ISO string so the entry is JSON-safe. */
export interface ToolNewsItem {
  id: string;
  slug: string;
  title: string;
  source: string | null;
  date: string;
}

/** Up to `perTool` items per catalogue slug. A slug with no articles has no key. */
export type ToolNewsBySlug = Record<string, ToolNewsItem[]>;

const toIso = (value: Date | string): string => (value instanceof Date ? value : new Date(value)).toISOString();

/** Newest first; equal dates by `id` descending, so the order is total and stable. */
export function compareToolNews(a: ToolNewsItem, b: ToolNewsItem): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.id === b.id ? 0 : a.id < b.id ? 1 : -1;
}

export function groupNewsByPrimaryTool<T extends CatalogueTool>(
  rows: readonly ToolNewsSource[],
  catalogue: ToolCatalogue<T>,
  perTool: number
): ToolNewsBySlug {
  const bySlug = new Map<string, ToolNewsItem[]>();
  for (const row of rows) {
    // #187: one tag per kind (primary first), through the same resolver and input shape as /api/news.
    const tags = articleToolTags({ title: row.title, toolMentions: row.toolMentions }, catalogue);
    for (const tag of tags) {
      const items = bySlug.get(tag.slug) ?? [];
      items.push({
        id: row.id,
        slug: row.slug,
        title: row.title,
        source: row.sourceName?.trim() || null,
        date: toIso(row.publishedDate ?? row.createdAt),
      });
      bySlug.set(tag.slug, items);
    }
  }

  const result: ToolNewsBySlug = {};
  for (const [slug, items] of bySlug) result[slug] = items.sort(compareToolNews).slice(0, perTool);
  return result;
}

/** The items for one slug, `[]` when it has none. Own keys only, so "constructor" is not a slug. */
export function newsForTool(bySlug: ToolNewsBySlug, slug: string): ToolNewsItem[] {
  return Object.hasOwn(bySlug, slug) ? bySlug[slug]! : [];
}
