import { Metadata } from "next";
import { type Tool } from "@/types/database";
import { type RankedTool } from "@/types/rankings";

interface GenerateMetadataProps {
  title: string;
  description: string;
  path?: string;
  ogImage?: string;
  keywords?: string[];
  noIndex?: boolean;
  lastModified?: Date;
}

export function generateMetadata({
  title,
  description,
  path = "",
  ogImage,
  keywords = [],
  noIndex = false,
  lastModified,
}: GenerateMetadataProps): Metadata {
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerrankings.com";
  const url = `${baseUrl}${path}`;

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
      locale: "en_US",
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
    alternates: {
      canonical: url,
      languages: {
        "en-US": url,
        "ja-JP": `${baseUrl}/ja${path}`,
        "zh-CN": `${baseUrl}/zh${path}`,
        "es-ES": `${baseUrl}/es${path}`,
        "fr-FR": `${baseUrl}/fr${path}`,
        "de-DE": `${baseUrl}/de${path}`,
        "ko-KR": `${baseUrl}/ko${path}`,
        "pt-BR": `${baseUrl}/pt${path}`,
      },
    },
    ...(lastModified && { lastModified: lastModified.toISOString() }),
  };
}

export function generateToolMetadata(tool: Tool): Metadata {
  const keywords = [
    tool.name,
    tool.category,
    ...(tool.info.features?.languages_supported || []),
    ...(tool.info.features?.ide_support || []),
    "AI coding assistant",
    "developer tools",
  ];

  const title = `${tool.name} - AI Coding Tool Review & Rankings`;
  const description = `${tool.info.product.description || tool.info.product.tagline || ""} Compare ${tool.name} with other AI coding tools. Features, pricing, performance benchmarks, and user reviews.`;

  return generateMetadata({
    title,
    description,
    path: `/tools/${tool.slug}`,
    keywords,
    ogImage: `/api/og?title=${encodeURIComponent(tool.name)}&subtitle=${encodeURIComponent(tool.category)}&logo=${encodeURIComponent(tool.info.metadata?.logo_url || "")}`,
  });
}

export function generateRankingMetadata(period: string, rankings?: RankedTool[]): Metadata {
  const title = `AI Coding Tools Rankings - ${period}`;
  const description = `Monthly rankings of the best AI coding assistants for ${period}. Compare Cursor, GitHub Copilot, Claude, and 50+ tools based on performance, features, and developer satisfaction.`;

  const topTools =
    rankings
      ?.slice(0, 5)
      .map((r) => r.name)
      .join(", ") || "";
  const keywords = [
    "AI rankings",
    period,
    "coding tools comparison",
    "best AI assistants",
    ...topTools.split(", "),
  ];

  return generateMetadata({
    title,
    description,
    path: `/rankings/${period}`,
    keywords,
    ogImage: `/api/og?title=${encodeURIComponent(title)}&subtitle=Top Tools: ${encodeURIComponent(topTools)}`,
  });
}

export function generateComparisonMetadata(tool1: Tool, tool2: Tool): Metadata {
  const title = `${tool1.name} vs ${tool2.name} - AI Coding Tools Comparison`;
  const description = `Detailed comparison between ${tool1.name} and ${tool2.name}. Features, pricing, performance benchmarks, and which AI coding assistant is better for your needs.`;

  const keywords = [
    tool1.name,
    tool2.name,
    `${tool1.name} vs ${tool2.name}`,
    "AI tools comparison",
    "coding assistant comparison",
    tool1.category,
    tool2.category,
  ];

  return generateMetadata({
    title,
    description,
    path: `/compare/${tool1.slug}-vs-${tool2.slug}`,
    keywords,
    ogImage: `/api/og?title=${encodeURIComponent(title)}`,
  });
}

// Helper to generate breadcrumb structured data
export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerrankings.com";

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
