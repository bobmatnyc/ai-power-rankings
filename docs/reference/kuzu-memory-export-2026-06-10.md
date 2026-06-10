# KuzuMemory Export — aipowerranking

> **Consolidated export of all stored project memories, created on 2026-06-10 prior to retiring KuzuMemory.**

## Export Header

| Field | Value |
|---|---|
| **Primary source DB** | `.kuzu-memory/memories.db` (16.3 MB, modified 2026-05-22) — authoritative store |
| **Secondary source DB** | `kuzu-memories/memories.db` (6.1 MB, modified 2026-03-19) — stale older DB, swept for unique content |
| **Artifact DB** | `.kuzu_memory.db` (repo root) — **EMPTY** (failed-migration artifact, 0 memories, confirmed) |
| **Extraction method** | Kuzu Python API (`kuzu.Database(path, read_only=True)`), schema introspected via `CALL show_tables()` / `CALL table_info()`, all `Memory` nodes dumped with every property. Full original memory text recovered from `metadata.extraction_metadata.original_content`. |
| **Kuzu version that worked** | **kuzu 0.11.3** (latest pip release) — opened both DBs with no storage-version error; no version downgrade needed. |
| **KuzuMemory tool version** | last migration recorded `1.9.0` (schema written under storage SchemaVersion 2) |
| **Primary DB raw node count** | 158 `Memory` nodes (0 `ArchivedMemory`) |
| **Curated knowledge memories (deduped/reconstructed)** | **11** complete memories (from 32 fragmented records) |
| **Auto-ingested git-commit memories** | **126** (git_sync source) |
| **Date range (curated)** | 2026-03-27 → 2026-05-04 |
| **Date range (git_sync)** | 2025-10-07 → 2026-04-10 |
| **Stale-DB-only memories swept** | 97 substantive + 78 short/filler conversation captures (none were unique *curated* knowledge; see Section 4) |

### ⚠️ Important note on data fidelity

KuzuMemory stored each memory as **entity-extracted fragments** in the `content` column (e.g. a record literally reading `"AbortSignal"` or `"reBuildErrors=true and eslint"`). The **complete, un-truncated original memory text was preserved inside each record's `metadata.extraction_metadata.original_content` field**, and that is what is reproduced below. The 32 curated fragment-records in the primary DB collapse to **11 distinct full memories**, all faithfully reconstructed here. Nothing was lost to truncation.

All memories carried `knowledge_type = "note"` in the schema (the tool never differentiated types), so the grouping below is derived from each memory's `source_type` / content (troubleshooting · investigation · resolution · code-review · decision · infrastructure · auto-ingested-commit).

---

## 1. Curated Engineering Knowledge (Primary DB) — the real memories

These are the human/agent-authored memories capturing root-cause investigations and resolutions. **This is the high-value content.**

### 1.1 Troubleshooting / Recovery — 2026-03-27

- **Date:** 2026-03-27 22:10:31.092691
- **Source type:** `troubleshooting-session`
- **Importance / Confidence:** 0.5 / 1.0
- **Reconstructed from:** 3 fragment record(s)

```
Article Publishing System Recovery (March 2026):

ISSUE RESOLVED: Article publishing stopped around March 14, 2026 due to timeout hangs in AIAnalyzer calls to OpenRouter API (no AbortSignal.timeout).

FIXES IMPLEMENTED:
- Commit 4943c9b7: Added AbortSignal.timeout(120000) to OpenRouter calls and timeout(15000) to HTML fetches
- Reduced max_tokens from 16000 to 4000 to prevent long completions
- System now fully operational

BACKFILL COMPLETED:
- 9-day gap (March 19-27) successfully backfilled
- 82 high-quality articles recovered using scripts/backfill-day.ts
- Articles properly tagged with 'tavily_backfill' discovery source
- All articles accessible on website with correct metadata

CURRENT STATUS: System operational, daily cron working, publishing at 06:00 UTC schedule.

KEY SCRIPTS:
- scripts/backfill-day.ts - For targeted date-range backfilling
- scripts/trigger-ingestion.ts - Manual ingestion testing

MONITORING: Daily article publishing should continue automatically via Vercel cron scheduler.
```

### 1.2 Troubleshooting / Recovery — 2026-03-28

- **Date:** 2026-03-28 00:47:56.395741
- **Source type:** `troubleshooting-session`
- **Importance / Confidence:** 0.5 / 1.0
- **Reconstructed from:** 2 fragment record(s)

```
Monthly Summary System Recovery (March 2026):

ISSUE IDENTIFIED: February 2026 summary generated during article outage with only 9 articles vs normal 50+ articles.

FIXES COMPLETED:
- March 2026 summary regenerated with complete data (50 articles, 20 new tools)
- System health verified: authentication, timeouts, environment variables all working
- Cron endpoint tested and functional with CRON_SECRET authentication
- AbortSignal timeout fixes applied to monthly summary service

SYSTEM STATUS: Fully operational
- Current summary: March 2026 with comprehensive content (461 words, 3,606 chars)
- April 2026: Ready for automated generation on April 1st at 8 AM UTC
- Data quality: Complete March article data ensures high-quality future summaries

KEY ENDPOINTS:
- /api/cron/monthly-summary (8 AM UTC on 1st of month)
- /api/state-of-ai/current (public API)
- scripts/generate-state-of-ai.ts (manual regeneration)

RECOVERY EVIDENCE: 5.5x more articles in current summary (50) vs outage period (9)
```

### 1.3 Troubleshooting / Recovery — 2026-03-28

- **Date:** 2026-03-28 10:17:34.535789
- **Source type:** `troubleshooting-session`
- **Importance / Confidence:** 0.5 / 1.0
- **Reconstructed from:** 2 fragment record(s)

```
Duplicate Articles Issue Resolution (March 2026):

ISSUE SCOPE: 72 duplicate articles across 15 URLs (15.5% database bloat)
ROOT CAUSE: Missing duplicate check in articles-core.repository.ts - direct DB insertion without sourceUrl verification

FIXES IMPLEMENTED:
1. Database cleanup: 72 duplicate articles removed (463→391 total articles)
2. Database-level unique constraint on source_url column
3. Application-level duplicate checking with URL canonicalization
4. Race condition protection for concurrent ingestion

VERIFICATION RESULTS:
- 0 duplicates remaining (100% cleanup success)
- Two-layer prevention system (application + database)
- User experience restored - no duplicate articles in feed
- Future duplicate prevention active and tested

KEY FILES MODIFIED:
- lib/db/repositories/articles/articles-core.repository.ts (duplicate prevention logic)
- Database schema (unique constraint added)

BACKUP SAFETY: Complete database backup created before cleanup
```

### 1.4 Investigation — 2026-04-03

- **Date:** 2026-04-03 11:41:05.121947
- **Source type:** `investigation-2026-04-03`
- **Importance / Confidence:** 0.7 / 0.95
- **Reconstructed from:** 2 fragment record(s)

```
Auto-publishing failure investigation 2026-04-03: Root cause was git synchronization issue - local repository 1 commit ahead of remote (06bfb78d vs 4943c9b7). Vercel auto-deployment blocked waiting for push. Fix: git push origin main. System uses Vercel GitHub integration, no CI/CD workflows. Recent cron hanging issues were already fixed in 4943c9b7 with AbortSignal timeouts.
```

### 1.5 Code Review — 2026-04-03

- **Date:** 2026-04-03 11:41:13.222024
- **Source type:** `code-review-2026-04-03`
- **Importance / Confidence:** 0.7 / 0.95
- **Reconstructed from:** 2 fragment record(s)

```
Code review findings 2026-04-03: CRITICAL build config issues in next.config.js - typescript.ignoreBuildErrors=true and eslint.ignoreDuringBuilds=true bypass quality checks, risk for deployment failures. 16+ linting violations. Database duplicate prevention issue found (72 duplicates, 15.5% bloat). Good: AbortSignal timeouts added, modern architecture with repository pattern, security-first design. Action items: remove build bypassing, fix linting, add unique constraint on source_url.
```

### 1.6 Resolution — 2026-04-03

- **Date:** 2026-04-03 11:58:10.051723
- **Source type:** `resolution-2026-04-03`
- **Importance / Confidence:** 0.7 / 0.95
- **Reconstructed from:** 4 fragment record(s)

```
Auto-publishing restoration complete 2026-04-03: Successfully fixed auto-publishing failure through (1) git push to sync repository, (2) removed dangerous build bypassing from next.config.js (typescript.ignoreBuildErrors and eslint.ignoreDuringBuilds), (3) fixed critical ESLint violations including @typescript-eslint/no-explicit-any, unused variables, and React hooks dependencies. TypeScript engineer reduced violations from 283+ to 270. Committed as 699096e9. Quality checks now enabled, build failures will prevent broken deployments.
```

