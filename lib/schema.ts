/**
 * Schema markup utilities for SEO
 */
import { RANKING_METHOD_QUESTION, type RankingMethodAnswer } from "@/lib/rankings/method-answer";

export interface ToolSchemaData {
  name: string;
  description?: string;
  category: string;
  company?: string;
  website?: string;
  pricing?: string;
  logo?: string;
  github?: string;
  /** #280: the rank on the tool's own per-list board, never a stored `current_rank`. */
  rank?: number;
  /** #280: the score on that board (0-100). */
  score?: number;
  /** #280: the board's display name, e.g. "Coding harnesses". */
  rankingList?: string;
  users?: number;
  rating?: number;
  ratingCount?: number;
}

export interface OrganizationSchemaData {
  name: string;
  url: string;
  logo?: string;
  description?: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * Generate Schema.org markup for a tool page
 */
export function generateToolSchema(tool: ToolSchemaData) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    description: tool.description || `${tool.name} - AI-powered tool for developers`,
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: tool.category,
    operatingSystem: "Web",
    url: tool.website,
    ...(tool.logo && {
      image: tool.logo,
    }),
    ...(tool.company && {
      creator: {
        "@type": "Organization",
        name: tool.company,
      },
    }),
    ...(tool.pricing && {
      offers: {
        "@type": "Offer",
        description: tool.pricing,
        availability: "https://schema.org/InStock",
      },
    }),
    ...(tool.score &&
      tool.rank && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: Math.round(tool.score / 10), // Convert 0-100 to 0-10 scale
          bestRating: 10,
          worstRating: 0,
          ratingCount: tool.ratingCount || 1,
        },
      }),
    ...(tool.users && {
      interactionStatistic: {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/UserLikes",
        userInteractionCount: tool.users,
      },
    }),
    ...(tool.github && {
      codeRepository: tool.github,
    }),
  };

  return schema;
}

/**
 * Generate Schema.org markup for organization
 */
export function generateOrganizationSchema(org: OrganizationSchemaData) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: org.name,
    url: org.url,
    ...(org.logo && {
      logo: {
        "@type": "ImageObject",
        url: org.logo,
        width: 512,
        height: 512,
      },
    }),
    ...(org.description && {
      description: org.description,
    }),
    sameAs: [
      "https://hyperdev.matsuoka.com/",
      "https://hyperdev.matsuoka.com/",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: [
        "English",
        "Japanese",
        "Chinese",
        "Spanish",
        "French",
        "German",
        "Korean",
        "Portuguese",
      ],
    },
    foundingDate: "2024",
    expertise: "AI tool evaluation and ranking",
    knowsAbout: [
      "Artificial Intelligence",
      "Developer Tools",
      "Coding Assistants",
      "Software Development",
      "AI Benchmarking",
    ],
  };
}

/**
 * Generate Schema.org Website markup
 */
export function generateWebsiteSchema(baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AI Power Rankings",
    url: baseUrl,
    description:
      "The definitive monthly rankings and analysis of agentic AI coding tools, trusted by developers worldwide.",
    // #233: no site-search potentialAction; its target URL would put the term in page_location.
    audience: {
      "@type": "Audience",
      audienceType: "Developers and Software Engineers",
    },
    mainEntity: {
      "@type": "ItemList",
      name: "AI Coding Tools Rankings",
      description: "Monthly rankings of AI-powered coding tools and developer assistants",
    },
    inLanguage: ["en", "ja", "zh", "es", "fr", "de", "ko", "pt"],
  };
}

/**
 * Generate Schema.org breadcrumb markup
 */
export function generateBreadcrumbSchema(items: BreadcrumbItem[], baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${baseUrl}${item.url}`,
    })),
  };
}

/**
 * Generate FAQ Schema for rankings methodology.
 * #280: the first answer is the ranking page's own answer box text (`rankingMethodAnswer`).
 */
export function generateRankingFAQSchema(method: Pick<RankingMethodAnswer, "text">) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: RANKING_METHOD_QUESTION,
        acceptedAnswer: {
          "@type": "Answer",
          text: method.text,
        },
      },
      {
        "@type": "Question",
        name: "How often are rankings updated?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Rankings are recalculated monthly with fresh data from multiple sources including GitHub statistics, user metrics, funding announcements, and technical benchmarks.",
        },
      },
      {
        "@type": "Question",
        name: "What makes a tool rank higher?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Tools rank higher based on strong performance across technical capabilities, user adoption, innovation, and business metrics. Our algorithm weighs both quantitative metrics and qualitative factors.",
        },
      },
    ],
  };
}

/**
 * Generate Review Schema for tool evaluations
 */
export function generateToolReviewSchema(tool: ToolSchemaData, baseUrl: string) {
  if (!tool.score || !tool.rank) {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "Review",
    itemReviewed: {
      "@type": "SoftwareApplication",
      name: tool.name,
    },
    author: {
      "@type": "Organization",
      name: "AI Power Rankings",
      url: baseUrl,
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: Math.round(tool.score / 10), // Convert 0-100 to 0-10 scale
      bestRating: 10,
      worstRating: 0,
    },
    // #280: the rank is counted within one list, so the body names that list and no algorithm version.
    reviewBody: `${tool.name} ranks #${tool.rank}${tool.rankingList ? ` in the ${tool.rankingList} list` : ""} of AI Power Rankings, with a score of ${Math.round(tool.score * 10) / 10}/100.`,
  };
}

/**
 * Create structured data for Next.js Head
 */
export function createJsonLdScript(schema: object): string {
  return JSON.stringify(schema, null, 2);
}
