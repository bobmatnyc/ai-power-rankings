# State of AI Summary Data Source Investigation

**Date:** 2026-02-04
**Investigator:** Research Agent
**Status:** Root Cause Identified

## Executive Summary

The January 2026 State of AI summary contains hallucinated content because **no articles exist in the database from January 2026**. The `getMonthlyData()` method correctly queries for articles from the last 30 days, but since zero articles are returned, the LLM generates content without any real data to reference.

## Investigation Findings

### 1. How `getMonthlyData()` Works

The `WhatsNewAggregationService.getMonthlyData()` method in `/lib/services/whats-new-aggregation.service.ts`:

```typescript
// Lines 71-76: Date range calculation
private getDateRange(): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);  // LAST 30 DAYS FROM NOW
  return { startDate, endDate };
}
```

**Key Finding:** The method uses a **rolling 30-day window from the current date**, not a specific calendar month. This is consistent regardless of what month/year is passed to `generateStateOfAi()`.

### 2. State of AI Generation Flow

In `/lib/services/state-of-ai-summary.service.ts`:

```typescript
// Line 187: Calls aggregation service
const aggregatedData = await this.aggregationService.getMonthlyData();
```

**Issue:** Even though `generateStateOfAi(month, year)` accepts month/year parameters, the `getMonthlyData()` call does not pass these parameters to filter by that specific month. The data always comes from the last 30 days.

### 3. Database Article Inventory

Query results from the `news` table:

| Month | Article Count |
|-------|--------------|
| 2025-11 | 1 |
| 2025-10 | 1 |
| 2025-08 | 28 |
| 2025-07 | 57 |
| 2025-06 | 228 |
| **2026-01** | **0** |
| **2026-02** | **0** |

**Critical Finding:** There are **zero articles** in the database with `published_at` dates in January or February 2026.

### 4. What the LLM Receives

When generating the January 2026 summary:
- The prompt tells the LLM to write about "January 2026"
- `aggregatedData.metadata.totalArticles` = 0
- `aggregatedData.newsArticles` = []
- The LLM has no actual news data to reference

This causes the LLM to hallucinate tool names like "GPT-5.1 High", "GPT-5.2 High", and "Claude Agent" - none of which are real announcements.

## Root Cause Analysis

There are **two contributing factors**:

### Factor 1: No Recent Articles Ingested
The automated ingestion system has not populated the database with articles from December 2025 through February 2026. The most recent article in the database is from November 2025.

### Factor 2: Rolling Window vs. Calendar Month
The `getMonthlyData()` method uses a rolling 30-day window rather than filtering by the specific month being summarized. Even if January 2026 articles existed, the method would only find them if they were within the last 30 days of the current date.

## Recommendations

### Immediate Fix: Ingest Tavily Articles
The recently implemented Tavily search feature can fetch current AI news. Run the automated ingestion to populate the database with January/February 2026 articles before regenerating the summary.

### Short-Term Fix: Month-Specific Filtering
Modify `getMonthlyData()` to accept and use month/year parameters:

```typescript
async getMonthlyData(month?: number, year?: number): Promise<MonthlyDataSources> {
  let startDate: Date;
  let endDate: Date;

  if (month && year) {
    // Filter by specific calendar month
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 1);
  } else {
    // Default to rolling 30-day window
    const range = this.getDateRange();
    startDate = range.startDate;
    endDate = range.endDate;
  }
  // ... rest of implementation
}
```

Update `StateOfAiSummaryService.generateStateOfAi()`:

```typescript
// Line 187: Pass month/year to aggregation
const aggregatedData = await this.aggregationService.getMonthlyData(targetMonth, targetYear);
```

### Long-Term Fix: Empty Data Guard
Add validation before LLM generation:

```typescript
if (aggregatedData.metadata.totalArticles === 0) {
  throw new Error(`Cannot generate State of AI for ${monthName} ${targetYear}: No articles found in database for this period. Run article ingestion first.`);
}
```

## Files Involved

| File | Purpose |
|------|---------|
| `/lib/services/state-of-ai-summary.service.ts` | Orchestrates summary generation |
| `/lib/services/whats-new-aggregation.service.ts` | Fetches data from database |
| `/lib/services/automated-ingestion.service.ts` | Ingests articles from Tavily |
| `/lib/services/article-ingestion.service.ts` | Processes individual articles |

## Action Items

1. **Verify Tavily integration is working** - Check `/api/admin/tavily-search/` endpoint
2. **Run automated ingestion** - Populate database with recent AI news
3. **Regenerate January 2026 summary** - Use `forceRegenerate: true` after articles are ingested
4. **Implement month-specific filtering** - Modify `getMonthlyData()` to accept date parameters
5. **Add empty data validation** - Prevent hallucinated summaries when no articles exist

## Verification Steps

After fixes are implemented:

```sql
-- Verify January 2026 articles exist
SELECT COUNT(*) FROM news
WHERE published_at >= '2026-01-01'
  AND published_at < '2026-02-01';

-- Should return > 0 before regenerating summary
```

---

**Research completed:** 2026-02-04
**Next steps:** Ingest articles via Tavily, then regenerate summary