### 1.7 Resolution — 2026-04-03

- **Date:** 2026-04-03 12:09:12.510481
- **Source type:** `complete-resolution-2026-04-03`
- **Importance / Confidence:** 0.7 / 0.95
- **Reconstructed from:** 2 fragment record(s)

```
Complete auto-publishing resolution 2026-04-03: Successfully resolved all three critical issues: (1) Auto-publishing failure - git sync fixed by pushing commit 06bfb78d→8036b1d0, (2) Build quality - removed typescript.ignoreBuildErrors and eslint.ignoreDuringBuilds from next.config.js, fixed 283→270 ESLint violations with TypeScript interfaces, (3) Database duplicates - verified existing prevention system working with URL canonicalization, unique constraints, and 72 duplicates already cleaned up. Final commits: 699096e9 (build fixes) + 8036b1d0 (duplicate prevention). Vercel auto-deployment fully restored and hardened.
```

### 1.8 Investigation — 2026-04-23

- **Date:** 2026-04-23 21:38:49.886772
- **Source type:** `investigation-and-fix-session`
- **Importance / Confidence:** 0.7 / 0.95
- **Reconstructed from:** 7 fragment record(s)

```
fix: article scraping status update race condition resolved (2026-04-23)

Investigation revealed article scraping was actually working correctly - system was successfully ingesting 6 articles per day from Tavily API with 37% quality pass rate. The "not working" issue was a false alarm caused by database status updates remaining "running" instead of updating to "completed".

Root cause: Logic error in automated-ingestion.service.ts where status update conditions were incorrect, preventing completedAt timestamps from being set.

Solution implemented:
- Fixed status update logic in lines 1041-1046 to properly set completedAt for terminal states
- Added comprehensive error handling around critical status updates (lines 668-685)
- Enhanced database update validation with .returning() clause
- Added detailed logging for better observability

Additional enhancement: Configured Jina API key across all environments (local, GitHub secrets, Vercel) to improve content extraction fallback chain reliability.

System performance: ~2min runtime per cron job, $0.14 cost per run, 36 articles discovered per run, quality filtering with Claude Sonnet 4.

Commit: 2b5da67b fix(automated-ingestion): resolve status update race condition in cron jobs
```

### 1.9 Investigation — 2026-05-03

- **Date:** 2026-05-03 20:40:02.607518
- **Source type:** `investigation-2026-05-04`
- **Importance / Confidence:** 0.7 / 0.95
- **Reconstructed from:** 2 fragment record(s)

```
Article ingestion system investigation (May 4, 2026): System is actually working correctly with articles successfully ingested on April 23, 2026. User reported "over a week without updates" but this was inaccurate. Real issue is intermittent cron execution gaps (11-15 days between runs) likely due to Vercel cron reliability issues, API rate limits, or transient errors. All pipeline components operational: Tavily API, database, quality assessment (37% pass rate), cron endpoint. Recommended adding monitoring/alerts for failed runs and backup cron strategy. System status: functional but needs reliability improvements.
```

### 1.10 Investigation — 2026-05-04

- **Date:** 2026-05-04 09:41:20.335531
- **Source type:** `corrected-investigation-2026-05-04`
- **Importance / Confidence:** 0.7 / 0.95
- **Reconstructed from:** 4 fragment record(s)

```
Article ingestion system update (May 4, 2026): Corrected previous assessment. Last successful run was April 23rd (11 days ago, over a week as user stated). Cron did NOT run last night (May 3rd/4th). Real issue: cron endpoint hanging/timing out during execution, creating "running" database entries that never complete. Database status update bug confirmed - 6 stuck "running" entries found and cleaned up. Root cause is process stalling, not environment variables. System needs debugging of ingestion pipeline timeout issue.
```

### 1.11 Resolution — 2026-05-04

- **Date:** 2026-05-04 10:05:34.347278
- **Source type:** `resolution-2026-05-04`
- **Importance / Confidence:** 0.7 / 0.95
- **Reconstructed from:** 2 fragment record(s)

```
Article ingestion hanging issue RESOLVED (May 4, 2026): Successfully implemented fixes for cron endpoint hanging. Root cause was sequential quality assessment with 30s timeouts. Applied fixes: parallel processing (5 concurrent), 10-minute pipeline timeout, circuit breaker (30% failure threshold), reduced OpenRouter timeout (30s→15s, 3→2 attempts), killed hanging job. Verification: dry run completed in 85s with parallel processing working. Commit da0eb76a applied. Daily ingestion should now work reliably.
```

---

## 2. Decisions & Infrastructure Notes (recovered from stale DB only)

These typed entries existed **only** in the older `kuzu-memories/` DB and are genuinely useful project facts, so they are preserved here.

### 2.1 `preference` — 2026-02-13

- **Date:** 2026-02-13 16:33:58.569805
- **Source type:** `preference`

```
Vercel project: The correct/primary Vercel project is `ai-power-ranking` at https://vercel.com/1-m/ai-power-ranking (team: 1-m). The `aipowerranking` project in .vercel/project.json may be outdated.
```

### 2.2 `decision` — 2026-02-25

- **Date:** 2026-02-25 07:21:59.901652
- **Source type:** `decision`

```
Investigated Next.js caching architecture - found comprehensive 3-layer system: 1) Next.js ISR/cache tags, 2) In-memory cache patterns, 3) Vercel blob storage. Cache invalidation service triggers on article ingestion via cron jobs. Mobile cache issue likely related to service worker, stale browser cache, or API route cache headers differences.
```

### 2.3 `decision` — 2026-02-25

- **Date:** 2026-02-25 07:45:43.020748
- **Source type:** `decision`

```
Verified mobile caching fixes on 2026-02-25: 1) Mobile user agents detected correctly (mobile_ua: true), 2) Mobile requests receive additional no-cache, no-store, private headers, 3) Cache-busting parameter (cb) works properly, 4) Vary: User-Agent header properly set. No articles from today yet - latest are from 2026-02-24, which is expected since cron runs at 6 AM UTC (1 AM EST) and current time is 12:45 UTC.
```

---

## 3. Auto-Ingested Git-Commit Memories (Primary DB, `source_type = git_sync`)

KuzuMemory auto-captured **126** git commit messages as memories. These duplicate the project's git history; they are listed compactly (date · SHA · files changed · subject). Full commit bodies remain in `git log`.

