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

### 0. **companies**

Companies and organizations behind the tools.

```sql
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(20) CHECK (type IN ('company', 'startup', 'enterprise', 'academic', 'open-source', 'acquired')),
    description TEXT,
    website_url VARCHAR(255),
    founded_date DATE,
    headquarters_location VARCHAR(100),
    employee_count_min INTEGER,
    employee_count_max INTEGER,
    logo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key Points:**

- UUID primary key for companies
- Type includes 'acquired' for companies like Windsurf
- Used as foreign key in tools table

### 1. **tools**

Primary table for AI coding tools.

```sql
CREATE TABLE tools (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    company_id UUID REFERENCES companies(id),
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    description TEXT,
    tagline VARCHAR(255),
    website_url VARCHAR(255),
    github_repo VARCHAR(255),
    founded_date DATE,
    first_tracked_date DATE DEFAULT CURRENT_DATE,
    pricing_model VARCHAR(20) CHECK (pricing_model IN ('free', 'freemium', 'paid', 'open-source', 'enterprise')),
    license_type VARCHAR(20) CHECK (license_type IN ('mit', 'apache', 'gpl', 'proprietary', 'other')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'beta', 'deprecated', 'discontinued', 'acquired')),
    logo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key Points:**

- `id` is VARCHAR(50), not UUID (e.g., 'cursor', 'github-copilot')
- `company_id` is a foreign key to companies table
- `status` includes 'acquired' for tools like Windsurf
- Pricing and license constraints ensure data quality

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
CREATE TABLE metrics_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    metric_key VARCHAR(50) REFERENCES metric_definitions(metric_key),
    value_integer BIGINT,
    value_decimal DECIMAL(15,2),
    value_boolean BOOLEAN,
    value_json JSONB,
    recorded_at TIMESTAMP NOT NULL,
    source VARCHAR(50),
    source_url VARCHAR(500),
    notes TEXT,
    is_interpolated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tool_id, metric_key, recorded_at)
);
```

**Important Schema Notes:**

- Different value columns for different data types (not value_text)
- `value_json` for complex data like timeline events
- No `confidence_score` column in this schema
- Enforces uniqueness on (tool_id, metric_key, recorded_at)
- Use appropriate value column based on metric data type

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
-- Integer metric example (GitHub stars)
INSERT INTO metrics_history (
  tool_id, metric_key, value_integer,
  recorded_at, source
) VALUES (
  'cursor', 'github_stars', 25000,
  '2025-06-09', 'github_api'
);

-- Decimal metric example (SWE-bench score)
INSERT INTO metrics_history (
  tool_id, metric_key, value_decimal,
  recorded_at, source
) VALUES (
  'claude-code', 'swe_bench_score', 72.7,
  '2025-06-09', 'official_benchmark'
);

-- JSON metric example (timeline event)
INSERT INTO metrics_history (
  tool_id, metric_key, value_json,
  recorded_at, source
) VALUES (
  'windsurf', 'timeline_event',
  '{"event": "Acquired by OpenAI", "amount": 3000000000}',
  '2025-04-16', 'news_announcement'
);
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

### 1. Running Migrations

#### Using Supabase API (Recommended)

For running SQL migrations programmatically, you can use the Supabase Management API:

```bash
# Run a migration script
node scripts/run-newsletter-migration.js

# Or create your own migration script
# See scripts/run-newsletter-migration.js for example
```

The script uses the Supabase Management API to execute SQL directly:
- Requires `SUPABASE_ACCESS_TOKEN` environment variable
- Executes SQL through the `/v1/projects/{id}/database/query` endpoint
- Provides immediate feedback on success/failure

#### Using Supabase Dashboard

Alternatively, run SQL directly in the dashboard:
https://supabase.com/dashboard/project/fukdwnsvjdgyakdvtdin/sql

### 2. Backup Database

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
