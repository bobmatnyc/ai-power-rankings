/**
 * The URLs `/sitemap.xml` lists, and their XML form.
 *
 * Why: #162 — the sitemap moved from the `app/sitemap.ts` metadata route, which
 * `next build` prerendered while `getDb()` refuses to connect, to a per-request
 * route handler (`app/sitemap.xml/route.ts`) that sets its own cache headers. A
 * route file may only export route fields, so the list and the serialiser live
 * here.
 * What: `buildSitemapEntries` returns the static pages, category pages, active
 * tools and active news articles, and throws when either database read fails.
 * `renderSitemapXml` serialises entries as a sitemaps.org 0.9 `<urlset>`.
 * Test: `tests/unit/sitemap-route.test.ts`, `tests/unit/seo-canonical-origin.test.ts`.
 */
import type { MetadataRoute } from "next";
import { i18n, locales } from "@/i18n/config";
import { newsRepository } from "@/lib/db/repositories/news";
import { toolsRepository } from "@/lib/db/repositories/tools.repository";

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

// Static pages with their change frequencies. #156: `englishOnly` marks a page
// whose body is English in every locale; it canonicalises to /en (see
// englishOnlyAlternates()), so only that URL is listed.
const staticPages = [
  { path: "", changeFrequency: "daily" as const, priority: 1.0, englishOnly: false }, // Homepage
  { path: "rankings", changeFrequency: "daily" as const, priority: 0.9, englishOnly: false },
  { path: "tools", changeFrequency: "daily" as const, priority: 0.9, englishOnly: false },
  { path: "news", changeFrequency: "daily" as const, priority: 0.9, englishOnly: true },
  { path: "trending", changeFrequency: "daily" as const, priority: 0.9, englishOnly: false },
  { path: "methodology", changeFrequency: "monthly" as const, priority: 0.7, englishOnly: true },
  { path: "about", changeFrequency: "monthly" as const, priority: 0.7, englishOnly: true },
  { path: "privacy", changeFrequency: "yearly" as const, priority: 0.3, englishOnly: true },
  { path: "terms", changeFrequency: "yearly" as const, priority: 0.3, englishOnly: true },
  // #156: the canonical URL; /{lang}/contact only redirects here.
  { path: "contact/default", changeFrequency: "monthly" as const, priority: 0.5, englishOnly: true },
] as const;

/**
 * Every URL the sitemap lists, read from the database at call time.
 *
 * Why: A sitemap missing its articles or tools must never be returned as if it
 * were complete (#162), so a failed read propagates instead of being skipped.
 * What: Static pages in every locale (English-only pages under `/en` only),
 * category pages under `/en`, each active tool in every locale, and each active
 * article once under `/en/news/<slug>` with `lastModified` set to its date. All
 * URLs start with `baseUrl`. Rejects when either repository read rejects.
 * Test: `tests/unit/sitemap-route.test.ts`, `tests/unit/seo-canonical-origin.test.ts`.
 */
export async function buildSitemapEntries(
  baseUrl: string,
  now: Date = new Date()
): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = [];

  // 1. Static routes: every locale, or /en only for an English-only page
  for (const locale of locales) {
    for (const page of staticPages) {
      if (page.englishOnly && locale !== i18n.defaultLocale) continue;
      const path = page.path === "" ? `/${locale}` : `/${locale}/${page.path}`;
      routes.push({
        url: `${baseUrl}${path}`,
        lastModified: now,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
      });
    }
  }

  // 2. Category pages. #156: their body is English literals in every locale
  // and they canonicalise to /en, so only that URL is listed.
  for (const category of categoryPages) {
    routes.push({
      url: `${baseUrl}/${i18n.defaultLocale}/${category}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // #162: both reads throw on failure; neither is caught here, so a partial
  // list never reaches a cache.
  const [tools, articles] = await Promise.all([
    toolsRepository.findAll(),
    newsRepository.getPublishedSlugs(),
  ]);

  // 3. Active tool pages, one per locale
  for (const tool of tools) {
    if (tool.status !== "active") continue;
    for (const locale of locales) {
      routes.push({
        url: `${baseUrl}/${locale}/tools/${tool.slug}`,
        lastModified: tool.updated_at ? new Date(tool.updated_at) : now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  }

  // 4. News articles. #156: article bodies are English-only and every locale's
  // article page canonicalises to /en, so only that URL is listed.
  for (const article of articles) {
    routes.push({
      url: `${baseUrl}/${i18n.defaultLocale}/news/${article.slug}`,
      lastModified: article.publishedAt,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return routes;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Serialises entries as a sitemaps.org 0.9 `<urlset>`, one `<url>` per entry. */
export function renderSitemapXml(entries: MetadataRoute.Sitemap): string {
  const urls = entries.map((entry) => {
    const lines = [`<loc>${escapeXml(entry.url)}</loc>`];
    if (entry.lastModified !== undefined) {
      const date = entry.lastModified instanceof Date ? entry.lastModified : new Date(entry.lastModified);
      lines.push(`<lastmod>${date.toISOString()}</lastmod>`);
    }
    if (entry.changeFrequency) lines.push(`<changefreq>${entry.changeFrequency}</changefreq>`);
    if (entry.priority !== undefined) lines.push(`<priority>${entry.priority}</priority>`);
    return `<url>\n${lines.join("\n")}\n</url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}
