# What's New Monthly Summary - Implementation Guide

**Quick Start Guide for Deploying the Monthly Summary Feature**

---

## Prerequisites

✅ OpenRouter API key configured
✅ Database access (PostgreSQL)
✅ Next.js application running
✅ Clerk authentication set up (for manual regeneration)

---

## Step 1: Run Database Migration

### Option A: Vercel Postgres (Production)

1. Open Vercel Dashboard → Your Project → Storage → Postgres
2. Go to "Query" tab
3. Copy and paste contents of `/lib/db/migrations/0002_monthly_summaries.sql`
4. Execute the SQL

### Option B: Local Development

```bash
# Using psql
psql $DATABASE_URL -f lib/db/migrations/0002_monthly_summaries.sql

# Verify table created
psql $DATABASE_URL -c "\dt monthly_summaries"
```

**Expected Output:**
```
           List of relations
 Schema |       Name        | Type  |  Owner
--------+-------------------+-------+---------
 public | monthly_summaries | table | postgres
```

---

## Step 2: Verify Environment Variables

Ensure these are set in your environment (`.env.local` or Vercel):

```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-xxxxx
DATABASE_URL=postgresql://user:pass@host:5432/database

# Optional (already configured if site is working)
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

**Check:**
```bash
# Local
cat .env.local | grep OPENROUTER_API_KEY

# Vercel
vercel env pull
```

---

## Step 3: Test API Endpoint

### Generate First Summary

```bash
# Local development
curl http://localhost:3000/api/whats-new/summary | jq

# Production
curl https://your-domain.com/api/whats-new/summary | jq
```

**Expected Response:**
```json
{
  "summary": {
    "period": "2025-10",
    "content": "The agentic coding market is experiencing...",
    "generatedAt": "2025-10-23T...",
    "metadata": {
      "model": "anthropic/claude-sonnet-4",
      "generation_time_ms": 4500,
      "article_count": 12
    }
  },
  "isNew": true,
  "generationTimeMs": 5234
}
```

**Troubleshooting:**
- **503 Database unavailable**: Check `DATABASE_URL`
- **503 AI service unavailable**: Check `OPENROUTER_API_KEY`
- **Empty content**: No data in database for last 30 days (expected in fresh install)

---

## Step 4: Test UI Component

1. **Start development server:**
   ```bash
   npm run dev
   ```

2. **Open application**: http://localhost:3000

3. **Open What's New modal:**
   - Click "What's New" button (if visible)
   - Or trigger via keyboard shortcut (if configured)

4. **Switch to "Monthly Summary" tab:**
   - Click "Monthly Summary" tab
   - Wait for loading (3-6 seconds first time)
   - Verify content renders

5. **Check features:**
   - ✅ Content displays with proper formatting
   - ✅ Links are clickable
   - ✅ Metadata stats show at bottom
   - ✅ Generated date visible

---

## Step 5: Verify Cache Invalidation (Optional)

Test that cache invalidates when new articles are published:

```bash
# 1. Generate initial summary
curl http://localhost:3000/api/whats-new/summary

# 2. Note the dataHash in response metadata

# 3. Add a test news article (when article ingestion is implemented)
# This should trigger invalidation

# 4. Request summary again
curl http://localhost:3000/api/whats-new/summary

# 5. Compare dataHash - should be different
```

---

## Step 6: Manual Regeneration (Admin)

Force regenerate summary (requires authentication):

```bash
# Get auth token (from Clerk session)
TOKEN="your-clerk-session-token"

# Force regeneration
curl -X POST http://localhost:3000/api/whats-new/summary \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"period": "2025-10"}'
```

**Production Only**: In development, authentication check is bypassed.

---

## Deployment Checklist

### Pre-Deployment

- [ ] Database migration executed in staging
- [ ] Environment variables configured in Vercel
- [ ] API endpoint tested in staging
- [ ] UI component renders correctly
- [ ] OpenRouter API key has sufficient credits

### Deployment

```bash
# Deploy to Vercel
git add .
git commit -m "feat: Add LLM-powered monthly summary feature"
git push origin main

