import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { toolsRepository } from "@/lib/db/repositories/tools.repository";
import { newsRepository } from "@/lib/db/repositories/news";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://aipowerranking.com";

// Category page slugs based on existing app structure
const categoryPages = [
  "best-ai-coding-tools",
  "best-ai-code-editors",
  "best-autonomous-agents",
  "best-code-review-tools",
  "best-testing-tools",
  "best-devops-assistants",
  "best-ide-assistants",
  "best-open-source-frameworks",
  "best-ai-app-builders",
] as const;

// Static pages with their change frequencies
const staticPages = [
  { path: "", changeFrequency: "daily" as const, priority: 1.0 }, // Homepage
  { path: "rankings", changeFrequency: "daily" as const, priority: 0.9 },
  { path: "tools", changeFrequency: "daily" as const, priority: 0.9 },
  { path: "news", changeFrequency: "daily" as const, priority: 0.9 },
  { path: "methodology", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "about", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "privacy", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "terms", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "contact", changeFrequency: "monthly" as const, priority: 0.5 },
] as const;

/**
 * Sitemap generation with dynamic routes from database
 *
 * This sitemap is generated at build time AND regenerated at runtime when requested.
 * - At build time: Database may not be available, so we generate static routes only
 * - At runtime: Full sitemap with all dynamic routes from database
 *
 * Next.js will cache this sitemap and revalidate it based on the revalidate export.
 */
export const revalidate = 3600; // Revalidate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [];
  const isBuildTime = !process.env.DATABASE_URL;

  // 1. Generate static routes for all languages
  for (const locale of locales) {
    for (const page of staticPages) {
      const path = page.path === "" ? `/${locale}` : `/${locale}/${page.path}`;
      routes.push({
        url: `${baseUrl}${path}`,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
      });
    }
  }

  // 2. Generate category pages for all languages
  for (const locale of locales) {
    for (const category of categoryPages) {
      routes.push({
        url: `${baseUrl}/${locale}/${category}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }

  // Skip dynamic routes during build time
  if (isBuildTime) {
    console.log(`[sitemap] Build time: Generated ${routes.length} static routes only`);
    return routes;
  }

  // 3. Generate dynamic tool pages from database (runtime only)
  try {
    const tools = await toolsRepository.findAll();

    for (const tool of tools) {
      // Only include active tools in sitemap
      if (tool.status === "active") {
        for (const locale of locales) {
          routes.push({
            url: `${baseUrl}/${locale}/tools/${tool.slug}`,
            lastModified: tool.updated_at ? new Date(tool.updated_at) : new Date(),
            changeFrequency: "weekly",
            priority: 0.7,
          });
        }
      }
    }

    console.log(`[sitemap] Generated ${tools.length} tool pages across ${locales.length} languages`);
  } catch (error) {
    console.error("[sitemap] Error fetching tools for sitemap:", error);
    // Continue generating sitemap even if tools query fails
  }

  // 4. Generate dynamic news article pages from database (runtime only)
  try {
    const newsArticles = await newsRepository.getAll();

    for (const article of newsArticles) {
      for (const locale of locales) {
        routes.push({
          url: `${baseUrl}/${locale}/news/${article.slug}`,
          lastModified: article.publishedAt || new Date(),
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    }

    console.log(`[sitemap] Generated ${newsArticles.length} news pages across ${locales.length} languages`);
  } catch (error) {
    console.error("[sitemap] Error fetching news articles for sitemap:", error);
    // Continue generating sitemap even if news query fails
  }

  console.log(`[sitemap] Total URLs generated: ${routes.length}`);

  return routes;
}
