import type { Metadata } from "next";
import { canonicalLocale, localizedAlternates } from "@/lib/seo/alternates";
import { siteOrigin } from "@/lib/site-origin";
import { isNoindexToolSlug } from "@/lib/seo/url-table";
import { toMetaDescription } from "@/lib/article-summary";
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
      locale: canonicalLocale(lang), // #156: the page locale; en for an unknown segment.
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

/** The meta description ceiling (#179). */
const TOOL_META_DESCRIPTION_MAX = 160;

const CODING_WORDING = { noun: "AI Coding Tool", plural: "AI coding tools" };

/** Per-kind wording (#424); the kinds are the per-list boards. */
const KIND_WORDING: Record<string, { noun: string; plural: string }> = {
  harness: CODING_WORDING,
  model: { noun: "AI Model", plural: "AI models" },
  productivity: { noun: "AI Productivity Tool", plural: "AI productivity tools" },
};

/** Title noun and plural for a tool kind; the coding-tool wording for an unknown or missing kind. */
function toolKindWording(kind: unknown): { noun: string; plural: string } {
  return typeof kind === "string" && Object.hasOwn(KIND_WORDING, kind) ? KIND_WORDING[kind]! : CODING_WORDING;
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

  // #424: the title and description wording follow the tool's kind; an unknown or missing kind keeps the coding-tool wording.
  const wording = toolKindWording(tool.kind);
  const title = `${tool.name} - ${wording.noun} Review & Rankings`;

  // Safely access nested description with fallbacks to flat structure
  const toolDescription =
    tool.info?.product?.description ||
    tool.info?.product?.tagline ||
    tool.description ||
    "";

  // #424: the fixed tail stays whole; only the tool's own text is cut so the result fits the 160-character meta rule (#179).
  const tail = `Compare ${tool.name} with other ${wording.plural}. Features, pricing, performance benchmarks, and user reviews.`;
  const lead = toolDescription.trim()
    ? toMetaDescription(toolDescription, Math.max(0, TOOL_META_DESCRIPTION_MAX - tail.length - 1))
    : "";
  const description = lead && lead !== "…" ? `${lead} ${tail}` : tail;

  return generateMetadata({
    title,
    description,
    lang,
    path: `/tools/${tool.slug}`,
    keywords,
    ogImage: `/api/og?title=${encodeURIComponent(tool.name)}&subtitle=${encodeURIComponent(tool.category)}&logo=${encodeURIComponent(tool.info?.metadata?.logo_url || "")}`,
    // #191: the signed URL table keeps these pages served but out of the index.
    // D91: an inactive tool (e.g. a family row before its fold) is noindex; a redirect row is not.
    // D58: a deprecated (archived) tool is noindex too; its page stays served.
    noIndex: isNoindexToolSlug(tool.slug) || tool.status === "inactive" || tool.status === "deprecated",
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