# Vercel will auto-deploy
```

### Post-Deployment

- [ ] Run migration in production database
- [ ] Test production API endpoint
- [ ] Generate first production summary
- [ ] Monitor OpenRouter API usage
- [ ] Check application logs for errors

---

## Monitoring

### Check Summary Generation

```sql
-- View all summaries
SELECT period, generated_at,
       metadata->>'article_count' as articles,
       metadata->>'generation_time_ms' as gen_time_ms
FROM monthly_summaries
ORDER BY period DESC;
```

### Monitor Costs

1. **OpenRouter Dashboard**: https://openrouter.ai/activity
2. **Check monthly spend**:
   - Model: anthropic/claude-sonnet-4
   - Filter by referer: your domain

3. **Expected costs**:
   - ~$0.02 per generation
   - 3-5 generations per month
   - **Total: ~$0.10/month**

---

## Common Issues

### Issue: "Database connection not available"

**Cause**: `DATABASE_URL` not set or invalid

**Fix:**
```bash
# Check environment
echo $DATABASE_URL

# Verify connection
psql $DATABASE_URL -c "SELECT 1"
```

### Issue: "OpenRouter authentication failed"

**Cause**: `OPENROUTER_API_KEY` not set or invalid

**Fix:**
```bash
# Check environment
echo $OPENROUTER_API_KEY

# Verify key format (should start with sk-or-v1-)
# Check OpenRouter dashboard for valid keys
```

### Issue: "No content in OpenRouter response"

**Cause**: Rate limit, insufficient credits, or API error

**Fix:**
1. Check OpenRouter dashboard for:
   - Credit balance
   - Rate limit status
   - Error logs

2. Wait a few minutes and retry

3. Check application logs for detailed error

### Issue: Summary tab shows "No monthly summary available"

**Cause**: Summary generation failed silently or no data exists

**Fix:**
```bash
# Check database
psql $DATABASE_URL -c "SELECT * FROM monthly_summaries LIMIT 1"

# Force generation via API
curl -X POST http://localhost:3000/api/whats-new/summary

# Check application logs
tail -f logs/application.log
```

### Issue: Links in summary not working

**Cause**: Incorrect URL format or missing base URL

**Fix:**
1. Check source article URLs in database
2. Verify `NEXT_PUBLIC_BASE_URL` is set
3. Test links manually from generated content

---

## Rollback Plan

If you need to rollback this feature:

### 1. Remove UI Component Changes

```bash
git revert <commit-hash>
```

### 2. Drop Database Table

```sql
-- CAUTION: This deletes all generated summaries
DROP TABLE IF EXISTS monthly_summaries;
```

### 3. Remove API Route

```bash
rm -rf app/api/whats-new/summary
```

### 4. Remove Services

```bash
rm lib/services/whats-new-aggregation.service.ts
rm lib/services/whats-new-summary.service.ts
```

---

## Performance Benchmarks

Expected performance metrics:

| Operation | First Load | Cached |
|-----------|-----------|--------|
| Data aggregation | 300-500ms | N/A |
| LLM generation | 3-5 seconds | N/A |
| Database save | 50-100ms | N/A |
| API response | 3.5-6s | <100ms |
| UI load | +200ms | Instant |

**Total**: First generation takes ~4-6 seconds, subsequent loads <100ms

---

## Next Steps

After successful deployment:

1. **Monitor first week**:
   - Check generation frequency
   - Review summary quality
   - Monitor API costs
   - Collect user feedback

2. **Optimization** (if needed):
   - Adjust prompt template
   - Tune cache duration
   - Optimize data queries

3. **Enhancement** (future):
   - Add historical month browsing
   - Implement email newsletters
   - Create RSS feed
   - Add multi-language support

---

## Support

**Documentation**: `/docs/development/whats-new-monthly-summary.md`
**Code**: Search codebase for `WhatsNewSummaryService`
**Issues**: Create GitHub issue with label `feature:monthly-summary`

---

**Last Updated**: 2025-10-24
**Version**: 0.1.5
