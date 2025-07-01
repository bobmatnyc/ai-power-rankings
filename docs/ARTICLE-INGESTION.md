# Article Ingestion System

This document describes the manual article ingestion system for the AI Power Rankings platform.

## Overview

The system provides manual ingestion of news articles through the admin dashboard:

1. Upload JSON files via the admin interface
2. Validates articles against the news-item schema
3. Ingests valid articles into the database
4. Removes duplicates based on URL
5. Generates ingestion reports

## Admin Dashboard

Access the news ingestion tool at:

- Development: `http://localhost:3000/admin/news-ingestion`
- Production: `https://aipowerrankings.com/admin/news-ingestion`

## File Format

Articles must be in JSON format and can be either:

- A single article object
- An array of article objects

Each article must conform to the schema defined in `/schemas/news-item.schema.json`.

### Example Article

```json
{
  "id": "cursor-9b-valuation-2025",
  "title": "Cursor Reaches $9.9B Valuation, Surpasses $500M ARR",
  "source": {
    "name": "TechCrunch",
    "url": "https://techcrunch.com/2025/06/05/cursors-anysphere-nabs-9-9b-valuation-soars-past-500m-arr/",
    "author": "Jane Doe"
  },
  "published_date": "2025-06-05T14:30:00Z",
  "type": "funding",
  "tools_mentioned": [
    {
      "tool_id": "cursor",
      "relevance": "primary",
      "sentiment": "positive"
    }
  ],
  "summary": "Cursor, an AI-powered code editor, has achieved a $9.9 billion valuation in its latest funding round...",
  "discovered_date": "2025-06-06T02:34:24.363779+00:00",
  "metrics_mentioned": [
    {
      "tool_id": "cursor",
      "metric_key": "arr",
      "value": 500000000,
      "unit": "usd",
      "comparison": "Surpassed $500M ARR milestone"
    }
  ],
  "tags": ["funding", "valuation", "arr"],
  "impact_assessment": {
    "importance": "high",
    "market_impact": "significant",
    "ranking_impact": ["popularity", "financial_health"]
  },
  "verification": {
    "status": "verified",
    "confidence_score": 0.95,
    "fact_checked": true,
    "corroborating_sources": ["https://anysphere.co/blog/funding-announcement"]
  },
  "metadata": {
    "language": "en",
    "region": "global",
    "exclusive": false,
    "embargo_until": null,
    "related_news_ids": []
  }
}
```

## Ingestion Process

1. **Upload**: Use the admin dashboard to upload JSON files
2. **Validation**: Articles are validated against the schema
3. **Duplicate Check**: URLs are checked for existing articles
4. **Processing**: Valid articles are added to the database
5. **Reporting**: Detailed ingestion report is generated

## Schema Requirements

### Required Fields

- `id`: Unique identifier for the article
- `title`: Article headline
- `source.name`: Publication name
- `source.url`: Article URL
- `published_date`: When the article was published (ISO 8601)
- `discovered_date`: When the article was discovered (ISO 8601)
- `type`: Article type (funding, product_launch, partnership, etc.)
- `summary`: Brief article summary

### Optional Fields

- `source.author`: Article author
- `tools_mentioned`: Array of tools referenced
- `metrics_mentioned`: Performance metrics mentioned
- `tags`: Article tags
- `impact_assessment`: Predicted impact on rankings
- `content`: Full article text
- `verification`: Fact-checking information
- `metadata`: Additional metadata

## Tool References

When referencing tools in `tools_mentioned`, use the exact tool slugs from the database:

- `cursor` for Cursor
- `github-copilot` for GitHub Copilot
- `claude-code` for Claude Code
- etc.

## Error Handling

The system provides detailed error reporting for:

- Invalid JSON format
- Missing required fields
- Invalid tool references
- Duplicate URLs
- Schema validation failures

## Best Practices

1. **Validate JSON** before uploading using a JSON validator
2. **Check tool IDs** to ensure they exist in the database
3. **Use ISO 8601 dates** for all date fields
4. **Provide unique IDs** for each article
5. **Include impact assessment** for better ranking integration

## Troubleshooting

### Common Issues

1. **Invalid JSON**: Use a JSON validator to check syntax
2. **Missing required fields**: Ensure all required fields are present
3. **Invalid dates**: Use ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)
4. **Tool not found**: Check that tool slugs match database entries
5. **Duplicate URL**: Article with same URL already exists

### Getting Help

Check the ingestion reports in the admin dashboard for detailed error messages and processing results.
