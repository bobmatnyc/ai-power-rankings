import type {
  BreadcrumbList,
  ItemList,
  Organization,
  Review,
  SearchAction,
  SoftwareApplication,
  WebSite,
  WithContext,
} from "schema-dts";
import type { Ranking, Tool } from "@/types/database";
import type { RankedTool } from "@/types/rankings";

const baseUrl =
  process.env["NEXT_PUBLIC_BASE_URL"] || process.env["VERCEL_URL"]
    ? `https://${process.env["VERCEL_URL"]}`
    : "";

export function createOrganizationSchema(): WithContext<Organization> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AI Power Rankings",
    alternateName: "AI Power Rankings - Developer Tool Intelligence",
    url: baseUrl,
    logo: {
      "@type": "ImageObject",
      url: `${baseUrl}/logo-1200x630.png`,
      width: "1200",
      height: "630",
    },
    description:
      "The definitive monthly rankings and analysis of agentic AI coding tools, trusted by 500K+ developers worldwide",
    sameAs: [
      "https://twitter.com/aipowerrankings",
      "https://github.com/aipowerrankings",
      "https://linkedin.com/company/aipowerrankings",
    ],
    foundingDate: "2025",
    knowsAbout: [
      "AI coding assistants",
      "Autonomous programming tools",
      "Developer productivity software",
      "Machine learning for software development",
      "Code generation AI",
      "Programming automation",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "hyperdev@matsuoka.com",
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
  };
}

export function createWebsiteSchema(): WithContext<WebSite> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AI Power Rankings",
    url: baseUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    } as SearchAction,
    publisher: {
      "@type": "Organization",
      name: "AI Power Rankings",
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/logo-1200x630.png`,
      },
    },
  };
}

export function createSoftwareApplicationSchema(
  tool: Tool,
  ranking?: Ranking,
  reviews?: Review[]
): WithContext<SoftwareApplication> {
  const aggregateRating = reviews?.length
    ? {
        "@type": "AggregateRating" as const,
        ratingValue:
          reviews.reduce((sum, r) => {
            const rating = r.reviewRating as { ratingValue?: number } | undefined;
            return sum + (rating?.ratingValue || 0);
          }, 0) / reviews.length,
        bestRating: 10,
        worstRating: 1,
        ratingCount: reviews.length,
      }
    : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    description: tool.info.product.description || "",
    url: tool.info.links.website || "",
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: tool.category,
    operatingSystem: "Windows, macOS, Linux",
    offers: tool.info.product.pricing_model
      ? {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
          availability: "https://schema.org/InStock",
          seller: {
            "@type": "Organization",
            name: tool.info.company.name || tool.name,
          },
        }
      : undefined,
    ...(aggregateRating && { aggregateRating }),
    creator: {
      "@type": "Organization",
      name: tool.info.company.name || tool.name,
      url: tool.info.company.website || tool.info.links.website || "",
    },
    datePublished: tool.created_at,
    dateModified: tool.updated_at,
    ...(ranking && {
      award: `#${ranking.position} in AI Power Rankings ${ranking.period}`,
    }),
    screenshot: tool.info.metadata?.logo_url
      ? {
          "@type": "ImageObject",
          url: tool.info.metadata.logo_url,
          caption: `${tool.name} logo`,
        }
      : undefined,
    featureList: [
      ...(tool.info.features?.key_features || []),
      `Category: ${tool.category}`,
      ...(tool.info.features?.languages_supported || []).map((lang: string) => `Supports ${lang}`),
      ...(tool.info.features?.ide_support || []).map((ide: string) => `${ide} integration`),
    ],
  };
}

export function createRankingSchema(rankings: RankedTool[], period: string): WithContext<ItemList> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `AI Power Rankings - ${period}`,
    description: `Monthly rankings of the best agentic AI coding tools for ${period}`,
    url: `${baseUrl}/rankings/${period}`,
    numberOfItems: rankings.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: rankings.map((ranking, index) => ({
      "@type": "ListItem",
      position: ranking.ranking.position || index + 1,
      name: ranking.name,
      item: {
        "@type": "SoftwareApplication",
        name: ranking.name,
        url: `${baseUrl}/tools/${ranking.slug}`,
        description: `${ranking.name} - Ranked #${ranking.ranking.position} in ${period}`,
        applicationCategory: "DeveloperApplication",
      },
    })),
  };
}

export function createBreadcrumbSchema(
  items: { name: string; url: string }[]
): WithContext<BreadcrumbList> {
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

export function createComparisonSchema(
  tool1: Tool,
  tool2: Tool
): WithContext<{
  "@type": "Article";
  "@id": string;
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  author: {
    "@type": "Organization";
    name: string;
    url: string;
  };
  publisher: {
    "@type": "Organization";
    name: string;
    logo: {
      "@type": "ImageObject";
      url: string;
    };
  };
  mainEntity: {
    "@type": "ItemList";
    name: string;
    numberOfItems: number;
    itemListElement: Array<{
      "@type": "ListItem";
      position: number;
      item: {
        "@type": "SoftwareApplication";
        name: string;
        url: string;
        applicationCategory: string;
      };
    }>;
  };
}> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${baseUrl}/compare/${tool1.slug}-vs-${tool2.slug}`,
    headline: `${tool1.name} vs ${tool2.name} - AI Coding Tools Comparison`,
    description: `Detailed comparison between ${tool1.name} and ${tool2.name} covering features, pricing, performance, and use cases`,
    url: `${baseUrl}/compare/${tool1.slug}-vs-${tool2.slug}`,
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    author: {
      "@type": "Organization",
      name: "AI Power Rankings",
      url: baseUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "AI Power Rankings",
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/logo-1200x630.png`,
      },
    },
    mainEntity: {
      "@type": "ItemList",
      name: "Compared Tools",
      numberOfItems: 2,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          item: {
            "@type": "SoftwareApplication",
            name: tool1.name,
            url: tool1.info.links.website || "",
            applicationCategory: "DeveloperApplication",
          },
        },
        {
          "@type": "ListItem",
          position: 2,
          item: {
            "@type": "SoftwareApplication",
            name: tool2.name,
            url: tool2.info.links.website || "",
            applicationCategory: "DeveloperApplication",
          },
        },
      ],
    },
  };
}

// Helper to inject schema into page
export function generateSchemaScript(schema: WithContext<any> | WithContext<any>[]): string {
  const schemas = Array.isArray(schema) ? schema : [schema];
  return JSON.stringify(schemas);
}
