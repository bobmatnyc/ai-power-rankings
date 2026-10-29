/**
 * The URLs `/sitemap.xml` lists, and their XML form.
 *
 * Why: #162 — the sitemap moved from the `app/sitemap.ts` metadata route, which
 * `next build` prerendered while `getDb()` refuses to connect, to a per-request
 * route handler (`app/sitemap.xml/route.ts`) that sets its own cache headers. A
 * route file may only export route fields, so the list and the serialiser live
 * here.
 * What: `buildSitemapEntries` returns the static pages, category pages, active
 * tools, active news articles, monthly What's New reports and weekly digests,
 * and throws when any database read fails except the optional digest read.
 * `renderSitemapXml` serialises entries as a sitemaps.org 0.9 `<urlset>`.
 * Test: `tests/unit/sitemap-route.test.ts`, `tests/unit/seo-canonical-origin.test.ts`.
 */
import type { MetadataRoute } from "next";
import { i18n, locales } from "@/i18n/config";
import { newsRepository } from "@/lib/db/repositories/news";
import { toolsRepository } from "@/lib/db/repositories/tools.repository";
import {
  DEFAULT_RANKING_LIST,
  isMetricGatedList,
  isRankingListIndexable,
  listOfTool,
  RANKING_LISTS,
  type RankingList,
  rankingListPath,
} from "@/lib/rankings/lists";
import { loggers } from "@/lib/logger";
import { loadCurrentRankings } from "@/lib/rankings/current-rankings";
import { listDigestWeeks } from "@/lib/services/weekly-digest.repository";
import { listPeriods } from "@/lib/services/whats-new-summary.service";
import { isNoindexToolSlug, isTableRedirectSource } from "@/lib/seo/url-table";

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
 * article once under `/en/news/<slug>` with `lastModified` set to its date, and
 * each stored monthly report once under `/en/whats-new/<period>` (#54) and each
 * stored weekly digest once under `/en/whats-new/weekly/<week>` (#181). #191:
 * table 308 sources and noindex tools are left out. #186: each non-default list page
 * (`/rankings/<slug>`) in every locale when the list has at least 10 active tools
 * (D53); the models list also needs 10 active board rows with metrics, counted by
 * `loadCurrentRankings` as the page does (#329, D63); `/rankings` is the harness list's canonical, so `/rankings/coding-harnesses`
 * is never listed. All URLs start with `baseUrl`. Rejects when any database read rejects,
 * except the models board read, whose failure only leaves `/rankings/models` out (#329),
 * and the weekly digest read, whose failure is logged and only leaves the digest URLs out (#181).
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

  // #162: the tool, article and report reads throw on failure; none is caught
  // here, so a partial list never reaches a cache. #54 adds the report periods.
  const [tools, articles, reportPeriods, digestWeeks] = await Promise.all([
    toolsRepository.findAll(),
    newsRepository.getPublishedSlugs(),
    listPeriods(),
    // #181: digest URLs are optional, like the /whats-new list; a failed read (e.g. the
    // weekly_digests table not migrated yet) logs and leaves them out instead of a 503.
    listDigestWeeks().catch((error: unknown) => {
      loggers.api.error("Sitemap: weekly digest read failed; digest URLs left out", {
        name: error instanceof Error ? error.name : typeof error,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }),
  ]);

  // 3. Active tool pages, one per locale
  for (const tool of tools) {
    if (tool.status !== "active") continue;
    // #191: a noindex tool leaves the sitemap in every locale.
    if (isNoindexToolSlug(tool.slug)) continue;
    for (const locale of locales) {
      routes.push({
        url: `${baseUrl}/${locale}/tools/${tool.slug}`,
        lastModified: tool.updated_at ? new Date(tool.updated_at) : now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  }

  // 3b. #186: list pages. A list below 10 entries is noindex (D53), and so is the models list
  // below 10 active rows with metrics (#329, D63), so neither is listed.
  const listSizes = new Map<RankingList, number>();
  for (const tool of tools) {
    if (tool.status !== "active") continue;
    const list = listOfTool(tool["kind"], tool["modality"]);
    if (list) listSizes.set(list, (listSizes.get(list) ?? 0) + 1);
  }
  // #329: a metric-gated list (models) takes its entry and metric-row counts from the board the
  // page and /api/rankings read (`loadCurrentRankings`: board rows, the tools.status column, the
  // Vals metric rule), never from findAll()'s status, which a stale data.status can override.
  // A failed board read leaves only that list page out (count 0), as the page itself goes
  // noindex on an unknown count; the rest of the sitemap is unaffected.
  const metricRows = new Map<RankingList, number>();
  for (const list of RANKING_LISTS.filter(isMetricGatedList)) {
    let board: Awaited<ReturnType<typeof loadCurrentRankings>> = null;
    try {
      board = await loadCurrentRankings(list);
    } catch {
      loggers.api.warn("Sitemap: list board read failed; list page left out", { list });
    }
    listSizes.set(list, board?.rankings.length ?? 0);
    metricRows.set(list, board?.metricRowCount ?? 0);
  }
  for (const list of RANKING_LISTS) {
    if (list === DEFAULT_RANKING_LIST || !isRankingListIndexable(list, listSizes.get(list) ?? 0, metricRows.get(list) ?? 0)) continue;
    for (const locale of locales) {
      routes.push({
        url: `${baseUrl}/${locale}${rankingListPath(list)}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.9,
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

  // 5. Monthly What's New reports. #54: one permalink per stored period; the
  // body is English, so only the /en URL is listed (#156).
  for (const report of reportPeriods) {
    routes.push({
      url: `${baseUrl}/${i18n.defaultLocale}/whats-new/${report.period}`,
      lastModified: report.updatedAt,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // 6. #181: weekly digests, one permalink per stored week, /en only like the monthly reports.
  for (const digest of digestWeeks) {
    routes.push({
      url: `${baseUrl}/${i18n.defaultLocale}/whats-new/weekly/${digest.week}`,
      lastModified: digest.updatedAt,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // #191: a URL that 308s under the signed table is never listed.
  return routes.filter((route) => !isTableRedirectSource(new URL(route.url).pathname));
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
