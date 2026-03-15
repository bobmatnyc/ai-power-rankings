# Article Scraping System Analysis

**Date**: 2026-03-03
**Objective**: Understand the last published article date, catch-up mechanism, search query construction, and recommended approach for backfilling missed days (Feb 25 - Mar 2).

---

## 1. Last Published Article Date

**Production database query results** (from `ep-dark-firefly-adp1p3v8`):

The most recent ingestion runs occurred on **Tue Mar 03, 2026 at 01:17-01:20 AM EST** (presumably triggered manually last night as a backfill test). These runs ingested articles published through **Mon Mar 02, 2026** (Cursor $2B article at 8:53 PM EST, Feb 27 Israeli startup article).

### Key Timeline from Production DB

| Date | Run Status | Articles Ingested | Notes |
|------|-----------|-------------------|-------|
| Mar 03, 01:17-01:20 AM EST | 5 runs, all `completed` | 3 each = ~15 total | Last night's runs — heavy duplicates due to running 5x in quick succession |
| Feb 25, 08:11-08:17 AM EST | 5 runs, all `completed` | 0-1 total | Ran during security fix deployment — 0 quality passes |
| Feb 14 - Feb 24 | Gap | 0 | Cron auth broken (see below) |

**Important observation**: The Mar 03 and Feb 25 runs show heavy duplicate ingestion — the same articles (ynetnews.com, cnbc.com, techcrunch.com) were ingested 4-5 times each because URL deduplication runs BEFORE writing, but multiple concurrent runs started before any completed.

### Last Genuinely New Article Coverage

Based on `published_date` fields in the database, the most recent article covers **Mar 02, 2026** (Cursor $2B story). However, there are significant gaps in the Feb 25 - Mar 02 window:
- Feb 25 runs found articles but **0 passed quality check** — likely the quality LLM was configured with stricter thresholds or the articles were borderline
- Feb 26-Mar 02: No cron runs (cron was failing due to auth issues)
- Mar 03 runs finally ingested content including Feb 27 and Mar 02 articles

---

## 2. Why Cron Was Failing (Feb 25 - Mar 2)

### Root Cause Chain

1. **Feb 24 commit** (`9c92a922`): Added "insecure" auth methods — user-agent and x-vercel-cron header checks. The Vercel cron could authenticate via these methods.
2. **Feb 25 commit** (`abaecf71`): Security fix REMOVED all auth methods except Bearer token. This broke the Vercel scheduler's ability to call the cron endpoint because Vercel's built-in scheduler sends the `Authorization: Bearer <CRON_SECRET>` header — BUT only if `CRON_SECRET` is configured in the Vercel environment.

If `CRON_SECRET` was not in Vercel's production environment variables, every scheduled cron call returned `401 Unauthorized` and no ingestion occurred.

**Result**: The daily cron at `0 6 * * *` (6 AM UTC) failed silently from Feb 25 through Mar 2.

---

## 3. Catch-Up / Backfill Mechanism

### Does the System Support Date-Range Ingestion?

**No built-in date-range backfill exists.**

The `DailyDiscoveryOptions` interface only has:
```typescript
interface DailyDiscoveryOptions {
  dryRun?: boolean;
  maxArticles?: number;
  qualityThreshold?: number;
  skipQualityCheck?: boolean;
  days?: number;  // Tavily "days lookback" — added Feb 21, 2026
}
```

The `days` parameter (added in commit `5e2d9177`) IS passed through to Tavily's API as `days_back`. This is the ONLY date-related parameter. It tells Tavily how many days to look back for articles.

### Cron Endpoint Date Params

`GET /api/cron/daily-news` — **No query parameters accepted**. Fixed implementation calls `service.runDailyDiscovery()` with no options.

### Admin API Date Params

`POST /api/admin/automated-ingestion` body accepts:
- `dryRun: boolean`
- `skipQualityCheck: boolean`
- `maxArticles: number`

**No `days` parameter exposed via the admin API** — this was not added to the API endpoint, only to the script.

### trigger-ingestion.ts Script Parameters

```bash
npx tsx scripts/trigger-ingestion.ts [--dry-run] [--max-articles=N] [--days=N]
```

The `--days=N` parameter IS supported and passes through to `TavilySearchService`. This is the best available mechanism for backfill.

---

## 4. Search Query Construction (Tavily)

### Primary Query (Always Runs)

```
AI coding assistant news OR AI code generation tools OR
GitHub Copilot OR Cursor AI OR Claude Code OR Windsurf OR
Devin AI OR Replit Agent OR Amazon Q Developer OR
AI developer tools announcement OR agentic coding 2026
```

### Supplementary Queries (2 of 7, Rotated by Day of Week)

