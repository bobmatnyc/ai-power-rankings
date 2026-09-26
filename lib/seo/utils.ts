import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/seo/alternates";
import { siteOrigin } from "@/lib/site-origin";
import type { Tool } from "@/types/database";

interface GenerateMetadataProps {
  title: string;
  description: string;
  /** The `[lang]` route segment the page is served under. */
  lang: string;
  /** Locale-free route path (`/tools/cursor`, `/dashboard`); `""` for home. */
  path?: string;
  ogImage?: string;
  keywords?: string[];
  noIndex?: boolean;
  lastModified?: Date;
}

/**
 * Metadata for a page under `app/[lang]/`: title, robots, openGraph, twitter
 * and localized alternates.
 *
 * Why: this builder hard-coded its own hreflang map, with a `pt-BR` → `/pt`
 * locale the site does not serve and a canonical and `og:url` without the
 * locale segment the route lives under (#156).
 * What: canonical, hreflang and the RSS link come from `localizedAlternates()`;
 * `openGraph.url` is that canonical and `openGraph.locale` is `lang`. With
 * `noIndex`, `alternates` keeps canonical and the RSS link but no hreflang:
 * a page kept out of the index has no translations to offer it.
 * Test: `tests/unit/seo-canonical-origin.test.ts`.
 */
export function generateMetadata({
  title,
  description,
  lang,
  path = "",
  ogImage,
  keywords = [],
  noIndex = false,
  lastModified,
}: GenerateMetadataProps): Metadata {
  // #153: the production origin; getBaseUrl() returned the VERCEL_URL host.
  const baseUrl = siteOrigin();
  const localized = localizedAlternates(lang, path);
  // #156: og:url is the canonical, so the two cannot disagree.
  const url = localized.canonical;
  // #156: no hreflang on a noindex page; canonical and the RSS link stay.
  const alternates = noIndex
    ? { canonical: localized.canonical, types: localized.types }
    : localized;

  const images = ogImage
    ? [{ url: ogImage, width: 1200, height: 630, alt: title }]
    : [{ url: `${baseUrl}/og-default.png`, width: 1200, height: 630, alt: title }];

  return {
    title,
    description,
    keywords: [
      "AI coding tools",
      "developer tools",
      "AI assistants",
      "code generation",
      "programming AI",
      ...keywords,
    ].join(", "),
    authors: [{ name: "AI Power Rankings Team" }],
    creator: "AI Power Rankings",
    publisher: "AI Power Rankings",
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "AI Power Rankings",
      images,
      locale: lang, // #156: the page locale, as on the home and trending pages.
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
      creator: "@aipowerrankings",
      site: "@aipowerrankings",
    },
    alternates,
    ...(lastModified && { lastModified: lastModified.toISOString() }),
  };
}

export function generateToolMetadata(tool: Tool, lang: string): Metadata {
  const keywords = [
    tool.name,
    tool.category,
    ...(tool.info?.features?.languages_supported || []),
    ...(tool.info?.features?.ide_support || []),
    "AI coding assistant",
    "developer tools",
  ];

  const title = `${tool.name} - AI Coding Tool Review & Rankings`;

  // Safely access nested description with fallbacks to flat structure
  const toolDescription =
    tool.info?.product?.description ||
    tool.info?.product?.tagline ||
    tool.description ||
    "";

  const description = `${toolDescription} Compare ${tool.name} with other AI coding tools. Features, pricing, performance benchmarks, and user reviews.`;

  return generateMetadata({
    title,
    description,
    lang,
    path: `/tools/${tool.slug}`,
    keywords,
    ogImage: `/api/og?title=${encodeURIComponent(tool.name)}&subtitle=${encodeURIComponent(tool.category)}&logo=${encodeURIComponent(tool.info?.metadata?.logo_url || "")}`,
  });
}

// Helper to generate breadcrumb structured data
export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  const baseUrl = siteOrigin(); // #153

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.url}`,
    })),
  };
}

// Helper to format dates for SEO
export function formatSEODate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString();
}
