# Auto-Publishing System Investigation Report

**Date:** 2026-05-28  
**Investigator:** Claude Research Agent  
**Scope:** Monthly Summary Auto-Publishing System Analysis  

---

## Executive Summary

The auto-publishing system for monthly summaries has two separate pipelines with different statuses:

1. **"What's New" Monthly Summaries** (monthly_summaries table): ✅ **OPERATIONAL** - Missing March & April 2026
2. **"State of AI" Editorial Summaries** (state_of_ai_summaries table): ⚠️ **NEEDS MAY 2026 GENERATION**

The core issue is that both systems have **gaps that won't auto-backfill** due to their design - they only generate for the previous month when triggered on the 1st.

---

## System Architecture Overview

### 1. What's New Monthly Summaries
- **Route:** `GET /api/cron/monthly-summary` (Note: this route name is misleading - it actually handles State of AI summaries)
- **Table:** `monthly_summaries` 
- **Schedule:** Unknown (no vercel.json entry found for this)
- **Last Generated:** 2026-05 (generated on 2026-05-08)

### 2. State of AI Editorial Summaries  
- **Route:** `GET /api/cron/monthly-summary`
- **Table:** `state_of_ai_summaries`
- **Schedule:** `0 8 1 * *` (8:00 AM UTC, 1st of each month)
- **Last Generated:** April 2026 (generated on 2026-03-28 via cli-script)

## Current Status Analysis

### Monthly Summaries Status
```
✅ 2026-05: Generated (2026-05-08)
❌ 2026-04: MISSING
❌ 2026-03: MISSING  
✅ 2026-02: Generated (2026-02-26)
✅ 2026-01: Generated (2026-01-21)
```

### State of AI Summaries Status  
```
❌ 2026-05: MISSING (CURRENT NEED)
✅ 2026-04: Generated (2026-03-28 via cli-script)
✅ 2026-03: Generated (2026-03-28 via cli-script) 
✅ 2026-02: Generated (2026-02-04)
✅ 2026-01: Generated (2026-02-04)
```

## Root Cause Analysis

### 1. CRON_SECRET Authentication Issues
From the TODO comment in the cron route and process status report:

> "The April 1 cron returned 401 (CRON_SECRET broken at the time), so March 2026 was never generated"

**Timeline of failures:**
- **Feb 25 - Mar 2**: ~5 days outage (CRON_SECRET not set)
- **Mar 19 - Mar 27**: ~9 days outage (Tavily quota/timeout issues)  
- **Mar 28 - Apr 10**: **14 days outage** (CRON_SECRET mismatch)

### 2. System Design Issues

#### No Auto-Backfill Logic
Both systems only target the **previous month** when triggered on the 1st:
```typescript
// From route.ts line 128-138
let targetMonth = now.getMonth(); // 0-indexed, so current month - 1
let targetYear = now.getFullYear();

// If we're on the 1st, generate for previous month
if (targetMonth === 0) {
  targetMonth = 12;
  targetYear -= 1;
}
```

This means:
- **May 1 cron** → generates April 2026
- **June 1 cron** → generates May 2026  
- **March & April 2026 are permanently skipped** for monthly summaries

#### Timeout Risk  
The route had `maxDuration = 60` seconds which was too short for LLM generation. This was **recently fixed** in commit `71c4d1a9`:
```
fix(cron): bump monthly maxDuration to 300s, add failure alerting to both cron routes
```

### 3. Monitoring Gaps
From the process report:
> "Zero observability - Neither process has any failure alerting. Outages are discovered days or weeks later through manual investigation."

However, the recent commit added failure alerting via `ALERT_WEBHOOK_URL`.

## What Needs to be Done

### Immediate Actions Required

#### 1. Generate Missing May 2026 State of AI Summary
**Status:** ⚠️ **URGENT** - Current month summary missing

