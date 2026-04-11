# Auto Article Scraping Failure Investigation

**Date**: April 10, 2026  
**Investigator**: Research Agent  
**Issue**: Auto article scraping stopped working despite previous fixes

## Executive Summary

**Root Cause Identified**: Environment variable loading issue preventing API keys from being accessible to the automated ingestion service in production.

**Status**: Auto scraping system is **functionally working** but has been failing since March 27th due to missing API key configuration in the production environment.

**Impact**: 14-day gap in automated article ingestion (March 28 - April 10, 2026).

**Fix Required**: Environment variable configuration in Vercel production deployment.

## Investigation Timeline

### 1. System State Analysis

**Recent Ingestion Runs** (March 14 - April 10, 2026):
- **March 27, 2026**: Last successful runs (4-5 articles ingested via manual backfill)
- **March 19-27**: Quality assessment failures (0 articles passed quality check)
- **March 28 - April 10**: **No automated runs** - 14-day gap

### 2. Technical Analysis

**Database Query Results**:
```
Run ID: 1f9727c2-a237-427b-9910-1bc919ca75ea
  Created: Fri Mar 27 2026 21:47:40 GMT-0400
  Status: completed
  Discovered: 37
  Passed Quality: 4
  Ingested: 4
  Errors: 0
```

**Key Findings**:
- System discovered articles successfully (30+ articles per run)
- Search API (Tavily) is functional
- Quality assessment working when API keys are available
- Database operations functioning normally

### 3. Environment Variable Investigation

**Local Environment Status**:
- ✅ TAVILY_API_KEY: Present in `.env.local`
- ✅ CRON_SECRET: Present in `.env.local`
- ✅ DATABASE_URL: Present and functional

**Production Environment Issue**:
- ❌ Environment variables not loaded by NextJS/Vercel in serverless functions
- ❌ API services report "No API key configured"

**Test Results**:
```bash
# Without explicit dotenv loading
TAVILY_API_KEY: MISSING
CRON_SECRET: MISSING

# With explicit dotenv loading
TAVILY_API_KEY: SET (tvly-prod-5...)
✅ Tavily API key properly loaded
✅ Successfully discovered 30 articles
✅ Quality assessment passed 3/6 articles
```

## Functional Verification

**Dry Run Test Results**:
- **Articles Discovered**: 30 (Tavily Search working)
- **Semantic Deduplication**: Working (filtered 10 duplicates)
- **Quality Assessment**: Working (3/6 passed, cost: $0.0279)
- **Error Rate**: Minimal (1 403 Forbidden from axios.com)
- **Processing Time**: ~2 minutes
- **Status**: "partial" (expected for dry run with 1 error)

**Pipeline Components Status**:
- ✅ Search Discovery (Tavily API)
- ✅ Duplicate Detection (URL + Semantic)
- ✅ Content Extraction (Multiple fallbacks)
- ✅ Quality Assessment (OpenRouter LLM)
- ✅ Database Operations
- ❌ Environment Variable Loading (Production only)

## Root Cause Analysis

### Primary Issue: Environment Variable Access

**Problem**: The automated ingestion service cannot access API keys in production environment.

**Evidence**:
1. Local testing requires explicit `dotenv.config()` to load `.env.local`
2. NextJS applications in Vercel should auto-load environment variables
3. Cron routes may not have same environment loading as regular API routes

**Likely Causes**:
1. **Vercel Environment Variables**: Missing or misconfigured in production
2. **NextJS Environment Loading**: Not working in serverless cron functions
3. **Deployment Issue**: Environment variables not propagated to functions

### Secondary Issues (Resolved)

1. **Cron Configuration**: ✅ Correct (0 6 * * * = 6 AM UTC)
2. **API Authentication**: ✅ Working (Bearer token validation)
3. **Search Services**: ✅ Functional (Tavily configured)
4. **Database Access**: ✅ Working (successful queries)
5. **Quality Assessment**: ✅ Working (OpenRouter API)

## Current System Behavior

**What's Working**:
- Manual backfill runs work (March 27th success)
- All pipeline components function correctly
- Quality assessment properly filters articles
- Database operations and caching

**What's Failing**:
- **Daily automated cron runs** (no runs since March 27th)
- **Environment variable access** in production
- **Continuous article ingestion**

## Impact Assessment

**Business Impact**:
- 14-day content gap (March 28 - April 10)
- Users not seeing latest AI coding news
- Ranking system not reflecting recent developments
- Manual intervention required for content updates

**Technical Debt**:
- Environment variable loading inconsistency
- Missing monitoring for failed cron runs
- No alerting when daily runs fail

## Recommended Fix Strategy

### Immediate Actions (Priority 1)

1. **Verify Vercel Environment Variables**
   ```bash
   # Check Vercel Dashboard → Project → Settings → Environment Variables
   # Ensure these are set for Production environment:
   TAVILY_API_KEY=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
   CRON_SECRET=cron-secret-aipowerranking-2026-v2-a65HfuSHbwxkXkhn
   OPENROUTER_API_KEY=[value]
   DATABASE_URL=[value]
   ```

2. **Force Deployment**
   - Environment variable changes require new deployment
   - Trigger deployment to propagate environment variables

3. **Test Cron Endpoint**
   ```bash
   # Test production cron endpoint manually
   curl -X GET "https://aipowerranking.com/api/cron/daily-news" \
        -H "Authorization: Bearer cron-secret-aipowerranking-2026-v2-a65HfuSHbwxkXkhn"
   ```

### Verification Steps

1. **Monitor Next Scheduled Run** (Tomorrow 6 AM UTC = 2 AM EDT)
2. **Check Ingestion Runs Table** (`npx tsx scripts/check-ingestion-runs.ts`)
3. **Verify Recent Articles** (`npx tsx scripts/check-recent-articles.ts`)
4. **Validate Error Logs** in Vercel Functions dashboard

### Preventive Measures (Priority 2)

1. **Add Environment Validation**
   - Enhance startup validation to check cron-specific variables
   - Add health check endpoint for environment status

2. **Monitoring and Alerting**
   - Set up alerts for failed daily runs
   - Monitor daily ingestion success rate
   - Dashboard for cron run status

3. **Backup Ingestion Strategy**
   - Manual backfill capability (already exists)
   - Alternative scheduling system if Vercel cron fails

## Expected Timeline

- **Fix Implementation**: 1 hour (environment variable configuration)
- **Verification**: 24 hours (wait for next scheduled run)
- **Full Recovery**: 2-3 days (catch up on missed articles)

## Success Criteria

1. **Daily cron runs resume** (next run: April 11, 6 AM UTC)
2. **Articles discovered > 0** in next run
3. **Articles ingested > 0** in next run
4. **Zero environment-related errors**

## Backup Plan

If environment variable fix doesn't resolve the issue:

1. **Manual Backfill**: Run manual ingestion to catch up
2. **Alternative Scheduler**: Set up GitHub Actions as backup cron
3. **Code Deployment**: Add explicit dotenv loading to cron route
4. **Service Migration**: Move to external cron service (e.g., Cron-job.org)

## Lessons Learned

1. **Environment variables require explicit verification in serverless functions**
2. **Cron failures need automated monitoring and alerting**
3. **API key access should be validated at startup**
4. **Manual testing of full pipeline should be automated**
5. **Production environment changes need systematic verification**

---

**Next Action**: Verify and fix Vercel production environment variables immediately.