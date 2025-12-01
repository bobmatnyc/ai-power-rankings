# State of AI Monthly Summary System

## Overview

Automated monthly "State of AI" editorial generation system using Claude Sonnet 4 via OpenRouter. Generates 400-500 word editorial summaries analyzing the AI coding tools industry.

**Status:** ✅ Fully Implemented (December 2025)

## Features

- **Automated Data Aggregation**: Pulls last 4 weeks of news, rankings, and tool launches
- **LLM-Powered Editorial**: Claude Sonnet 4 generates opinionated, journalistic summaries
- **Admin UI**: Simple interface for generating and previewing editorials
- **Public API**: ISR-cached endpoint for current month's editorial
- **Dynamic Display**: StateOfUnion component fetches and displays latest editorial

## Architecture

### Database Schema

**Table:** `state_of_ai_summaries`

```sql
CREATE TABLE state_of_ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL,           -- 1-12
  year integer NOT NULL,             -- e.g., 2025
  content text NOT NULL,             -- Markdown editorial (400-500 words)
  generated_at timestamp NOT NULL,   -- When generated
  generated_by text NOT NULL,        -- User ID who triggered
  metadata jsonb DEFAULT '{}',       -- article_count, word_count, cost, etc.
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL,
  UNIQUE(month, year)                -- One editorial per month
);
```

**Indexes:**
- Unique index on `(month, year)`
- Index on `generated_at` for chronological queries
- GIN index on `metadata` for JSONB queries

### Service Layer

**File:** `/lib/services/state-of-ai-summary.service.ts`

**Key Methods:**
- `generateStateOfAi(month?, year?, generatedBy?, forceRegenerate?)` - Generate editorial
- `getSummary(month?, year?)` - Get specific month's editorial
- `getCurrentSummary()` - Get current month or most recent
- `listSummaries(limit?)` - List all editorials

**LLM Configuration:**
- Model: `anthropic/claude-sonnet-4` via OpenRouter
- Temperature: `0.4` (slightly higher for editorial creativity)
- Max Tokens: `2000`
- Cost: ~$0.01-0.03 per generation

### API Endpoints

#### Admin Endpoint (Protected)

**POST** `/api/admin/state-of-ai/generate`

Requires admin authentication (Clerk).

**Request Body:**
```json
{
  "month": 12,              // Optional, defaults to current
  "year": 2025,             // Optional, defaults to current
  "forceRegenerate": false  // Regenerate if already exists
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "id": "uuid",
    "month": 12,
    "year": 2025,
    "content": "Editorial content in markdown...",
    "generatedAt": "2025-12-01T12:00:00Z",
    "generatedBy": "user_xxx",
    "metadata": {
      "article_count": 47,
      "new_tool_count": 3,
      "word_count": 456,
      "cost_usd": 0.0234
    }
  },
  "isNew": true,
  "generationTimeMs": 12345
}
```

#### Public Endpoint (Cached)

**GET** `/api/state-of-ai/current`

Returns current month's editorial, falls back to most recent.

**Response:**
```json
{
  "success": true,
  "summary": {
    "id": "uuid",
    "month": 12,
    "year": 2025,
    "content": "Editorial content...",
    "generatedAt": "2025-12-01T12:00:00Z",
    "metadata": { ... }
  }
}
```

**Caching:**
- ISR revalidation: 3600 seconds (1 hour)
- Cache-Control: `public, s-maxage=3600, stale-while-revalidate=7200`

### Frontend Components

#### Admin UI

**Path:** `/app/[lang]/(authenticated)/admin/state-of-ai/`

**Features:**
- Month/Year selector (last 12 months)
- "Generate State of AI Editorial" button
- Loading state with progress indicator (~30-60 seconds)
- Preview generated content (markdown)
- Metadata display (article count, word count, cost)
- Link to preview live

**Access:** Admin users only (Clerk authentication)

#### StateOfUnion Component

**Path:** `/components/news/state-of-union.tsx`

**Behavior:**
- Fetches from `/api/state-of-ai/current` on mount
- Shows loading spinner during fetch
- Falls back to hardcoded October 2025 content if API fails
- Parses markdown links: `[text](url)` → `<a>` tags
- Displays dynamic month/year in header

