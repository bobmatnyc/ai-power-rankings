# Feature: LLM-Powered Monthly Summary

**Quick reference for the What's New monthly summary feature**

---

## What It Does

Automatically generates a comprehensive monthly summary of:
- News articles (last 30 days)
- Ranking changes
- New tools added
- Site updates from CHANGELOG

Using **Claude Sonnet 4.5** to create a ~1500 word narrative.

---

## Quick Start

### 1. Deploy Database Migration

```bash
psql $DATABASE_URL -f lib/db/migrations/0002_monthly_summaries.sql
```

### 2. Test API

```bash
curl http://localhost:3000/api/whats-new/summary | jq
```

### 3. View in UI

1. Open What's New modal
2. Click "Monthly Summary" tab
3. Wait ~5 seconds for first generation

---

## Files Overview

```
lib/
  db/
    migrations/0002_monthly_summaries.sql    # Database schema
    schema.ts                                 # Updated with monthlySummaries table
  services/
    whats-new-aggregation.service.ts         # Data collection
    whats-new-summary.service.ts             # LLM generation
    article-ingestion.service.ts             # Updated with cache invalidation

app/
  api/
    whats-new/
      summary/route.ts                       # API endpoints (GET/POST)

components/
  ui/
    whats-new-modal.tsx                      # Updated with Monthly Summary tab

docs/
  development/
    whats-new-monthly-summary.md             # Full documentation
    guides/
      whats-new-monthly-summary-implementation.md  # Deployment guide
```

---

## Key Concepts

### Caching
- Database-backed cache (monthly_summaries table)
- Invalidated when data changes (SHA-256 hash comparison)
- Manual regeneration available (POST endpoint)

### Cost
- ~$0.02 per generation
- 3-5 generations per month
- **Total: ~$0.10/month**

### Performance
- First load: 4-6 seconds (LLM generation)
- Cached load: <100ms (database query)

---

## API Endpoints

### GET /api/whats-new/summary
Retrieve cached or generate summary

**Query params:**
- `period` (optional): YYYY-MM format

**Response:**
```json
{
  "summary": {
    "period": "2025-10",
    "content": "markdown content...",
    "generatedAt": "2025-10-23T...",
    "metadata": { ... }
  },
  "isNew": false,
  "generationTimeMs": 123
}
```

### POST /api/whats-new/summary
Force regeneration (admin only)

**Body:**
```json
{
  "period": "2025-10"
}
```

---

## Common Commands

```bash
# Regenerate current month summary
curl -X POST http://localhost:3000/api/whats-new/summary

# Get specific month
curl http://localhost:3000/api/whats-new/summary?period=2025-09

# Check database
psql $DATABASE_URL -c "SELECT period, generated_at FROM monthly_summaries"

# View latest summary
psql $DATABASE_URL -c "SELECT content FROM monthly_summaries ORDER BY period DESC LIMIT 1"
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 503 Database error | Check DATABASE_URL env var |
| 503 AI service error | Check OPENROUTER_API_KEY env var |
| Stale content | DELETE from monthly_summaries WHERE period='YYYY-MM' |
| Empty summary | No data in last 30 days (expected in fresh install) |

---

## Documentation

**Full Documentation**: [/docs/development/whats-new-monthly-summary.md](/docs/development/whats-new-monthly-summary.md)
**Deployment Guide**: [/docs/development/guides/whats-new-monthly-summary-implementation.md](/docs/development/guides/whats-new-monthly-summary-implementation.md)
**Implementation Summary**: [/IMPLEMENTATION_SUMMARY.md](/IMPLEMENTATION_SUMMARY.md)

---

## Version

- **Implemented**: 2025-10-24
- **Version**: 0.1.5
- **Status**: Production ready
