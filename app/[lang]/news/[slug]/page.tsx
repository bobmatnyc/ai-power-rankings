import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { insightsArticleTemplateEnabled } from "@/app/[lang]/insights/preview-gate";
import { ArticleTemplate } from "@/components/news/article-template";
import NewsDetailContent from "@/components/news/news-detail-content";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { toMetaDescription } from "@/lib/article-summary";
import {
  type NewsArticleDetail,
  type NewsArticleTool,
  type NewsArticleView,
  loadNewsArticle,
} from "@/lib/news-article";
import { ENGLISH_ONLY_OG_LOCALE, englishOnlyAlternates } from "@/lib/seo/alternates";

// #368: ISR with the 60-second window the /api/news fetch used; slugs render on first request.
export const revalidate = 60;
export function generateStaticParams(): Array<{ lang: string; slug: string }> {
  return [];
}

interface PageProps {
  params: Promise<{ lang: string; slug: string }>;
}

type DetailProps = Parameters<typeof NewsDetailContent>[0];

/**
 * The article and its tool, or `notFound()`.
 *
 * #368: reads the database directly (was a fetch of `/api/news/<slug>`); React
 * `cache()` shares one read between `generateMetadata` and the page. An
 * unknown slug is a 404. A failed read throws rather than 404s, so an ISR
 * regeneration that hits a database error keeps serving the cached article
 * instead of caching a 404 for a real one.
 */
const fetchArticle = cache(
  async (slug: string): Promise<{ article: NewsArticleView; tool: NewsArticleTool | null; tools: NewsArticleDetail["tools"] }> => {
    const detail = await loadNewsArticle(slug, "/[lang]/news/[slug]");
    if (!detail) notFound();
    // #198: `tools` (one tag per kind, #187) feeds the Article template only.
    return { article: detail.article, tool: detail.tool, tools: detail.tools };
  }
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, slug } = await params;
  // #153: SEO URLs come from englishOnlyAlternates(), never the deployment host.

  try {
    const { article, tool } = await fetchArticle(slug);

    const toolName = tool ? ` - ${tool.name}` : "";
    // #179: cap at ~160 characters on a word boundary; summaries ran 400-500 words.
    const description = toMetaDescription(article.summary || article.content);

    // #156: article bodies are English-only, so every locale canonicalises to
    // /en with no hreflang; og:url reads the same canonical.
    const alternates = englishOnlyAlternates(lang, `/news/${slug}`);
    return {
      title: `${article.title}${toolName}`,
      description,
      keywords: [
        "AI coding tools news",
        "AI development updates",
        ...(article.tags || []),
        ...(tool ? [tool.name, `${tool.name} news`] : []),
      ],
      openGraph: {
        title: article.title,
        description,
        type: "article",
        url: alternates.canonical, // #156: always the canonical
        locale: ENGLISH_ONLY_OG_LOCALE, // #156: the body is English
        siteName: "AI Power Rankings",
        publishedTime: article.published_date,
        modifiedTime: article.updated_at,
        authors: article.source ? [article.source] : undefined,
        tags: article.tags,
      },
      twitter: {
        card: "summary_large_image",
        title: article.title,
        description,
      },
      // #155: the helper also keeps the RSS link that replacing the layout's alternates drops.
      alternates,
    };
  } catch {
    // Fallback metadata if article fetch fails
    return {
      title: "Article Not Found",
      description: "The requested article could not be found.",
    };
  }
}

export default async function NewsArticlePage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang, slug } = await params;
  const dict = await getDictionary(lang as Locale);

  // Fetch the article data
  const { article, tool, tools } = await fetchArticle(slug);

  // #198: the Article template has its own flag so the Insights launch leaves indexed news pages as they are (#421).
  if (insightsArticleTemplateEnabled()) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-8">
        {/* #198: the template's labels come from the locale's dictionary (#421 review). */}
        <ArticleTemplate lang={lang} labels={dict.news.article} article={article} tool={tool} tools={tools} />
      </main>
    );
  }

  return (
    <main className="px-3 md:px-6 py-8 max-w-7xl mx-auto">
      <article>
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">{dict.common.loading}</p>
            </div>
          }
        >
          {/* #368: the same values the /api/news JSON carried (nulls included); the component's types never named the nulls. */}
          <NewsDetailContent
            article={article as DetailProps["article"]}
            tool={tool as DetailProps["tool"]}
            dict={dict}
            lang={lang as Locale}
          />
        </Suspense>
      </article>
    </main>
  );
}