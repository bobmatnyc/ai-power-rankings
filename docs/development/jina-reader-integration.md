# Jina.ai Reader API Integration

**Status**: ✅ Implemented
**Date**: 2025-11-12
**Version**: 0.3.9

## Overview

This document describes the integration of Jina.ai Reader API for intelligent web scraping and article content extraction in the AI Power Rankings project.

## Background

Previously, the news analysis feature used basic regex-based HTML parsing to extract article content from URLs. This approach had several limitations:
- Poor content extraction quality
- No metadata extraction
- Difficulty handling modern JavaScript-heavy sites
- Required manual HTML cleaning

The Jina.ai Reader API provides:
- Clean markdown content extraction
- Automatic metadata extraction (title, author, published date, description)
- Better handling of modern web pages
- No HTML parsing required

## Implementation

### Files Created

#### `/lib/services/jina-reader.service.ts`

New service class that encapsulates Jina.ai Reader API integration:

```typescript
export class JinaReaderService {
  // Core methods
  async fetchArticle(url: string): Promise<JinaReaderResponse>
  isAvailable(): boolean
  async healthCheck(): Promise<boolean>
}
```

**Features**:
- 30-second timeout for reliability
- Comprehensive error handling
- Metadata extraction and normalization
- Content length limiting (10k characters)
- Singleton instance export

**API Response Types**:
```typescript
interface JinaReaderResponse {
  content: string;
  metadata: JinaReaderMetadata;
}

interface JinaReaderMetadata {
  title?: string;
  author?: string;
  publishedDate?: string;
  source?: string;
  description?: string;
  url?: string;
}
```

### Files Modified

#### `/app/api/admin/news/analyze/route.ts`

Updated the news analysis route to use Jina.ai Reader:

1. **Import added**:
   ```typescript
   import { jinaReaderService, type JinaReaderMetadata } from "@/lib/services/jina-reader.service";
   ```

2. **Updated `fetchArticleContent` function** (lines 112-196):
   - Changed return type from `Promise<string>` to `Promise<{ content: string; metadata: JinaReaderMetadata }>`
   - Attempts Jina.ai Reader API first if available
   - Falls back to basic HTML parsing if Jina.ai fails or is not configured
   - Returns both content and metadata

3. **Updated URL processing logic** (lines 732-782):
   - Captures metadata from `fetchArticleContent`
   - Merges Jina.ai metadata with AI analysis results
   - Prefers Jina metadata but allows AI to override with better data

## Configuration

### Environment Variables

```bash
# .env.local
JINA_API_KEY=jina_xxxxxxxxxxxxxxxxxxxxx
```

The service automatically checks for the API key and gracefully degrades to basic HTML parsing if not configured.

### API Endpoint

- **Base URL**: `https://r.jina.ai`
- **Request Format**: `GET https://r.jina.ai/{TARGET_URL}`
- **Headers**:
  - `Authorization: Bearer {JINA_API_KEY}`
  - `Accept: application/json`
  - `X-Return-Format: json`

## Usage

### Basic Usage

```typescript
import { jinaReaderService } from "@/lib/services/jina-reader.service";

// Fetch article
const result = await jinaReaderService.fetchArticle("https://example.com/article");
console.log(result.content);
console.log(result.metadata.title);
```

### Check Availability

```typescript
if (jinaReaderService.isAvailable()) {
  // Use Jina.ai
} else {
  // Fall back to alternative
}
```

### Health Check

```typescript
const healthy = await jinaReaderService.healthCheck();
if (healthy) {
  console.log("Jina.ai service is operational");
}
```

## Fallback Mechanism

The implementation includes a robust fallback mechanism:

1. **Primary**: Jina.ai Reader API
   - Used when `JINA_API_KEY` is configured
   - Provides clean content and metadata

2. **Fallback**: Basic HTML fetch
   - Used when Jina.ai is unavailable or fails
   - Uses regex to strip HTML tags
   - Extracts minimal metadata (source from URL)

### Fallback Triggers

- API key not configured
- Jina.ai API returns error
- Network timeout (30 seconds)
- Invalid response format

## Error Handling

The service implements comprehensive error handling:

```typescript
try {
  const result = await jinaReaderService.fetchArticle(url);
} catch (error) {
  // Error types:
  // - "Jina.ai API key is not configured"
  // - "Jina.ai API timeout after 30000ms"
  // - "Jina.ai API error (404): Not Found"
  // - "Failed to fetch article with Jina.ai: Network error"
}
```

## Logging

The implementation includes detailed logging for debugging:

```
[JinaReader] Fetching article from: https://...
[JinaReader] Successfully fetched article: { contentLength: 5432, title: "...", source: "..." }
[News Analysis] Using Jina.ai Reader API
[News Analysis] Jina.ai fetch successful: { contentLength: 5432, hasTitle: true, ... }
[News Analysis] Merged metadata from Jina.ai into analysis
```

## Testing

### Manual Testing

Test the integration with the admin news analysis interface:

1. Navigate to `/admin/news`
2. Enter a URL in the analysis form
3. Check browser console for Jina.ai logs
4. Verify metadata is extracted correctly

### Test URLs

Good test URLs:
- `https://techcrunch.com/` - Modern news site
- `https://arstechnica.com/` - Technical articles
- `https://example.com/` - Simple test page

### Fallback Testing

Test fallback by temporarily removing `JINA_API_KEY`:

```bash
# Comment out in .env.local
# JINA_API_KEY=...
```

Should see: `[News Analysis] Jina.ai not available, using basic HTML fetch`

## Performance

### Metrics

- **Jina.ai Response Time**: Typically 2-5 seconds
- **Fallback Response Time**: Typically 0.5-2 seconds
- **Timeout**: 30 seconds
- **Content Limit**: 10,000 characters

### Optimization Opportunities

Future improvements:
- Cache Jina.ai responses (TTL: 1 hour)
- Parallel metadata extraction
- Streaming for large articles
- Rate limiting awareness

## Backward Compatibility

The implementation maintains full backward compatibility:

- ✅ Existing API interface unchanged
- ✅ Fallback to previous behavior if Jina.ai unavailable
- ✅ No breaking changes to analysis response format
- ✅ Optional metadata fields (won't break existing code)

## Security Considerations

1. **API Key Protection**:
   - Stored in `.env.local` (not committed)
   - Only used server-side (Next.js API route)
   - Never exposed to client

2. **URL Validation**:
   - No validation currently (relies on Jina.ai)
   - Consider adding URL whitelist in future

3. **Content Sanitization**:
   - Content is processed by OpenRouter AI
   - Already sanitized in analysis pipeline

## Future Improvements

Potential enhancements:

1. **Caching**: Cache Jina.ai responses to reduce API calls
2. **Retry Logic**: Implement exponential backoff for transient failures
3. **Rate Limiting**: Track and respect Jina.ai rate limits
4. **Enhanced Metadata**: Extract more metadata fields (images, tags, etc.)
5. **Batch Processing**: Process multiple URLs in parallel
6. **Monitoring**: Add metrics and alerting for service health

## Related Documentation

- [Jina.ai Reader Documentation](https://jina.ai/reader)
- [News Analysis API](/docs/api/news-analysis.md)
- [Article Ingestion Service](/lib/services/article-ingestion.service.ts)

## Troubleshooting

### Common Issues

**Issue**: "Jina.ai API key is not configured"
- **Solution**: Add `JINA_API_KEY` to `.env.local`

**Issue**: "Jina.ai API timeout after 30000ms"
- **Solution**: URL may be slow to load, will fallback to basic HTML

**Issue**: "Jina.ai API error (401): Unauthorized"
- **Solution**: Check API key is valid and not expired

**Issue**: Poor content extraction even with Jina.ai
- **Solution**: Some sites may block Jina.ai, fallback will be used

## Change Log

### Version 0.3.9 (2025-11-12)
- ✅ Created `JinaReaderService` class
- ✅ Updated news analysis route to use Jina.ai
- ✅ Implemented fallback mechanism
- ✅ Added metadata extraction and merging
- ✅ Comprehensive error handling
- ✅ Full backward compatibility maintained

## Conclusion

The Jina.ai Reader API integration significantly improves article content extraction quality while maintaining backward compatibility through a robust fallback mechanism. The implementation is production-ready and can be deployed immediately.