| Date | Commit | Files | Subject |
|---|---|---|---|
| 2025-10-07 16:21:36 | `8cabd44a` | 231 | feat: Comprehensive tool data improvements and production readiness enhancements ## Core Features & Improvements ### Tool Data Management - Migrate JSONB tool data to top-level fields (42 tools popula |
| 2025-10-07 17:35:55 | `ea1ec545` | 28 | feat: Performance optimizations, data updates, and algorithm version corrections - Add Priority 1 performance optimizations (N+1 query fix, batch loading, caching) - Update Anything Max tool with comp |
| 2025-10-07 23:55:39 | `7d129d4a` | 5 | fix: Improve UI visibility and add missing content pages - Fix faint font colors for Categories and Avg Score statistics - Changed secondary color from light gray (210 40% 96.1%) to green (142 71% 45% |
| 2025-10-08 00:09:34 | `09ac7d66` | 1 | fix: Allow content markdown files in Vercel deployments - Updated .vercelignore to use specific patterns instead of wildcard - Changed from `*.md` to `/*.md`, `/docs/*.md`, `/scripts/*.md` - Preserves |
| 2025-10-08 00:21:47 | `bdf50352` | 6 | fix: Update all social media links to HyperDev - Updated footer social icons to point to https://hyperdev.matsuoka.com/ - Updated contact form social links to HyperDev - Updated contact page markdown  |
| 2025-10-08 00:34:26 | `21ee65f8` | 1 | feat: Replace contact form with newsletter signup CTA - Remove contact form for non-logged-in users - Add attractive signup CTA with benefits (Rankings, Insights, Early Access) - For logged-in users:  |
| 2025-10-08 00:51:57 | `c62a4962` | 1 | fix: Resolve SignUp modal SSR/hydration issues - Fix window.location access during SSR with safe typeof checks - Change from SignIn to SignUp component for proper signup flow - Update import from auth |
| 2025-10-08 01:00:29 | `4fd157e8` | 5 | fix: Update Clerk to Core 2 naming and enable authentication - Enable authentication by removing NEXT_PUBLIC_DISABLE_AUTH flag - Update deprecated environment variables: * AFTER_SIGN_IN_URL -> SIGN_IN |
| 2025-10-08 08:10:57 | `d275d32b` | 2 | fix: Logo alignment and Clerk modal visibility issues - Fix logo and APR text alignment to bottom (items-end instead of items-center) - Fix Clerk sign-up modal appearing off-screen - Replace embedded  |
| 2025-10-08 14:08:47 | `b11755d4` | 5 | fix: Remove critical HIGH-risk test endpoints (Phase 2.1) SECURITY: Remove 5 endpoints exposing sensitive information - Remove /api/test-env - Exposed OpenRouter API key fragments - Remove /api/public |
| 2025-10-08 14:09:32 | `cde6efea` | 25 | fix: Remove remaining 25 test/debug endpoints (Phase 2.2) Remove all remaining test and debug endpoints with no production value: Root Test Endpoints (6): - /api/test-basic, /api/test-static, /api/tes |
| 2025-10-08 14:11:02 | `0c37bc46` | 5 | fix: Add NODE_ENV guards to 5 admin debug endpoints (Phase 2.3) Guard admin endpoints to prevent accidental production use: - /api/admin/debug-auth - Comprehensive auth debugging (340 lines) - /api/ad |
| 2025-10-08 14:47:04 | `cbca5e32` | 2 | fix: Add baseline score derivation for incomplete tool scores Problem: - Tools showing 0.0 for most score dimensions - Only 3/9 dimensions stored: overall, agentic_capability, innovation - Missing 6 d |
| 2025-10-12 16:18:37 | `a1014928` | 13 | feat: Add State of Union component and semantic HTML improvements - Add StateOfUnion component for October 2025 market overview - Integrate State of Union into news content page - Improve semantic HTM |
| 2025-10-12 16:45:50 | `f4263dca` | 6 | fix: Update Clerk authentication to Core 2 API and add comprehensive testing Environment Configuration: - Update .env.production to use FALLBACK_REDIRECT_URL (Core 2 naming) - Remove deprecated AFTER_ |
| 2025-10-12 21:56:42 | `b5f071d3` | 1 | fix: Disable header hiding to keep sign-in button always accessible The header was being hidden off-screen on mobile homepage until scroll, which made the 'Sign In For Updates' button inaccessible. Di |
| 2025-10-12 23:16:27 | `81acc229` | 1 | fix: Prevent client-side exception on root route redirect Changed root page component to async and added headers() call to ensure server-side only execution. This prevents Next.js from attempting clie |
| 2025-10-14 10:28:56 | `f64e81f3` | 8 | fix: Fix Clerk authentication and category counts This commit resolves two critical issues: 1. **Clerk Authentication Server-Side Session Recognition** - Fixed middleware to use async/await with auth( |
| 2025-10-14 12:44:03 | `53c7d7ca` | 3 | perf: Optimize "What's New" modal performance Improved performance by consolidating 3 API calls into 1 and adding database indexes. Changes: 1. Created /api/whats-new endpoint - combines tools, news,  |
| 2025-10-14 14:03:26 | `9983319b` | 1 | fix: Bottom-align logo and APR text Changed flex alignment from items-center to items-end to properly align the crown logo with the APR text at the baseline. 🤖 Generated with [Claude Code](https://cla |
| 2025-10-14 15:51:35 | `df3703f0` | 2 | fix: Change Clerk sign-in from modal to redirect mode Modal mode was appearing off-screen in production. Changed to redirect mode which navigates to the sign-in page instead. Fixed in: - components/au |
| 2025-10-14 16:56:18 | `2718b650` | 1 | fix: Bottom-align mobile header logo with text Changed files: - components/layout/client-layout.tsx |
| 2025-10-14 18:57:14 | `9576d57a` | 1 | fix: Remove Suspense boundary causing sidebar to stick in loading state Changed files: - components/layout/app-sidebar.tsx |
| 2025-10-14 19:52:13 | `56ffef59` | 1 | fix: Add negative margin to compensate for font descender space in logo Changed files: - components/layout/app-sidebar.tsx |
| 2025-10-14 22:54:34 | `8f434a50` | 1 | fix: Remove deprecated fetchConnectionCache option Remove deprecated `neonConfig.fetchConnectionCache` option which is now always enabled by default in @neondatabase/serverless. This eliminates the de |
| 2025-10-14 23:15:32 | `a9b6a130` | 10 | perf: Phase 4 Lighthouse optimizations - Target modern browsers and reduce JavaScript Comprehensive performance improvements addressing Lighthouse audit findings: Performance Improvements Verified: -  |
| 2025-10-14 23:33:57 | `266d3b3e` | 1 | fix: Correct Clerk DNS prefetch URL to actual domain Fixed incorrect DNS prefetch URLs that were blocking Clerk authentication: - Changed from generic clerk.com to actual instance domain - Using easy- |
| 2025-10-14 23:43:32 | `ba14f00a` | 2 | fix: Remove invalid prefetch hints and restrict analytics to production Fixed multiple 404 errors in development console: 1. Removed Invalid Prefetch Hints: - Deleted /_next/static/chunks/client-ranki |
| 2025-10-14 23:51:33 | `9617fea8` | 1 | fix: Set Clerk provider availability flag for SignInButton to work Fixed login button not responding by setting the window.__clerkProviderAvailable flag that SignInButtonDirect checks to determine if  |
| 2025-10-15 00:38:56 | `dd9ec211` | 5 | perf: optimize static generation, caching, and UI behavior - Remove explicit edge runtime declarations from OG image routes (ImageResponse automatically uses edge runtime, fixes static generation warn |
| 2025-10-15 00:45:31 | `ba38cd9e` | 1 | fix: simplify category active state logic Remove redundant condition in category isActive check. Now correctly deselects "all categories" when a specific category is selected. 🤖 Generated with [Claude |
| 2025-10-15 00:46:07 | `0f9625b4` | 1 | feat: add 'Coming Soon' badge to signup modal - Add visual "Coming Soon" badge next to modal title - Update description to indicate authentication is coming soon - Provides clear user expectation for  |
| 2025-10-15 00:54:28 | `86a46f8a` | 1 | fix: force re-render on category change with composite key - Add composite key including currentCategory to force React re-render - Add development console logging to debug category selection - Ensure |
| 2025-10-15 00:58:59 | `f8992434` | 4 | perf: critical mobile performance optimizations Target: Fix mobile LCP (7.1s → <2.5s), TBT (450ms → <200ms), Speed Index (6.9s → <3s) **1. LCP Optimization - Server-Side Crown Icon** - Create crown-ic |
| 2025-10-15 01:25:33 | `6f0320fa` | 1 | fix: remove nested anchor tags in RankingCard Replace nested Link with programmatic navigation to fix hydration error. Category badge now uses onClick with router.push() instead of Link component. Fix |
| 2025-10-15 01:26:30 | `f037cf74` | 1 | feat: increase SWE-bench scoring weight in ranking algorithm Increase agenticCapability weight from 0.25 to 0.35 to emphasize SWE-bench scores in tool rankings. Rebalanced other factors: - innovation: |
| 2025-10-15 01:29:03 | `ee93a7a9` | 1 | feat: add company and logo for Greptile Create database update script to add: - Company name: Greptile - Logo URL: https://www.greptile.com/logo.svg - Website URL: https://www.greptile.com Script succ |
| 2025-10-15 01:32:08 | `87371462` | 2 | feat: update algorithm to v7.2 with enhanced SWE-bench emphasis Algorithm Changes: - Version: v7.0 → v7.2 - agenticCapability weight: 0.25 → 0.35 (+40%) - innovation weight: 0.125 → 0.10 (-20%) - tech |
| 2025-10-15 01:38:25 | `50b62a3d` | 3 | fix: resolve category filtering issue in rankings Root Cause: Rankings data was missing category fields, causing all tools to show as "unknown" category, making filtering impossible. Changes: 1. Creat |
| 2025-10-15 11:42:13 | `5946c0b1` | 9 | fix: Eliminate 3.3s TTFB and optimize vendor chunks Performance Optimizations: 1. Vendor chunk splitting (277 KiB unused JavaScript reduction) - Add nextFramework cache group with priority 40 - Split  |
| 2025-10-15 13:26:12 | `ea30a099` | 1 | fix: Update Clerk DNS prefetch to production domain Problem: - DNS prefetch was hardcoded to test domain (easy-salmon-30.clerk.accounts.dev) - Production uses live keys which require production domain |
| 2025-10-16 14:37:21 | `e74f642d` | 6 | fix: Resolve Vercel build failure - add tsx and update .vercelignore Root Cause Analysis: 1. .vercelignore was excluding entire scripts/ directory 2. tsx was not installed as a devDependency Changes M |
| 2025-10-16 17:24:23 | `4e10e15a` | 1 | fix: Add description, website_url, and logo to rankings API response Root Cause: - UI components expect tool.description and tool.website_url - API was only returning tool_id, tool_name, tool_slug, ca |
| 2025-10-16 23:26:42 | `78eccddf` | 2 | feat: Add Algorithm v7.2 with October 2025 rankings and news article Algorithm Changes: - Increased agentic capability weight from 0.25 to 0.35 (+40%) - Reduced innovation weight from 0.125 to 0.10 (- |
| 2025-10-17 15:01:03 | `5058fc60` | 1 | fix: Update homepage tagline to Algorithm v7.2 Changes: - Updated "Algorithm v7.0" to "Algorithm v7.2" on homepage stats card - Reflects the October 2025 algorithm update 🤖 Generated with [Claude Code |
| 2025-10-17 15:57:40 | `09d513be` | 5 | fix: Update all i18n dictionaries to Algorithm v7.2 Changes: - Updated English dictionary (en.json) with v7.2 descriptions - Updated Spanish (es.json), German (de.json), Japanese (ja.json), and Chines |
| 2025-10-19 11:52:30 | `deda8c10` | 23 | fix: TypeScript errors and security hardening for v0.1.4 release - Install missing dependencies (schema-dts, @types/pdf-parse) - Configure ESLint with Next.js strict configuration - Fix 95 critical Ty |
| 2025-10-19 12:29:43 | `50614e95` | 2 | fix: Restore Clerk authentication routes to resolve 404 errors Critical fix for broken authentication flow on production site. Root Cause: - Sign-in and sign-up routes were accidentally deleted in com |
| 2025-10-19 23:10:19 | `b0c51feb` | 5 | fix: Restore Clerk authentication routes to resolve 404 errors This commit restores the authentication routes that were accidentally deleted during security hardening, which caused critical 404 errors |
| 2025-10-23 22:41:34 | `40aa838f` | 13 | feat: Add LLM-powered monthly "What's New" summary feature Implements comprehensive monthly summary generation for news, rankings, tools, and site changes using Claude Sonnet 4 via OpenRouter API. Fea |
| 2025-10-24 01:50:56 | `6be66986` | 1 | feat: Enhance article ingestion to generate comprehensive 750-1000 word summaries Summary field is now the PRIMARY content (750-1000 words) instead of a teaser (200-300 chars): - Changed summary from  |
| 2025-10-24 01:50:56 | `fb8a81cf` | 3 | feat: Implement comprehensive Schema.org markup for SEO Added structured data across the site for improved search visibility: **Site-wide (app/layout.tsx)**: - Organization schema with company info, e |
| 2025-10-24 09:41:45 | `4514b2dd` | 1 | fix: Update What's New changelog with v0.2.0 release notes Updated hardcoded changelog items to show latest v0.2.0 features: - Comprehensive SEO Schema.org markup - Enhanced article summaries (750-100 |
| 2025-10-24 09:49:47 | `4fca6ed0` | 2 | fix: NewsRepository database connection in production Fixed critical bug where NewsRepository was using a pre-initialized db instance from lib/db/index.ts which could be null during Next.js build phas |
| 2025-10-24 09:53:20 | `6bc1f50d` | 1 | fix: Correct cachedJsonResponse status parameter in What's New API Fixed critical bug where What's New API was passing cache duration (60) as the HTTP status code parameter, causing "init["status"] mu |
| 2025-10-24 13:50:08 | `bef60504` | 18 | feat: Add monthly summaries feature and 3 new AI tools Added: - Monthly summaries database migration (0007_add_monthly_summaries.sql) - What's New API endpoint with LLM-generated monthly summaries - 3 |
| 2025-10-24 14:11:15 | `e7c37d84` | 15 | fix: Resolve quality gate issues for production release TypeScript Fixes: - Fix tool status type mismatches (added "discontinued" status) - Create types/rankings.ts with ranking-related types - Create |
| 2025-10-25 00:45:56 | `07b04cc6` | 69 | feat: Add comprehensive content for 14 AI tools (Phases 1-3) Phase 1 - Market Leaders (5 tools): - GitHub Copilot: 5 tiers, 12 features, market leader positioning - Cursor: $500M ARR, 9,900% YoY growt |
| 2025-10-25 13:41:31 | `88ea466b` | 84 | feat: Add comprehensive content for 48 AI tools (Phases 4-7A) Phase 4: Specialized Tools (9 tools - 100% quality) - CodeRabbit, Snyk Code, Sourcery, Diffblue Cover, Qodo Gen - GitLab Duo, Graphite, Gr |
| 2025-10-25 15:36:22 | `70b8ca74` | 9 | fix: Resolve Phase 4-7A production issues - Add use_cases field to /api/tools endpoint (90 use cases now exposed) - Remove duplicate jetbrains-ai-assistant database entry (51 tools remain) - Regenerat |
| 2025-10-25 22:01:24 | `6aecb50d` | 104 | refactor: Replace over-engineered phase system with data-driven approach - Remove 26,000 lines of repetitive phase scripts and documentation - Create single parametrized update script (scripts/update- |
| 2025-10-26 22:48:53 | `7cabb06e` | 5 | feat: implement unified feed for What's New modal - Refactor API to return single unified feed array - Add type discrimination (news/tool/platform) - Implement cache invalidation on article publish -  |
| 2025-10-26 22:49:07 | `7cf71130` | 2 | fix: add locale-aware routing to authentication pages - Sign-in/sign-up pages now use lang parameter - Add fallback redirect URLs for post-auth navigation - Configure proper routing for Clerk componen |
| 2025-10-26 22:49:15 | `c6ba8f1c` | 1 | feat: add published date field to news editor - Add date input field for published date control - Default to today's date for new articles - Format dates for database storage (ISO 8601) 🤖 Generated wi |
| 2025-10-30 14:00:59 | `74445ed7` | 1 | fix: remove invalid HTML attributes from image preload tag Fixes production syntax error preventing authentication login. Problem: imageSrcSet and imageSizes are React props for <img>, not valid HTML  |
| 2025-10-30 14:21:01 | `d6c0e3f5` | 3 | fix: replace Next.js Image with native img for crown icons Fixes production syntax error by preventing Next.js from auto-generating preload tags with invalid HTML attributes (imageSrcSet/imageSizes).  |
| 2025-10-30 14:26:41 | `e132ea76` | 13 | fix: eliminate Next.js auto-generated invalid preload tags Root cause: Next.js was auto-generating invalid preload tags with imageSrcSet/imageSizes attributes (React props) instead of lowercase HTML a |
| 2025-10-30 14:56:27 | `7d91ea4f` | 1 | fix: disable optimizeCss to prevent CSS script tag bug Fixes production syntax error by disabling experimental.optimizeCss. Problem: Next.js 15.5.4 with optimizeCss: true generates <script> tags for C |
| 2025-10-30 23:03:20 | `ef6a9808` | 174 | refactor: complete route groups migration and Next.js 15.5.6 upgrade Route Groups Migration: - Move all authenticated pages to (authenticated) route group - Delete old dashboard, admin, auth pages - C |
| 2025-10-31 00:17:07 | `cfc8ed7f` | 67 | feat: fix Jules duplicate and add 50 tool logos ## Jules Duplicate Fix - Merged duplicate Google Jules entries (google-jules + jules) - Marked old 'jules' entry as redirect to 'google-jules' - Regener |
| 2025-10-31 08:06:30 | `75c7375a` | 1 | feat: add copy button to debug information page Added 'Copy All' button to Clerk debug page that copies all debug information to clipboard for easy sharing and troubleshooting. Features: - One-click c |
| 2025-10-31 08:33:18 | `f021c1bf` | 52 | fix: resolve static logo file serving via API route ## Problem - 50 PNG tool logos in /public/tools/ were returning 404 on production - Next.js app/[lang] dynamic route was intercepting static file re |
| 2025-10-31 08:47:29 | `eaec1a8d` | 53 | fix: resolve logo 404 errors by fixing .vercelignore Root Cause: - .vercelignore wildcard patterns (*.png, *.jpg, *.jpeg) excluded ALL image files - This prevented tool logos from being deployed to Ve |
| 2025-11-02 10:46:56 | `81c6b1d1` | 107 | feat: Algorithm v7.6 - Balanced technical merit and market adoption This release introduces Algorithm v7.6 with fine-tuned weights that balance technical excellence, agentic capabilities, and market v |
| 2025-11-02 11:54:38 | `f334be84` | 16 | fix: resolve algorithm version labels and icon display issues - Fixed algorithm version labels in v7.5 and v7.6 generation scripts - Added db_id field to tools repository for proper UUID mapping - Fix |
| 2025-11-02 18:57:04 | `6f53e1a7` | 34 | feat: update algorithm to v7.6 and create content management system Algorithm Updates: - Updated all content to Algorithm v7.6 (Market-Validated Scoring) - Increased Developer Adoption weight to 18% ( |
| 2025-11-02 19:02:47 | `bd40d862` | 1 | feat: add Algorithm v7.6 news article - Created comprehensive news article for Algorithm v7.6 update - Highlights shift from innovation-focused to market-validated scoring - Explains Developer Adoptio |
| 2025-11-02 19:59:55 | `312225d0` | 4 | fix: add navigation fallback for Sign In For Updates button on public pages - Fixed SignInButtonDirect component to handle clicks when Clerk unavailable - Added onClick handler that navigates to sign- |
| 2025-11-03 11:09:52 | `891b6b76` | 8 | fix: resolve ClerkProvider context boundary error - Replaced global window flag with React Context for provider detection - Created ClerkAvailableContext and ClerkAvailableProvider in contexts/clerk-c |
| 2025-11-03 11:28:27 | `49b44db2` | 3 | fix: resolve webpack ChunkLoadError with HMR cache clean rebuild - Resolved ChunkLoadError timeout (120s) on vendor.tailwind-merge chunk - Root cause: HMR cache corruption from ClerkProvider context b |
| 2025-11-03 12:00:40 | `f64142b1` | 4 | fix: correct React attribute casing for fetchPriority - Changed fetchpriority to fetchPriority (proper React attribute casing) - Updated in app/layout.tsx for preload link tags - Updated in components |
| 2025-11-03 12:32:54 | `8734a29c` | 28 | fix: resolve all 94 ESLint errors to pass pre-publish quality gate Fixes for patch release 0.3.8: **JSX Quote Escaping (25 errors fixed)** - Escaped apostrophes and quotes in JSX text content - Change |
| 2025-11-11 09:19:01 | `d40348cf` | 75 | feat: organize project documentation into structured hierarchy Reorganized 69 documentation files from project root into categorized subdirectories under docs/ following PROJECT_ORGANIZATION.md standa |
| 2025-11-12 13:09:31 | `c529c20c` | 5 | feat: integrate Jina.ai Reader API for enhanced article crawling Add Jina.ai Reader service as primary article content extraction method with fallback to existing crawler. This integration provides cl |
| 2025-11-24 21:27:23 | `f3367cf8` | 28 | feat: preserve all work from 2025-11-24 (Issues #43, #44, #53-56) This commit preserves ALL work from today including: Original Implementation (Issues #43 & #44): - AI-powered news analysis endpoint - |
| 2025-11-24 21:28:09 | `10e3af48` | 5 | feat: original implementation of Issues #43 & #44 (AI news analysis) This commit preserves the ORIGINAL implementation before critique and fixes. Features Implemented: - AI-powered news analysis endpo |
| 2025-11-24 21:58:35 | `196484a0` | 23 | feat: implement Issues #55 and #56 - LLM validation and editor UX improvements This commit implements two major feature enhancements: Issue #55: LLM Response Validation and Retry Logic - Add comprehen |
| 2025-11-24 22:07:32 | `abda0e8c` | 8 | fix: implement Issue #57 - What's New navigation and pages This commit fixes the broken "What's New" navigation by creating a complete standalone page section with proper navigation and content displa |
| 2025-11-24 22:42:33 | `57a7fe34` | 1 | feat: add Preview/Apply Changes to News Editor (Issue #59) Implemented Preview Ranking Impact functionality in News Editor to allow editors to preview and apply scoring changes before publishing artic |
| 2025-11-24 22:48:20 | `8ad598cf` | 5 | feat: add admin UI for monthly summary regeneration (Issue #58) Implemented dedicated admin page for managing What's New monthly summaries with month selection, generation, and preview capabilities. K |
| 2025-11-24 23:20:27 | `7af048f9` | 1 | fix: implement actual ranking score updates in Apply Changes Previously, the "Apply Changes" button in the News Editor's Preview Ranking Impact feature only saved changes to the article_rankings_chang |
| 2025-11-24 23:21:20 | `687f85a7` | 1 | fix: use relative URL for monthly summary API to fix port mismatch Previously, the monthly summary page used an absolute URL with a hardcoded default port (localhost:3000), but the dev server runs on  |
| 2025-11-25 00:18:33 | `3db2614f` | 1 | fix: add 'use client' directive to Button component Resolves console error: 'Event handlers cannot be passed to Client Component props' The Button component was missing the 'use client' directive, cau |
| 2025-11-25 00:20:41 | `7d2668df` | 1 | fix: resolve SSR event handler serialization errors Fixes React error: 'Event handlers cannot be passed to Client Component props' Changes: 1. Replace onClick buttons with <a> links in SignInButtonDir |
| 2025-11-25 00:27:56 | `6ffc66f7` | 1 | fix: await Apply Changes operation before closing modal - Changed onClick handler to async function - Added await before handleRecalculateRankings() - Modal now stays open during operation - Users can |
| 2025-11-25 01:58:29 | `80475b34` | 2 | fix: simplify Apply Changes to use direct POST request - Removed complex EventSource/SSE logic for apply operation - Now uses simple POST request with async/await - Button properly waits for completio |
| 2025-12-01 17:31:49 | `87f2dec8` | 15 | feat: implement comprehensive caching strategy with on-demand invalidation - Add centralized cache invalidation service (lib/cache/invalidation.service.ts) - Configure ISR for Tools page (1-hour reval |
| 2025-12-01 18:20:25 | `bb43a6c5` | 1 | feat: add Google Tag Manager integration - Add GTM script with GA4 tracking (G-5YBL6NPWL6) - Use Next.js Script component with afterInteractive strategy - Initialize dataLayer for Google Analytics - A |
| 2025-12-01 18:20:57 | `a4703a30` | 11 | feat: add State of AI monthly summary system Implements automated monthly "State of AI" editorial system using last 4 weeks of news. Features: - Admin UI for generating monthly editorials with month/y |
| 2025-12-02 22:59:54 | `6ccd10c8` | 13 | feat: enable ISR on tool pages for performance optimization Performance Improvements (Tool Pages - 51 pages): - TTFB: 2.7s → 300ms (89% improvement) - FCP: 3.56s → 1.2s (66% improvement) - LCP: 4.01s  |
| 2025-12-02 23:10:46 | `45b854b5` | 10 | fix: resolve TypeScript and ESLint errors for v0.3.13 release TypeScript Fixes (10 errors): - Fix requireAdmin() call signature in State of AI route handler - Fix Zod error property access (.errors →  |
| 2025-12-02 23:54:11 | `68321a1d` | 7 | fix: create proper XML sitemap to resolve Google Search Console error Problem: - Google Search Console reported "Sitemap is HTML" - /sitemap.xml was returning HTML instead of XML - app/sitemap.ts file |
| 2025-12-05 02:30:29 | `bcdc1543` | 3 | fix: upgrade Next.js and React to fix CVE-2025-55182 RCE vulnerability - Upgrade Next.js from 15.5.6 to 15.5.7 - Upgrade React from 19.2.0 to 19.2.1 - Upgrade React-DOM from 19.2.0 to 19.2.1 - Add sec |
| 2025-12-05 02:49:16 | `72c64d35` | 11 | feat: add deployment automation system - Add automated semantic versioning script (scripts/deploy.sh) - Add comprehensive deployment documentation - Update CHANGELOG.md with proper Keep a Changelog fo |
| 2026-02-03 01:45:40 | `8f27c06a` | 8 | refactor: split articles repository into focused modules Split the 840-line God class (articles.repository.ts) into 7 focused modules: - articles-core.repository.ts (CRUD operations) - articles-query. |
| 2026-02-03 20:41:18 | `bd8e75a0` | 13 | feat: implement automated AI news ingestion system Add fully automated content discovery and ingestion pipeline: Services: - BraveSearchService: AI news discovery via Brave Search API - ArticleQuality |
| 2026-02-04 12:16:02 | `5cdaf284` | 16 | feat: v0.4.0 - add automated AI news ingestion and monthly report generation - Add Tavily search integration for AI news discovery - Add monthly 'State of Agentic Coding' report with style guide - Fix |
| 2026-02-04 13:15:27 | `dfa89eeb` | 8 | fix: remove tool page links from monthly summary to prevent 404s Tool links like /tools/claude-agent were generating 404s because those tools don't exist in the database. Now only links to newsletter  |
| 2026-02-05 12:05:12 | `e5e650c4` | 3 | fix: properly tag auto-ingested articles with automation metadata Problem: - Articles ingested by the automated news system were not being tagged - `is_auto_ingested` was always false despite automati |
| 2026-02-05 16:13:34 | `1d5c8d4c` | 2 | feat: add semantic duplicate detection with "first wins" model Problem: - Multiple articles about the same story (e.g., 5 articles about Apple Xcode agentic coding) were being ingested because they ha |
| 2026-02-05 16:18:36 | `95206d5c` | 1 | feat: reduce article summary length to 400-500 words - Summary: 750-1000 words → 400-500 words (more concise) - Rewritten content: 1500 words → 800-1000 words - Reduced max_tokens from 32k to 16k (cos |
| 2026-02-06 12:38:40 | `02e39471` | 3 | feat: add articles_skipped_semantic database tracking - Add articlesSkippedSemantic column to automated_ingestion_runs table - Update schema.ts with new column definition - Update service to persist s |
| 2026-02-07 11:59:46 | `1e3423d7` | 1 | fix: add /api/cron routes to public routes in middleware The Vercel cron jobs were failing with MIDDLEWARE_INVOCATION_FAILED because /api/cron/* routes were not in the public routes list. Clerk middle |
| 2026-02-07 13:24:00 | `ff6057b9` | 3 | fix: resolve monthly summary API timeout in production - Add /api/whats-new to public routes (skip Clerk auth overhead) - Add maxDuration=60 for Vercel function timeout - Add getCachedSummary() fast-p |
| 2026-02-07 13:33:07 | `30c32a4e` | 1 | fix: correct cachedJsonResponse status code parameter cachedJsonResponse() was receiving cache duration (300) as HTTP status code, causing HTTP 300 (Multiple Choices) instead of HTTP 200. Frontend fet |
| 2026-02-08 15:16:49 | `6480ccd5` | 6 | fix: Monthly Summary markdown rendering and add Vercel Speed Insights Monthly Summary Fix: - Replace custom regex-based markdown parsing with ReactMarkdown - Add remark-gfm plugin for GitHub Flavored  |
| 2026-02-11 04:29:06 | `7dd1ae80` | 14 | fix: news crawling extraction with Tavily-first fallback chain Root cause: Jina Reader was getting blocked by news sites (Reuters 401 errors) causing all article ingestion to fail since Feb 7. Solutio |
| 2026-02-12 23:36:54 | `39b14f70` | 2 | feat: add Latest AI News card to homepage - New NewsUpdateCard component showing 5 recent headlines - Placed above stats section, below top 3 tool cards - Shows headline, source, relative time (e.g.,  |
| 2026-02-13 16:47:27 | `34d1ebc2` | 1 | fix: add cache invalidation after article ingestion Revalidate /news, /, /tools, /rankings, /whats-new paths and related tags after successful article ingestion in daily cron. Co-Authored-By: Claude O |
| 2026-02-14 15:43:24 | `97a33251` | 2 | fix: resolve cron job ingestion failures and add copyright compliance ## Fixes ### 1. revalidatePath Error in Cron Jobs - Wrapped revalidatePath calls in try-catch in ArticlesCoreRepository - Prevents |
| 2026-02-16 18:06:43 | `a68f2ddf` | 1 | feat: add on-demand cache revalidation endpoint Enables manual cache invalidation via: GET /api/revalidate?secret=CRON_SECRET&path=all Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com> Changed f |
| 2026-02-21 18:09:53 | `e7330570` | 1 | fix: increase cron maxDuration from 60s to 300s to prevent pipeline timeout Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com> Changed files: - app/api/cron/daily-news/route.ts |
| 2026-02-21 18:27:34 | `5e2d9177` | 3 | feat: add --days parameter to trigger-ingestion script for backfill support Add configurable days lookback window to support backfilling articles outside Tavily's default ~7-day window. Changes: - Add |
| 2026-02-21 18:35:36 | `eaa9b09d` | 1 | fix: increase cron maxDuration to 800s - pipeline observed at 647s Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com> Changed files: - app/api/cron/daily-news/route.ts |
| 2026-02-21 19:17:56 | `0592f3c9` | 1 | feat: add tool update data for 10 tools with poor descriptions Update descriptions, taglines, and categories for: - infosys-topaz (code-assistant) - anything/AnythingLLM (open-source-framework) - wabi |
| 2026-04-10 23:12:16 | `68e3c2d8` | 2 | fix: resolve auto article scraping failure by fixing Vercel environment variables Root cause: CRON_SECRET mismatch between local development and Vercel production Solution: Updated production CRON_SEC |

---

## 4. Stale-DB-Only Conversation Captures (provenance note)

The older `kuzu-memories/` DB held **395** memories vs the primary's 158. After reconstructing originals and deduping against the primary DB, **175** records existed only in the stale DB. **None of them were unique *curated* knowledge** — they are Claude Code conversation-transcript captures (`source_type = claude-code-hook`): the orchestrator agent's own narration of work sessions (e.g. *"Perfect! Now let me create a summary…"*, *"Confirmed. I'll delegate…"*). The substantive ones are progress/verification reports for work that is already represented by (a) the git commits in Section 3 and (b) the curated memories in Section 1.

- **3** typed `decision`/`preference` entries → **promoted to Section 2** (the only stale-only content worth keeping).
- **94** substantive `claude-code-hook` transcript reports → indexed below (titles only; these are session narration, not distilled knowledge).
- **78** short filler captures ("Confirmed.", "Understood.", etc.) → intentionally omitted as noise.

<details>
<summary>Index of stale-only transcript captures (click to expand — 94 session-narration reports, titles + dates)</summary>

1. **2025-10-27** — Understood. I can see this is a test of the KuzuMemory hooks integration in the aipowerranking project. Looking at the system remi…
2. **2025-10-29** — # Web Performance Analysis Report - AI Power Rankings ## Executive Summary Based on comprehensive analysis of the codebase at `/Us…
3. **2025-10-29** — Now let me create a summary document of the changes: ## Phase 1 Quick Wins Implementation - Complete All Phase 1 performance optim…
4. **2025-10-29** — Perfect! Now let me create one final executive summary for quick reference: ## Phase 1 Performance Optimization - Verification Com…
5. **2025-10-29** — Excellent! Now let me create a final summary with all the key information: ## Phase 2A Database Query Optimization - Complete! 🎉 I…
6. **2025-10-29** — Perfect! Now let me create a final implementation summary for you: ## ✅ Phase 2B JavaScript Bundle Optimization - COMPLETE I've su…
7. **2025-10-29** — Perfect! Let me create one final summary for you: ## Phase 2C Image Optimization - Complete ✅ I've successfully implemented all Ph…
8. **2025-10-30** — Perfect! Now let me create a quick summary for the user: --- # Phase 2 Comprehensive Verification Complete ⛔ ## 🚨 CRITICAL: DO NOT…
9. **2025-10-30** — ## Research Complete ✅ I've completed comprehensive research on **Goose AI** from Block. Here's what I've delivered: ### 📊 **Key F…
10. **2025-10-30** — Perfect! Now let me create a quick summary output for you: ## 🦆 **Goose AI Agent - Successfully Added to AI Power Rankings** ### ✅…
11. **2025-10-30** — Perfect! Now let me create a quick summary of what was accomplished: ## Summary: Phase 2 Route Groups Architecture - COMPLETE ✅ I'…
12. **2025-10-30** — Now let me display the final verification summary: --- # 🦆 Goose AI Tool - Verification Complete ## ✅ **FINAL STATUS: APPROVED FOR…
13. **2025-10-30** — Perfect! The correction has been successfully applied. Let me create a final summary document with all the key information: ## 🎉 *…
14. **2025-10-30** — Perfect! Let me create a final summary document: ## ✅ Implementation Complete: Port Change from 3000 to 3006 ### Summary I have su…
15. **2025-10-30** — ## Summary Successfully changed the Next.js development server port from **3006** to **3007**. ### Files Updated (9 files): 1. **`…
16. **2025-10-30** — ## Investigation Complete I've completed a comprehensive investigation of all four tool entry issues. Here's the executive summary…
17. **2025-10-30** — Perfect! Now let's create a final implementation report: ## ✅ Implementation Complete - All Four Tool Entry Issues Fixed ### Summa…
18. **2025-10-30** — Excellent! Now let me create a concise final summary: ## Summary I've successfully completed both tasks: ### ✅ TASK 1: Goose Logo …
19. **2025-10-30** — I see the issue - the API is returning `null` for all Goose fields. This means the database query isn't finding the Goose entry co…
20. **2025-10-30** — ## Summary **Investigation Complete** ✅ ### Findings The Goose tool API endpoint (`/api/tools/goose/json`) is **working correctly*…
21. **2025-10-30** — I'm delegating the investigation of the production JavaScript syntax error to the Engineer agent. This is a critical issue that's …
22. **2025-10-30** — Perfect! Now let me create a quick summary of what to do next: ## Summary: Production Authentication Issue - RESOLVED ### 🎯 Root C…
23. **2025-10-30** — ## Deployment Complete - Evidence Summary ### 1. Git Commit Successfully Created - **Commit SHA**: `74445ed7c8d19c32baa977556d762a…
24. **2025-10-30** — ## Summary I've completed the comprehensive verification of the production authentication fix. Here's the verdict: ## ⚠️ **PARTIAL…
25. **2025-10-30** — The QA verification revealed that while we fixed the manual preload tag, the syntax error still persists because **Next.js is auto…
26. **2025-10-30** — Perfect! Now let me create a concise summary for you: --- ## ✅ Fix Complete: Next.js Image Component Invalid Preload Tags ### Root…
27. **2025-10-30** — ## ✅ Deployment Complete - Evidence Summary ### Commit Details - **Commit SHA**: `d6c0e3f52ffd8a54178203871a88362e76a9051c` - **Au…
28. **2025-10-30** — Perfect! Let me create a final summary for you: --- ## ✅ **FINAL VERIFICATION: PRODUCTION AUTHENTICATION FIX - COMPLETE SUCCESS** …
29. **2025-10-30** — I see from your console output that while we've made progress, **the syntax error still persists** on production. The error shows:…
30. **2025-10-30** — Perfect! Now I understand the full picture. Let me create a comprehensive report: ## 🔍 **CSS Syntax Error - Root Cause Analysis** …
31. **2025-10-30** — Excellent discovery! The Engineer found that Next.js is generating **`<script>` tags for CSS files** instead of just `<link>` tags…
32. **2025-10-30** — Perfect! This is definitely CSS. When the browser tries to execute this as JavaScript via `<script src="...">`, it will throw "Unc…
33. **2025-10-30** — The quick fix didn't work - the CSS script tag bug persists even after disabling `optimizeCss`. Let me delegate to the Engineer to…
34. **2025-10-30** — Great! Now I understand the issue completely. Let me create a comprehensive report: ## 🔍 **INVESTIGATION COMPLETE: ROOT CAUSE IDEN…
35. **2025-10-30** — The CSS script tag issue persists. This appears to be a Next.js 15 bug that's NOT related to the webpack chunk naming. Let me crea…
36. **2025-10-30** — I see the Engineer discovered that keeping `optimizeCss: false` prevents the CSS script tag bug. Let me commit these changes and d…
37. **2025-10-30** — Perfect! The commit has been successfully pushed to production. Now let me provide you with a comprehensive summary of the deploym…
38. **2025-10-30** — Understood! I'll add a patch version bump to the workflow. Let me update the task list and delegate to the version control agent t…
39. **2025-10-30** — ## ✅ Patch Release v0.3.2 Created Successfully ### Release Summary **Old Version:** 0.3.1 **New Version:** 0.3.2 **Release Type:**…
40. **2025-10-30** — Based on my search, **Next.js 15.5** is the latest stable version (released August 18, 2025). You're currently on **Next.js 15.5.4…
41. **2025-10-30** — ## Summary I've completed the Next.js 15.5.6 upgrade test with a **critical discovery**. Here are the findings: ### Test Results: …
42. **2025-10-30** — The Engineer discovered something important: **the CSS script tag bug persists in Next.js 15.5.6 regardless of the `optimizeCss` s…
43. **2025-10-30** — ## Commit Complete **Evidence of Successful Commit:** **Commit SHA:** `9b1adb16` **Files Committed:** - `package.json` - Next.js a…
44. **2025-10-30** — Perfect! Let me create a comprehensive summary document: ## Release v0.3.3 Completed Successfully! ✅ ### Evidence of Completion ##…
45. **2025-10-30** — You're absolutely right! Let me investigate both issues. I'll start by checking the scoring discrepancy and then address the missi…
46. **2025-10-30** — Perfect! Let me create a summary response for the user: ## Investigation Complete: Jules Ranking Discrepancy & Missing Logos I've …
47. **2025-10-30** — Perfect! Now let me create a final summary with all the evidence: ## Summary: Jules Duplicate Entry Fix - COMPLETE ✅ I have succes…
48. **2025-10-31** — Perfect! Now let me create a final comprehensive summary: ## Summary I've successfully implemented the **Logo Collection System** …
49. **2025-10-31** — Perfect! All tasks are complete. Let me create one final summary showing the comparison: ## Task Complete: Logo Collection Summary…
50. **2025-10-31** — ## Commit Complete - Evidence Summary **Commit SHA**: `cfc8ed7f699b270a85c86254e7c378bf8bec617f` **Files Committed**: 67 files cha…
51. **2025-10-31** — ## ✅ Release v0.3.4 Created Successfully **Evidence of Completion:** ### 1. Version Bump ✅ - **New Version**: 0.3.4 (confirmed in …
52. **2025-10-31** — You're right! The production rankings still show incorrect data. The database changes we made are only in the **development databa…
53. **2025-10-31** — Perfect! Now let me create one final comprehensive summary showing exactly what was accomplished: ## 🎉 Production Fixes Applied Su…
54. **2025-10-31** — Great! The button component exists. Now let me create a summary document showing what was implemented: ## Implementation Summary: …
55. **2025-10-31** — ## Commit and Push Complete! ✓ **Evidence:** **Commit SHA:** `75c7375adbaaab8b29ba057118b31764ae2398bf` **Files Changed:** - `app/…
56. **2025-10-31** — I can see the previous session ended with critical production issues - rankings still showing Jules duplicate and logos not appear…
57. **2025-10-31** — **Critical Discovery**: The static PNG logos are returning **404 Not Found** on production, confirming they haven't been deployed …
58. **2025-10-31** — ## Summary I've investigated and partially resolved the static PNG file serving issue on aipowerranking.com. Here's what was accom…
59. **2025-10-31** — I see the vercel-ops-agent has identified a critical issue - the `app/[lang]` dynamic route is intercepting static file requests. …
60. **2025-10-31** — I can see the vercel-ops-agent created an API route solution, but it's encountering file system access issues. Let me check the AP…
61. **2025-10-31** — Good! The files exist in `/public/tool-icons/`. The issue is that in Vercel's serverless environment, static files in `/public` ar…
62. **2025-10-31** — Perfect! Now let me create a quick summary for you: ## 🎯 Research Complete: Static File 404 Issue ### **ROOT CAUSE IDENTIFIED** ✅ …
63. **2025-10-31** — Excellent! All changes are complete. Let me create a final verification report: ## Summary: Logo 404 Issue - Root Cause Fixed I've…
64. **2025-10-31** — I see the issue - the vercel-ops-agent moved the PNG files from `/public/tools/` to `/public/tool-icons/`, but we need to also sta…
65. **2025-10-31** — ## LOGO 404 FIX - DEPLOYMENT VERIFICATION COMPLETE ### Deployment Status **Commit:** eaec1a8d - "fix: resolve logo 404 errors by f…
66. **2025-10-31** — I can see two issues from your report: 1. ✅ **Logos are now showing** - The "Recently Updated" section shows logos appearing corre…
67. **2025-10-31** — I see the problem - three tools (Google Jules, Refact.ai, and Devin) all have identical scores of 60 with the same agentic capabil…
68. **2025-10-31** — Good - the Jules duplicate fix is in place (old entry is a redirect). Now let me check the actual ranking data for these three too…
69. **2025-10-31** — **Critical Issue Found:** All three tools have **IDENTICAL** factor scores across all 9 metrics! This is clearly a data corruption…
70. **2025-10-31** — Perfect! Now let me create a summary response for the user: ## Investigation Complete: Critical Ranking Data Issue Identified I've…
71. **2025-11-01** — I've completed a comprehensive investigation of the ranking issues. Here's the critical finding: ## 🚨 Critical Discovery: Algorith…
72. **2025-11-01** — Perfect! Now let me create a final summary document to wrap everything up: ## Summary I've successfully created **Algorithm v7.3**…
73. **2025-11-01** — Excellent idea! Let me delegate to the research agent to investigate available metrics sources and create a data collection strate…
74. **2025-11-01** — Perfect! Now let me create a final summary of all deliverables: ## Research Complete! 🎉 I've completed comprehensive research on c…
75. **2025-11-01** — Perfect! Now let me create a quick summary document: ## Summary I've successfully completed **Phase 1: GitHub Metrics Collection**…
76. **2025-11-01** — Excellent! Let me create a comprehensive final summary for you: ## Research Complete! 🎉 I've successfully completed comprehensive …
77. **2025-11-01** — Perfect! Now let me create a final summary for you: ## Summary I've successfully completed the package registry metrics collection…
78. **2025-11-01** — Based on my review of the previous session, I can see that: 1. **Local testing was completed successfully** - The user's last scre…
79. **2025-11-01** — Perfect! The dev server on port 3007 is running successfully and serving the new Algorithm v7.3 rankings. Based on the logs, I can…
80. **2025-11-01** — Perfect! Now let me create a final executive summary: ## Algorithm v7.3 Production Deployment - Research Complete I've completed a…
81. **2025-11-01** — Excellent news! The verification script has completed successfully. Let me provide a comprehensive analysis: ## ✅ VERIFICATION RES…
82. **2025-11-01** — Perfect! Now let me create a comprehensive test report: --- # **Production Verification Report: Algorithm v7.3 Deployment** ## **E…
83. **2025-11-01** — You're absolutely right to question this. Let me investigate the scoring for Google Jules and compare it to tools that should like…
84. **2025-11-01** — Perfect! Now let me create a summary document for quick reference: ## Investigation Complete: Google Jules Ranking Error I've comp…
85. **2025-11-01** — You're absolutely right - the Research agent found a critical bug in the algorithm! **Innovation scores are exceeding 100 points**…
86. **2025-11-01** — The server completed. Let me restart it and also address the algorithm bug. Let me update the tasks and fix both issues:…
87. **2025-11-01** — Perfect! Now let me create a concise summary of what was accomplished: ## Summary I have successfully fixed the critical bug in Al…
88. **2025-11-01** — Great! The bug is fixed. Now let me restart the dev server on port 3007 and regenerate the rankings with the corrected algorithm:…
89. **2025-11-01** — ## Summary Successfully regenerated the November 2025 rankings with Algorithm v7.3.1 (innovation bug fix) and started the dev serv…
90. **2025-11-01** — Excellent point! You're absolutely right. **Tools without real metrics data should be penalized, not given the benefit of the doub…
91. **2025-11-01** — Perfect! Now let me create a final summary for you: ## Summary I've successfully implemented **Algorithm v7.4** with a comprehensi…
92. **2025-11-01** — Perfect! Algorithm v7.4 is implemented with the missing data penalty system. However, there's a critical blocker: ## 🚨 The Core Is…
93. **2025-11-01** — Perfect! Let me now create a final summary of all the deliverables: ## Investigation Complete ✅ I've identified the root cause of …
94. **2026-01-11** — Research has identified the root cause. This is a **Clerk Dashboard configuration issue**, not a codebase issue. Let me delegate t…

</details>

> If any specific session report above is needed verbatim, it is still recoverable from `kuzu-memories/memories.db` with the same extraction script; it was excluded here only to keep the export focused on durable knowledge rather than transcript logs.

---

## Appendix A — Project Self-Description (`.kuzu-memory/project_info.md`)

Reproduced verbatim for context:

<details>
<summary>project_info.md</summary>

# 📋 Project Information - aipowerranking

This file contains structured information about the project that helps KuzuMemory provide better context.

## 🏗️ Project Overview

**Project Name**: aipowerranking
**Type**: Web Application
**Language**: TypeScript
**Framework**: Next.js 14 (App Router)
**Version**: 0.1.1

## 🎯 Project Purpose

AI Power Ranking is a comprehensive web application that ranks and tracks AI tools and technologies. It provides users with data-driven insights into the AI tool landscape through systematic evaluation and scoring, industry news aggregation, and detailed methodology documentation.

## 🏛️ Architecture

### Tech Stack
- **Backend**: Next.js 14 API Routes (TypeScript)
- **Database**: PostgreSQL with Drizzle ORM
- **Cache**: Not implemented
- **Frontend**: React 18 with Next.js App Router
- **Deployment**: Vercel
- **Authentication**: Clerk
- **Styling**: Tailwind CSS

### Key Components
- **Rankings System**: AI tool evaluation and scoring engine with baseline derivation
- **News Ingestion**: Article processing service for AI industry news
- **Authentication Layer**: Clerk-based user management with Core 2 integration
- **Internationalization**: Multi-language routing via `[lang]` parameter
- **Repository Pattern**: Database access via repositories in `lib/db/repositories/`

## 📏 Conventions & Standards

### Code Style
- TypeScript with strict type checking
- ESLint for code quality
- Component-based architecture (React)
- Server/Client component separation (Next.js App Router)

### API Design
- RESTful API routes in `app/api/`
- Admin endpoints require `NODE_ENV` checks
- No test/debug endpoints in production
- Proper authentication guards on protected routes

### Database
- Drizzle ORM for type-safe queries
- Migration-based schema changes (no direct schema modifications)
- Repository pattern for data access
- Schema definitions in `lib/schema.ts`

### Testing
- Test documentation in `/tests/` directory
- Security-focused: all test endpoints removed from production
- UAT reports track known issues and resolutions

## 🚀 Development Workflow

### Getting Started
1. Clone repository and install dependencies: `npm install`
2. Configure environment variables (Clerk, DATABASE_URL)
3. Run database migrations: `npm run db:migrate`
4. Start development server: `npm run dev`

### Common Tasks
- **Run tests**: `npm test`
- **Start dev server**: `npm run dev`
- **Build for production**: `npm run build`
- **Database operations**: `npm run db:push`, `npm run db:studio`
- **Type checking**: `npm run type-check`
- **Linting**: `npm run lint`

## 🤝 Team Preferences

### Development
- Primary developer: Robert (Masa) Matsuoka
- Iterative development approach with phased rollouts
- Security-first mindset (multi-phase test endpoint removal)
- Production stability prioritized over rapid feature deployment

### Communication
- Detailed commit messages with conventional commits (feat/fix/chore)
- Comprehensive documentation in `/docs/` directory
- UAT reports for tracking issues and resolutions
- Version tracking with semantic versioning

### Code Review
- Type safety enforcement with TypeScript
- Security review for admin endpoints (NODE_ENV guards)
- Authentication flow validation required
- Migration-based database changes only

## 📚 Important Resources

- **Documentation**: `/docs/` directory (CONTRIBUTING, AUTHENTICATION-CONFIG, baseline-scoring-usage)
- **API Docs**: API routes in `app/api/` with inline documentation
- **Testing Guide**: `/tests/README.md`, `/tests/QUICK_START.md`
- **Deployment Guide**: Vercel-based deployment (see UAT reports)
- **Scripts & Tools**: `/scripts/` directory (database migrations, cleanup utilities)
- **UAT Reports**: `/uat-screenshots/EXECUTIVE-SUMMARY.md`

---

**💡 Tip**: Update this file as the project evolves. KuzuMemory will use this information to provide better context for AI assistance.

**🤖 AI Integration**: This information is automatically included in AI prompts to provide project-specific context.

</details>

---

## Appendix B — Extraction Reproducibility

```bash
# Isolated python venv (NOT added to project node deps)
python3 -m venv /tmp/kuzu_export_venv
/tmp/kuzu_export_venv/bin/pip install kuzu   # -> kuzu 0.11.3

# Open read-only and dump every Memory property
python - <<'PY'
import kuzu, json
db = kuzu.Database(".kuzu-memory/memories.db", read_only=True)
conn = kuzu.Connection(db)
res = conn.execute("MATCH (m:Memory) RETURN m.id, m.content, m.created_at, m.source_type, m.metadata ORDER BY m.created_at;")
# full original text lives in json.loads(metadata)['extraction_metadata']['original_content']
PY
```

Schema confirmed via `CALL show_tables() RETURN *;` (node tables: `Memory`, `ArchivedMemory`, `Entity`, `Keyword`, `Session`, `SchemaVersion`) and `CALL table_info('Memory') RETURN *;`.

**No `.db` files were modified** — every connection was opened with `read_only=True`.
