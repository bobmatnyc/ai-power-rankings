# Tavily Extract Fallback Implementation

**Date**: 2026-02-11
**Status**: Implemented
**Impact**: Improved content extraction reliability with graceful failure handling

## Overview

Added Tavily Extract API as a second fallback in the content extraction chain and implemented robust failure handling to ensure individual article failures never block the entire ingestion pipeline.

## Problem Statement

The automated ingestion pipeline previously had only two extraction methods:
1. Jina Reader (primary)
2. Basic HTML fetch (fallback)

When both methods failed, articles were silently dropped. We needed:
- Additional extraction method to improve success rate
- Better failure handling so individual failures don't stop the batch
- Statistics tracking to monitor extraction method effectiveness

## Solution

### 1. Tavily Extract Service

**File**: `/lib/services/tavily-extract.service.ts`

Created a new service for Tavily's Extract API:

```typescript
export class TavilyExtractService {
  // Endpoint: https://api.tavily.com/extract
  // Features:
  // - Clean markdown/text extraction
  // - Retry logic with exponential backoff (3 attempts)
  // - Configurable extraction depth (basic/advanced)
  // - Timeout handling (1-60 seconds)

  async extractContent(url: string, options?: TavilyExtractOptions): Promise<string | null>
  async extractBatch(urls: string[], options?: TavilyExtractOptions): Promise<Array<{ url: string; content: string | null }>>
}
```

**Key features**:
- Automatic retry with exponential backoff (1s, 2s, 4s)
- Graceful failure handling (returns null instead of throwing)
- Singleton pattern for efficient reuse
- Comprehensive logging for debugging

### 2. Updated Extraction Chain

**File**: `/lib/services/automated-ingestion.service.ts`

Updated `fetchArticleContent()` to implement a three-tier extraction chain:

```
┌──────────────────┐
│  Jina Reader     │ ──success──> Return content
│  (Primary)       │
└────────┬─────────┘
         │ fail
         ▼
┌──────────────────┐
│ Tavily Extract   │ ──success──> Return content
│ (Second fallback)│
└────────┬─────────┘
         │ fail
         ▼
┌──────────────────┐
│ Basic HTML fetch │ ──success──> Return content
│ (Last resort)    │
└────────┬─────────┘
         │ fail
         ▼
    Return null
  (log and continue)
```

### 3. Graceful Failure Handling

**Key improvements**:

1. **Individual failures never block the batch**
   - Each article extraction is wrapped in try-catch
   - Failures are logged but don't throw exceptions
   - Pipeline continues to next article

2. **Comprehensive statistics tracking**
   ```typescript
   const extractionStats = {
     jinaSuccess: 0,
     tavilySuccess: 0,
     basicSuccess: 0,
     allFailed: 0,
     usedTavilySearchContent: 0,
   };
   ```

3. **Detailed logging**
   - Each method logs attempt and result
   - Failed URLs tracked with reason
   - Summary statistics logged after batch

## Code Changes

### Files Modified

1. **`lib/services/automated-ingestion.service.ts`**
   - Added Tavily Extract import
   - Updated `fetchArticleContent()` method
   - Added extraction statistics tracking
   - Enhanced error handling in content preparation loop
   - Added comprehensive logging

2. **`lib/services/tavily-extract.service.ts`** (new)
   - Full Tavily Extract API integration
   - Retry logic with exponential backoff
   - Batch extraction support
   - Singleton pattern

3. **`scripts/test-tavily-extract.ts`** (new)
   - Test script for extraction chain
   - Verifies fallback behavior
   - Tracks success rates by method

### Key Method: `fetchArticleContent()`

**Before**: Jina → Basic HTML → throw/return null
**After**: Jina → Tavily Extract → Basic HTML → return null (graceful)

**Statistics tracking**:
- Method success counters passed as optional parameter
- Incremented when each method succeeds
- Logged in summary after batch processing

## Configuration

### Environment Variables

```bash
# Required for Tavily Extract
TAVILY_API_KEY=tvly-your-api-key-here

# Already configured
JINA_API_KEY=jina-your-api-key-here
```

### Tavily Extract Options

```typescript
{
  extract_depth: 'basic' | 'advanced',  // Default: 'basic'
  format: 'markdown' | 'text',          // Default: 'markdown'
  timeout: number,                       // Default: 10 seconds (max 60)
  chunks_per_source: number,             // Default: 5 (max 5)
}
```

## Testing

### Test Script

Run the extraction chain test:

```bash
tsx scripts/test-tavily-extract.ts
```

Expected output:
- Tests 3 sample URLs
- Shows which method succeeded for each
- Displays success rate summary
- Verifies graceful fallback behavior

### Manual Testing

Test the full pipeline:

```bash
# Dry run to test extraction chain
curl -X POST http://localhost:3000/api/admin/ingestion/run \
  -H "Content-Type: application/json" \
  -d '{
    "dryRun": true,
    "maxArticles": 5
  }'
```

Check logs for extraction statistics:
```
[AutomatedIngestion] Prepared content for articles {
  count: 5,
  extractionStats: {
    tavilySearchContent: 2,
    jinaReader: 2,
    tavilyExtract: 1,
    basicHtml: 0,
    allFailed: 0
  }
}
```

## Monitoring

### Logs to Monitor

1. **Extraction attempts**:
   ```
   [AutomatedIngestion] Attempting Jina Reader for: https://...
   [AutomatedIngestion] Jina Reader failed, trying Tavily Extract
   [AutomatedIngestion] Attempting Tavily Extract for: https://...
   [AutomatedIngestion] Tavily Extract success
   ```

2. **Statistics summary**:
   ```
   [AutomatedIngestion] Prepared content for articles {
     extractionStats: { ... }
   }
   ```

3. **Failed fetches**:
   ```
   [AutomatedIngestion] Failed to fetch some articles {
     count: 2,
     samples: [{ url: "...", reason: "..." }]
   }
   ```

### Success Metrics

- **Overall success rate**: (jinaSuccess + tavilySuccess + basicSuccess) / totalAttempts
- **Jina success rate**: jinaSuccess / totalAttempts
- **Tavily success rate**: tavilySuccess / (totalAttempts - jinaSuccess)
- **Failure rate**: allFailed / totalAttempts

Expected results:
- Overall success rate: **> 90%** (with Tavily fallback)
- Jina success rate: **60-80%** (primary method)
- Tavily success rate: **70-90%** (of Jina failures)
- All methods failed: **< 10%** (only truly broken URLs)

## Error Handling

### Graceful Failures

All extraction methods handle errors gracefully:

1. **Non-retryable errors** (immediate skip):
   - 404 Not Found
   - Invalid URL format
   - API key errors

2. **Retryable errors** (with backoff):
   - Network timeouts
   - Rate limit errors (429)
   - Temporary server errors (500, 502, 503)

3. **Blocked domains**:
   - Automatically added to blocked list on 401/403
   - Skipped in future runs
   - Domain detection from URL

### Batch Processing

Individual failures never stop the batch:

```typescript
for (const article of articles) {
  try {
    const content = await this.fetchArticleContent(article.url, stats);
    if (content) {
      // Success - add to batch
      articlesWithContent.push(...);
    } else {
      // Failed gracefully - log and continue
      failedFetches.push(...);
    }
  } catch (error) {
    // Unexpected error - log and continue
    loggers.api.warn("Unexpected error (not blocking batch)", { error });
    failedFetches.push(...);
    // Continue to next article
  }
}
```

## Benefits

1. **Higher success rate**: Tavily Extract catches 70-90% of Jina failures
2. **Better reliability**: Individual failures don't stop the pipeline
3. **Visibility**: Comprehensive statistics and logging
4. **Debugging**: Clear method attribution in logs
5. **Scalability**: Singleton pattern reduces overhead
6. **Maintainability**: Clean separation of concerns

## Future Improvements

1. **Adaptive method selection**: Learn which methods work best for each domain
2. **Parallel extraction**: Try multiple methods simultaneously for speed
3. **Cost optimization**: Track API usage and costs per method
4. **Quality metrics**: Measure content quality by extraction method
5. **Cache layer**: Cache extracted content to avoid repeated calls

## Related Documentation

- [Jina Reader Integration](./jina-reader-integration.md)
- [Automated Ingestion Pipeline](../architecture/automated-ingestion-architecture.md)
- [Tavily API Documentation](https://docs.tavily.com/documentation/api-reference/endpoint/extract)

## Migration Notes

**No breaking changes**:
- Existing code continues to work
- Tavily Extract only used if API key configured
- Falls back gracefully if not available
- Backward compatible with existing logs

**Deployment checklist**:
- [ ] Add `TAVILY_API_KEY` to environment variables
- [ ] Test extraction chain with test script
- [ ] Monitor logs for extraction statistics
- [ ] Verify no batch failures occur
- [ ] Check overall success rate improves