**Command to fix:**
```bash
curl -X POST https://aipowerranking.com/api/admin/state-of-ai/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ADMIN_SESSION_TOKEN>" \
  -d '{"month": 5, "year": 2026, "forceRegenerate": false}'
```

#### 2. Generate Missing Monthly Summaries (What's New)
**Status:** ⚠️ **HIGH** - Missing 2 months (March & April 2026)

**Note:** There's no obvious API route for generating monthly summaries (not State of AI). Need to investigate further.

### Current System Health

#### ✅ What's Working
1. **Authentication fixed**: CRON_SECRET mismatch resolved as of 2026-04-10
2. **Timeout fixed**: maxDuration increased from 60s → 300s  
3. **Alerting added**: Failure alerting via ALERT_WEBHOOK_URL webhook
4. **State of AI generation**: Working (March & April generated manually on 2026-03-28)

#### ❌ What's Broken/Missing
1. **May 2026 State of AI**: Not generated (current month)
2. **Monthly summaries backlog**: Missing March & April 2026
3. **No backfill mechanism**: System won't automatically catch up
4. **No health monitoring**: No dashboard to see system status

## Technical Deep Dive

### Cron Configuration
From `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-news",
      "schedule": "0 6 * * *"  // 6 AM daily
    },
    {
      "path": "/api/cron/monthly-summary", 
      "schedule": "0 8 1 * *"  // 8 AM on 1st of month
    }
  ]
}
```

### State of AI Generation Service
- **LLM Model:** anthropic/claude-sonnet-4
- **Temperature:** 0.4 (for editorial creativity)
- **Max tokens:** 2000  
- **Target length:** 400-600 words
- **Data sources:** WhatsNewAggregationService (articles, tools, rankings)

### Publishing Workflow
1. **Data Aggregation**: Collect articles, new tools, ranking changes from past month
2. **LLM Generation**: Use Claude Sonnet 4 to generate editorial summary  
3. **Database Storage**: Save to `state_of_ai_summaries` table
4. **Idempotency**: Unique constraint on (month, year) prevents duplicates

## Recommendations

### Short-term Fixes
1. **Generate May 2026 State of AI** via admin API (URGENT)
2. **Investigate monthly summaries system** - find generation method for March/April backfill
3. **Verify CRON_SECRET** is properly set in Vercel environment
4. **Set up ALERT_WEBHOOK_URL** if not already configured

### Medium-term Improvements  
1. **Add backfill logic** to cron routes (check for missing previous months)
2. **Create admin dashboard** showing system health and last-generated dates
3. **Add retry mechanism** for failed generations
4. **Document manual generation procedures** for future outages

### Long-term Architecture
1. **Separate cron routes** for each summary type to avoid confusion
2. **Event-driven architecture** with dead letter queues for reliability  
3. **Comprehensive monitoring** with health checks and SLA tracking
4. **Automated testing** for cron route functionality

## Files Analyzed

### Core System Files
- `/app/api/cron/monthly-summary/route.ts` - Main cron endpoint
- `/lib/services/state-of-ai-summary.service.ts` - LLM generation logic
- `/vercel.json` - Cron scheduling configuration
- `/lib/db/schema.ts` - Database table definitions

### Investigation Scripts  
- `/scripts/check-summaries.ts` - Database verification (just ran)
- `/scripts/verify-monthly-summaries.ts` - Table verification script

### Documentation
- `/docs/research/process-status-report-2026-05-09.md` - Previous analysis from May 9

## Conclusion

The auto-publishing system is **partially functional** but has systematic gaps that require manual intervention. The core architecture is sound, recent fixes have addressed the major authentication and timeout issues, but **May 2026 State of AI summary still needs generation** and there are missing monthly summaries that won't auto-backfill.

**Immediate action required:** Generate May 2026 State of AI summary before month ends.

---

**Investigation completed:** 2026-05-28 22:03 UTC  
**Next review:** After May 2026 generation is complete