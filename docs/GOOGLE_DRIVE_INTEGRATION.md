# Google Drive Integration for News Articles

## Overview

The AI Power Rankings platform integrates with Google Drive to streamline the process of importing news articles. This allows editors to prepare news content in a shared Google Drive folder, which can then be automatically ingested into the database.

## Setup

### 1. Google Drive Folder

The system is configured to read from a specific Google Drive folder that contains JSON files with news articles.

- **Folder ID**: Configured in environment variables
- **Access**: Public read access or via API key
- **File Format**: JSON files following the news article schema

### 2. Environment Configuration

Add the following to your `.env.local`:

```bash
# Google Drive API Configuration
GOOGLE_API_KEY=your-google-api-key-here
GOOGLE_DRIVE_FOLDER_ID=your-folder-id-here
```

### 3. Required Scripts

The following scripts handle the Google Drive integration:

- `scripts/run-ingestion-lenient.ts` - Main ingestion script with lenient validation
- `scripts/run-ingestion.ts` - Standard ingestion with strict validation
- `scripts/check-drive-folder.ts` - Verify folder access and list files
- `scripts/test-drive-access-fixed.ts` - Test Google Drive API connectivity

## News Article Schema

Articles must follow this JSON schema:

```json
{
  "id": "unique-uuid",
  "title": "Article Title",
  "summary": "Brief summary of the article",
  "content": "Full article content in markdown",
  "url": "https://source-url.com/article",
  "published_date": "2025-06-18T00:00:00Z",
  "discovered_date": "2025-06-18T00:00:00Z",
  "source": {
    "name": "Source Name",
    "type": "news|blog|social|press_release|research",
    "credibility": 1-10,
    "author": "Author Name (optional)"
  },
  "category": "funding|product|acquisition|partnership|industry|general",
  "tools_mentioned": [
    {
      "tool_id": "tool-slug",
      "relevance": "primary|secondary|mentioned",
      "sentiment": "positive|negative|neutral (optional)"
    }
  ],
  "metrics_mentioned": [
    {
      "tool_id": "tool-slug",
      "metric_key": "users|revenue|etc",
      "value": 123456,
      "unit": "count|usd|percentage (optional)",
      "comparison": "Description of comparison (optional)"
    }
  ],
  "importance_score": 1-10,
  "tags": ["tag1", "tag2"],
  "metadata": {
    "region": "global|us|europe|asia (optional)",
    "embargo_until": "2025-06-20T00:00:00Z (optional)",
    "internal_notes": "Notes for editors (optional)"
  }
}
```

## Ingestion Process

### 1. Running the Ingestion

To ingest articles from Google Drive:

```bash
# Run with lenient validation (recommended)
npx tsx scripts/run-ingestion-lenient.ts

# Run with strict validation
npx tsx scripts/run-ingestion.ts
```

### 2. What the Script Does

1. **Connects to Google Drive** using the API key
2. **Lists all JSON files** in the configured folder
3. **Downloads each file** and validates the content
4. **Cleans the data** (fixes dates, handles nulls, etc.)
5. **Checks for duplicates** by URL to avoid re-importing
6. **Inserts new articles** into the `news_updates` table
7. **Reports summary** of processed articles

### 3. Lenient vs Strict Mode

#### Lenient Mode (`run-ingestion-lenient.ts`)

- Automatically fixes common issues:
  - Adds timezone to dates missing them
  - Handles null values in nested objects
  - Cleans tool and metric references
  - More forgiving validation

#### Strict Mode (`run-ingestion.ts`)

- Requires exact schema compliance
- No automatic fixes
- Better for production-ready content

## Best Practices

### 1. File Naming Convention

Use descriptive file names that indicate the content:

- `cursor-funding-2025-06.json`
- `devin-product-launch.json`
- `ai-coding-industry-report.json`

### 2. Validation Before Upload

Always validate your JSON before uploading to Google Drive:

```bash
# Use a JSON validator
cat article.json | jq .

# Or test locally first
npx tsx scripts/test-article-ingestion.ts article.json
```

### 3. Batch Processing

The system processes all files in the folder, so you can:

- Add multiple articles at once
- Run ingestion periodically (e.g., daily)
- Keep processed files in the folder (duplicates are automatically skipped)

### 4. Error Handling

If an article fails to import:

1. Check the error message in the console output
2. Fix the JSON file in Google Drive
3. Re-run the ingestion script

## Monitoring and Maintenance

### Check Folder Contents

```bash
npx tsx scripts/check-drive-folder.ts
```

### Test Drive Access

```bash
npx tsx scripts/test-drive-access-fixed.ts
```

### Debug Issues

```bash
npx tsx scripts/debug-drive-access.ts
```

## Security Considerations

1. **API Key**: Keep the Google API key secure and never commit it
2. **Folder Access**: Use appropriate sharing settings on the Google Drive folder
3. **Content Validation**: The ingestion script validates content to prevent injection attacks
4. **Duplicate Prevention**: URLs are used as unique identifiers to prevent duplicate imports

## Troubleshooting

### Common Issues

1. **"Invalid API key"**

   - Check that `GOOGLE_API_KEY` is set in `.env.local`
   - Verify the API key has Drive API enabled

2. **"Folder not found"**

   - Check that `GOOGLE_DRIVE_FOLDER_ID` is correct
   - Ensure the folder has appropriate sharing permissions

3. **"JSON parse error"**

   - Validate the JSON file structure
   - Ensure proper escaping of quotes in content

4. **"Duplicate article"**
   - The article URL already exists in the database
   - Update the existing article or use a different URL

## Example Workflow

1. **Editor prepares news article** in JSON format
2. **Uploads to Google Drive folder** via web interface
3. **Developer runs ingestion** script:
   ```bash
   npx tsx scripts/run-ingestion-lenient.ts
   ```
4. **Script reports results**:
   ```
   📊 Overall Ingestion Summary:
   - Files processed: 2
   - Total articles ingested: 4
   - Total duplicates removed: 0
   - Total validation errors: 0
   ```
5. **Articles appear on website** immediately after ingestion

## Future Enhancements

- Automated scheduled ingestion via cron job
- Web interface for triggering ingestion
- Email notifications on successful import
- Article preview before import
- Automatic categorization using AI
