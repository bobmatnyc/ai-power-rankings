# What's New Monthly Summary Feature

## Overview

LLM-powered monthly summary feature that aggregates news articles, ranking changes, new tools, and site updates into a cohesive narrative for the "What's New" modal.

**Status**: ✅ Implemented (v0.1.5)
**Cost**: ~$0.02 per generation with Claude Sonnet 4.5
**Cache**: Database-backed with intelligent invalidation

---

## Architecture

### Components

1. **Database Layer** (`/lib/db/schema.ts`)
   - `monthlySummaries` table for caching generated summaries
   - Fields: period, content, data_hash, metadata, timestamps

2. **Data Aggregation** (`/lib/services/whats-new-aggregation.service.ts`)
   - Collects data from: news, rankings, tools, CHANGELOG.md
   - Calculates SHA-256 hash for change detection
   - Covers last 30 days

3. **LLM Generation** (`/lib/services/whats-new-summary.service.ts`)
   - Uses Claude Sonnet 4.5 via OpenRouter
   - Generates ~1500 word narrative (4 paragraphs)
   - Template inspired by StateOfUnion component

4. **API Route** (`/app/api/whats-new/summary/route.ts`)
   - GET: Retrieve cached or generate
   - POST: Force regeneration (admin only)

5. **UI Component** (`/components/ui/whats-new-modal.tsx`)
   - Tabs: "Recent (7 Days)" | "Monthly Summary"
   - Lazy loading on tab switch
   - Markdown rendering with links

---

## Database Migration

### Running the Migration

**Production (Vercel Postgres):**
```sql
-- Connect to Vercel Postgres dashboard
-- Execute: /lib/db/migrations/0002_monthly_summaries.sql
```

**Local Development:**
```bash
# Using psql
psql $DATABASE_URL -f lib/db/migrations/0002_monthly_summaries.sql

# Or using Drizzle Kit (if configured)
npm run db:push
```

### Migration File

Location: `/lib/db/migrations/0002_monthly_summaries.sql`

Creates:
- `monthly_summaries` table with indexes
- Comments for documentation

### Rollback

```sql
DROP TABLE IF EXISTS "monthly_summaries";
```

---

## Data Sources

### 1. News Articles
- **Table**: `news`
- **Scope**: Last 30 days, top 15 by importance
- **Fields**: title, summary, importanceScore, toolMentions, source, sourceUrl

### 2. Ranking Changes
- **Table**: `rankings`
- **Scope**: Last 30 days
- **Fields**: period, algorithmVersion, publishedAt, tool count

### 3. New Tools
- **Table**: `tools`
- **Scope**: Created in last 30 days
- **Fields**: name, category, createdAt, scoreUpdatedAt

### 4. Site Changes
- **Source**: `CHANGELOG.md`
- **Parser**: Custom markdown parser
- **Scope**: Versions released in last 30 days

---

## LLM Prompt Template

### System Prompt
```
You are an expert AI industry analyst creating a comprehensive monthly
"What's New" summary for AI Power Rankings.

Structure: 4 paragraphs (~1500 words total)
1. Market Overview (150-200 words)
2. Key Developments (150-200 words)
3. Ranking & Tool Changes (150-200 words)
4. Looking Ahead (150-200 words)

Guidelines:
- Professional, journalistic tone
- Specific data points and tool names
- Inline markdown links
- Analytical, not just descriptive
```

### User Prompt Format
```
# Monthly Data Summary for YYYY-MM

## NEWS ARTICLES (Top 15 by Importance)
1. **[Article Title]**
   Summary: [summary]
   Importance: X/10
   Published: [date]
   Source: [source]
   URL: [url]
   Tools Mentioned: [tools]

## RANKING CHANGES
- Period YYYY-MM: Algorithm vX.X with N tools

## NEW TOOLS ADDED
- **[Tool Name]** (category)
  Added: [date]

## SITE UPDATES (from CHANGELOG)
### Version X.X.X (YYYY-MM-DD)
**Added:**
- [change]
**Fixed:**
- [change]
```

---

## Caching Strategy

### Cache Invalidation
Summary is regenerated when:
1. Data hash changes (new articles/tools/rankings)
2. Manual trigger (POST endpoint)
3. Cache older than current period

### Data Hash Calculation
```typescript
SHA-256({
  articleIds: [sorted IDs],
  rankingPeriods: [sorted periods],
  toolIds: [sorted IDs],
  siteVersions: [sorted versions],
  counts: { articles, rankings, tools, changes }
})
```

### Rebuild Trigger
Located in `/lib/services/article-ingestion.service.ts`:
```typescript
// After article publication (when implemented):
await this.invalidateMonthlySummaryCache();
```

---

## API Endpoints

### GET /api/whats-new/summary

**Query Parameters:**
- `period` (optional): YYYY-MM format, defaults to current month

**Response:**
```json
{
  "summary": {
    "period": "2025-10",
    "content": "Generated markdown content...",
    "generatedAt": "2025-10-23T...",
    "metadata": {
      "model": "anthropic/claude-sonnet-4",
      "generation_time_ms": 4521,
      "article_count": 12,
      "ranking_change_count": 1,
      "new_tool_count": 2,
      "site_change_count": 5
    }
  },
  "isNew": false,
  "generationTimeMs": 123
}
```

**Caching:**
- New generation: 1 hour
- Cached response: 5 minutes

**Error Responses:**
- 503: Database or AI service unavailable
- 500: Internal server error

### POST /api/whats-new/summary

