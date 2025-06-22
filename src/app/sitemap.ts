import { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Revalidate every hour

async function getTools() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("tools")
    .select("slug, updated_at")
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  return data || [];
}

async function getLatestRankingPeriod() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("ranking_snapshots")
    .select("period")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return data?.period;
}

const languages = ["en", "ja", "zh", "es", "fr", "de", "ko", "pt"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerrankings.com";
  const currentDate = new Date().toISOString();

  // Get dynamic data
  const [tools, latestPeriod] = await Promise.all([getTools(), getLatestRankingPeriod()]);

  // Core pages with high priority
  const coreSitemap: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/rankings`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tools`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/news`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/methodology`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/updates`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  // Language-specific versions of core pages
  const languagePages: MetadataRoute.Sitemap = languages.flatMap((lang) =>
    coreSitemap.map((page) => ({
      ...page,
      url: page.url.replace(baseUrl, `${baseUrl}/${lang}`),
      priority: (page.priority || 0.5) * 0.9, // Slightly lower priority for translated pages
    }))
  );

  // Tool detail pages
  const toolPages: MetadataRoute.Sitemap = tools.flatMap((tool: any) => {
    // Ensure we have a valid date
    const toolDate =
      tool.updated_at && !isNaN(Date.parse(tool.updated_at))
        ? new Date(tool.updated_at).toISOString()
        : currentDate;

    const pages = [
      {
        url: `${baseUrl}/tools/${tool.slug}`,
        lastModified: toolDate,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      },
    ];

    // Add language-specific tool pages
    languages.forEach((lang) => {
      pages.push({
        url: `${baseUrl}/${lang}/tools/${tool.slug}`,
        lastModified: toolDate,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      });
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
        },
        ...languages.map((lang) => ({
          url: `${baseUrl}/${lang}/rankings/${latestPeriod}`,
          lastModified: currentDate,
          changeFrequency: "never" as const,
          priority: 0.5,
        })),
      ]
    : [];

  // Combine all sitemaps
  return [...coreSitemap, ...languagePages, ...toolPages, ...rankingPages];
}
