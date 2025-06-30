import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n/get-dictionary";
import { type Locale } from "@/i18n/config";
import { getNewsRepo, getToolsRepo } from "@/lib/json-db";
import NewsDetailContent from "@/components/news/news-detail-content";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Locale; slug: string }>;
}): Promise<Metadata> {
  const { lang: _lang, slug } = await params;
  const newsRepo = getNewsRepo();
  const article = await newsRepo.getBySlug(slug);

  if (!article) {
    return {
      title: "Article Not Found",
    };
  }

  return {
    title: `${article.title} | AI Power Rankings`,
    description: article.summary || article.content.substring(0, 160),
    openGraph: {
      title: article.title,
      description: article.summary || article.content.substring(0, 160),
      type: "article",
      publishedTime: article.published_date,
      modifiedTime: article.updated_at,
    },
  };
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ lang: Locale; slug: string }>;
}) {
  const { lang, slug } = await params;
  const dict = await getDictionary(lang);
  const newsRepo = getNewsRepo();
  const toolsRepo = getToolsRepo();

  // Get article by slug
  const article = await newsRepo.getBySlug(slug);

  if (!article) {
    notFound();
  }

  // Get tool information if available
  let tool = null;
  if (article.tool_mentions && article.tool_mentions.length > 0) {
    const tools = await toolsRepo.getAll();
    const firstMention = article.tool_mentions[0];
    if (firstMention) {
      tool =
        tools.find(
          (t) =>
            t.name.toLowerCase() === firstMention.toLowerCase() ||
            t.slug === firstMention.toLowerCase().replace(/\s+/g, "-")
        ) || null;
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <NewsDetailContent article={article} tool={tool} dict={dict} lang={lang} />
    </div>
  );
}
