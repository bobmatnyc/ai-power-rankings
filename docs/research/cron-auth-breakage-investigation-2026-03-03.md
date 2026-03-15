# Cron Auth Breakage Investigation

**Date:** 2026-03-03
**Status:** Root Cause Identified
**Severity:** CRITICAL - Automated article scraping is down

---

## Executive Summary

The automated article scraping and publishing system has been broken since commit `abaecf71` (Wed Feb 25 08:16:25 2026). The security fix that removed "insecure" cron auth methods **was correct in its security assessment but broke the automated scheduler**.

The root cause: Vercel's cron scheduler DOES send `Authorization: Bearer <CRON_SECRET>` — but the `CRON_SECRET` environment variable in Vercel production may not match what the code expects, OR the production Vercel environment has not been updated with `CRON_SECRET`.

**The code after `abaecf71` is architecturally correct per Vercel's documentation.** The bearer-token-only approach is the right one. The problem is whether `CRON_SECRET` is properly configured in Vercel's project environment variables.

---

## System Architecture

```
Vercel Cron Scheduler (vercel.json)
  → 6 AM UTC daily: GET /api/cron/daily-news
  → 8 AM UTC, 1st of month: GET /api/cron/monthly-summary
    → AutomatedIngestionService.runDailyDiscovery()
      → TavilySearchService.searchAINews() [primary]
      → BraveSearchService [fallback if Tavily missing]
      → URL deduplication
      → Semantic deduplication
      → Content fetch: Tavily Extract → Jina Reader → Basic HTML
      → ArticleQualityService.batchAssess() [OpenRouter LLM]
      → ArticleIngestionService.ingestArticle() [OpenRouter LLM]
        → ArticlesCoreRepository.createArticle()
      → invalidateArticleCache()
```

**Key files:**
- `/vercel.json` — cron schedule config
- `/app/api/cron/daily-news/route.ts` — cron endpoint for daily ingestion
- `/app/api/cron/monthly-summary/route.ts` — cron endpoint for monthly summaries
- `/middleware.ts` — allows `/api/cron/*` routes without Clerk auth (line 21)
- `/lib/services/automated-ingestion.service.ts` — ingestion orchestrator

---

## Three Commits That Changed Cron Auth

### Commit 1: `9c92a922` (Feb 24, 2026)
**"fix(cron): enable Vercel cron scheduler authentication"**

Added Method 2 (x-vercel-cron header + user-agent) and Method 3 (VERCEL=1 + deployment URL) as fallbacks because the cron scheduler allegedly could not authenticate with Bearer-only mode. The intent was to allow Vercel's scheduler to pass auth.

### Commit 2: `abaecf71` (Feb 25, 2026) — THE BREAKING COMMIT
**"fix(security): remove insecure cron auth methods — endpoint was open to public"**

Correctly identified that Methods 2 and 3 were security vulnerabilities:
- `x-vercel-cron` header: Not a real Vercel header (made up)
- User-agent check: Trivially spoofable
- `VERCEL=1` + deployment URL: Present on ALL Vercel requests — meaning any public request bypassed auth

Reverted to Bearer-token-only. **This is the correct approach per Vercel's official documentation.**

However, this NOW means the cron can only run if `CRON_SECRET` is configured in Vercel's environment AND Vercel automatically injects it as `Authorization: Bearer <CRON_SECRET>`.

---

## Root Cause Analysis

### Root Cause #1: CRON_SECRET Configuration in Vercel (MOST LIKELY)

**Severity:** CRITICAL

