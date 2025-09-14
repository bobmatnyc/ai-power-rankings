# Article Management System

## Overview

The Article Management System provides comprehensive functionality for ingesting, analyzing, and managing articles that impact AI tool rankings. It supports multiple ingestion methods, dry-run analysis, and complete rollback capabilities.

## Features

### 1. Article Ingestion Methods
- **URL Input**: Fetch and extract content from any web URL
- **Direct Text Input**: Paste article content directly
- **File Upload**: Support for PDF, TXT, MD, and JSON files

### 2. Dry Run Mode
- Analyze content without saving to database
- Extract tags, tool mentions, and company mentions
- Calculate predicted ranking changes
- Preview impact before committing changes
- Generate comprehensive analysis summary

### 3. Complete Submission
- Save article to database with full metadata
- Store rankings snapshot before changes
- Apply calculated ranking changes
- Auto-create new tools/companies if mentioned
- Track all changes for audit trail

### 4. Article Management Operations
- **Update**: Modify article text/content without recalculating rankings
- **Recalculate**: Re-analyze article and update rankings
- **Delete**: Remove article and rollback all ranking changes
- **View Impact**: See detailed statistics about article's effect

### 5. Rollback Capabilities
- Complete rollback of ranking changes when deleting articles
- Tools and companies created by articles are preserved
- Full audit trail of all changes

## Database Schema

### Articles Table
```sql
CREATE TABLE articles (
    id UUID PRIMARY KEY,
    slug VARCHAR(255) UNIQUE,
    title VARCHAR(500),
    summary TEXT,
    content TEXT,
    ingestion_type VARCHAR(20), -- 'url', 'text', 'file'
    source_url VARCHAR(1000),
    tool_mentions JSONB,
    company_mentions JSONB,
    rankings_snapshot JSONB,
    importance_score INTEGER,
    sentiment_score DECIMAL,
    status VARCHAR(20),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Article Rankings Changes Table
```sql
CREATE TABLE article_rankings_changes (
    id UUID PRIMARY KEY,
    article_id UUID REFERENCES articles(id),
    tool_id VARCHAR(50),
    tool_name VARCHAR(255),
    metric_changes JSONB,
    old_rank INTEGER,
    new_rank INTEGER,
    rank_change INTEGER,
    score_change DECIMAL,
    change_type VARCHAR(20),
    is_applied BOOLEAN,
    rolled_back BOOLEAN,
    created_at TIMESTAMP
);
```

## API Endpoints

### Ingest Article
```http
POST /api/admin/articles/ingest
Content-Type: application/json

{
  "type": "url" | "text" | "file",
  "input": "...",
  "dryRun": true | false,
  "metadata": {
    "author": "...",
    "publishedDate": "...",
    "category": "...",
    "tags": ["..."]
  }
}
```

### List Articles
```http
GET /api/admin/articles?status=active&limit=50&includeStats=true
```

### Get Article Details
```http
GET /api/admin/articles/{id}
```

### Update Article
```http
PATCH /api/admin/articles/{id}
Content-Type: application/json

{
  "title": "...",
  "summary": "...",
  "content": "...",
  "tags": ["..."],
  "category": "..."
}
```

### Recalculate Rankings
```http
POST /api/admin/articles/{id}/recalculate
```

### Delete Article
```http
DELETE /api/admin/articles/{id}
```

## Usage Examples

### 1. Dry Run Analysis
```javascript
// Analyze an article without saving
const response = await fetch('/api/admin/articles/ingest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'url',
    input: 'https://example.com/ai-news',
    dryRun: true
  })
});

const result = await response.json();
console.log(result.result.summary);
// {
//   totalToolsAffected: 5,
//   totalNewTools: 2,
//   averageRankChange: 2.5,
//   averageScoreChange: 0.05
// }
```

### 2. Complete Ingestion
```javascript
// Ingest and save article with rankings update
const response = await fetch('/api/admin/articles/ingest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'text',
    input: articleContent,
    dryRun: false,
    metadata: {
      author: 'John Doe',
      category: 'AI News',
      tags: ['gpt-5', 'llm', 'openai']
    }
  })
});
```

### 3. Delete with Rollback
```javascript
// Delete article and rollback its ranking changes
await fetch(`/api/admin/articles/${articleId}`, {
  method: 'DELETE'
});
// Rankings are automatically restored to pre-article state
```

## Testing

Run the test script to verify the system:

```bash
./test-article-ingestion.sh
```

This will test:
1. Admin authentication
2. Dry run with URL
3. Dry run with text
4. Article listing
5. Complete ingestion (if database configured)
6. Article retrieval
7. Rankings recalculation
8. Article deletion with rollback

## UI Component

The system includes a React component for the admin interface:

```tsx
import { ArticleManagement } from '@/components/admin/article-management';

// Use in your admin dashboard
<ArticleManagement />
```

Features:
- Tab-based interface for ingestion and management
- Real-time dry run results display
- Article list with quick actions
- Visual feedback for all operations

## Migration Guide

To set up the article management system:

1. **Run the database migration**:
```bash
psql $DATABASE_URL < database/migrations/add-article-management-tables.sql
```

2. **Configure environment variables**:
```env
DATABASE_URL=your_neon_database_url
OPENROUTER_API_KEY=your_openrouter_api_key
USE_DATABASE=true
```

3. **Add the UI component** to your admin dashboard

4. **Test the system** using the provided test script

## Best Practices

1. **Always use dry run first** for new ingestion sources
2. **Review predicted changes** before completing ingestion
3. **Keep article snapshots** for audit trail
4. **Monitor processing logs** for troubleshooting
5. **Regular backups** of the articles table

## Troubleshooting

### Common Issues

1. **Database connection errors**:
   - Verify DATABASE_URL is configured
   - Check USE_DATABASE=true is set
   - Ensure Neon database is accessible

2. **OpenRouter API errors**:
   - Verify OPENROUTER_API_KEY is valid
   - Check API rate limits
   - Ensure sufficient credits

3. **Content extraction failures**:
   - Some websites block automated access
   - Use text input as fallback
   - Check file format compatibility

## Future Enhancements

- [ ] Batch article ingestion
- [ ] Scheduled article fetching
- [ ] Advanced duplicate detection
- [ ] ML-based ranking prediction improvements
- [ ] Export/import functionality
- [ ] Webhook notifications for ranking changes
- [ ] A/B testing for ranking algorithms