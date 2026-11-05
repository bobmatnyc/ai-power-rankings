import type { MetadataRoute } from "next";
import { i18n } from "@/i18n/config";
import { insightsPreviewEnabled, monthlyInsightPath, weeklyInsightPath } from "./preview-gate";

/**
 * The `/sitemap.xml` entries of the Insights pages (#198).
 *
 * Why: #198: proposal M5-7 asks for sitemap entries for the hub, the weekly and
 * the monthly pages. The pages 404 while `INSIGHTS_PREVIEW` is off, so they are
 * listed only when it is on, and with it off the sitemap is unchanged. This
 * module lives under the route directory so no file outside `/insights` names
 * an Insights URL.
 * What: `[]` when `insightsPreviewEnabled(env)` is false. Otherwise
 * `/en/insights`, then one `/en/insights/weekly/<week>` per stored digest week
 * and one `/en/insights/monthly/<period>` per stored period, each dated by its
 * row. The body is English in every locale and each page canonicalises to
 * `/en`, so only the `/en` URL is listed, as for the What's New permalinks
 * (#156). Reads nothing; the caller passes the rows it already read.
 * Test: `tests/unit/insights-sitemap-198.test.ts`.
 */
export function insightsSitemapEntries(
  baseUrl: string,
  now: Date,
  digestWeeks: ReadonlyArray<{ week: string; updatedAt: Date }>,
  reportPeriods: ReadonlyArray<{ period: string; updatedAt: Date }>,
  env: Record<string, string | undefined> = process.env
): MetadataRoute.Sitemap {
  if (!insightsPreviewEnabled(env)) return [];
  const en = `${baseUrl}/${i18n.defaultLocale}`;
  return [
    { url: `${en}/insights`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...digestWeeks.map(({ week, updatedAt }) => ({
      url: `${en}${weeklyInsightPath(week)}`,
      lastModified: updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...reportPeriods.map(({ period, updatedAt }) => ({
      url: `${en}${monthlyInsightPath(period)}`,
      lastModified: updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
