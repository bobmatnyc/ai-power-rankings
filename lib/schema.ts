/**
 * Schema markup utilities for SEO
 */

export interface ToolSchemaData {
  name: string;
  description?: string;
  category: string;
  company?: string;
  website?: string;
  pricing?: string;
  logo?: string;
  github?: string;
  rank?: number;
  score?: number;
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
      "https://twitter.com/aipowerrankings",
      "https://github.com/bobmatnyc/ai-power-rankings",
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
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/tools?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
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
 * Generate FAQ Schema for rankings methodology
 */
export function generateRankingFAQSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How are AI tools ranked?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "AI tools are ranked using our proprietary Algorithm v7.1, which evaluates 8 key factors: Agentic Capability, Innovation, Technical Performance, Developer Adoption, Market Traction, Business Sentiment, Development Velocity, and Platform Resilience.",
        },
      },
      {
        "@type": "Question",
        name: "How often are rankings updated?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Rankings are updated weekly with fresh data from multiple sources including GitHub statistics, user metrics, funding announcements, and technical benchmarks.",
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
    reviewBody: `${tool.name} ranks #${tool.rank} in our comprehensive AI tool rankings, with a score of ${tool.score}/100 based on our Algorithm v7.1 evaluation.`,
  };
}

/**
 * Create structured data for Next.js Head
 */
export function createJsonLdScript(schema: object): string {
  return JSON.stringify(schema, null, 2);
}
