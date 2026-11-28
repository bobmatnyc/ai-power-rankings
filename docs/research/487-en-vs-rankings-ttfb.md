# #487: why /en field TTFB (p75 3.36 s) exceeds /en/rankings (0.48 s)

Read at main 54806fd1. Static read only: no build, no `.next` (absent), no DB, no prod requests.

## Conclusion

The two routes have the same server configuration. Route config does not explain the gap. Nothing in `/en` forces dynamic rendering that `/en/rankings` avoids. The gap is cold ISR renders plus the `/` redirect, both traffic effects.

## Side-by-side

| Item | `/en` (`app/[lang]/page.tsx`) | `/en/rankings` (`app/[lang]/rankings/page.tsx`) |
|---|---|---|
| `revalidate` | 300 (page.tsx:47) | 300 (rankings/page.tsx:16) |
| `generateStaticParams` | `[]` (page.tsx:50-52) | `[]` (rankings/page.tsx:17-19) |
| `dynamic`, `fetchCache`, `runtime`, `preferredRegion` | none | none |
| `headers()`, `cookies()`, `searchParams` | none | none |
| DB read at render | `loadCurrentRankings()` (page.tsx:143, 155) | `loadListBoard()` -> `loadCurrentRankings()` (list-board.ts:34-37) |
| Extra reads | `HomeInsightSlot` reads `listDigests(1)` only if `INSIGHTS_PREVIEW=true` (home-insight-card.tsx:73-79) | `isRankingListVisible`, nav list reads (ranking-list-page.tsx:68, 178-180) |
| Layout | shared `app/[lang]/layout.tsx`: static categories, dictionary, no auth call | same |
| Middleware | same function; no `/en`-only branch | same |

Both routes are ISR with empty `generateStaticParams`, so each locale renders on its first request after a deploy or eviction (comment at page.tsx:48-49). `dynamicParams` is the default, so this is on-demand ISR, not build-time static.

No `force-dynamic` exists on either route or their layouts. The `force-dynamic` hits under `app/[lang]` are contact, admin and RSS routes only. `app/layout.tsx` and `app/[lang]/layout.tsx` have no route segment config. `vercel.json` has crons only; no `regions` or `functions` entry.

## Middleware

`middleware.ts` runs for both paths. The chain is urlTableRedirect, searchKeyRedirect, heldSourceRewrite, openWeightRewrite, harnessCategoryRewrite, rootLocaleRedirect. Only `rootLocaleRedirect` is path-specific, and it matches `/` exactly. `needsClerk()` is false for `/en` and `/en/rankings`, so Clerk is skipped on both (lib/route-access.ts:176-191). No Clerk or auth call exists in the layout or page of either route.

## Likely causes (inferred; not measurable without field data)

1. **Cold ISR renders on the landing page.** On a miss or expiry, a render does the shared DB path: `loadCurrentRankings` makes one snapshot read, then `formatRanking` runs per entry and calls `toolsRepo.findById` or `findBySlug` (current-rankings.ts:93, 184-188). That is N+1 reads, issued with `Promise.all` and not batched. Add Neon cold-connection cost. This is the identical cost on `/en/rankings`, but `/en` is the entry page and gets the cold hits: n=31 is low traffic, with a 300 s window per locale entry and a fresh entry after every deploy. A p75 of 3.36 s over 31 samples is consistent with a handful of regenerations. `/en/rankings` is mostly reached after `/en` has warmed the DB path and its own entry. This is a hypothesis; the repo cannot show the cache hit ratio. The Vercel `x-vercel-cache` header per request would confirm it.
2. **The `/` -> `/en` hop is counted in landing TTFB.** The bare-domain visit is a 307 from middleware (root-locale-redirect.ts:19-26), then a second request for `/en`. The web-vitals TTFB is measured from navigation start, so redirect time adds to the `/en` figure. It is cheap now (edge, no function), but it is a second round trip with a cold TLS and DNS connection on first visit. `/en/rankings` is mostly reached by in-app navigation or direct links with no hop. The 307 is also not cacheable as 301/308.

## Smallest fix

The route is already ISR. The fix is to stop the `/en` render from being cold:

- Return `[{ lang: "en" }]` from `generateStaticParams` in `app/[lang]/page.tsx:50-52`, so `/en` prerenders at build (and from the build cache) instead of on first request.
- Risk: the comment at page.tsx:48-49 says that at build `getDb()` is null, so `readHomeRankings` would throw and fail the build, or cache an empty page. Without a DB at build, the fix needs either a build-time DB, or a guard that skips prerender when the DB is unavailable. Do not ship the plain change without that guard; it can cache an empty top 3.
- Lower-risk alternative: keep on-demand ISR and warm `/en` after deploy and after each regeneration (a cron or deploy-hook GET of `/en`), and raise `revalidate` for `/en` (for example 3600, with `revalidatePath` on ranking changes) so fewer requests land on a cold entry. No code risk; it hides cold renders but does not remove them.
- Independent speedup: batch the N+1 in `formatRanking` (one `inArray` read for tool ids). It shortens every cold render on both routes.

## Verification still needed (not done here)

- Build output route table (`○`, `●`, `ƒ`) for `/[lang]` and `/[lang]/rankings`; no build was run and `.next` is absent.
- `x-vercel-cache` (HIT, STALE, MISS, PRERENDER) for `/en` field requests, to confirm cause 1.
- Whether `INSIGHTS_PREVIEW` is `true` in production; if so `/en` has one more DB read than `/en/rankings`.