```javascript
const allQueries = [
  'AI coding assistant funding startup investment 2026',
  'autonomous coding agent Devin Replit release update',
  '"GitHub Copilot" OR "Cursor" announcement 2026',
  'AI code review tool launch enterprise',
  'SWE-bench coding agent benchmark results',
  'AI pair programming tool VS Code JetBrains',
  'Claude Anthropic developer tools API update',
];
// Selects 2 based on: dayOfWeek % 7
```

### Date Filtering

The `days` parameter is passed to Tavily API as `days` in the request body:
```typescript
if (days !== undefined) {
  requestBody.days = days;
}
```

Tavily's `days` parameter means "only return articles from the last N days". When omitted, Tavily defaults to approximately 7 days of recency.

**Important**: This is a recency filter, NOT an exact date. You cannot specify "give me Feb 25-28 only" — you can only say "give me the last N days from today."

### Tavily API Behavior with `days`

- `days=7` (default when omitted): Returns articles from roughly the past week
- `days=14`: Returns articles from the past 2 weeks — useful for backfilling Feb 17+ content
- `days=30`: Could backfill a full month, but returns lower-relevance older articles

---

## 5. Recommended Approach to Catch Up on Feb 25 - Mar 2

### Current State Assessment

The Mar 03 runs already picked up the most prominent Feb 27-Mar 02 stories. However:
- Heavy duplicates were ingested (same URL 4-5x) due to concurrent runs without delays
- Feb 25-26 articles may be missing if they were too old for the default 7-day Tavily window when the Mar 03 runs ran
- Feb 25 runs found articles but all failed quality check (0 ingested)

### Step 1: Verify What's Actually Missing

```bash
DATABASE_URL="postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-dark-firefly-adp1p3v8-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require" \
npx tsx scripts/check-recent-articles.ts
```

Look at the `publishedDate` spread. If you see articles from Feb 27+ but nothing from Feb 25-26, those days may need a targeted backfill.

### Step 2: Run Backfill with `--days=14`

To maximize coverage of the missed Feb 25 - Mar 2 window:

```bash
DATABASE_URL="postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-dark-firefly-adp1p3v8-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require" \
TAVILY_API_KEY="<your-tavily-key>" \
OPENROUTER_API_KEY="<your-openrouter-key>" \
npx tsx scripts/trigger-ingestion.ts --max-articles=20 --days=14
```

The `--days=14` tells Tavily to search within the past 14 days (back to ~Feb 17 from today), which covers the entire missed window.

### Step 3: Run Once Per Day Going Forward (Cron Fix)

Verify the CRON_SECRET is configured in Vercel's production environment:
- Go to Vercel Dashboard → Project → Settings → Environment Variables
- Confirm `CRON_SECRET` is set for Production environment
- The cron at `0 6 * * *` (6 AM UTC = 1 AM EST) should resume automatically

### Step 4: Clean Up Duplicate Articles

The Mar 03 backfill runs created 4-5 duplicate entries for the same URLs (same article ingested multiple times). This may affect the news page display. Consider:
1. Checking the news page — does it deduplicate on display, or does it show duplicates?
2. If duplicates appear, run a cleanup script to remove articles with the same `sourceUrl`

---

## 6. Key Findings Summary

| Question | Answer |
|----------|--------|
| Last successful ingestion | Mar 03, 2026 at 1:17-1:20 AM EST |
| Last article published date | Mar 02, 2026 (Cursor $2B article) |
| Date range with no articles | Feb 25-26 likely missing; Feb 27-Mar 02 ingested on Mar 03 |
| Root cause of cron failure | Security fix on Feb 25 requires CRON_SECRET env var for Vercel scheduler auth |
| Does cron accept date params? | No |
| Does admin API accept date params? | No (`days` param not exposed) |
| Does trigger-ingestion.ts accept date params? | Yes: `--days=N` |
| Does Tavily support date filtering? | Yes: `days` param (recency filter, not exact dates) |
| Best backfill command | `npx tsx scripts/trigger-ingestion.ts --max-articles=20 --days=14` |
| Duplicate article problem | Yes — 5 concurrent runs created 4-5x duplicates for same URLs |

---

## 7. Key Files Reference

| File | Purpose |
|------|---------|
| `app/api/cron/daily-news/route.ts` | Cron endpoint (runs at 6 AM UTC daily) |
| `lib/services/automated-ingestion.service.ts` | Orchestrator class |
| `lib/services/tavily-search.service.ts` | Search with `days` param support |
| `scripts/trigger-ingestion.ts` | Manual backfill script with `--days=N` |
| `app/api/admin/automated-ingestion/route.ts` | Admin API (no date params) |
| `vercel.json` | Cron schedule: `"0 6 * * *"` |
