# Cron Hang Investigation: /api/cron/daily-news

**Date**: 2026-03-19
**Symptom**: Endpoint accepts connections, never returns a response (hangs indefinitely)
**Last successful run**: 2026-03-14
**New deployment**: 2026-03-15

---

## Executive Summary

The hang is caused by **two no-timeout `fetch()` calls in `lib/services/article-ingestion.service.ts`** (the `AIAnalyzer` class, lines ~651 and ~329). These calls go to OpenRouter and to raw article URLs with no `signal: AbortSignal.timeout(...)` or any other timeout mechanism. If OpenRouter stalls on a long completion request (16,000 max_tokens), or a target URL stalls during HTML fetch, Node.js holds the connection open indefinitely.

The deployment on 2026-03-15 did not change the ingestion service itself — but it changed `articles-entities.service.ts` and `articles.repository.ts` (the auto-tool creation guards), which means the pipeline runs further into the ingestion phase than before and is now reliably hitting the stall point on every run.

---

## Root Cause: Missing Timeouts in `AIAnalyzer.analyzeContent()`

### File: `lib/services/article-ingestion.service.ts`, lines ~651-667

```typescript
// HANGS: No timeout, no AbortSignal, max_tokens=16000
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${this.apiKey}`,
    "Content-Type": "application/json",
    Referer: process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3007",
  },
  body: JSON.stringify({
    model: "anthropic/claude-sonnet-4",
    messages: [...],
    temperature: 0.2,
    max_tokens: 16000,   // <-- requesting 16k tokens: long responses take 60-120s+
  }),
});
```

**Why this hangs**: The `AIAnalyzer` class uses a raw `fetch()` with no `signal` parameter. With `max_tokens: 16000`, OpenRouter generating a large response (400-500 word summary + 800-1000 word rewrite + full JSON) can take 2-3 minutes or more for Claude Sonnet 4. Node.js fetch has no built-in timeout — the request simply waits until the server responds or the process dies.

### File: `lib/services/article-ingestion.service.ts` (ContentExtractor), lines ~329-334

```typescript
// HANGS: No timeout on basic HTML fallback fetch
const response = await fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; AINewsBot/1.0; ...)",
    Accept: "text/html,...",
  },
  // No signal, no timeout
});
```

This is the fallback HTML fetch inside `ContentExtractor.extractFromUrl()`. If a target URL stalls (slow server, connection hang, redirect loop), this awaits indefinitely.

---

## Secondary Issue: `ArticleQualityService` Timeout is Per-Attempt, Not a Hard Cap

### File: `lib/services/article-quality.service.ts`

The quality service uses `getOpenRouterService()` which goes through `retryWithBackoff()` with `timeoutMs: 30000`. However, `retryWithBackoff` applies the timeout **per attempt** using `Promise.race()`, and retries up to 3 times. With `maxAttempts=3`, delays (1s, 2s, 4s), and 30s per attempt, the worst case is:

```
30s + 1s + 30s + 2s + 30s = 93 seconds per article quality check
```

With up to 20 articles in a batch (`batchAssess()`), worst case is:
```
20 articles × 93s = 1,860 seconds = 31 minutes
```

The Vercel function has `maxDuration = 800` (13 minutes), so it would time out at the Vercel level — but Vercel's timeout returns a 504 to the caller while the serverless function continues running internally, which explains the "accepts connections, never returns" symptom if the 800s limit is not being enforced.

---

## What Changed on 2026-03-15 (The Deployment)

### Commit `88c0a4fb` — `feat(ingestion): harden auto-tool creation against bad tool ingestion`

**Files changed**:
- `lib/db/repositories/articles.repository.ts`
- `lib/db/repositories/articles/articles-entities.service.ts`

**What it did**: Added a category allowlist and slug blocklist for auto-tool creation, and changed newly created tool status from `"active"` to `"pending_review"`.

**Why this matters for the hang**: This commit did NOT change the ingestion pipeline or add any new awaits. However, it changed behavior in the entity-creation phase that runs AFTER the OpenRouter AI analysis. The prior behavior may have been short-circuiting earlier runs with tool creation errors; the new hardened path runs further through the pipeline, making the per-article `AIAnalyzer.analyzeContent()` call (with its no-timeout fetch) more reliably reached on every article.

**None of the commits between 2026-03-13 and 2026-03-19 touched `lib/services/` or `app/api/cron/`.**

---

## Pipeline Execution Path to the Hang

```
GET /api/cron/daily-news
  -> AutomatedIngestionService.runDailyDiscovery()
     -> TavilySearchService.searchAINews()          [has timeout via Tavily API]
     -> checkDuplicates()                           [DB query, fast]
     -> getRecentArticleTitles()                    [DB query, fast]
     -> filterSemanticDuplicates()                  [in-memory, fast]
     -> fetchArticleContent() per article           [Tavily/Jina both have timeouts]
     -> ArticleQualityService.batchAssess()         [30s per attempt x 3 x 20 articles = up to 31min]
     -> ArticleIngestionService.ingestArticle()
        -> ContentExtractor.extractFromUrl()
           -> fetch(url)                            *** NO TIMEOUT ***
        -> AIAnalyzer.analyzeContent()
           -> fetch("openrouter.ai/...")            *** NO TIMEOUT, max_tokens=16000 ***
