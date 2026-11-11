# #198 Insights launch: INSIGHTS_PREVIEW flag flip

Read at origin/main (fetched 2026-11-11). Paths are repo-relative.

## Decision
GO or NO-GO on turning Insights on in Production, and whether the `/news/<slug>` article-template swap launches with it (A) or behind its own flag (B).

## Current state
- `INSIGHTS_PREVIEW` is absent from Vercel Production. Only the exact string `"true"` turns it on (`app/[lang]/insights/preview-gate.ts:19-21`).
- Off: `/en/insights` is 404, both RSS feeds are 404, sitemap, nav, home and news pages are unchanged. #421 live check (dpl_BvpAGTW9...) confirmed identical DOM with the flag off.
- All Insights pages are hard-coded `noindex` (see below). #384: "noindex stays on until launch. The flag flip must remove it."

## What turns on (flag = "true")
Everything below is read per request from the one function `insightsPreviewEnabled()`.
| Surface | Effect | Code |
|---|---|---|
| `/[lang]/insights`, `/insights/weekly/<week>`, `/insights/monthly/<period>` | 404 becomes 200 | `requireInsightsPreview()` in `insights/page.tsx:32,59`, `weekly/[week]/page.tsx`, `monthly/[month]/page.tsx`; `preview-gate.ts:24-26` |
| RSS `/[lang]/insights/{weekly,monthly}/rss.xml` | 404 becomes 200 | `insights/insights-rss.ts:146` |
| Site nav | "Insights" link after Tools | `insightsNavProps()` `preview-gate.ts:38-42`, `app/[lang]/layout.tsx:88`, `lib/navigation/site-nav.ts:90,145` |
| Home page | "This week" card after the hero, if a digest is stored | `components/insights/home-insight-card.tsx:56-65` |
| Sitemap | `/en/insights` plus each stored week and month, `/en` only | `app/[lang]/insights/insights-sitemap.ts:28-44`, `lib/sitemap.ts:217-219` |
| Page heads | Insights RSS links added to `alternates.types` | `preview-gate.ts:65-75,111-119` |
| **Every `/[lang]/news/<slug>`** | `ArticleTemplate` replaces `NewsDetailContent` | `app/[lang]/news/[slug]/page.tsx:107-114` |

The last row is the critic's MEDIUM note on #421: the flag launches two things, and the news pages are already indexed.

## Does the flag lift noindex? No. A small PR is needed first.
- `preview-gate.ts:124-125`: `robots: { index: false, follow: false, googleBot: {...false} }` is unconditional inside `insightsPreviewMetadata()`. The docstring (lines 91-92) says "the launch only drops `robots`".
- The feeds send `X-Robots-Tag: noindex, nofollow` unconditionally (`insights-rss.ts:125-126`, applied at `:167`).
- Tests pin noindex (`tests/unit/insights-{weekly,monthly,rss,launch}-198.test*`); they change with the PR.
- Flipping the flag alone would list noindex URLs in `sitemap.xml` (`insights-sitemap.ts`), a contradiction Search Console reports as "submitted URL marked noindex". Do not flip before the PR merges.
- The PR (small): remove `robots` from `insightsPreviewMetadata` (rename to drop "preview"), drop the feed `ROBOTS` header, update the tests. Default-off means merging it changes nothing in Production until the flip.
- Pages remain a gate on #191 only for the `/whats-new` redirects (out of scope); the `/whats-new/weekly/*` pages stay in the sitemap (`lib/sitemap.ts:207-215`) alongside Insights until then, so both URL sets are indexable duplicates in the interim. Owner should accept or sequence this.

