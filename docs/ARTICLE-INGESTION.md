# Article Ingestion System

This document describes the automated article ingestion system that monitors Google Drive for new articles and processes them into the AI Power Rankings database.

## Overview

The system automatically:

1. Monitors a Google Drive folder for new JSON files every 6 hours
2. Validates articles against the news-item schema
3. Ingests valid articles into the database
4. Removes duplicates based on URL
5. Generates ingestion reports
6. Moves processed files to an archive folder

## Folder Structure

- **Incoming Folder**: `https://drive.google.com/drive/u/0/folders/1TVEXlX3PDHDtyRgjR1VenDUywrIEAVy8`
  - Place new JSON files here for processing
- **Processed Folder**: `https://drive.google.com/drive/u/0/folders/1VCEJc1USJ3iRs2aSVBCpaWW47e9jog12`
  - Processed files and reports are moved here

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
  "metrics_mentioned": [
    {
      "tool_id": "cursor",
      "metric_key": "valuation",
      "value": 9900000000,
      "unit": "USD"
    },
    {
      "tool_id": "cursor",
      "metric_key": "revenue",
      "value": 500000000,
      "unit": "USD"
    }
  ]
}
```

## Setup Instructions

### 1. Google Cloud Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Google Drive API
4. Create a service account:
   - Go to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Download the JSON key file
5. Share both Google Drive folders with the service account email

### 2. Environment Variables

Add to your `.env.local`:

```bash
# Google Drive API
GOOGLE_SERVICE_ACCOUNT_KEY='<paste entire service account JSON here>'

# Vercel Cron Secret (generate a secure random string)
CRON_SECRET=your_secure_random_string
```

### 3. Vercel Configuration

The cron job is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/ingest-articles",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

This runs every 6 hours at minute 0 (00:00, 06:00, 12:00, 18:00 UTC).

## Processing Flow

1. **File Discovery**: The cron job lists all JSON files in the incoming folder
2. **Validation**: Each article is validated against the schema
3. **Duplicate Check**: Existing articles with the same URL are removed
4. **Ingestion**: Valid articles are inserted into the `news_updates` table
5. **Metrics Update**: If metrics are mentioned, they're added to `metrics_history`
6. **Report Generation**: A `.report.json` file is created with ingestion details
7. **File Movement**: Both the original file and report are moved to the processed folder

## Ingestion Report

Each processed file generates a report with the same name but `.report.json` extension:

```json
{
  "timestamp": "2025-06-17T06:00:00Z",
  "file_name": "tech-news-june-2025.json",
  "total_articles": 10,
  "ingested": 8,
  "duplicates_removed": 2,
  "validation_errors": 2,
  "errors": ["Article \"Invalid Article\": Missing required field: tools_mentioned"],
  "ingested_articles": [
    {
      "id": "cursor-9b-valuation-2025",
      "title": "Cursor Reaches $9.9B Valuation",
      "url": "https://techcrunch.com/...",
      "status": "new"
    }
  ]
}
```

## Manual Testing

To manually trigger the ingestion:

```bash
# Using curl (replace YOUR_DOMAIN and YOUR_CRON_SECRET)
curl -X POST https://YOUR_DOMAIN/api/cron/ingest-articles \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Monitoring

- Check Vercel Functions logs for execution details
- Review `.report.json` files in the processed folder
- Monitor the `news_updates` table for new entries

## Security Notes

1. The cron endpoint requires the `CRON_SECRET` for authentication
2. Service account credentials should have minimal permissions (only Drive access)
3. Share folders with the service account email only
4. Never commit credentials to version control

## Troubleshooting

### Common Issues

1. **Authentication Error**: Check that `GOOGLE_SERVICE_ACCOUNT_KEY` is properly formatted
2. **Permission Denied**: Ensure folders are shared with the service account email
3. **Validation Errors**: Review the schema and ensure all required fields are present
4. **Duplicate Key Errors**: The system handles duplicates automatically by URL

### Debug Mode

For local testing, you can create a test endpoint without cron authentication:

```typescript
// src/app/api/test/ingest-articles/route.ts
export { GET, POST } from "@/app/api/cron/ingest-articles/route";
```

Then test locally without authentication requirements.