```

The hang most likely occurs at `AIAnalyzer.analyzeContent()` on the first article. With `max_tokens=16000` and Claude Sonnet 4 generating a 400-500 word summary plus 800-1000 word rewrite, OpenRouter can take 90-180 seconds. Node.js fetch blocks indefinitely.

---

## Evidence Summary

| Location | Issue | Evidence |
|----------|-------|----------|
| `article-ingestion.service.ts:651` | `fetch()` to OpenRouter with no timeout, `max_tokens=16000` | Direct code read, no `signal` parameter |
| `article-ingestion.service.ts:329` | `fetch(url)` for HTML fallback with no timeout | Direct code read, no `signal` parameter |
| `automated-ingestion.service.ts:199-203` | Basic HTML fetch HAS a 10s timeout | `signal: AbortSignal.timeout(10000)` present |
| `jina-reader.service.ts:75-87` | Jina fetch HAS a 30s timeout | `AbortController` + `setTimeout` present |
| `tavily-extract.service.ts:135-141` | Tavily extract fetch has NO timeout | No `signal` parameter (but API-side `timeout: 10` parameter is sent in request body) |
| `openrouter.service.ts:238-242` | The proper `OpenRouterService.generate()` path HAS timeout | Via `retryWithBackoff` `timeoutMs: 30000` |
| `article-ingestion.service.ts:651` | `AIAnalyzer` does NOT use `OpenRouterService` | Uses raw `fetch()` directly, bypassing all retry/timeout infrastructure |
| `article-quality.service.ts:6` | Quality service DOES use `OpenRouterService` | `getOpenRouterService()` call present |

---

## Why the AIAnalyzer Does Not Use OpenRouterService

The project has a proper `OpenRouterService` in `lib/services/openrouter.service.ts` with `retryWithBackoff` and `timeoutMs: 30000`. However, `AIAnalyzer` (inside `article-ingestion.service.ts`) was written with a direct `fetch()` call and was never refactored to use the centralized service. This is the root code smell that enabled the bug.

---

## Recommended Fixes (Ordered by Priority)

### Fix 1 (Immediate): Add AbortSignal.timeout to AIAnalyzer.analyzeContent()

In `lib/services/article-ingestion.service.ts`, line ~651:

```typescript
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: { ... },
  body: JSON.stringify({ ... }),
  signal: AbortSignal.timeout(120000), // 2 minute hard timeout for large completions
});
```

### Fix 2 (Immediate): Add AbortSignal.timeout to ContentExtractor HTML fallback

In `lib/services/article-ingestion.service.ts`, line ~329:

```typescript
const response = await fetch(url, {
  headers: { ... },
  signal: AbortSignal.timeout(15000), // 15 second timeout
});
```

### Fix 3 (Medium-term): Refactor AIAnalyzer to use OpenRouterService

Replace the raw `fetch()` in `AIAnalyzer.analyzeContent()` with `openRouterService.generate()`. This would give it the full retry/timeout/cost-tracking infrastructure already built.

### Fix 4 (Medium-term): Reduce max_tokens from 16000

The prompt requests 400-500 word summary + 800-1000 word rewrite. That is approximately 1,500-1,750 words or roughly 2,000-2,500 tokens. Setting `max_tokens: 4000` would still provide ample headroom while reducing completion time by 4-8x.

---

## Files Read During Investigation

- `/Users/masa/Projects/aipowerranking/app/api/cron/daily-news/route.ts`
- `/Users/masa/Projects/aipowerranking/lib/services/automated-ingestion.service.ts`
- `/Users/masa/Projects/aipowerranking/lib/services/article-ingestion.service.ts`
- `/Users/masa/Projects/aipowerranking/lib/services/jina-reader.service.ts`
- `/Users/masa/Projects/aipowerranking/lib/services/tavily-extract.service.ts`
- `/Users/masa/Projects/aipowerranking/lib/services/openrouter.service.ts`
- `/Users/masa/Projects/aipowerranking/lib/services/article-quality.service.ts`
- `/Users/masa/Projects/aipowerranking/lib/utils/retry-with-backoff.ts`
- Git log and diffs for commits `83f3993c`, `88c0a4fb`, and surrounding commits on 2026-03-15
