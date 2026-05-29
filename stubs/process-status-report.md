# AI Power Ranking — Process Status Report

**Date:** 2026-05-09
**Author:** Automated Investigation
**Scope:** Daily Article Ingestion Pipeline & Monthly State of Agentic AI Report Builder

---

## Executive Summary

Two automated processes power the AI Power Ranking content pipeline. The **daily article ingestion** is currently operational after recovering from a 14-day outage in March–April 2026. The **monthly State of AI report builder** has a **missing March 2026 report** that will never auto-backfill due to the unique constraint + `forceRegenerate=false` default. Both processes share a structural weakness: zero failure alerting — outages are only discovered through manual inspection.

---

## 1. Daily Article Ingestion Pipeline

### Architecture

| Component | Detail |
|---|---|
| **Cron schedule** | `0 6 * * *` (6:00 AM UTC daily) |
| **Route** | `GET /api/cron/daily-news` → `AutomatedIngestionService.runDailyDiscovery()` |
| **Admin trigger** | `POST /api/admin/automated-ingestion` |
| **maxDuration** | 800 seconds (Pro plan limit) |
| **Auth** | Bearer token via `CRON_SECRET` env var |
| **Search provider** | Tavily API (primary), Brave Search (fallback) |

### Current Status: ✅ OPERATIONAL

The pipeline has been running successfully since April 10, 2026. Project memory confirms articles were successfully ingested on April 23, 2026 with a ~37% quality pass rate (6 articles/day discovered, ~2 passing quality filter).

### Failure Timeline

| Period | Duration | Root Cause | Resolution |
|---|---|---|---|
| **Feb 25 – Mar 2** | ~5 days | Security hardening removed insecure auth methods (x-vercel-cron header, user-agent check, VERCEL env check). `CRON_SECRET` was not set in Vercel production. | Set `CRON_SECRET` in Vercel dashboard. Backfilled via `npx tsx scripts/trigger-ingestion.ts --max-articles=20 --days=14`. |
| **Mar 19 – Mar 27** | ~9 days | Likely `CRON_SECRET` or Tavily quota issue. HTTP endpoint hung on authenticated requests while manual script worked. | AbortSignal timeouts added (15s HTML fetch, 120s LLM call). Manual intervention restored service. |
| **Mar 28 – Apr 10** | **14 days** | `CRON_SECRET` mismatch between local `.env` and Vercel production environment variables. Environment variables not accessible in production serverless functions. | Updated production `CRON_SECRET` to match expected value. Forced redeployment. Documented in `docs/research/auto-scraping-failure-investigation-2026-04-10.md`. |

### Root Cause Pattern

All three outages share the same root cause category: **environment variable misconfiguration in Vercel production**. The `CRON_SECRET` Bearer token auth is the sole authentication mechanism. When the env var is missing or mismatched, every cron invocation returns 401 silently — Vercel does not alert on cron auth failures.

### Error Handling Assessment

