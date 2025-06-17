# Longitudinal Rankings System

This document describes how the AI Power Rankings system generates historical rankings for any month using all available data, including properly aged news impacts.

## Overview

The longitudinal ranking system allows you to:

- Generate rankings for any historical month
- Apply news impact with proper time decay
- Compare tool performance across different time periods
- Track ranking changes over time
- Understand how news events affected rankings historically

## Key Features

### 1. Temporal Data Storage

All data is stored with timestamps, allowing point-in-time queries:

- **metrics_history**: Tool metrics with `recorded_at` timestamps
- **news_updates**: News articles with `published_date` and `discovered_date`
- **funding_rounds**: Funding events with `announced_date`
- **performance_benchmarks**: Benchmark results with `benchmark_date`

### 2. News Aging System

News impact decays over time using an asymptotic curve:

- 50% impact remaining after 1 year
- 97.7% impact after 1 month
- 74.3% impact after 6 months
- Formula: `impact = 1 / (1 + (days_old / 365)^1.5)`

### 3. Historical Calculation Functions

#### `calculate_news_impact_at_date(news_id, tool_id, reference_date)`

Calculates the impact of a specific news article at any point in time:

```sql
SELECT * FROM calculate_news_impact_at_date(
  'news-uuid-here',
  'cursor',
  '2025-06-30'::timestamp
);
```

#### `get_tool_news_impacts_at_date(tool_id, reference_date)`

Gets all news impacts for a tool at a specific date:

```sql
SELECT * FROM get_tool_news_impacts_at_date(
  'cursor',
  '2025-06-30'::timestamp,
  730  -- lookback days
);
```

#### `calculate_aggregate_news_impact(tool_id, reference_date)`

Calculates total news impact for ranking calculations:

```sql
SELECT * FROM calculate_aggregate_news_impact(
  'cursor',
  '2025-06-30'::timestamp
);
```

## API Endpoints

### 1. Historical Rankings

**GET** `/api/rankings/historical?month=2025-06`

Returns rankings for a specific month:

```json
{
  "month": "2025-06",
  "algorithm_version": "v3.2",
  "includes_news_impact": true,
  "rankings": [
    {
      "tool_id": "cursor",
      "tool_name": "Cursor",
      "position": 1,
      "score": 8.75,
      "factor_scores": {
        "agenticCapability": 9.2,
        "innovation": 8.5,
        "newsImpactModifier": 0.8
      },
      "news_summary": {
        "article_count": 15,
        "total_impact": 8.2,
        "positive_impact": 8.5,
        "negative_impact": 0.3
      }
    }
  ]
}
```

### 2. News Impact History

**GET** `/api/news/historical?month=2025-06&tool_id=cursor`

Returns news impacts for a specific tool and month:

```json
{
  "tool_id": "cursor",
  "month": "2025-06",
  "aggregate": {
    "total_impact": 8.2,
    "article_count": 15,
    "recent_article_count": 5
  },
  "news_impact_modifier": 0.82
}
```

### 3. Multi-Month Comparison

**POST** `/api/rankings/historical`

Compare rankings across multiple months:

```json
{
  "months": ["2025-03", "2025-04", "2025-05", "2025-06"],
  "tool_ids": ["cursor", "github-copilot", "devin"]
}
```

## Database Views

### `news_by_month`

Aggregated news statistics by month:

```sql
SELECT * FROM news_by_month WHERE month >= '2024-01-01' ORDER BY month DESC;
```

### `tool_news_impact_by_month`

Tool-specific news impacts by month:

```sql
SELECT * FROM tool_news_impact_by_month WHERE tool_id = 'cursor' ORDER BY month DESC;
```

### `news_impact_monthly_summary`

Pre-calculated monthly impacts (materialized view):

```sql
SELECT * FROM news_impact_monthly_summary WHERE tool_id = 'cursor';
```

## Migration Guide

To enable longitudinal rankings in your database:

1. Run the migration:

```sql
-- Apply the longitudinal tracking migration
\i database/migrations/enhance-news-longitudinal-tracking.sql
```

2. Refresh the materialized view:

```sql
SELECT refresh_news_impact_summary();
```

3. Set up a cron job to refresh the view periodically:

```sql
-- Add to your cron schedule
SELECT cron.schedule(
  'refresh-news-impacts',
  '0 2 * * *',  -- Daily at 2 AM
  'SELECT refresh_news_impact_summary();'
);
```

## Example Queries

### Get rankings for June 2024

```typescript
const response = await fetch("/api/rankings/historical?month=2024-06");
const { rankings } = await response.json();
```

### Track cursor's ranking over time

```typescript
const response = await fetch("/api/rankings/historical", {
  method: "POST",
  body: JSON.stringify({
    months: ["2024-01", "2024-06", "2024-12", "2025-06"],
    tool_ids: ["cursor"],
  }),
});
```

### Get news impact timeline

```typescript
const response = await fetch("/api/news/historical", {
  method: "POST",
  body: JSON.stringify({
    tool_id: "cursor",
    start_date: "2024-01-01",
    end_date: "2025-06-30",
    interval: "month",
  }),
});
```

## Performance Considerations

1. **Indexes**: All temporal queries use indexes on date columns
2. **Materialized Views**: Monthly summaries are pre-calculated
3. **Caching**: Consider caching historical rankings that don't change
4. **Batch Processing**: Use the multi-month comparison endpoint for efficiency

## Testing

Run the test script to verify the system:

```bash
tsx scripts/test-historical-rankings.ts
```

This will:

- Calculate rankings for multiple test months
- Demonstrate news aging effects
- Show available data ranges
- Verify all calculations work correctly