**Authentication:** Required (Clerk)
**Environment:** Production requires authenticated user

**Request Body:**
```json
{
  "period": "2025-10"  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "summary": { ... },
  "generationTimeMs": 5234
}
```

**Error Responses:**
- 401: Unauthorized
- 500: Regeneration failed

---

## UI Component Usage

### WhatsNewModal

**Props:**
```typescript
interface WhatsNewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoShow?: boolean;
}
```

**Tabs:**
1. **Recent (7 Days)** - Existing detailed view
   - Tools updated
   - News articles
   - Platform updates

2. **Monthly Summary** - NEW
   - LLM-generated narrative
   - Metadata statistics
   - Lazy loaded on tab switch

**Markdown Rendering:**
- Converts markdown to HTML
- Preserves links to articles/tools
- Responsive layout with prose classes

---

## Cost Analysis

### OpenRouter API Costs
- **Model**: `anthropic/claude-sonnet-4`
- **Input**: ~5,000 tokens (data prompt)
- **Output**: ~2,000 tokens (1500 words)
- **Cost**: ~$0.02 per generation

### Frequency
- **Typical**: 1-2 generations per month
- **With cache invalidation**: 3-5 regenerations per month
- **Manual triggers**: Minimal

**Monthly Budget**: ~$0.10 (negligible)

---

## Performance Characteristics

### Generation Time
- **Data Aggregation**: 200-500ms
- **LLM Call**: 3-5 seconds
- **Database Save**: 50-100ms
- **Total**: 3.5-6 seconds first time

### Cached Response
- **Database Query**: 10-50ms
- **Total**: <100ms

### UI Loading States
- Lazy tab loading prevents blocking
- Skeleton loader during generation
- Error fallback for failures

---

## Testing

### Manual Testing

1. **Generate Summary:**
   ```bash
   curl http://localhost:3000/api/whats-new/summary
   ```

2. **Force Regeneration** (requires auth):
   ```bash
   curl -X POST http://localhost:3000/api/whats-new/summary \
     -H "Content-Type: application/json" \
     -d '{"period": "2025-10"}'
   ```

3. **UI Testing:**
   - Open What's New modal
   - Switch to "Monthly Summary" tab
   - Verify content loads
   - Check links work

### Unit Tests (TODO)

```typescript
describe("WhatsNewAggregationService", () => {
  it("should aggregate data from all sources");
  it("should calculate consistent hash");
  it("should parse CHANGELOG.md correctly");
});

describe("WhatsNewSummaryService", () => {
  it("should generate summary with valid structure");
  it("should cache summary in database");
  it("should invalidate cache when data changes");
});
```

---

## Troubleshooting

### Issue: Summary not generating

**Check:**
1. `OPENROUTER_API_KEY` environment variable set
2. Database connection available
3. News/rankings data exists for period
4. API logs for detailed error

**Solution:**
```bash
# Check environment
echo $OPENROUTER_API_KEY

# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM news WHERE published_at >= NOW() - INTERVAL '30 days';"

# Check logs
tail -f /var/log/vercel/app.log
```

### Issue: Stale cached summary

**Check:**
1. Data hash in metadata
2. Last generation timestamp
3. Recent articles published

**Solution:**
```bash
# Force regeneration via API
curl -X POST http://localhost:3000/api/whats-new/summary \
  -H "Authorization: Bearer $AUTH_TOKEN"

# Or delete from database
psql $DATABASE_URL -c "DELETE FROM monthly_summaries WHERE period = '2025-10';"
```

### Issue: Links not working in summary

**Check:**
1. Source URLs in news articles
2. Tool slugs in database
3. Markdown link format

**Debugging:**
```typescript
// In browser console
const summary = document.querySelector('.prose');
const links = summary.querySelectorAll('a');
links.forEach(link => console.log(link.href));
```

---

## Future Enhancements

### Planned
- [ ] Historical summaries (browse past months)
- [ ] Multi-language support
- [ ] Email newsletter integration
- [ ] RSS feed generation
- [ ] Download as PDF

### Ideas
- [ ] Comparison view (month-over-month)
- [ ] Customizable summary length
- [ ] Topic filtering (only show certain categories)
- [ ] User preferences (skip certain sources)
- [ ] AI-powered trend predictions

---

## Related Documentation

- [State of Union Component](/components/news/state-of-union.tsx)
- [Article Ingestion Service](/lib/services/article-ingestion.service.ts)
- [What's New Modal](/components/ui/whats-new-modal.tsx)
- [Database Schema](/lib/db/schema.ts)

---

## Changelog

### v0.1.5 (2025-10-24)
- Initial implementation
- Database migration created
- Data aggregation service
- LLM summary generation
- API endpoints
- UI integration with tabs
- Cache invalidation trigger

---

## Maintenance

### Monthly Review
- Check generation costs in OpenRouter dashboard
- Verify summary quality
- Review user feedback
- Update prompt template if needed

### Database Maintenance
```sql
-- Clean up old summaries (keep last 12 months)
DELETE FROM monthly_summaries
WHERE generated_at < NOW() - INTERVAL '12 months';

-- Check table size
SELECT
  pg_size_pretty(pg_total_relation_size('monthly_summaries')) as total_size,
  COUNT(*) as record_count
FROM monthly_summaries;
```

### Performance Monitoring
- Track generation times in metadata
- Monitor API response times
- Alert on failures
- Log cache hit rates

---

**Contact**: For questions or issues, check project documentation or create an issue in the repository.