The route code itself has reasonable error handling:
- Structured logging with `runId`, article counts, duration
- Try/catch with 500 responses including error details
- Graceful degradation (cache invalidation failures don't fail the job)

**Gap:** No external alerting. The system logs errors but nobody sees them unless they check Vercel logs manually.

---

## 2. Monthly State of Agentic AI Report Builder

### Architecture

| Component | Detail |
|---|---|
| **Cron schedule** | `0 8 1 * *` (8:00 AM UTC, 1st of each month) |
| **Route** | `GET /api/cron/monthly-summary` → `StateOfAiSummaryService.generateStateOfAi()` |
| **Admin trigger** | `POST /api/admin/state-of-ai/generate` (requires admin auth) |
| **maxDuration** | ⚠️ **60 seconds** |
| **Auth** | Bearer token via `CRON_SECRET` (cron), admin session (admin API) |
| **Idempotency** | Unique `(month, year)` constraint; `forceRegenerate=false` by default |

### Current Status: ⚠️ PARTIALLY BROKEN — Missing March 2026 Report

| Month | Generated? | Notes |
|---|---|---|
| **February 2026** | ✅ Yes | Generated March 1 via cron. Last known successful report. |
| **March 2026** | ❌ **Missing** | April 1 cron returned 401 (CRON_SECRET broken at the time). Will never auto-backfill. |
| **April 2026** | ⚠️ Likely partial | May 1 cron should have succeeded (CRON_SECRET fixed April 10), but report covers only April 11–30 articles (~20 days of data from a 30-day month). |

### Why March 2026 Won't Auto-Backfill

The cron route (line 97) passes `forceRegenerate: false`:

```typescript
const result = await service.generateStateOfAi(
  targetMonth, targetYear,
  "cron-monthly-summary",
  false  // Don't force regenerate if already exists
);
```

But the issue isn't idempotency — it's that the cron only targets the **previous month**. The May 1 cron generated April 2026. The June 1 cron will generate May 2026. March 2026 is permanently skipped. Only a manual admin API call can fill the gap.

### Timeout Risk: `maxDuration = 60`

The monthly route has `maxDuration = 60` (seconds). The research notes state that LLM-based editorial generation sits "at the documented generation time ceiling." Under OpenRouter load spikes, this route will silently timeout with a Vercel 504, and no report will be written. The daily pipeline's `maxDuration = 800` shows that higher values are acceptable on this plan.

### Error Handling Assessment

- Auth and validation logic are sound
- Structured logging with duration and content metrics
- Try/catch returns 500 with details

**Gaps:**
1. No timeout protection within the function (no AbortSignal on LLM calls, unlike the daily pipeline which added them)
2. No retry or dead-letter mechanism for failed months
3. No alerting on failure

---

## 3. Shared Systemic Issues

### 3.1 Zero Observability

Neither process has any failure alerting. Outages are discovered days or weeks later through manual investigation. The February and March–April outages each ran for 5–14 days before anyone noticed.

### 3.2 Single Point of Failure: CRON_SECRET

Both processes depend on the same `CRON_SECRET` env var. If it becomes misconfigured again, both pipelines break simultaneously and silently.

### 3.3 No Backfill Mechanism

The monthly report builder has no concept of "catch-up" — it only generates the previous month. The daily pipeline at least supports a `--days` parameter for backfill via the manual trigger script.

---

## 4. Recommended Actions

### Immediate (resolve existing data gaps)

| # | Action | Command / Detail | Priority |
|---|---|---|---|
| 1 | **Verify which monthly reports exist** | Run `npx tsx scripts/check-summaries.ts` to query `state_of_ai_summaries` table | 🔴 High |
| 2 | **Backfill March 2026 report** | `POST /api/admin/state-of-ai/generate` with body `{"month": 3, "year": 2026, "forceRegenerate": true}` | 🔴 High |
| 3 | **Check April 2026 report quality** | If April report exists but covers only 20 days of data, consider regenerating with `forceRegenerate: true` after confirming article coverage | 🟡 Medium |

### Short-term (prevent recurrence)

| # | Action | Detail | Priority |
|---|---|---|---|
| 4 | **Bump monthly maxDuration** | Change `maxDuration` in `app/api/cron/monthly-summary/route.ts` from `60` to `300` | 🔴 High |
| 5 | **Add AbortSignal to monthly LLM calls** | Mirror the daily pipeline's timeout pattern (15s fetch, 120s LLM) | 🟡 Medium |
| 6 | **Add failure alerting** | Integrate a simple webhook (Slack, email, or PagerDuty) on 401/500 responses from both cron routes | 🔴 High |

### Medium-term (structural improvements)

| # | Action | Detail | Priority |
|---|---|---|---|
| 7 | **Add cron health dashboard** | Log last-success timestamp to a `cron_health` table; surface in admin UI | 🟡 Medium |
| 8 | **Add monthly backfill logic** | On cron trigger, check for any missing months in the last 3 months and generate them | 🟡 Medium |
| 9 | **CRON_SECRET rotation procedure** | Document the exact steps to rotate the secret across Vercel + local dev, with a verification checklist | 🟢 Low |

---

## 5. Verification Script

To confirm current state, run:

```bash
# 1. Check which monthly summaries exist in the database
npx tsx scripts/check-summaries.ts

# 2. Check recent Vercel cron logs (requires Vercel CLI)
vercel logs --filter="/api/cron" --since=2026-04-01

# 3. Verify CRON_SECRET is set in production
vercel env ls | grep CRON_SECRET
```

---

## Appendix: Related Investigation Documents

| Document | Date | Topic |
|---|---|---|
| `docs/research/article-scraping-system-analysis-2026-03-03.md` | Mar 3 | First auth failure analysis |
| `docs/research/article-ingestion-stall-investigation-2026-03-19.md` | Mar 19 | Second stall investigation |
| `docs/research/cron-status-verification-2026-03-28.md` | Mar 28 | Timeout fix verification |
| `docs/research/auto-scraping-failure-investigation-2026-04-10.md` | Apr 10 | CRON_SECRET mismatch root cause |
