import type { Metadata } from "next";
import { generateToolOGImageUrl, sanitizeForUrl } from "@/lib/og-utils";

interface ToolData {
  tool: {
    name: string;
    category: string;
    info?: {
      company?: { name?: string };
      product?: { description?: string; tagline?: string };
      links?: { website?: string };
      metadata?: { logo_url?: string };
    };
  };
  ranking?: {
    rank: number;
    scores: { overall: number };
  };
  metrics?: {
    users?: number;
  };
}

export async function generateToolMetadata(slug: string): Promise<Metadata> {
  try {
    // Fetch tool data from API
    const isDev = process.env["NODE_ENV"] === "development";
    const baseUrl = isDev
      ? "http://localhost:3000"
      : process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerranking.com";

    const response = await fetch(`${baseUrl}/api/tools/${slug}`, {
      next: { revalidate: isDev ? 0 : 3600 }, // Revalidate every hour in production
    });

    if (!response.ok) {
      return getDefaultToolMetadata(slug);
    }

    const toolData: ToolData = await response.json();
    const { tool, ranking } = toolData;

    // Generate OG image
    const ogImageUrl = generateToolOGImageUrl({
      name: sanitizeForUrl(tool.name),
      category: tool.category,
      rank: ranking?.rank,
      score: ranking?.scores?.overall,
      logo: tool.info?.metadata?.logo_url,
      company: tool.info?.company?.name,
    });

    // Create description
    const description =
      tool.info?.product?.description ||
      tool.info?.product?.tagline ||
      `${tool.name} - AI-powered tool for developers. Compare features, pricing, and performance in our comprehensive rankings.`;

    // Create title with ranking info
    const titleParts = [tool.name];
    if (ranking?.rank) {
      titleParts.push(`(Ranked #${ranking.rank})`);
    }
    if (tool.info?.company?.name) {
      titleParts.push(`by ${tool.info.company.name}`);
    }
    const title = titleParts.join(" ");

    // Generate keywords
    const keywords = [
      tool.name,
      tool.category.replace(/-/g, " "),
      "AI tool",
      "developer tools",
      "coding assistant",
      "artificial intelligence",
    ];

    if (tool.info?.company?.name) {
      keywords.push(tool.info.company.name);
    }
    if (ranking?.rank) {
      keywords.push(`rank ${ranking.rank}`, "AI rankings");
    }

    return {
      title,
      description: description.substring(0, 160),
      keywords: keywords.join(", "),
      authors: [{ name: "AI Power Rankings Team" }],
      creator: "AI Power Rankings",
      publisher: "AI Power Rankings",
      openGraph: {
        title: `${tool.name} - AI Tool Review & Ranking`,
        description,
        type: "article",
        url: `${baseUrl}/tools/${slug}`,
        siteName: "AI Power Rankings",
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: `${tool.name} - AI Tool Ranking`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        site: "@aipowerrankings",
        creator: "@aipowerrankings",
        title: `${tool.name} - AI Tool Review`,
        description,
        images: [ogImageUrl],
      },
      alternates: {
        canonical: `${baseUrl}/tools/${slug}`,
      },
      other: {
        "article:section": "AI Tools",
        "article:tag": keywords.slice(0, 5).join(","),
      },
    };
  } catch (error) {
    console.error("Error generating tool metadata:", error);
    return getDefaultToolMetadata(slug);
  }
}

function getDefaultToolMetadata(slug: string): Metadata {
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerranking.com";
  const fallbackOGUrl = `${baseUrl}/api/og?title=${encodeURIComponent("AI Tool")}&subtitle=Developer%20Tool%20Intelligence`;

  return {
    title: "AI Tool - AI Power Rankings",
    description: "Comprehensive AI tool analysis and ranking from AI Power Rankings.",
    openGraph: {
      title: "AI Tool - AI Power Rankings",
      description: "Comprehensive AI tool analysis and ranking from AI Power Rankings.",
      type: "article",
      url: `${baseUrl}/tools/${slug}`,
      siteName: "AI Power Rankings",
      images: [
        {
          url: fallbackOGUrl,
          width: 1200,
          height: 630,
          alt: "AI Tool - AI Power Rankings",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@aipowerrankings",
      creator: "@aipowerrankings",
      images: [fallbackOGUrl],
    },
  };
}
