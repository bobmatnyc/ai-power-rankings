# Article Ingestion Backfill Analysis: Feb 13-21, 2026

**Date**: 2026-02-21
**Objective**: Understand how to manually trigger article ingestion for specific dates and execute a backfill.

---

## 1. Key Finding: No Date Parameter Support

The ingestion system does NOT support targeting a specific date. `runDailyDiscovery()` always searches for "current" news using Tavily's real-time search API. There is no `targetDate`, `startDate`, or `endDate` parameter anywhere in:

- `scripts/trigger-ingestion.ts`
- `AutomatedIngestionService.runDailyDiscovery()`
- `DailyDiscoveryOptions` interface
- `/api/admin/automated-ingestion` POST endpoint
- `/api/cron/daily-news` GET endpoint

**Implication**: Running the ingestion today will find articles published around today's date. Tavily returns articles with their `published_date` timestamps, but the search queries are not date-filtered.

---

## 2. Existing Coverage (What's Already in DB)

From querying the production database (`ep-dark-firefly-adp1p3v8`):

### Ingestion Runs by Date

| Date | Run Status | Articles Ingested | Notes |
|------|-----------|-------------------|-------|
| Feb 21 | N/A | N/A | Not yet run |
| Feb 20 | N/A | N/A | Not yet run |
| Feb 19 | N/A | N/A | Not yet run |
| Feb 18 | N/A | N/A | Not yet run |
| Feb 17 | N/A | N/A | Not yet run |
| Feb 16 | 2x running, 1x failed (401 Tavily) | 0 | Tavily key invalid during runs |
| Feb 15 | N/A | N/A | Not yet run |
| Feb 14 | completed | **6** | Last successful run (Feb 14 at 21:42 EST) |
| Feb 13 | N/A | N/A | Not yet run |
| Feb 12 | failed | 0 | Brave/Tavily config issues |

### Articles Currently in DB (Most Recent)

Most recent article ingestion was **Feb 14, 2026 at ~21:50 EST** (6 articles ingested in that run). Articles published through ~Feb 12, 2026 are covered.

**Gap**: Feb 15-21, 2026 has NO articles ingested.

---

## 3. Why the Cron Job Missed Feb 13-21

From the ingestion run history:
- **Feb 12**: Failed - no search API configured (Brave/Tavily not set)
- **Feb 14**: Completed successfully with 6 articles (manual trigger or cron catch-up)
- **Feb 15-17**: No runs recorded
- **Feb 16**: 3 runs all failed (401 Tavily auth error - invalid/expired key)
- **Feb 17-21**: No runs recorded

The cron runs daily at 6 AM UTC but Tavily keys were misconfigured/expired during this period.

---

## 4. How to Trigger Ingestion

### Method 1: Local Script (Recommended for Backfill)

```bash
DATABASE_URL="postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-dark-firefly-adp1p3v8-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require" \
TAVILY_API_KEY="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" \
npx tsx scripts/trigger-ingestion.ts [--dry-run] [--max-articles=N]
```

**Parameters:**
- `--dry-run`: Simulate without writing to DB (use for testing)
- `--max-articles=N`: Limit articles per run (default: 10, cron uses ~20)

### Method 2: Admin API (Requires Auth Session)

```bash
POST /api/admin/automated-ingestion
Content-Type: application/json
{
  "dryRun": false,
  "maxArticles": 15,
  "skipQualityCheck": false
}
```
Requires admin authentication cookie/session.

### Method 3: Cron Endpoint (Requires CRON_SECRET)

```bash
curl -H "Authorization: Bearer cron-secret-aipowerranking-2026" \
  https://aipowerranking.com/api/cron/daily-news
```
Note: Does not accept a date parameter, always uses current date search.

---

## 5. Backfill Strategy for Feb 13-21

### The Core Problem

Running ingestion today (Feb 21) will find articles from ~today's news cycle. Tavily's search returns "recent news" but does NOT have reliable date-range filtering in the current implementation. The queries like `"AI coding assistant funding startup investment 2026"` will return whatever Tavily considers most relevant and recent.

### What Will Actually Happen

When you run `trigger-ingestion.ts` today:
1. Tavily returns ~35 articles from the **past few days** (roughly Feb 17-21 range based on test run)
2. Duplicate detection filters articles already in DB
3. Quality check filters irrelevant articles
4. ~3-8 articles get ingested

The semantic duplicate detection uses `getRecentArticleTitles(7)` - last 7 days - to avoid redundant stories.

### Recommended Backfill Approach

Since the system cannot target specific past dates, the best approach is to run ingestion multiple times in quick succession to maximize coverage of the gap period:

**Run 5-7 times, spaced 30 minutes apart** (allows Tavily to return somewhat different results):

```bash
# Run 1 - now (will get Feb 18-21 news)
DATABASE_URL="postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-dark-firefly-adp1p3v8-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require" \
TAVILY_API_KEY="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" \
npx tsx scripts/trigger-ingestion.ts --max-articles=15

# Wait 30-60 minutes, then run again
# Run 2-7: same command
```

**However, for truly covering Feb 13-21**, the Tavily API has a `days_back` parameter that is NOT currently used in the code. To properly backfill older dates, you would need to modify `TavilySearchService.executeSearch()` to pass `days=N` in the API request body.

### Quick Backfill You Can Run Right Now

This will get you coverage for roughly the past 5-7 days:

```bash
# Dry run first to verify it works
DATABASE_URL="postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-dark-firefly-adp1p3v8-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require" \
TAVILY_API_KEY="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" \
npx tsx scripts/trigger-ingestion.ts --dry-run --max-articles=15

# Live run (remove --dry-run)
DATABASE_URL="postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-dark-firefly-adp1p3v8-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require" \
TAVILY_API_KEY="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" \
npx tsx scripts/trigger-ingestion.ts --max-articles=15
```

---

## 6. Verifying What's in the Database by Date

To check articles per ingestion date:

```bash
DATABASE_URL="postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-dark-firefly-adp1p3v8-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require" \
npx tsx scripts/check-recent-articles.ts
```

To check ingestion runs:

```bash
DATABASE_URL="postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-dark-firefly-adp1p3v8-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require" \
npx tsx scripts/check-ingestion-runs.ts
```

---

## 7. Summary

| Question | Answer |
|----------|--------|
| Does trigger-ingestion.ts support a date param? | No |
| Does the cron endpoint accept a date param? | No |
| Does the admin API accept a date param? | No |
| Does Tavily API support date filtering? | Yes (days parameter), but not currently used in code |
| What dates are missing articles? | Feb 15-21, 2026 (Feb 13-14 may have partial coverage) |
| What's the best command for backfill? | `npx tsx scripts/trigger-ingestion.ts --max-articles=15` with production env vars |
| Will running today get Feb 13-14 articles? | Unlikely - Tavily returns recent news (~7 days), so Feb 13-14 are borderline |
| How to guarantee older date coverage? | Modify TavilySearchService to pass `days=N` parameter |

---

## 8. Appendix: Environment Variables for Production DB

Use these for running scripts locally against the production database:

```
DATABASE_URL=postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-dark-firefly-adp1p3v8-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
TAVILY_API_KEY=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
```

Note: The `.env.local` points to a development/staging database endpoint (`ep-bold-sunset-adneqlo6`). The production database is `ep-dark-firefly-adp1p3v8` from `.env.production.local`.
