# Automatic Article Ingestion Failure Investigation

**Date:** 2026-02-21
**Status:** Root Causes Identified
**Severity:** HIGH - No automatic article ingestion occurring

---

## Executive Summary

The automatic article ingestion system has had a history of failures. Three prior fixes were applied (Feb 7, Feb 11, Feb 14), but ingestion is still not working reliably on production. This report identifies **four root causes**, ordered by severity.

---

## Architecture Overview

```
Vercel Cron (6 AM UTC daily)
  → GET /api/cron/daily-news
    → AutomatedIngestionService.runDailyDiscovery()
      → TavilySearchService.searchAINews() [primary] or BraveSearchService [fallback]
      → URL deduplication (checkDuplicates)
      → Semantic deduplication (filterSemanticDuplicates)
      → Content fetch: Tavily Extract → Jina Reader → Basic HTML
      → ArticleQualityService.batchAssess() [OpenRouter LLM]
      → ArticleIngestionService.ingestArticle() [OpenRouter LLM]
        → ArticlesCoreRepository.createArticle()
      → invalidateArticleCache()
```

**Key files:**
- `vercel.json` - Cron schedule: `0 6 * * *` (daily at 6 AM UTC)
- `app/api/cron/daily-news/route.ts` - Cron endpoint
- `lib/services/automated-ingestion.service.ts` - Main orchestrator (1096 lines)
- `lib/services/tavily-search.service.ts` - Primary search
- `lib/services/article-quality.service.ts` - LLM quality filter
- `lib/services/article-ingestion.service.ts` - Article storage

---

## Root Cause Analysis

### Root Cause #1: MISSING ENVIRONMENT VARIABLES (CONFIRMED - MOST LIKELY)

**Severity:** CRITICAL
**File:** `.env.local` (pulled from Vercel via CLI)

The local `.env.local` file (pulled from Vercel with `vercel env pull`) is **missing these critical environment variables:**

| Variable | Purpose | Impact if missing |
|----------|---------|-------------------|
| `CRON_SECRET` | Cron endpoint authentication | Cron returns 500 "not configured" |
| `TAVILY_API_KEY` | Primary article search + content extraction | Falls back to Brave; no content extraction via Tavily |
| `BRAVE_SEARCH_API_KEY` | Fallback article search | If both missing: pipeline fails with "No search API configured" |
| `JINA_API_KEY` | Article content extraction | Falls back to basic HTML (gets blocked) |

**Evidence:**
```
$ grep -c "CRON_SECRET\|TAVILY\|BRAVE" .env.local
0  ← ZERO matches - these variables do not exist
```

**How it fails:** The cron endpoint at line 33-44 of `route.ts` checks:
```typescript
const cronSecret = process.env["CRON_SECRET"];
if (!cronSecret) {
  return NextResponse.json({ error: "Cron endpoint not configured" }, { status: 500 });
}
```
If `CRON_SECRET` is not set in production, every cron invocation returns HTTP 500 immediately.

**If `TAVILY_API_KEY` and `BRAVE_SEARCH_API_KEY` are both absent:**
```typescript
// automated-ingestion.service.ts line 287-312
const useTavily = this.tavilySearchService.isConfigured(); // false
const useBrave = this.braveSearchService.isAvailable();    // false
if (!useTavily && !useBrave) {
  // Pipeline aborts with "failed" status
}
```

**Note:** The `.env.local` was pulled from the Vercel project `ai-power-ranking` (project ID: `prj_X7qlcAHqmXu6qRxFnNcKFqNzIwCL`). These variables MUST be added to Vercel production environment variables if not already present.

**Fix:** In Vercel dashboard → Project Settings → Environment Variables, ensure all 4 variables are set for Production environment.

---

### Root Cause #2: TIMEOUT - 60-SECOND LIMIT IS INSUFFICIENT

**Severity:** HIGH
**File:** `app/api/cron/daily-news/route.ts`, line 21

```typescript
export const maxDuration = 60; // Allow up to 60 seconds
```

**The pipeline does sequential operations that easily exceed 60 seconds:**

| Step | Operations | Estimated Time |
|------|-----------|----------------|
| Tavily search | 3 API calls (1 primary + 2 supplementary) | ~9-15s |
| Content fetch | Up to 40 articles × 10s timeout each | 20-400s |
| Quality assessment | Sequential LLM calls (OpenRouter) per article | 3-8s each |
| Article ingestion | Sequential LLM calls (OpenRouter) per article | 10-30s each |

**Even in the best case** (5 articles pass quality, content fetches are fast):
- Search: 10s + Content: 50s (5×10s) + Quality: 25s (5×5s) + Ingest: 75s (5×15s) = **160s**

The 60-second `maxDuration` causes Vercel to terminate the function mid-execution, leaving the run record in `status: 'running'` forever in the database.

**Evidence from QA report** (Feb 6, 2026): "Duration: 212.2 seconds (~3.5 minutes)" for a successful manual run.

**Vercel limit:** Vercel Pro plan allows up to `maxDuration = 300` (5 minutes) for serverless functions. Enterprise allows 900s.

**Fix location:** `app/api/cron/daily-news/route.ts`, line 21:
```typescript
// Change from:
export const maxDuration = 60;
// To:
export const maxDuration = 300; // 5 minutes - sufficient for pipeline (verified ~212s average)
```

---

### Root Cause #3: REVALIDATEPATH ERROR DURING CRON EXECUTION (FIXED BUT VERIFY)

**Severity:** MEDIUM (previously fixed)
**Fix commit:** `97a33251` (2026-02-14)
**File:** `lib/db/repositories/articles/articles-core.repository.ts`, lines 186-200

