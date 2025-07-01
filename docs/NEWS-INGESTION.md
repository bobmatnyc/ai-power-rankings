# News Ingestion Process Documentation

## Overview

The AI Power Rankings system ingests news articles via the admin dashboard to track updates about AI coding tools. This document explains the manual ingestion process.

## Manual News Ingestion

### Admin Dashboard

News articles can be ingested through the admin dashboard at `/admin/news-ingestion`.

### File Format

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

## Manual Upload Process

1. **Prepare the JSON file** following the schema above
2. **Navigate to Admin Dashboard** at `/admin/news-ingestion`
3. **Upload the file** using the upload interface
4. **Review the validation results**
5. **Confirm ingestion** if validation passes

### Common Issues and Solutions

#### 1. Validation Errors

**Problem**: Fields like `author`, `content`, `region`, `embargo_until` must be strings but are null
**Solution**: Ensure fields are properly formatted or use null for optional fields

#### 2. Date Format Issues

**Problem**: `discovered_date` must match ISO format "date-time"
**Solution**: Use format `2025-06-20T02:34:24.363779+00:00`

#### 3. Missing Tool IDs

**Problem**: Tool mentioned in news doesn't exist in database
**Solution**: Check tool slug matches exactly with database entries

## Best Practices

1. **File Naming**: Use consistent naming: `news-items-YYYY-MM.json`
2. **Tool IDs**: Verify tool slugs exist in database before referencing
3. **Dates**: Always use ISO 8601 format with timezone
4. **Null Values**: Use `null` for optional fields, not empty strings
5. **Validation**: Test with the upload interface which provides immediate feedback

## Post-Ingestion

After successful ingestion:

1. News items appear in the database `news_articles` table
2. Rankings can be recalculated to include news impact
3. News appears on the website immediately

## Troubleshooting Checklist

- [ ] File format matches schema requirements
- [ ] Tool IDs exist in database
- [ ] Date formats are ISO 8601 compliant
- [ ] JSON is valid and properly formatted
