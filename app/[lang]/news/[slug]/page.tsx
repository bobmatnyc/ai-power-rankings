import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import NewsDetailContent from "@/components/news/news-detail-content";
import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getUrl } from "@/lib/get-url";

// Force dynamic rendering to ensure fresh data
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lang: string; slug: string }>;
}

interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  content: string;
  summary?: string;
  published_date: string;
  source?: string;
  source_url?: string;
  tags?: string[];
  tool_mentions?: string[];
  created_at: string;
  updated_at: string;
}

interface Tool {
  id: string;
  slug: string;
  name: string;
  description?: string;
  category?: string;
  info?: {
    website?: string;
  };
}

async function fetchArticle(slug: string): Promise<{ article: NewsArticle; tool: Tool | null }> {
  try {
    const baseUrl = getUrl();
    const response = await fetch(`${baseUrl}/api/news/${slug}`, {
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!response.ok) {
      if (response.status === 404) {
        notFound();
      }
      throw new Error(`Failed to fetch article: ${response.status}`);
    }

    const data = await response.json();
    return { article: data.article, tool: data.tool };
  } catch (error) {
    console.error("Error fetching article:", error);
    notFound();
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, slug } = await params;
  const baseUrl = getUrl();

  try {
    const { article, tool } = await fetchArticle(slug);

    // Build hreflang alternates for all supported languages
    const languages: Record<string, string> = {};
    locales.forEach((locale) => {
      languages[locale] = `${baseUrl}/${locale}/news/${slug}`;
    });

    const toolName = tool ? ` - ${tool.name}` : "";
    const description = article.summary || article.content.substring(0, 160);

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
        url: `${baseUrl}/${lang}/news/${slug}`,
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
      alternates: {
        // Always set canonical to the English version
        canonical: `${baseUrl}/en/news/${slug}`,
        // Include hreflang tags for all supported languages
        languages,
      },
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
  const { article, tool } = await fetchArticle(slug);

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
          <NewsDetailContent
            article={article}
            tool={tool}
            dict={dict}
            lang={lang as Locale}
          />
        </Suspense>
      </article>
    </main>
  );
}