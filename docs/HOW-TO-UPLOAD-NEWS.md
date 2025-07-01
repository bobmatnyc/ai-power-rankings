# How to Upload News Items to AI Power Rankings

## Quick Start

### Method 1: Admin UI Upload (Recommended)

1. Go to http://localhost:3000/admin/ingest-news
2. Click "Upload JSON File"
3. Select your news JSON file
4. Click "Upload and Process"

### Method 2: API Upload

```bash
curl -X POST http://localhost:3000/api/admin/ingest-news \
  -H "Content-Type: multipart/form-data" \
  -F "file=@your-news-items.json"
```

## News Item Format

### Required Fields

```json
{
  "title": "OpenAI Announces GPT-5 for Developers",
  "url": "https://example.com/article",
  "source": "TechCrunch",
  "published_at": "2025-06-24T10:00:00Z"
}
```

### Full Example

```json
{
  "title": "Claude Code Reaches 200K Users",
  "summary": "Anthropic's AI coding assistant surpasses milestone",
  "content": "Full article content here...",
  "url": "https://techcrunch.com/claude-code-200k",
  "source": "TechCrunch",
  "author": "Jane Smith",
  "published_at": "2025-06-24T10:00:00Z",
  "category": "Product Update",
  "importance_score": 8,
  "related_tools": ["claude-code", "cursor", "github-copilot"],
  "primary_tool": "claude-code",
  "sentiment": 0.8,
  "key_topics": ["AI coding", "developer tools", "growth"],
  "is_featured": true,
  "metadata": {
    "reader_count": 5000,
    "engagement_score": 0.85
  }
}
```

### Batch Upload

```json
[
  {
    "title": "News Item 1",
    "url": "https://example.com/1",
    "source": "Source 1",
    "published_at": "2025-06-24T10:00:00Z"
  },
  {
    "title": "News Item 2",
    "url": "https://example.com/2",
    "source": "Source 2",
    "published_at": "2025-06-24T11:00:00Z"
  }
]
```

## Process Resilience

### ✅ Built-in Safety Features

1. **Duplicate Detection**

   - Checks URL uniqueness
   - Skips duplicates automatically
   - Reports duplicates in ingestion report

2. **Auto-creation of References**

   - Creates tools if they don't exist
   - Creates companies if needed
   - Links relationships automatically

3. **Validation**

   - Required fields checked
   - Date format validation
   - URL format validation
   - Score range validation (1-10 for importance, -1 to 1 for sentiment)

4. **Error Handling**

   - Individual item failures don't stop batch
   - Detailed error reporting
   - Partial success allowed

5. **Rollback Capability**
   - Can undo entire ingestion
   - Preview before rollback
   - Dependency checking

### ⚠️ Important Notes

1. **Tool References**: Use exact tool slugs from the tools collection
2. **Date Format**: Use ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)
3. **Duplicates**: Same URL = duplicate (will be skipped)
4. **File Size**: Large batches may take time to process

## Viewing Results

### Ingestion Reports

- Go to http://localhost:3000/admin/ingest-news
- Click "View Reports" tab
- See detailed processing results

### Check Ingested News

- Go to http://localhost:3000/admin/collections/news
- View all news items in Payload CMS

## Troubleshooting

### Common Issues

1. **"Invalid JSON"**

   - Validate JSON at jsonlint.com
   - Check for trailing commas
   - Ensure proper quotes

2. **"Missing required fields"**

   - Must have: title, url, source, published_at
   - Check field names match exactly

3. **"Tool not found"**

   - Tool will be auto-created
   - Check ingestion report for new tools

4. **"Duplicate URL"**
   - News with same URL already exists
   - Check existing news items

## Sample Files

Download sample files from the admin UI:

- Single news item template
- Multiple news items template
- Complex example with all fields