## Sitemap, hreflang, canonical (flag on)
- Sitemap: `/en/insights`, `/en/insights/weekly/<week>`, `/en/insights/monthly/<period>`; no other locale (`insights-sitemap.ts:29-44`). Sitemap is CDN-cached `s-maxage=3600, stale-while-revalidate=86400` (`app/sitemap.xml/route.ts:26`), so entries appear within about an hour.
- Canonical: `${siteOrigin()}/en/<path>` for any `[lang]` (`lib/seo/alternates.ts:62-70`). No hreflang (body is English in every locale, #156). Non-`/en` Insights URLs resolve but canonicalise to `/en` and are not listed.
- og:url = canonical, og:locale = en; Article JSON-LD on permalinks (`preview-gate.ts:156`).

## Options
**A. One flag for everything (today's code).**
- Pros: no extra code; one rollback switch; the template and the Insights design ship as one reviewed look.
- Cons: the launch also rewrites every indexed news article's markup; a template regression hits existing organic traffic.
- Risk: medium. #421 only verified the flag-off DOM. Known gaps from the critic: English-only labels on all locales (LOW), `source_url` goes into `href` without an http(s) check (LOW).

**B. Separate flag for the template (built as `INSIGHTS_ARTICLE_TEMPLATE`).**
- Pros: Insights can launch (and roll back) without touching indexed news pages; the template can be checked on live data and flipped later.
- Cons: a small code PR (one gate in `news/[slug]/page.tsx:108`, plus tests); one more env var; two flips to run.
- Risk: low. Default-off keeps the news DOM identical, as #421 proved for the current flag.

## Recommendation
B. Bundle it with the noindex-lift PR: (1) remove noindex, (2) move the template swap behind its own flag. Then set `INSIGHTS_PREVIEW=true` alone; flip the template flag after the owner spot-checks live news pages. The order protects indexed pages from a coupled regression and costs one tiny PR already needed. If the owner prefers speed, A is acceptable only after the noindex PR.

## Steps if GO
The launch-prep PR (branch `feat/198-insights-launch-prep`) builds option B. Two env vars, both read per request, both on only for the exact string `"true"`, both default off:
- `INSIGHTS_PREVIEW`: Insights pages, feeds, nav, home card and sitemap entries; with it on the pages carry no `robots` meta and the feeds no `X-Robots-Tag`.
- `INSIGHTS_ARTICLE_TEMPLATE`: the Article template on `/[lang]/news/<slug>`. Independent of `INSIGHTS_PREVIEW`; the template reads only the news article.

1. Merge the launch-prep PR (CI green, default-off). Confirm production still serves the same DOM with both flags absent.
2. Owner sets `INSIGHTS_PREVIEW=true` in Vercel Production (agents do not write env). Leave `INSIGHTS_ARTICLE_TEMPLATE` unset. Redeploy production.
3. Live checks: `/en/insights` 200 with no `robots` meta; `/en/insights/weekly/<latest>` 200, canonical `/en/...`, no hreflang; both `rss.xml` 200 without `X-Robots-Tag`; nav shows Insights; `/sitemap.xml` lists the `/en/insights*` URLs (allow up to 1 h of cache); a `/en/news/<slug>` page unchanged (no `data-template="article"`); `/ja/insights` canonical points to `/en`.
4. Later, after the owner spot-checks the template: owner sets `INSIGHTS_ARTICLE_TEMPLATE=true` in Vercel Production and redeploys. Check a `/en/news/<slug>` page shows `data-template="article"` with unchanged metadata.
5. Optional: Search Console sitemap resubmit is manual (`lib/seo/submit-sitemap.ts` is a script, not run on deploy). Nothing is pinged automatically.

## Rollback
Each flag rolls back alone. `INSIGHTS_ARTICLE_TEMPLATE`: unset or set to anything but `"true"`, redeploy; news pages render the detail view again.
`INSIGHTS_PREVIEW`: unset or set to anything but `"true"`, redeploy. Pages, feeds, nav, home card and sitemap entries revert (404/removed). What persists:
- CDN sitemap copy: up to 1 h (+ stale-while-revalidate up to 24 h while the origin errors); the pages 404 meanwhile.
- ISR home/news HTML is rebuilt by the redeploy.
- If crawlers fetched indexable pages, Google may keep them for days; a 404 drops them over time. No pings to undo. Feed readers that polled the feeds will see 404.
- No database state is written by the flag.

## Out of scope
The `/whats-new` to `/en/insights` 308 redirects: held with #191 (waiting on the A99 Search Console export).

## Links
#198, #421 (critic notes), #384 ("noindex stays on until launch"), #191 (redirects), all on bobmatnyc/ai-power-rankings.
