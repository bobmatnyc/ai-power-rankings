import { NewsRepository } from "@/lib/db/repositories/news";
import { loadNewsToolCatalogueOrNull } from "@/lib/news-tool-catalogue";
import { articleToolTags, primaryArticleTool } from "@/lib/news-tool-resolver";
import type { StoredToolMention } from "@/lib/tool-mention-shape"; // #434

/** An article in the shape `/api/news/[slug]` returns and the article page renders. */
export interface NewsArticleView {
  id: string;
  slug: string;
  title: string;
  content: string;
  summary: string | null;
  published_date: string;
  source: string;
  source_url: string | null;
  tags: string[];
  tool_mentions: StoredToolMention[]; // #434: bare names (old rows) or mention objects
  created_at: string;
  updated_at: string;
}

/** The article's primary tool, as `/api/news/[slug]` returns it. */
export interface NewsArticleTool {
  id: string;
  slug: string;
  name: string;
  kind: string;
  description: unknown;
  category: string;
  info: Record<string, unknown>;
}

export interface NewsArticleDetail {
  article: NewsArticleView;
  tool: NewsArticleTool | null;
  /** #187: one tag per kind; null when the catalogue read failed. */
  tools: Array<{ slug: string; name: string; kind: string }> | null;
}

/**
 * Reads one news article with its tool attribution.
 *
 * Why: #368 — the article page fetched `/api/news/<slug>` over HTTP twice per
 *   render (metadata and body). The page and the API now share this read.
 * What: `NewsRepository.getBySlug()`; null for an unknown slug. The primary
 *   tool and the per-kind tags come from the tool catalogue (#109, #187); a
 *   failed catalogue read leaves `tool` null and `tools` null and still returns
 *   the article. Dates are ISO strings. A failed article read throws.
 * Test: `tests/unit/news-route-tools-109.test.ts` (through the API route),
 *   `tests/unit/news-article-page-368.test.ts`.
 */
export async function loadNewsArticle(slug: string, caller: string): Promise<NewsArticleDetail | null> {
  const article = await new NewsRepository().getBySlug(slug);
  if (!article) return null;

  // #109: the primary tool comes from the tool catalogue only (stored mention
  // ids, then exact names, then whole-word title matches). A failed catalogue
  // read is logged and leaves `tool` null; the article is still served.
  const catalogue = await loadNewsToolCatalogueOrNull(caller);
  const matchingTool = catalogue ? primaryArticleTool(article, catalogue) : null;
  // #187: one tag per kind, as /api/news reports; null when the catalogue read failed.
  const tools = catalogue
    ? articleToolTags(article, catalogue).map((t) => ({ slug: t.slug, name: t.name, kind: t.kind }))
    : null;

  const published = article.publishedAt.toISOString();
  return {
    article: {
      id: article.id,
      slug: article.slug,
      title: article.title,
      content: article.content || article.summary || "",
      summary: article.summary,
      published_date: published,
      source: article.source || "AI News",
      source_url: article.sourceUrl,
      tags: article.tags || [],
      tool_mentions: article.toolMentions || [],
      created_at: published,
      updated_at: published,
    },
    tool: matchingTool
      ? {
          id: matchingTool.id,
          slug: matchingTool.slug,
          name: matchingTool.name,
          kind: matchingTool.kind, // #187
          description: matchingTool.description,
          category: matchingTool.category,
          info: matchingTool.info || {},
        }
      : null,
    tools,
  };
}
