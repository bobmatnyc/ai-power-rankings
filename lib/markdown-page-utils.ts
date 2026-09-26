import type { Metadata } from "next";
import { type MarkdownPageConfig, markdownPages } from "@/config/markdown-pages";
import { loadMarkdownContent } from "@/lib/markdown-renderer";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";

export function getMarkdownPageConfig(slug: string): MarkdownPageConfig | null {
  return markdownPages[slug] || null;
}

// #156: `lang` is the `[lang]` segment; lib/seo/utils builds locale URLs from it.
export function generateMarkdownPageMetadata(slug: string, lang: string): Metadata {
  const config = getMarkdownPageConfig(slug);

  if (!config) {
    return {
      title: "Page Not Found",
      description: "The requested page could not be found.",
    };
  }

  return generateSEOMetadata({
    title: config.title,
    description: config.description,
    lang,
    path: `/${slug}`,
    noIndex: config.noIndex,
  });
}

export function getMarkdownPageContent(slug: string): string | null {
  const config = getMarkdownPageConfig(slug);

  if (!config) {
    return null;
  }

  return loadMarkdownContent(config.markdownFile);
}