**States:**
- Loading: Spinner in card
- Error/404: Fallback to hardcoded content
- Success: Dynamic content with parsed links

## Usage

### 1. Apply Database Migration

```bash
# Run migration script
npx tsx scripts/apply-state-of-ai-migration.ts

# Verify table creation
# Check output for table structure and indexes
```

### 2. Generate First Editorial

**Option A: Admin UI (Recommended)**

1. Navigate to: `http://localhost:3007/en/admin/state-of-ai`
2. Select month/year (defaults to current)
3. Click "Generate State of AI Editorial"
4. Wait ~30-60 seconds for Claude Sonnet 4 generation
5. Preview generated content
6. View live on What's New page

**Option B: API Endpoint**

```bash
# Generate for current month
curl -X POST http://localhost:3007/api/admin/state-of-ai/generate \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json"

# Generate for specific month
curl -X POST http://localhost:3007/api/admin/state-of-ai/generate \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"month": 11, "year": 2025}'

# Force regenerate
curl -X POST http://localhost:3007/api/admin/state-of-ai/generate \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"month": 12, "year": 2025, "forceRegenerate": true}'
```

### 3. View Live Editorial

Navigate to: `http://localhost:3007/en/whats-new`

Scroll to "State of Agentic Coding" section.

## LLM Prompt Strategy

### System Prompt Guidelines

**Tone:** Bold, editorial, opinionated but grounded in data

**Structure:** Exactly 4 paragraphs
1. Opening - Major theme/trend of the month
2. Key Developments - 2-3 significant events/launches
3. Market Shifts - Ranking changes, competitive landscape
4. Forward Looking - Implications and predictions

**Requirements:**
- 400-500 words total
- Include inline markdown links to sources
- Journalistic, not marketing copy
- Specific data points (tool names, numbers, percentages)
- Analytical, not just descriptive

**Format:** Clean markdown ready to display

### Data Sources

Aggregated from:
- **News Articles** (last 30 days, top 10 by importance)
- **Ranking Changes** (tool count, algorithm version)
- **New Tools** (launches, categories)
- **Site Updates** (from CHANGELOG.md)

## Cost Analysis

**Per Generation:**
- Model: Claude Sonnet 4 ($3/M input, $15/M output)
- Typical usage: ~2,000 input tokens, ~600 output tokens
- Cost: $0.015-0.030 per editorial

**Monthly Cost (1 editorial/month):**
- ~$0.03/month

**Cost Tracking:**
- Stored in `metadata.cost_usd` field
- Displayed in admin UI
- Logged via OpenRouter service

## Error Handling

### Service Layer

**Retries:**
- Automatic retry with exponential backoff (via OpenRouter service)
- Max 3 attempts for transient errors
- No retry for 4xx errors (validation, auth)

**Errors Logged:**
- LLM generation failures
- Database errors
- Data aggregation failures

### Frontend

**Admin UI:**
- Shows error alert with specific message
- Allows retry without page refresh

**StateOfUnion Component:**
- Falls back to hardcoded content on 404
- Shows hardcoded content on API errors
- Graceful degradation (always shows something)

## Monitoring & Logging

**Service Logs:**
- Generation start/complete (info level)
- Cost and timing metrics
- Content length, word count
- Article count processed

**API Logs:**
- Request metadata (userId, month, year)
- Generation duration
- Cache hit/miss (via isNew flag)

**OpenRouter Service:**
- Token usage (prompt + completion)
- API latency
- Retry attempts
- Cost calculation

## Testing

### Manual Testing Checklist

- [ ] Database migration applies successfully
- [ ] Admin UI loads without errors
- [ ] Month selector shows last 12 months
- [ ] Generate button works with loading state
- [ ] Editorial generates in ~30-60 seconds
- [ ] Metadata displays correctly (count, cost)
- [ ] Markdown links parse correctly in preview
- [ ] Public API returns editorial
- [ ] StateOfUnion component displays editorial
- [ ] Fallback content works when API fails

### API Testing