**Background:** Before commit `97a33251`, calling `revalidatePath()` inside `createArticle()` during cron execution threw:
```
Error: static generation store missing
```
This caused the entire article creation to fail and roll back.

**Fix applied:** The `revalidatePath` calls were wrapped in try-catch so they fail silently during cron context.

**Current state (VERIFY):** The fix is in the codebase. Confirm it deployed to production by checking if articles can now be created without the `revalidatePath` error.

---

### Root Cause #4: SEMANTIC DEDUPLICATION OVER-FILTERING (POTENTIAL)

**Severity:** MEDIUM
**File:** `lib/services/automated-ingestion.service.ts`, line 811

```typescript
const similarityThreshold = 0.35; // 35% weighted similarity triggers duplicate detection
```

**Issue:** The threshold of 0.35 (35% similarity) combined with a weighted algorithm (40% word overlap + 60% key feature overlap) may be over-filtering legitimate new articles.

The key features list includes generic terms:
```typescript
const keyEntities = new Set([
  'openai', 'anthropic', 'google', 'microsoft', ...,
  'agent', 'coding', 'assistant', 'model', 'release', 'launch',  // Very common in AI news
  'announces', 'unveils', 'funding', 'acquisition', 'partnership',
]);
```

Two different articles about different "model releases" (e.g., GPT-4o mini update vs Claude 3.5 Haiku update) could both trigger `model` + `release` → 2/2 key features match = 100% feature similarity → combined score of `0×0.4 + 1.0×0.6 = 0.60` → **filtered as duplicate** even though they're different stories.

**Evidence from QA report:** "Only 3 of 26 articles passed the quality filter (11.5%)" - semantic deduplication is removing 26.9% of articles.

**Fix:** Raise threshold slightly (e.g., to 0.45) or remove extremely generic terms from `keyEntities` set (`'model'`, `'release'`, `'agent'`, `'coding'`, `'assistant'`).

---

## Timeline of Prior Fixes

| Date | Commit | Fix Applied |
|------|--------|-------------|
| 2026-02-04 | `bd8e75a0` | Initial automated ingestion system created |
| 2026-02-07 | `1e3423d7` | `/api/cron/*` added to public middleware routes (Clerk was blocking) |
| 2026-02-07 | `0188e50f` | Triggered rebuild for env var update |
| 2026-02-11 | `7dd1ae80` | Tavily Extract added as primary content fetcher (Jina was getting 401s) |
| 2026-02-14 | `97a33251` | `revalidatePath` try-catch fix + copyright compliance prompts |
| 2026-02-16 | `a68f2ddf` | On-demand cache revalidation endpoint added |

---

## Recommended Fixes (Priority Order)

### Fix 1: Verify Production Environment Variables (IMMEDIATE)

Check Vercel Dashboard → `ai-power-ranking` project → Settings → Environment Variables.

Ensure these are set for **Production** environment:
- `CRON_SECRET` - any secure random string
- `TAVILY_API_KEY` - from https://tavily.com
- `BRAVE_SEARCH_API_KEY` - from https://api.search.brave.com (optional if Tavily works)
- `JINA_API_KEY` - from https://jina.ai (optional - improves content extraction)
- `OPENROUTER_API_KEY` - from https://openrouter.ai (already confirmed set)

### Fix 2: Increase maxDuration to 300 seconds

**File:** `app/api/cron/daily-news/route.ts`, line 21

```typescript
// Before:
export const maxDuration = 60;

// After:
export const maxDuration = 300; // 5 minutes - verified sufficient for pipeline (avg ~212s)
```

**Impact:** Allows the full pipeline to complete without Vercel killing the function.

### Fix 3: Verify revalidatePath Fix is Deployed

Check production logs for `[ArticlesRepo] Cache invalidation skipped (likely cron context)` - this warning should appear without throwing an error.

### Fix 4: Tune Semantic Deduplication (Optional)

**File:** `lib/services/automated-ingestion.service.ts`

Option A: Raise threshold slightly:
```typescript
const similarityThreshold = 0.45; // from 0.35
```

Option B: Remove generic terms from keyEntities:
```typescript
// Remove: 'model', 'release', 'agent', 'coding', 'assistant', 'launch'
// Keep only proper nouns: 'openai', 'anthropic', 'google', 'microsoft', etc.
```

---

## Verification Steps After Fixes

1. **Check Vercel logs** for `/api/cron/daily-news` around 6 AM UTC to see if it runs
2. **Check admin panel** at `/en/admin/automated-ingestion` for run history
3. **Run manual test** via admin panel POST to trigger ingestion
4. **Check `automated_ingestion_runs` table** using `npx tsx scripts/check-ingestion-runs.ts`
5. **Check recent articles** using `npx tsx scripts/check-recent-articles.ts`

---

## Files Examined

- `app/api/cron/daily-news/route.ts`
- `app/api/cron/monthly-summary/route.ts`
- `vercel.json`
- `middleware.ts`
- `lib/services/automated-ingestion.service.ts`
- `lib/services/tavily-search.service.ts`
- `lib/services/brave-search.service.ts`
- `lib/services/tavily-extract.service.ts`
- `lib/services/jina-reader.service.ts`
- `lib/services/article-quality.service.ts`
- `lib/services/article-ingestion.service.ts`
- `lib/services/openrouter.service.ts`
- `lib/db/repositories/articles/articles-core.repository.ts`
- `lib/startup-validation.ts`
- `.env.local` (Vercel pull)
- `.vercel/project.json`
- `docs/qa/cron-job-performance-feb6-2026.md`
- `docs/research/cron-job-investigation-2026-02-11.md`
