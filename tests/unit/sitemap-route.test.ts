import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for #162 — news articles missing from `/sitemap.xml`.
 *
 * Why: `app/sitemap.ts` was prerendered by `next build`, where `getDb()`
 * refuses to connect (`NEXT_PHASE=phase-production-build`), so every deploy
 * shipped a sitemap of static pages only and served it until the first ISR
 * revalidation an hour later. A failed read at request time was also swallowed
 * into an article-less sitemap that was then cached for the full window.
 * What: Calls the `/sitemap.xml` route handler with the repositories replaced
 * and `DATABASE_URL` unset, then checks the exported route config, that each
 * active article is listed once under `/en/news/<slug>` with its own date as
 * `<lastmod>`, the success and failure cache headers, and that a failed read
 * is a `no-store` 503 rather than a 200 without articles. #54: each stored
 * monthly report is listed once, under `/en/whats-new/<period>`, and a failed
 * period read is the same 503. #181: a failed weekly digest read only leaves
 * the digest URLs out and is logged; the route still answers 200.
 * Test: `npx vitest run tests/unit/sitemap-route.test.ts`. No database access,
 * no network.
 */

const { getPublishedSlugs, findAll, listPeriods, listDigestWeeks } = vi.hoisted(() => ({
  getPublishedSlugs: vi.fn(),
  findAll: vi.fn(),
  listPeriods: vi.fn(),
  listDigestWeeks: vi.fn(),
}));

// #181: the sitemap's weekly-digest read.
vi.mock("../../lib/services/weekly-digest.repository", () => ({ listDigestWeeks }));

// #54: the sitemap's monthly-report read.
vi.mock("../../lib/services/whats-new-summary.service", () => ({ listPeriods }));

vi.mock("../../lib/db/repositories/news", () => {
  class NewsRepository {
    getPublishedSlugs = getPublishedSlugs;
  }
  return { NewsRepository, newsRepository: new NewsRepository() };
});

vi.mock("../../lib/db/repositories/tools.repository", () => {
  class ToolsRepository {
    findAll = findAll;
  }
  return { ToolsRepository, toolsRepository: new ToolsRepository() };
});

import * as route from "../../app/sitemap.xml/route";
import { locales } from "../../i18n/config";
import { loggers } from "../../lib/logger";
import { renderSitemapXml } from "../../lib/sitemap";

const ORIGIN = "https://aipowerranking.com";

/**
 * Static pages + categories the sitemap lists with no database rows (#156).
 * #185: 55 -> 64: /methodology is translated, so it is listed in all 10 locales, not /en only.
 */
const STATIC_URL_COUNT = 64;

interface ListedUrl {
  loc: string;
  lastmod: string | undefined;
}

function listedUrls(xml: string): ListedUrl[] {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
    loc: /<loc>([^<]*)<\/loc>/.exec(m[1] ?? "")?.[1] ?? "",
    lastmod: /<lastmod>([^<]*)<\/lastmod>/.exec(m[1] ?? "")?.[1],
  }));
}

async function fetchSitemap(): Promise<Response> {
  return route.GET();
}

