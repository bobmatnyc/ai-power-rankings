import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Insights sitemap entries and feed links, slice 4 of #198.
 *
 * Why: #198 lists the hub, weekly and monthly pages in `/sitemap.xml` and
 * advertises the weekly and monthly feeds in each Insights page head, but only
 * while `INSIGHTS_PREVIEW` is on. With it off the sitemap must be exactly what
 * it was before this slice.
 * What: builds the real sitemap (route handler and `buildSitemapEntries`) and
 * the real Insights `generateMetadata` with every database read replaced by
 * in-memory fixtures. Each test compares the flag off with the flag on, so it
 * fails when the flag does not add the entries or links.
 * Test: `npx vitest run tests/unit/insights-sitemap-198.test.ts`. No database, no network.
 */

const ORIGIN = "https://aipowerranking.com";
const NOW = new Date("2026-11-05T12:00:00.000Z");
const INSIGHTS_URL = /\/insights(?:[/?#]|$)/;

const monthly = vi.hoisted(() => ({ getStoredSummary: vi.fn(), listPeriods: vi.fn() }));
const weekly = vi.hoisted(() => ({ getStoredDigest: vi.fn(), listDigests: vi.fn(), listDigestWeeks: vi.fn() }));
vi.mock("../../lib/services/whats-new-summary.service", () => monthly);
vi.mock("../../lib/services/weekly-digest.repository", () => weekly);
vi.mock("../../lib/db/repositories/news", () => ({
  newsRepository: {
    getPublishedSlugs: vi.fn(async () => [{ slug: "big-launch", publishedAt: new Date("2026-10-20T08:30:00.000Z") }]),
  },
}));
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  toolsRepository: {
    findAll: vi.fn(async () => [{ slug: "cursor", status: "active", updated_at: "2026-09-02T00:00:00.000Z" }]),
  },
}));

import * as route from "../../app/sitemap.xml/route";
import { buildSitemapEntries, renderSitemapXml } from "../../lib/sitemap";

const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

async function sitemapXml(flag: string | undefined): Promise<string> {
  vi.stubEnv("INSIGHTS_PREVIEW", flag);
  return renderSitemapXml(await buildSitemapEntries(ORIGIN, NOW));
}

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1] ?? "");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
  weekly.listDigestWeeks.mockResolvedValue([
    { week: "2026-W44", updatedAt: new Date("2026-11-02T07:31:00.000Z") },
    { week: "2026-W43", updatedAt: new Date("2026-10-26T07:31:00.000Z") },
  ]);
  monthly.listPeriods.mockResolvedValue([{ period: "2026-10", updatedAt: new Date("2026-11-01T08:05:00.000Z") }]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/sitemap.xml and INSIGHTS_PREVIEW (#198)", () => {
  it.each([undefined, "", "1", "false", "TRUE"])(
    "flag %j: lists no Insights URL and only the flag-on entries are added on top of it",
    async (flag) => {
      const off = await sitemapXml(flag);
      const on = await sitemapXml("true");

      expect(locs(off).filter((url) => INSIGHTS_URL.test(url))).toEqual([]);
      // With the flag off nothing is added: the flag-on sitemap minus its Insights
      // entries is the flag-off sitemap, byte for byte.
      const onWithoutInsights = on.replace(/<url>\n<loc>[^<]*\/insights[^<]*<\/loc>[\s\S]*?<\/url>\n/g, "");
      expect(onWithoutInsights).toBe(off);
      expect(on).not.toBe(off);
    }
  );

  it("flag on: lists the hub, each stored week and each stored month, /en only, dated by the row", async () => {
    vi.stubEnv("INSIGHTS_PREVIEW", "true");
    const entries = await buildSitemapEntries(ORIGIN, NOW);
    const insights = entries.filter(({ url }) => INSIGHTS_URL.test(url));

    expect(insights).toEqual([
      { url: `${ORIGIN}/en/insights`, lastModified: NOW, changeFrequency: "weekly", priority: 0.7 },
      {
        url: `${ORIGIN}/en/insights/weekly/2026-W44`,
        lastModified: new Date("2026-11-02T07:31:00.000Z"),
        changeFrequency: "monthly",
        priority: 0.6,
      },
      {
        url: `${ORIGIN}/en/insights/weekly/2026-W43`,
        lastModified: new Date("2026-10-26T07:31:00.000Z"),
        changeFrequency: "monthly",
        priority: 0.6,
      },
      {
        url: `${ORIGIN}/en/insights/monthly/2026-10`,
        lastModified: new Date("2026-11-01T08:05:00.000Z"),
        changeFrequency: "monthly",
        priority: 0.6,
      },
    ]);
    // The #54 and #181 permalinks stay listed beside them.
    expect(entries.map(({ url }) => url)).toEqual(
      expect.arrayContaining([`${ORIGIN}/en/whats-new/2026-10`, `${ORIGIN}/en/whats-new/weekly/2026-W44`])
    );
  });

  it("reads the flag per request in the route handler", async () => {
    vi.stubEnv("INSIGHTS_PREVIEW", "");
    const off = locs(await (await route.GET()).text());
    vi.stubEnv("INSIGHTS_PREVIEW", "true");
    const on = locs(await (await route.GET()).text());

    expect(off.filter((url) => INSIGHTS_URL.test(url))).toEqual([]);
    expect(on).toContain(`${ORIGIN}/en/insights`);
    expect(on).toContain(`${ORIGIN}/en/insights/weekly/2026-W44`);
    expect(on).toContain(`${ORIGIN}/en/insights/monthly/2026-10`);
  });
});