```bash
# Test public endpoint
curl http://localhost:3007/api/state-of-ai/current

# Test admin endpoint (requires auth)
# Use Postman or similar with Clerk session token
```

## Deployment

### Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `USE_DATABASE=true` - Enable database operations
- `OPENROUTER_API_KEY` - OpenRouter API key
- `NEXT_PUBLIC_BASE_URL` - Base URL for app

### Deployment Steps

1. **Apply Migration:**
   ```bash
   npx tsx scripts/apply-state-of-ai-migration.ts
   ```

2. **Verify Database:**
   ```sql
   SELECT * FROM state_of_ai_summaries;
   ```

3. **Generate Initial Editorial:**
   - Use admin UI to generate current month
   - Verify in database
   - Check live on What's New page

4. **Set Up Monthly Cron (Optional):**
   - Create Vercel Cron job for 1st of each month
   - Calls `/api/admin/state-of-ai/generate`
   - Requires Clerk admin authentication

## Maintenance

### Monthly Workflow

1. **Beginning of Month:**
   - Admin navigates to `/admin/state-of-ai`
   - Selects current month
   - Clicks "Generate State of AI Editorial"
   - Reviews generated content
   - Editorial goes live automatically

2. **Review Process:**
   - Check metadata (article count, word count)
   - Verify links are accurate and working
   - Ensure editorial quality meets standards
   - Optional: Edit content in database if needed

3. **Update Previous Month:**
   - Previous month stays in database
   - StateOfUnion component shows current month
   - Historical editorials preserved for future reference

### Future Enhancements

**Potential Improvements:**
- [ ] Automated monthly generation (Vercel Cron)
- [ ] Rich text editor for manual edits
- [ ] Version history for editorials
- [ ] A/B testing different LLM prompts
- [ ] Multi-language editorial generation
- [ ] Email notifications when new editorial published
- [ ] Analytics dashboard for editorial performance

## Troubleshooting

### Issue: Editorial not displaying

**Check:**
1. Database connection: `SELECT * FROM state_of_ai_summaries;`
2. API endpoint: `curl /api/state-of-ai/current`
3. Browser console for fetch errors
4. Fallback content should always show

### Issue: Generation fails

**Check:**
1. OpenRouter API key configured
2. Database write permissions
3. Service logs for error details
4. News data available (last 30 days)

### Issue: Markdown links not parsing

**Check:**
1. Link format: `[text](url)` (no spaces)
2. `parseMarkdownContent` function logic
3. Browser console for React errors

## Related Files

**Core Implementation:**
- `/lib/db/schema.ts` - Database schema
- `/lib/db/migrations/0010_add_state_of_ai_summaries.sql` - Migration
- `/lib/services/state-of-ai-summary.service.ts` - Service layer
- `/app/api/admin/state-of-ai/generate/route.ts` - Admin API
- `/app/api/state-of-ai/current/route.ts` - Public API
- `/app/[lang]/(authenticated)/admin/state-of-ai/` - Admin UI
- `/components/news/state-of-union.tsx` - Display component

**Supporting Files:**
- `/lib/services/whats-new-aggregation.service.ts` - Data aggregation
- `/lib/services/openrouter.service.ts` - LLM service
- `/scripts/apply-state-of-ai-migration.ts` - Migration script

## Success Metrics

**System Health:**
- ✅ Database migration applied
- ✅ Service generates editorial in <60 seconds
- ✅ Admin UI functional and user-friendly
- ✅ Public API cached and performant
- ✅ StateOfUnion component displays dynamically
- ✅ Fallback content prevents blank state

**Content Quality:**
- 400-500 words per editorial
- 4 paragraph structure
- 3-4 inline links to sources
- Journalistic tone achieved
- Data-driven insights

**Cost Efficiency:**
- <$0.03 per editorial
- ~$0.36/year for monthly editorials
- Cost tracked in metadata

## Contact

**Questions or Issues:**
- Review this documentation first
- Check service logs for errors
- Test API endpoints directly
- Verify database state

---

**Last Updated:** December 1, 2025
**Version:** 1.0.0
**Status:** Production Ready
