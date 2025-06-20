import { Metadata } from "next";
import { markdownPages, MarkdownPageConfig } from "@/config/markdown-pages";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";
import { loadMarkdownContent } from "@/lib/markdown-renderer";

export function getMarkdownPageConfig(slug: string): MarkdownPageConfig | null {
  return markdownPages[slug] || null;
}

export function generateMarkdownPageMetadata(slug: string): Metadata {
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
