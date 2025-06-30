import { MetadataRoute } from "next";
import { getToolsRepo, getRankingsRepo } from "@/lib/json-db";
import { i18n } from "@/i18n/config";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Revalidate every hour

async function getTools() {
  try {
    const toolsRepo = getToolsRepo();
    const tools = await toolsRepo.getByStatus("active");

    return tools.map((tool) => ({
      slug: tool.slug,
      updated_at: tool.updated_at,
    }));
  } catch (error) {
    console.warn("Failed to fetch tools for sitemap:", error);
    return [];
  }
}

async function getLatestRankingPeriod() {
  try {
    const rankingsRepo = getRankingsRepo();
    const currentPeriod = await rankingsRepo.getCurrentPeriod();
    return currentPeriod;
  } catch (error) {
    console.warn("Failed to fetch latest ranking period for sitemap:", error);
    return null;
  }
}

// Helper function to generate alternates for all languages
function generateAlternates(basePath: string, baseUrl: string) {
  const alternates: Record<string, string> = {
    "x-default": `${baseUrl}${basePath}`, // Default to English
    en: `${baseUrl}${basePath}`,
  };

  // Add all other language versions
  i18n.locales.forEach((locale) => {
    if (locale !== "en") {
      alternates[locale] = `${baseUrl}/${locale}${basePath}`;
    }
  });

  return alternates;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerrankings.com";
  const currentDate = new Date().toISOString();

  // Get dynamic data
  const [tools, latestPeriod] = await Promise.all([getTools(), getLatestRankingPeriod()]);

  // Core pages with high priority and language alternates
  const coreSitemap: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 1.0,
      alternates: {
        languages: generateAlternates("", baseUrl),
      },
    },
    {
      url: `${baseUrl}/rankings`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.9,
      alternates: {
        languages: generateAlternates("/rankings", baseUrl),
      },
    },
    {
      url: `${baseUrl}/tools`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: {
        languages: generateAlternates("/tools", baseUrl),
      },
    },
    {
      url: `${baseUrl}/news`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.7,
      alternates: {
        languages: generateAlternates("/news", baseUrl),
      },
    },
    {
      url: `${baseUrl}/methodology`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: {
        languages: generateAlternates("/methodology", baseUrl),
      },
    },
    {
      url: `${baseUrl}/about`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.5,
      alternates: {
        languages: generateAlternates("/about", baseUrl),
      },
    },
    {
      url: `${baseUrl}/updates`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.6,
      alternates: {
        languages: generateAlternates("/updates", baseUrl),
      },
    },
  ];

  // Language-specific versions of core pages
  const languagePages: MetadataRoute.Sitemap = i18n.locales
    .filter((locale) => locale !== "en") // English is already in coreSitemap
    .flatMap((locale) =>
      coreSitemap.map((page) => ({
        ...page,
        url: page.url.replace(baseUrl, `${baseUrl}/${locale}`),
        priority: (page.priority || 0.5) * 0.9, // Slightly lower priority for translated pages
        // Keep the same alternates as the original page
        alternates: page.alternates,
      }))
    );

  // Tool detail pages with alternates
  const toolPages: MetadataRoute.Sitemap = tools.flatMap((tool) => {
    // Ensure we have a valid date
    const toolDate =
      tool.updated_at && !isNaN(Date.parse(tool.updated_at))
        ? new Date(tool.updated_at).toISOString()
        : currentDate;

    const alternates = generateAlternates(`/tools/${tool.slug}`, baseUrl);
    const pages = [
      {
        url: `${baseUrl}/tools/${tool.slug}`,
        lastModified: toolDate,
        changeFrequency: "weekly" as const,
        priority: 0.8,
        alternates: {
          languages: alternates,
        },
      },
    ];

    // Add language-specific tool pages
    i18n.locales.forEach((locale) => {
      if (locale !== "en") {
        pages.push({
          url: `${baseUrl}/${locale}/tools/${tool.slug}`,
          lastModified: toolDate,
          changeFrequency: "weekly" as const,
          priority: 0.7,
          alternates: {
            languages: alternates,
          },
        });
      }
    });

    return pages;
  });

  // Historical ranking pages if we have periods
  const rankingPages: MetadataRoute.Sitemap = latestPeriod
    ? [
        {
          url: `${baseUrl}/rankings/${latestPeriod}`,
          lastModified: currentDate,
          changeFrequency: "never",
          priority: 0.6,
          alternates: {
            languages: generateAlternates(`/rankings/${latestPeriod}`, baseUrl),
          },
        },
        ...i18n.locales
          .filter((locale) => locale !== "en")
          .map((locale) => ({
            url: `${baseUrl}/${locale}/rankings/${latestPeriod}`,
            lastModified: currentDate,
            changeFrequency: "never" as const,
            priority: 0.5,
            alternates: {
              languages: generateAlternates(`/rankings/${latestPeriod}`, baseUrl),
            },
          })),
      ]
    : [];

  // Combine all sitemaps
  return [...coreSitemap, ...languagePages, ...toolPages, ...rankingPages];
}