describe("Insights feed links in the page head (#198)", () => {
  it("advertises the weekly and monthly feeds on every Insights page only when the flag is on", async () => {
    vi.stubEnv("INSIGHTS_PREVIEW", "true");
    weekly.getStoredDigest.mockResolvedValue({
      week: "2026-W44",
      content: "# T\n\nBody.",
      createdAt: new Date("2026-11-02T07:31:00.000Z"),
    });
    monthly.getStoredSummary.mockResolvedValue({ period: "2026-10", content: "# T\n\nBody.", metadata: {} });
    const metas = await Promise.all([
      import("../../app/[lang]/insights/page").then((m) => m.generateMetadata(params({ lang: "fr" }))),
      import("../../app/[lang]/insights/weekly/[week]/page").then((m) =>
        m.generateMetadata(params({ lang: "fr", week: "2026-W44" }))
      ),
      import("../../app/[lang]/insights/monthly/[month]/page").then((m) =>
        m.generateMetadata(params({ lang: "fr", month: "2026-10" }))
      ),
    ]);
    for (const meta of metas) {
      expect(meta.alternates?.types?.["application/rss+xml"]).toEqual([
        { title: "AI Power Rankings - News & Updates", url: `${ORIGIN}/fr/news/rss.xml` },
        { title: "AI Power Rankings - Weekly Insights", url: `${ORIGIN}/fr/insights/weekly/rss.xml` },
        { title: "AI Power Rankings - Monthly Insights", url: `${ORIGIN}/fr/insights/monthly/rss.xml` },
      ]);
    }

    // The same metadata builder with the flag off keeps only the news feed.
    const { insightsPreviewMetadata } = await import("../../app/[lang]/insights/preview-gate");
    vi.stubEnv("INSIGHTS_PREVIEW", "false");
    const off = insightsPreviewMetadata("fr", "/insights", "t", "d");
    expect(off.alternates?.types?.["application/rss+xml"]).toEqual([
      { title: "AI Power Rankings - News & Updates", url: `${ORIGIN}/fr/news/rss.xml` },
    ]);
  });

  it("names the English feeds for an unknown locale segment, as the news link does (#156)", async () => {
    const { insightsFeedLinks } = await import("../../app/[lang]/insights/preview-gate");
    expect(insightsFeedLinks("xx", { INSIGHTS_PREVIEW: "true" }).map(({ url }) => url)).toEqual([
      `${ORIGIN}/en/insights/weekly/rss.xml`,
      `${ORIGIN}/en/insights/monthly/rss.xml`,
    ]);
    expect(insightsFeedLinks("xx", {})).toEqual([]);
  });
});
