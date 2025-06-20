# News Ingestion Process Documentation

## Overview

The AI Power Rankings system ingests news articles from Google Drive to track updates about AI coding tools. This document explains the ingestion process and common issues.

## Google Drive Setup

### Folder Structure

- **Incoming Folder**: `1TVEXlX3PDHDtyRgjR1VenDUywrIEAVy8` (AI Power Rankings Inbox)
- **Processed Folder**: `1VCEJc1USJ3iRs2aSVBCpaWW47e9jog12` (archive)

### Environment Variables

Add to `.env.local`:

```bash
GOOGLE_DRIVE_INCOMING_FOLDER_ID=1TVEXlX3PDHDtyRgjR1VenDUywrIEAVy8
GOOGLE_DRIVE_PROCESSED_FOLDER_ID=1VCEJc1USJ3iRs2aSVBCpaWW47e9jog12
```

## File Format

News items must be in JSON format with filename pattern: `news-items-YYYY-MM.json`

### Required Schema Structure

```json
{
  "$schema": "../schemas/news-item.schema.json",
  "generated_at": "2025-06-20T02:34:24.363779+00:00",
  "source_file": "source_name",
  "total_items": 68,
  "items": [
    {
      "id": "unique-id-here",
      "title": "Article Title",
      "source": {
        "name": "Source Name",
        "url": "https://example.com/article",
        "author": null // Can be null
      },
      "published_date": "2025-06-19T00:00:00Z",
      "type": "product_launch|funding|partnership|feature_update|company_news",
      "tools_mentioned": [
        {
          "tool_id": "cursor",
          "relevance": "primary|secondary",
          "sentiment": null // Can be null
        }
      ],
      "summary": "Brief summary of the article",
      "discovered_date": "2025-06-20T02:34:24.363779+00:00",
      "metrics_mentioned": [], // Optional
      "tags": ["ai", "developer-tools"],
      "impact_assessment": {
        "importance": "high|medium|low",
        "market_impact": "significant|moderate|minimal",
        "ranking_impact": []
      },
      "content": null, // Can be null
      "verification": {
        "status": "verified|unverified",
        "confidence_score": 0.9,
        "fact_checked": true,
        "corroborating_sources": []
      },
      "metadata": {
        "language": "en",
        "region": null, // Can be null
        "exclusive": false,
        "embargo_until": null, // Can be null
        "related_news_ids": []
      }
    }
  ]
}
```

## Running Ingestion

### Available Scripts

1. **Standard Ingestion** (Strict validation):

   ```bash
   tsx scripts/run-ingestion.ts
   ```

   - Validates all fields according to schema
   - Rejects items with validation errors
   - Best for production data

2. **Lenient Ingestion** (Relaxed validation):

   ```bash
   tsx scripts/run-ingestion-lenient.ts
   ```

   - Accepts null values for optional fields
   - Fixes common format issues automatically
   - Recommended for initial imports

3. **Fixed Ingestion** (Service role):
   ```bash
   tsx scripts/run-ingestion-fixed.ts
   ```
   - Uses service role to avoid auth issues
   - Same as lenient but with better error handling

### Common Issues and Solutions

#### 1. Validation Errors

**Problem**: Fields like `author`, `content`, `region`, `embargo_until` must be strings but are null
**Solution**: Use lenient ingestion script or ensure fields are properly formatted

#### 2. Date Format Issues

**Problem**: `discovered_date` must match ISO format "date-time"
**Solution**: Use format `2025-06-20T02:34:24.363779+00:00`

#### 3. Authentication Errors

**Problem**: `cookies was called outside a request scope`
**Solution**: Use `run-ingestion-fixed.ts` which uses service role authentication

#### 4. Missing Tool IDs

**Problem**: Tool mentioned in news doesn't exist in database
**Solution**: Check tool slug matches exactly with database entries

## Checking Available Files

```bash
# Check files in Google Drive
tsx scripts/check-drive-folder.ts

# Inspect JSON file content
tsx scripts/inspect-json-files.ts

# Download specific file for inspection
tsx scripts/test-file-download.ts FILE_ID
```

## Best Practices

1. **File Naming**: Use consistent naming: `news-items-YYYY-MM.json`
2. **Tool IDs**: Verify tool slugs exist in database before referencing
3. **Dates**: Always use ISO 8601 format with timezone
4. **Null Values**: Use `null` for optional fields, not empty strings
5. **Validation**: Test with standard ingestion first, fall back to lenient if needed

## Post-Ingestion

After successful ingestion:

1. Files are automatically moved to the processed folder
2. News items appear in the database `news_articles` table
3. Rankings can be recalculated to include news impact

## Troubleshooting Checklist

- [ ] Environment variables set correctly in `.env.local`
- [ ] Google Drive API credentials configured
- [ ] File format matches schema requirements
- [ ] Tool IDs exist in database
- [ ] Date formats are ISO 8601 compliant
- [ ] Using appropriate ingestion script for data quality

## Contact

For issues with news ingestion, check:

- Google Drive folder permissions
- API quota limits
- Database connection status