describe("GET /sitemap.xml (#162)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // A `next build` environment: no database URL, deployment host set.
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
    vi.stubEnv("VERCEL_URL", "ai-power-ranking-xyz-1-m.vercel.app");
    findAll.mockResolvedValue([
      { slug: "cursor", status: "active", updated_at: "2026-09-02T00:00:00.000Z" },
      { slug: "retired-tool", status: "inactive", updated_at: "2026-01-01T00:00:00.000Z" },
    ]);
    getPublishedSlugs.mockResolvedValue([
      { slug: "big-launch", publishedAt: new Date("2026-09-20T08:30:00.000Z") },
      { slug: "older-news", publishedAt: new Date("2026-08-01T00:00:00.000Z") },
    ]);
    listPeriods.mockResolvedValue([
      { period: "2026-08", updatedAt: new Date("2026-08-30T06:00:00.000Z") },
      { period: "2026-07", updatedAt: new Date("2026-08-02T06:00:00.000Z") },
    ]);
    listDigestWeeks.mockResolvedValue([
      { week: "2026-W43", updatedAt: new Date("2026-10-26T07:31:00.000Z") },
      { week: "2026-W42", updatedAt: new Date("2026-10-19T07:31:00.000Z") },
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is rendered per request, never prerendered by next build", () => {
    // #162: a prerendered sitemap is built while getDb() refuses to connect.
    expect(route.dynamic).toBe("force-dynamic");
    expect((route as Record<string, unknown>)["revalidate"]).toBeUndefined();
  });

  it("lists every article once, under /en/news/<slug>, dated by the article", async () => {
    const response = await fetchSitemap();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/xml");

    const urls = listedUrls(await response.text());
    const news = urls.filter((u) => /\/news\/[^/]+$/.test(u.loc));
    expect(news).toEqual([
      { loc: `${ORIGIN}/en/news/big-launch`, lastmod: "2026-09-20T08:30:00.000Z" },
      { loc: `${ORIGIN}/en/news/older-news`, lastmod: "2026-08-01T00:00:00.000Z" },
    ]);

    // Nothing the sitemap already listed is lost: static pages, and the
    // active tool in every locale (the inactive one in none).
    const reports = urls.filter((u) => u.loc.includes("/whats-new/"));
    expect(urls).toHaveLength(STATIC_URL_COUNT + locales.length + news.length + reports.length);
    expect(urls.filter((u) => u.loc.endsWith("/tools/cursor"))).toHaveLength(locales.length);
    expect(urls.some((u) => u.loc.includes("retired-tool"))).toBe(false);
    for (const { loc } of urls) {
      expect(loc.startsWith(`${ORIGIN}/`), loc).toBe(true);
      expect(loc).not.toContain("vercel.app");
    }
  });

  it("lists each stored monthly report once, under /en/whats-new/<period> (#54)", async () => {
    const urls = listedUrls(await (await fetchSitemap()).text());

    expect(urls.filter((u) => /\/whats-new\/\d{4}-\d{2}$/.test(u.loc))).toEqual([
      { loc: `${ORIGIN}/en/whats-new/2026-08`, lastmod: "2026-08-30T06:00:00.000Z" },
      { loc: `${ORIGIN}/en/whats-new/2026-07`, lastmod: "2026-08-02T06:00:00.000Z" },
    ]);
  });

  it("lists each stored weekly digest once, under /en/whats-new/weekly/<week> (#181)", async () => {
    const urls = listedUrls(await (await fetchSitemap()).text());

    expect(urls.filter((u) => u.loc.includes("/whats-new/weekly/"))).toEqual([
      { loc: `${ORIGIN}/en/whats-new/weekly/2026-W43`, lastmod: "2026-10-26T07:31:00.000Z" },
      { loc: `${ORIGIN}/en/whats-new/weekly/2026-W42`, lastmod: "2026-10-19T07:31:00.000Z" },
    ]);
  });

  it("lets the CDN cache a complete sitemap for an hour", async () => {
    const response = await fetchSitemap();
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
  });

  it.each([
    ["the news read", () => getPublishedSlugs.mockRejectedValue(new Error("connection reset"))],
    ["the tools read", () => findAll.mockRejectedValue(new Error("Database not connected"))],
    ["the report period read (#54)", () => listPeriods.mockRejectedValue(new Error("connection reset"))],
  ])("answers 503 no-store, not an article-less 200, when %s fails", async (_what, fail) => {
    fail();

    const response = await fetchSitemap();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).not.toContain("<urlset");
  });

  it("still answers 200 without digest URLs, and logs an error, when the weekly digest read fails (#181)", async () => {
    // #181: production before migration 0030 is applied.
    listDigestWeeks.mockRejectedValue(new Error('relation "weekly_digests" does not exist'));
    const logged = vi.spyOn(loggers.api, "error").mockImplementation(() => undefined);

    const response = await fetchSitemap();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    const urls = listedUrls(await response.text());
    expect(urls.some((u) => u.loc === `${ORIGIN}/en/news/big-launch`)).toBe(true);
    expect(urls.filter((u) => u.loc.endsWith("/tools/cursor"))).toHaveLength(locales.length);
    expect(urls.some((u) => u.loc === `${ORIGIN}/en/whats-new/2026-08`)).toBe(true);
    expect(urls.some((u) => u.loc.includes("/whats-new/weekly/"))).toBe(false);
    expect(logged).toHaveBeenCalledWith(
      "Sitemap: weekly digest read failed; digest URLs left out",
      expect.objectContaining({ error: 'relation "weekly_digests" does not exist' })
    );
    logged.mockRestore();
  });
});

describe("renderSitemapXml (#162)", () => {
  it("escapes XML metacharacters in <loc>, & first so no entity is escaped twice", () => {
    const xml = renderSitemapXml([{ url: "https://x/a?b=1&c=<d>" }]);

    expect(xml).toContain("<loc>https://x/a?b=1&amp;c=&lt;d&gt;</loc>");
  });
});