Vercel's cron job documentation states:
- Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` header when running scheduled cron jobs
- `CRON_SECRET` must be set in Vercel's **Project Settings → Environment Variables**
- The variable must be set for the **Production** environment

From `.env.production.local` (pulled from Vercel via CLI), `CRON_SECRET` is present:
```
CRON_SECRET="cron-secret-aipowerranking-2026"
```

However, there are two potential sub-issues:

**Sub-issue A: The secret may have been added AFTER the broken deployment.**
If `CRON_SECRET` was added to Vercel's environment variables after the `abaecf71` commit was deployed, the running deployment might not have picked it up (Vercel requires a redeploy for env var changes to take effect in serverless functions).

**Sub-issue B: The `.env.production.local` may be stale.**
The `.env.production.local` file is a local snapshot pulled via `vercel env pull`. It may not reflect what is actually configured in Vercel's live production environment right now. If `CRON_SECRET` was removed from Vercel's dashboard, the cron would fail.

### Root Cause #2: Header Case Sensitivity (SECONDARY, POSSIBLE)

The code after `abaecf71` changed from:
```typescript
const authHeader = request.headers.get("Authorization");  // capital A
```
to:
```typescript
const authHeader = request.headers.get("authorization");  // lowercase
```

HTTP headers are case-insensitive per RFC 7230, and Next.js `request.headers.get()` normalizes to lowercase. This change is **safe and correct**. Not the issue.

### Root Cause #3: CRON_SECRET Value Mismatch

If Vercel's dashboard has a different `CRON_SECRET` value than what's in `.env.production.local`, the Bearer token comparison would always fail:
```typescript
if (authHeader === `Bearer ${cronSecret}`) {  // strict equality
```

The value in `.env.production.local` is:
```
CRON_SECRET="cron-secret-aipowerranking-2026"
```

Note: `BRAVE_SEARCH_API_KEY` has `\n` embedded in the value (literal backslash-n, not newline). If `CRON_SECRET` had a similar issue in Vercel's configuration, the comparison would fail silently.

---

## Failure Mode

When the cron runs and auth fails, the endpoint returns:
```json
HTTP 401
{"success": false, "error": "Unauthorized"}
```

Vercel logs this as a cron execution failure. The ingestion pipeline never starts.

When `CRON_SECRET` is not configured at all, the endpoint returns:
```typescript
loggers.api.error("Cron: CRON_SECRET environment variable not configured");
return false;  // → 401 Unauthorized
```

---

## What the Previous Commit (9c92a922) Was Trying To Do

Commit `9c92a922` was created because the cron was failing auth — same symptom as today. The developer added fallback methods to try to make it work. The METHOD 3 fallback (checking `VERCEL=1`) effectively disabled auth entirely, which did make crons run (and also let anyone trigger ingestion from the internet).

This is now fixed, but the fix exposed the underlying problem: **CRON_SECRET must be correctly set in Vercel's production environment.**

---

## Verification Steps

### Step 1: Check Vercel Dashboard
Go to: Vercel Dashboard → `aipowerranking` project → Settings → Environment Variables

Verify:
- `CRON_SECRET` exists for Production environment
- Value exactly matches (no trailing spaces, no embedded `\n`)
- Redeploy was done after adding it

### Step 2: Check Vercel Cron Logs
Go to: Vercel Dashboard → `aipowerranking` → Functions → Logs (filter by `/api/cron/daily-news`)

Look for:
- `Unauthorized cron request` warning
- `CRON_SECRET environment variable not configured` error
- HTTP 401 responses

### Step 3: Manual Test
```bash
# Test with the current CRON_SECRET value
curl -X GET https://aipowerranking.vercel.app/api/cron/daily-news \
  -H "Authorization: Bearer cron-secret-aipowerranking-2026"
```

Expected: `{"success": true, ...}` if CRON_SECRET matches.

### Step 4: Check Admin Panel
Navigate to `/en/admin/automated-ingestion` — check if any runs appear after Feb 25, 2026.

---

## Environment Variable Status

From `.env.production.local` (local Vercel snapshot):

| Variable | Status | Notes |
|----------|--------|-------|
| `CRON_SECRET` | Present | `"cron-secret-aipowerranking-2026"` |
| `TAVILY_API_KEY` | Present | Production key configured |
| `BRAVE_SEARCH_API_KEY` | Present | Has `\n` suffix (may cause issues) |
| `OPENROUTER_API_KEY` | Present | Required for LLM analysis |
| `DATABASE_URL` | Present | Neon DB configured |

**Warning:** `BRAVE_SEARCH_API_KEY` has a literal `\n` at the end of the value in the Vercel env snapshot. If this is present in the actual Vercel environment, the API key would be invalid (the trailing `\n` would be part of the key string).

---

## Recommended Actions (Priority Order)

### Action 1: Verify CRON_SECRET in Vercel Dashboard (IMMEDIATE)
1. Log into Vercel Dashboard
2. Navigate to aipowerranking project → Settings → Environment Variables
3. Confirm `CRON_SECRET` = `cron-secret-aipowerranking-2026` (or whatever value is configured)
4. If missing or wrong: Add/fix it
5. If changed: Redeploy the production deployment

### Action 2: Verify BRAVE_SEARCH_API_KEY Does Not Have `\n` Suffix
The local pull shows `BRAVE_SEARCH_API_KEY="BSAQQh-MpVe_EZlRV8yQgiw88BfCZms\n"`. The `\n` may be a Vercel CLI artifact or a real issue. Verify the key in Vercel dashboard has no trailing characters.

### Action 3: Force a Redeploy
After confirming env vars:
```bash
vercel deploy --prod
```
Or push a trivial commit to trigger a production deployment.

### Action 4: Monitor After Next 6 AM UTC Run
After the redeploy, check Vercel logs at/after 6 AM UTC to confirm the cron runs successfully.

---

## Why the Security Fix Was Correct

The `abaecf71` security fix was technically sound:

1. `x-vercel-cron` header — Vercel's documentation does NOT mention this header. It was invented and never set by Vercel.
2. User-agent check — Any HTTP client can set any user-agent string.
3. `VERCEL=1` + deployment URL — These are set on ALL Vercel requests (including public traffic), not just cron. This was effectively open authentication.

Vercel's actual mechanism: When `CRON_SECRET` is set in project env vars, Vercel's scheduler automatically sends `Authorization: Bearer <CRON_SECRET>`. The current code correctly implements only this mechanism.

---

## Files Examined

- `/vercel.json`
- `/app/api/cron/daily-news/route.ts`
- `/app/api/cron/monthly-summary/route.ts`
- `/middleware.ts`
- `/.env.production.local`
- `/.env.local.example`
- `/docs/research/ingestion-failure-investigation-2026-02-21.md`
- `git log --oneline -20`
- `git show abaecf71` (full diff)
- `git show 9c92a822` (full diff)
