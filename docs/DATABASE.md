# AI Power Rankings Database Documentation

## Overview

The AI Power Rankings uses Supabase (PostgreSQL) as its database. This document covers everything you need to know about connecting to, querying, and managing the database.

## Table of Contents

1. [Connection Details](#connection-details)
2. [Database Schema](#database-schema)
3. [Key Tables](#key-tables)
4. [Views and Functions](#views-and-functions)
5. [Common Queries](#common-queries)
6. [Data Manipulation](#data-manipulation)
7. [Maintenance Tasks](#maintenance-tasks)
8. [Troubleshooting](#troubleshooting)

## Connection Details

### Environment Variables

```bash
# Required in .env.local
NEXT_PUBLIC_SUPABASE_URL=https://fukdwnsvjdgyakdvtdin.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_ACCESS_TOKEN=<your-access-token>
SUPABASE_DATABASE_PASSWORD=<your-db-password>
```

### Connection Methods

#### 1. Supabase Client (JavaScript/TypeScript)

```typescript
import { createClient } from "@supabase/supabase-js";

// For client-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// For server-side operations with full access
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
```

#### 2. Direct SQL Access

```bash
# Via Supabase Dashboard
https://supabase.com/dashboard/project/fukdwnsvjdgyakdvtdin/sql

# Via psql
psql "postgresql://postgres:[PASSWORD]@db.fukdwnsvjdgyakdvtdin.supabase.co:5432/postgres"
```

#### 3. REST API

```bash
# Query example
curl "https://fukdwnsvjdgyakdvtdin.supabase.co/rest/v1/tools" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Database Schema

### Core Schema Files

- `database/schema-complete.sql` - Full database schema
- `docs/data/POPULATE.sql` - Seed data with research
- `database/ranking-algorithm.sql` - Ranking calculation functions

### Entity Relationship Overview

```
companies (1) ─── (n) tools
    │                   │
    │                   ├── tool_capabilities
    │                   ├── pricing_plans
    │                   ├── metrics_history
    │                   ├── performance_benchmarks
    │                   └── ranking_cache
    │
    └── funding_rounds

algorithm_versions ─── ranking_periods ─── ranking_cache
                                           │
                                           └── ranking_editorial

metric_definitions ─── metrics_history

news_updates (related_tools[])
data_collection_jobs (target_tools[])
```

## Key Tables

### 1. **tools**

Primary table for AI coding tools.

```sql
-- Key columns
id: text (primary key, e.g., 'cursor', 'github-copilot')
name: text
slug: text (unique)
company_id: uuid (foreign key)
category: text ('code-editor', 'autonomous-agent', 'app-builder', etc.)
status: text ('active', 'deprecated', 'beta')
```

### 2. **ranking_cache**

Pre-calculated rankings for each period.

```sql
-- Key columns
period: text (e.g., 'june-2025')
tool_id: text
position: integer
score: decimal
market_traction_score: decimal
technical_capability_score: decimal
developer_adoption_score: decimal
-- ... other factor scores
```

### 3. **metrics_history**

Time-series data for all metrics.

```sql
-- Key columns
tool_id: text
metric_key: text (references metric_definitions)
value_integer: bigint
value_decimal: decimal
recorded_at: timestamp
source: text
```

### 4. **algorithm_versions**

Tracks ranking algorithm changes over time.

```sql
-- Key columns
version: text (e.g., 'v3.2')
weights: jsonb (factor weights)
is_active: boolean
```

## Views and Functions

### Key Views

#### **latest_rankings**

Current rankings with full tool details.

```sql
SELECT * FROM latest_rankings
ORDER BY position
LIMIT 10;
```

#### **current_tool_metrics**

Latest metric values for each tool.

```sql
SELECT * FROM current_tool_metrics
WHERE tool_id = 'cursor';
```

### Key Functions

#### **calculate_zeitgeist_rankings()**

Calculates rankings based on current metrics.

```sql
SELECT * FROM calculate_zeitgeist_rankings()
ORDER BY score DESC;
```

#### **get_tool_metrics_history()**

Returns time-series metrics for a tool.

```sql
SELECT * FROM get_tool_metrics_history('cursor', '2024-01-01', '2025-12-31');
```

## Common Queries

### Get Current Top 10

```sql
SELECT
  rc.position,
  t.name as tool_name,
  c.name as company_name,
  rc.score,
  rc.market_traction_score,
  rc.technical_capability_score,
  rc.developer_adoption_score
FROM ranking_cache rc
JOIN tools t ON t.id = rc.tool_id
JOIN companies c ON c.id = t.company_id
WHERE rc.period = 'june-2025'
ORDER BY rc.position
LIMIT 10;
```

### Track Tool Progress Over Time

```sql
SELECT
  rp.display_name as period,
  rc.position,
  rc.score
FROM ranking_cache rc
JOIN ranking_periods rp ON rp.period = rc.period
WHERE rc.tool_id = 'cursor'
ORDER BY rp.calculation_date;
```

### Get Tool Details with Capabilities

```sql
SELECT
  t.*,
  c.name as company_name,
  json_agg(
    json_build_object(
      'type', tc.capability_type,
      'value', COALESCE(
        tc.value_text::text,
        tc.value_number::text,
        tc.value_boolean::text,
        tc.value_json::text
      )
    )
  ) as capabilities
FROM tools t
JOIN companies c ON c.id = t.company_id
LEFT JOIN tool_capabilities tc ON tc.tool_id = t.id
WHERE t.id = 'cursor'
GROUP BY t.id, c.name;
```

### Find Tools by Category

```sql
SELECT
  t.name,
  t.slug,
  t.category,
  t.subcategory,
  rc.position,
  rc.score
FROM tools t
LEFT JOIN ranking_cache rc ON rc.tool_id = t.id AND rc.period = 'june-2025'
WHERE t.category = 'autonomous-agent'
ORDER BY COALESCE(rc.position, 999);
```

## Data Manipulation

### Update Tool Information

```sql
UPDATE tools
SET
  description = 'Updated description',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'cursor';
```

### Add New Metrics

```sql
INSERT INTO metrics_history (
  id, tool_id, metric_key, value_integer,
  recorded_at, source, source_url
) VALUES (
  gen_random_uuid(),
  'cursor',
  'estimated_users',
  500000,
  CURRENT_TIMESTAMP,
  'techcrunch',
  'https://techcrunch.com/...'
);
```

### Recalculate Rankings

```sql
-- Insert new rankings for a period
INSERT INTO ranking_cache (id, period, tool_id, position, score, ...)
SELECT
  gen_random_uuid(),
  'july-2025',
  tool_id,
  ROW_NUMBER() OVER (ORDER BY score DESC),
  score,
  ...
FROM calculate_zeitgeist_rankings();
```

### Update Algorithm Weights

```sql
UPDATE algorithm_versions
SET
  weights = '{
    "market_traction": 0.20,
    "technical_capability": 0.30,
    "developer_adoption": 0.25,
    "development_velocity": 0.10,
    "platform_resilience": 0.10,
    "community_sentiment": 0.05
  }'::jsonb
WHERE version = 'v3.2' AND is_active = true;
```

## Maintenance Tasks

### 1. Backup Database

```bash
# Using Supabase CLI
supabase db dump -f backup.sql

# Using pg_dump
pg_dump "postgresql://postgres:[PASSWORD]@db.fukdwnsvjdgyakdvtdin.supabase.co:5432/postgres" > backup.sql
```

### 2. Reset and Reseed

```sql
-- Clear all data
TRUNCATE TABLE news_updates CASCADE;
TRUNCATE TABLE ranking_editorial CASCADE;
TRUNCATE TABLE ranking_cache CASCADE;
-- ... etc

-- Then run seed scripts
-- database/schema-complete.sql
-- docs/data/POPULATE.sql
```

### 3. Validate Data Integrity

```sql
-- Check for orphaned records
SELECT t.* FROM tools t
LEFT JOIN companies c ON c.id = t.company_id
WHERE c.id IS NULL;

-- Check for missing rankings
SELECT t.id, t.name
FROM tools t
LEFT JOIN ranking_cache rc ON rc.tool_id = t.id
  AND rc.period = 'june-2025'
WHERE rc.id IS NULL AND t.status = 'active';
```

### 4. Performance Optimization

```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM latest_rankings;

-- Update statistics
ANALYZE;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## Troubleshooting

### Common Issues

#### 1. "relation does not exist"

The schema hasn't been created. Run:

```bash
# In SQL editor
-- Paste contents of database/schema-complete.sql
```

#### 2. "duplicate key value"

Data already exists. Clear before reseeding:

```sql
TRUNCATE TABLE tools CASCADE;
-- Then rerun seed script
```

#### 3. Connection Refused

Check environment variables and network access:

```bash
# Test connection
curl https://fukdwnsvjdgyakdvtdin.supabase.co/rest/v1/
```

#### 4. Permission Denied

Use service role key for admin operations:

```typescript
const supabase = createClient(url, SUPABASE_SERVICE_ROLE_KEY);
```

### Useful Scripts

Located in `/scripts/`:

- `seed-database.ts` - Populate database with seed data
- `validate-database.ts` - Verify database integrity
- `update-algorithm-weights.ts` - Adjust ranking algorithm
- `populate-only.ts` - Add data without recreating schema

### Direct SQL Access

For complex operations, use the Supabase SQL Editor:
https://supabase.com/dashboard/project/fukdwnsvjdgyakdvtdin/sql

## Best Practices

1. **Always backup before major changes**
2. **Use transactions for multi-table updates**
3. **Test queries in development first**
4. **Keep seed data in sync with schema**
5. **Document any manual database changes**
6. **Use appropriate indexes for performance**
7. **Monitor query performance regularly**

## Additional Resources

- [Supabase Docs](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- Project Schema: `/database/schema-complete.sql`
- Seed Data: `/docs/data/POPULATE.sql`
- Ranking Algorithm: `/database/ranking-algorithm.sql`
