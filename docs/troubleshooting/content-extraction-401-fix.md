# Content Extraction 401/403 Error Fix

**Issue**: News article ingestion was failing with 401 HTTP Forbidden errors from Reuters and other news sites when using Jina Reader service.

**Root Cause**: The Jina Reader service (`r.jina.ai`) was getting blocked by certain news sites, causing the entire article ingestion batch to fail.

## Solution Implemented

### 1. Jina Reader Retry Logic
Added intelligent retry mechanism with exponential backoff:
- **File**: `lib/services/jina-reader.service.ts`
- **Changes**:
  - Detects 401/403 errors specifically
  - Retries up to 2 times with 1s, 2s delays
  - Provides clear error messages for blocked sources

```typescript
// Handle 401/403 errors with retry logic
if (response.status === 401 || response.status === 403) {
  if (retryCount < 2) {
    const delay = Math.pow(2, retryCount) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    return this.fetchArticle(url, retryCount + 1);
  }
  throw new Error(`Jina.ai blocked by source (${response.status})`);
}
```

### 2. Integrated Jina Reader into Automated Ingestion
The Jina Reader service was NOT being used in the automated ingestion pipeline. Now integrated:

**File**: `lib/services/automated-ingestion.service.ts`
- Added import: `import { jinaReaderService } from "./jina-reader.service"`
- Updated `fetchArticleContent()` to try Jina Reader first with fallback to basic HTML fetch
- Proper error handling that doesn't fail entire batch

**File**: `lib/services/article-ingestion.service.ts`
- Updated `ContentExtractor.extractFromUrl()` to use Jina Reader first
- Maintains fallback to basic HTML parsing

### 3. Blocked Domains Configuration
Created domain blocking system to skip known problem sites:

**File**: `lib/services/blocked-domains.config.ts`
- Maintains list of domains that consistently block scrapers
- Initial list: `reuters.com`, `wsj.com`, `ft.com`, `bloomberg.com`
- Provides `isDomainBlocked()` utility
- Auto-blocks domains when 401/403 errors detected

### 4. Graceful Error Handling
Updated automated ingestion to handle failures gracefully:
- Check blocked domains before attempting fetch
- Track failed fetches separately (don't fail entire batch)
- Auto-add domains to blocked list on 401/403 errors
- Log failures for monitoring

```typescript
// Check if domain is known to block scrapers
if (isDomainBlocked(article.url)) {
  loggers.api.warn("[AutomatedIngestion] Skipping blocked domain:", {
    url: article.url.substring(0, 100),
  });
  failedFetches.push({ url: article.url, reason: "blocked_domain" });
  continue;
}
```

### 5. Partial Success Support
Articles that can't be fully extracted no longer block the entire ingestion:
- Failed articles are logged but don't stop processing
- Other articles in the batch continue to be ingested
- Statistics track failed fetches separately

## Testing

### Manual Test
Run the test script to verify the fix:

```bash
npx tsx scripts/test-content-extraction-fix.ts
```

This will:
1. Check Jina Reader availability
2. Display blocked domains
3. Test content extraction with retry logic
4. Show which domains get auto-blocked

### Production Verification
Monitor automated ingestion logs for:
- `[AutomatedIngestion] Jina Reader success` - successful extractions
- `[AutomatedIngestion] Jina Reader failed, using fallback` - fallback used
- `[AutomatedIngestion] Skipping blocked domain` - blocked domains detected
- `[AutomatedIngestion] Auto-blocked domain` - new domains blocked

## Configuration

### Required Environment Variables
- `JINA_API_KEY` - Jina Reader API key (required for content extraction)

### Optional Tuning
Adjust blocked domains list in `lib/services/blocked-domains.config.ts`:
```typescript
export const BLOCKED_DOMAINS = new Set([
  "reuters.com",
  "wsj.com",
  // Add more as needed
]);
```

## Behavior

### Before Fix
- Jina Reader fails with 401 → **entire batch fails**
- No retry logic
- No fallback content extraction
- Articles from blocked sources prevent other articles from ingesting

### After Fix
- Jina Reader fails with 401 → **retries 2 times**
- If retries fail → **falls back to basic HTML fetch**
- If HTML fetch also fails → **logs error and continues with other articles**
- Blocked domains are **automatically detected and skipped** in future runs
- Partial success: some articles ingest even if others fail

## Metrics Impact

Expected improvements:
- **Ingestion success rate**: Should increase from ~11% to ~20%+ as blocked articles no longer fail entire batch
- **Failed fetches**: Now tracked separately, not counted as failures
- **Discovery effectiveness**: More articles successfully ingested per run

## Monitoring

Track these metrics in automated ingestion runs:
- `articlesDiscovered` - should remain consistent
- `articlesIngested` - **should increase**
- `articlesSkipped` - may increase (blocked domains)
- `failedFetches` (logged) - tracks extraction failures

## Rollback Plan

If issues occur, revert to basic HTML fetch only:
1. Comment out Jina Reader imports in both services
2. Remove Jina Reader attempt blocks
3. Keep only the fallback HTML fetch code

## Related Files

- `lib/services/jina-reader.service.ts` - Jina Reader with retry logic
- `lib/services/automated-ingestion.service.ts` - Main ingestion orchestrator
- `lib/services/article-ingestion.service.ts` - Article processing service
- `lib/services/blocked-domains.config.ts` - Blocked domains configuration
- `scripts/test-content-extraction-fix.ts` - Test script
- `docs/troubleshooting/content-extraction-401-fix.md` - This document

## Future Enhancements

1. **Smart domain detection**: Use machine learning to predict which domains will block
2. **Alternative extractors**: Add more fallback services beyond Jina Reader
3. **Content caching**: Cache successfully extracted content to avoid re-fetching
4. **User feedback**: Allow manual reporting of blocked/working domains
5. **Rate limiting**: Implement per-domain rate limiting to avoid triggering blocks

## References

- [Jina Reader API Documentation](https://jina.ai/reader)
- [QA Report: Cron Job Performance](../qa/cron-job-performance-feb6-2026.md)
- Original issue: News crawling failing with 401 errors (Feb 11, 2026)
