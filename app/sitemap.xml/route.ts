import { loggers } from "@/lib/logger";
import { siteOrigin } from "@/lib/site-origin";
import { buildSitemapEntries, renderSitemapXml } from "@/lib/sitemap";

/**
 * `/sitemap.xml`, built from the database per request and cached by the CDN.
 *
 * Why: #162 — the old `app/sitemap.ts` was prerendered by `next build`, where
 * `getDb()` refuses to connect, so each deploy served a sitemap with no tools
 * or articles until its first ISR revalidation; a failed read at request time
 * was cached the same way for an hour.
 * What: Lists `buildSitemapEntries(siteOrigin())` as XML with a one-hour CDN
 * lifetime. A failed database read is a 503 marked `no-store`, so the CDN keeps
 * serving the last complete copy (within `stale-while-revalidate`) or nothing.
 * Test: `tests/unit/sitemap-route.test.ts`.
 */

// #162: never prerendered at build, where the database is unreachable by design.
export const dynamic = "force-dynamic";

// #162: news is ingested by a daily cron (vercel.json, 06:00 UTC) plus ad-hoc
// admin publishes, and tools change monthly. One hour lists a new article within
// an hour of publication for at most ~24 database reads a day per CDN region;
// crawlers fetch a sitemap a few times a day, so a shorter window buys nothing.
const SITEMAP_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

export async function GET(): Promise<Response> {
  let xml: string;
  try {
    // #153: the one shared production-origin rule, read per request.
    xml = renderSitemapXml(await buildSitemapEntries(siteOrigin()));
  } catch (error) {
    // #162: fail closed. An article-less 200 would be cached as the sitemap.
    loggers.api.error("Sitemap: database read failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response("Sitemap temporarily unavailable", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "300",
      },
    });
  }

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": SITEMAP_CACHE_CONTROL,
    },
  });
}
