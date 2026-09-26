/**
 * The site's canonical origin, for URLs that must not change between deploys.
 *
 * Why: RSS guids and links, and the feed URL the layout advertises, have to
 * name the public site. `getUrl()` prefers `VERCEL_URL`, the per-deployment
 * `*.vercel.app` host, so a feed built from it gave every item a new guid on
 * every deploy (#150). `app/sitemap.ts` and `app/robots.ts` already follow
 * this rule inline.
 * What: `NEXT_PUBLIC_BASE_URL` when set and non-empty, else
 * `https://aipowerranking.com`; any trailing slash is removed. Never reads
 * `VERCEL_URL` or the request.
 * Test: `lib/site-origin.test.ts`, `tests/unit/news-rss-route.test.ts`.
 */
export const DEFAULT_SITE_ORIGIN = "https://aipowerranking.com";

export function siteOrigin(): string {
  const configured = process.env["NEXT_PUBLIC_BASE_URL"]?.trim();
  return (configured || DEFAULT_SITE_ORIGIN).replace(/\/+$/, "");
}
