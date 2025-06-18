# AI Power Rankings Database Documentation

## Overview

The AI Power Rankings uses Supabase (PostgreSQL) as its database with two separate environments for safe development and production operations. This document covers everything you need to know about connecting to, querying, and managing both databases.

## 🚨 CRITICAL DATABASE ACCESS RULES

**ALWAYS follow these rules to avoid database connection issues:**

### 1. Use Centralized Database Clients

```typescript
// ✅ CORRECT - use this in ALL API routes
import { supabase } from "@/lib/database";

// ❌ WRONG - never manually create clients in API routes
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(url, key);
```

### 2. Use Anon Key for 99% of Operations

- ✅ `supabase` (anon key) - for tools, rankings, news, metrics
- ⚠️ `supabaseAdmin` (service role) - only for admin operations

### 3. Use Bracket Notation for Environment Variables

```typescript
// ✅ CORRECT
process.env["NEXT_PUBLIC_SUPABASE_URL"];

// ❌ WRONG - fails in production
process.env.NEXT_PUBLIC_SUPABASE_URL;
```

### 4. Restart Dev Server After Environment Changes

```bash
kill $(lsof -ti:3000) && npm run dev
```

## Table of Contents

1. [Two-Database System](#two-database-system)
2. [Environment Management](#environment-management)
3. [Connection Details](#connection-details)
4. [Database Schema](#database-schema)
5. [Key Tables](#key-tables)
6. [Data Import System](#data-import-system)
7. [Common Queries](#common-queries)
8. [Data Manipulation](#data-manipulation)
9. [Maintenance Tasks](#maintenance-tasks)
10. [Troubleshooting](#troubleshooting)

## Two-Database System

### Production Database

- **Project ID**: `fukdwnsvjdgyakdvtdin`
- **URL**: `https://fukdwnsvjdgyakdvtdin.supabase.co`
- **Purpose**: Live data for the production website
- **Access**: Read-only for development, write access only for production deployments

### Development Database

- **Project ID**: `iupygejzjkwyxtitescy` (NEW as of June 2025)
- **URL**: `https://iupygejzjkwyxtitescy.supabase.co`
- **Purpose**: Safe environment for development, testing, and experimentation
- **Access**: Full read/write access for development work
- **Note**: This is the enhanced database with the newer schema including the `info` field on tools table

## Environment Management

### Switching Between Environments

Use the environment switching script to safely change between databases:

```bash
# Switch to development (safe for testing)
./scripts/switch-env.sh dev

# Switch to production (use with caution)
./scripts/switch-env.sh prod

# Check current environment
./scripts/switch-env.sh status
```

### Environment Files

#### Development Environment (`.env.local.dev`)

```bash
# DEVELOPMENT ENVIRONMENT - Safe Development Database
NEXT_PUBLIC_SUPABASE_URL=https://iupygejzjkwyxtitescy.supabase.co
SUPABASE_PROJECT_ID=iupygejzjkwyxtitescy
SUPABASE_DATABASE_PASSWORD=DevPassword123!
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

#### Production Environment (`.env.local.prod`)

```bash
# PRODUCTION ENVIRONMENT - Live Production Database
NEXT_PUBLIC_SUPABASE_URL=https://fukdwnsvjdgyakdvtdin.supabase.co
SUPABASE_PROJECT_ID=fukdwnsvjdgyakdvtdin
# ... production keys
NEXT_PUBLIC_BASE_URL=https://aipowerranking.com
```

### Safety Features

- **Automatic Backup**: The switch script creates backup copies of your current `.env.local`
- **Environment Indicators**: Clear terminal output shows which environment is active
- **Development Default**: New setups default to development environment

## Connection Details

### JavaScript/TypeScript Client - AUTHORITATIVE METHODS

There are **TWO WAYS** to access our databases. Use these patterns consistently:

#### Method 1: Using the Centralized Database Client (RECOMMENDED)

**Always use this for API routes and server-side code:**

```typescript
// Import the centralized client from our database module
import { supabase } from "@/lib/database"; // Uses anon key - works for 99% of operations

// For admin operations (if you really need them)
import { supabaseAdmin } from "@/lib/database"; // Uses service role key
```

**Examples:**

```typescript
// API routes - use this pattern
import { supabase } from "@/lib/database";

export async function GET() {
  const { data: tools, error } = await supabase.from("tools").select("*").order("name");

  if (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  return NextResponse.json({ tools });
}
```

#### Method 2: Manual Client Creation (AVOID UNLESS NECESSARY)

```typescript
import { createClient } from "@supabase/supabase-js";

// For client-side operations (uses anon key)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// For server-side operations (uses service role key)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
```

### CRITICAL: When to Use Which Client

#### Use `supabase` (anon key) for:

- ✅ **API routes** - tools, rankings, news endpoints
- ✅ **Reading public data** - tools, rankings, metrics_history
- ✅ **Client-side operations** - all React components
- ✅ **99% of all database operations**

#### Use `supabaseAdmin` (service role key) ONLY for:

- ⚠️ **Admin operations** - creating/deleting tables
- ⚠️ **Bypassing RLS** - when you need unrestricted access
- ⚠️ **Bulk operations** - large data imports/exports

#### NEVER manually create clients in API routes - use the centralized clients

### Environment Variable Access

**CRITICAL**: Always use bracket notation for environment variables in Next.js:

```typescript
// ✅ CORRECT
const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];

// ❌ WRONG - will fail in production
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
```

### Direct SQL Access

```bash
# Development database
PGPASSWORD="DevPassword123!" psql -h db.iupygejzjkwyxtitescy.supabase.co -U postgres -d postgres

# Production database (use with caution)
PGPASSWORD="[PROD_PASSWORD]" psql -h db.fukdwnsvjdgyakdvtdin.supabase.co -U postgres -d postgres
```

### REST API Access

```bash
# Development API
curl "https://iupygejzjkwyxtitescy.supabase.co/rest/v1/tools" \
  -H "apikey: YOUR_DEV_ANON_KEY" \
  -H "Authorization: Bearer YOUR_DEV_ANON_KEY"

# Production API
curl "https://fukdwnsvjdgyakdvtdin.supabase.co/rest/v1/tools" \
  -H "apikey: YOUR_PROD_ANON_KEY" \
  -H "Authorization: Bearer YOUR_PROD_ANON_KEY"
```

## Database Schema

### Core Schema Files

- `database/schema-complete.sql` - Full database schema
- `database/migrations/` - Migration files for schema updates
- `docs/data/POPULATE.sql` - Seed data with research
- `database/ranking-algorithm.sql` - Ranking calculation functions

### Schema Differences Between Environments

#### Enhanced Development Schema (June 2025)

The development database includes an enhanced schema with:

```sql
-- tools table includes info JSONB column
ALTER TABLE tools ADD COLUMN info JSONB;

-- Example info structure:
{
  "company": {
    "name": "Company Name",
    "website": "https://example.com",
    "founded_date": "2020-01-01"
  },
  "product": {
    "tagline": "Product tagline",
    "description": "Detailed description",
    "pricing_model": "freemium",
    "license_type": "proprietary"
  },
  "links": {
    "website": "https://tool.com",
    "github": "https://github.com/org/repo",
    "documentation": "https://docs.tool.com"
  },
  "features": {
    "key_features": ["feature1", "feature2"],
    "languages_supported": ["python", "javascript"],
    "ide_support": ["vscode", "jetbrains"]
  },
  "metadata": {
    "logo_url": "https://logo.url"
  }
}
```

This consolidated structure improves data organization and query performance.

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
    pricing_model VARCHAR(20) CHECK (pricing_model IN ('free', 'freemium', 'paid', 'open-source', 'enterprise')),
    license_type VARCHAR(20) CHECK (license_type IN ('mit', 'apache', 'gpl', 'proprietary', 'other')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'beta', 'deprecated', 'discontinued')),
    logo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. **companies**

Companies and organizations behind the tools.

```sql
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    website_url VARCHAR(255),
    headquarters VARCHAR(100),
    founded_year INTEGER,
    company_size VARCHAR(20) CHECK (company_size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
    company_type VARCHAR(20) CHECK (company_type IN ('private', 'public', 'open-source', 'non-profit')),
    logo_url VARCHAR(500),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
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

### 4. **ranking_cache**

Pre-calculated rankings for each period.

```sql
CREATE TABLE ranking_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period VARCHAR(20) REFERENCES ranking_periods(period),
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    market_traction_score DECIMAL(5,2),
    technical_capability_score DECIMAL(5,2),
    developer_adoption_score DECIMAL(5,2),
    development_velocity_score DECIMAL(5,2),
    platform_resilience_score DECIMAL(5,2),
    community_sentiment_score DECIMAL(5,2),
    algorithm_version VARCHAR(10) REFERENCES algorithm_versions(version),
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Data Import System

### Export Tools Data

Export all current tools data for updating:

```bash
# Export all tools data to JSON
node scripts/export-tools.js
```

This creates `tools-export.json` with complete database export including:

- Tools table data
- Tool capabilities
- Pricing plans
- Companies
- Recent metrics history (30 days)

### Import Data Using JSON Files

The project includes a comprehensive data import system with schema validation:

#### 1. **Schema Definition**

Location: `data/imports/schema.json`

Defines the complete JSON schema for importing:

- Tools data
- Metrics history
- Company information
- Tool capabilities
- Pricing plans

#### 2. **Example Files**

- `data/imports/example-metrics-history.json` - Metrics data import example
- `data/imports/example-tool-details.json` - Tool information import example
- `data/imports/example-capabilities.json` - Tool capabilities import example

#### 3. **Import Script**

Location: `scripts/import-data.js`

Features:

- **Schema Validation**: Validates against JSON schema before import
- **Batch Processing**: Handles large datasets efficiently
- **Upsert Support**: Updates existing records or creates new ones
- **Error Handling**: Detailed error reporting for failed records
- **Validation Mode**: Test imports without making changes

#### 4. **Usage Examples**

```bash
# Import metrics history
node scripts/import-data.js data/imports/example-metrics-history.json

# Import tool details with validation only
node scripts/import-data.js data/imports/example-tool-details.json

# Import capabilities data
node scripts/import-data.js data/imports/example-capabilities.json
```

#### 5. **Creating Import Files**

##### Metrics History Import Format

```json
{
  "importType": "metrics_history",
  "data": [
    {
      "tool_id": "claude-code",
      "metric_key": "users",
      "value_integer": 150000,
      "recorded_at": "2025-06-10T12:00:00Z",
      "source": "company_report",
      "source_url": "https://anthropic.com/metrics",
      "notes": "Active monthly users as reported in Q2 2025"
    }
  ],
  "options": {
    "upsert": true,
    "validateOnly": false,
    "batchSize": 50
  }
}
```

##### Tool Details Import Format

```json
{
  "importType": "tools",
  "data": [
    {
      "id": "new-ai-tool",
      "name": "New AI Coding Tool",
      "slug": "new-ai-tool",
      "category": "ide-assistant",
      "description": "An innovative AI-powered coding assistant...",
      "website_url": "https://newaitool.com",
      "status": "active"
    }
  ],
  "options": {
    "upsert": true,
    "batchSize": 10
  }
}
```

### Supported Metrics

The system supports these metric types:

#### Core Metrics

- `users` - Total or monthly active users
- `monthly_arr` - Monthly Annual Recurring Revenue
- `github_stars` - GitHub repository stars
- `github_commits_last_month` - Recent development activity
- `swe_bench_score` - SWE-bench coding benchmark score
- `context_window_tokens` - AI model context window size
- `supported_languages_count` - Number of programming languages supported
- `valuation_usd` - Company valuation
- `total_funding_usd` - Total funding raised
- `employees_count` - Company employee count

#### Data Types

- **Integer values**: Use `value_integer` (e.g., users, stars, employee count)
- **Decimal values**: Use `value_decimal` (e.g., scores, revenue, funding)
- **Boolean values**: Use `value_boolean` (e.g., feature availability)
- **Complex data**: Use `value_json` (e.g., feature lists, timeline events)

## Common Queries

### Get Current Top 10 Rankings

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
LEFT JOIN companies c ON c.id = t.company_id
WHERE rc.period = (
  SELECT period FROM ranking_periods WHERE is_current = true
)
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

### Get Latest Metrics for a Tool

```sql
SELECT DISTINCT ON (metric_key)
  metric_key,
  COALESCE(value_integer, value_decimal) as value,
  recorded_at,
  source
FROM metrics_history
WHERE tool_id = 'claude-code'
ORDER BY metric_key, recorded_at DESC;
```

### Find Tools by Category with Rankings

```sql
SELECT
  t.name,
  t.slug,
  t.category,
  t.subcategory,
  COALESCE(rc.position, 999) as position,
  rc.score
FROM tools t
LEFT JOIN ranking_cache rc ON rc.tool_id = t.id
  AND rc.period = (SELECT period FROM ranking_periods WHERE is_current = true)
WHERE t.category = 'autonomous-agent'
  AND t.status = 'active'
ORDER BY COALESCE(rc.position, 999);
```

## Data Manipulation

### Adding New Tools

```sql
-- 1. Add company (if needed)
INSERT INTO companies (name, slug, website_url, company_type)
VALUES ('NewAI Corp', 'newai-corp', 'https://newai.com', 'private');

-- 2. Add tool
INSERT INTO tools (
  id, name, slug, company_id, category,
  description, website_url, status
) VALUES (
  'newai-assistant',
  'NewAI Assistant',
  'newai-assistant',
  (SELECT id FROM companies WHERE slug = 'newai-corp'),
  'ide-assistant',
  'AI-powered coding assistant',
  'https://newai.com/assistant',
  'active'
);

-- 3. Add capabilities
INSERT INTO tool_capabilities (tool_id, capability_type, value_boolean)
VALUES
  ('newai-assistant', 'autocomplete', true),
  ('newai-assistant', 'chat_interface', true),
  ('newai-assistant', 'code_generation', true);
```

### Adding Metrics Data

```sql
-- Add user count
INSERT INTO metrics_history (
  tool_id, metric_key, value_integer,
  recorded_at, source, notes
) VALUES (
  'claude-code', 'users', 200000,
  CURRENT_TIMESTAMP, 'company_report',
  'Monthly active users Q2 2025'
);

-- Add benchmark score
INSERT INTO metrics_history (
  tool_id, metric_key, value_decimal,
  recorded_at, source, source_url
) VALUES (
  'cursor', 'swe_bench_score', 85.2,
  CURRENT_TIMESTAMP, 'swe_bench',
  'https://www.swebench.com/leaderboard'
);
```

### Updating Tool Information

```sql
-- Update tool description and website
UPDATE tools
SET
  description = 'Updated comprehensive description of the tool capabilities',
  website_url = 'https://newtool.com/updated',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'tool-id';

-- Update company information
UPDATE companies
SET
  headquarters = 'San Francisco, CA',
  employee_count_min = 50,
  employee_count_max = 100,
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'company-slug';
```

## Maintenance Tasks

### 1. Database Synchronization

#### From Production to Development

```bash
# 1. Switch to development environment
./scripts/switch-env.sh dev

# 2. Export production data
./scripts/switch-env.sh prod
node scripts/export-tools.js

# 3. Switch back to development
./scripts/switch-env.sh dev

# 4. Import production data to development
node scripts/import-data.js tools-export.json
```

#### From Development to Production

```bash
# 1. Export development data
./scripts/switch-env.sh dev
node scripts/export-tools.js

# 2. Review changes carefully
cat tools-export.json | jq '.dataCount'

# 3. Switch to production (with caution)
./scripts/switch-env.sh prod

# 4. Import changes (ensure this is what you want!)
node scripts/import-data.js tools-export.json
```

### 2. Data Validation

```sql
-- Check for orphaned records
SELECT t.* FROM tools t
LEFT JOIN companies c ON c.id = t.company_id
WHERE c.id IS NULL;

-- Check for missing rankings
SELECT t.id, t.name
FROM tools t
LEFT JOIN ranking_cache rc ON rc.tool_id = t.id
  AND rc.period = (SELECT period FROM ranking_periods WHERE is_current = true)
WHERE rc.id IS NULL AND t.status = 'active';

-- Validate metrics data integrity
SELECT
  tool_id,
  metric_key,
  COUNT(*) as record_count,
  MIN(recorded_at) as earliest,
  MAX(recorded_at) as latest
FROM metrics_history
GROUP BY tool_id, metric_key
ORDER BY tool_id, metric_key;
```

### 3. Performance Monitoring

```sql
-- Check database size
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Monitor query performance
EXPLAIN ANALYZE
SELECT * FROM latest_rankings LIMIT 10;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### 4. Backup Procedures

```bash
# Development database backup
./scripts/switch-env.sh dev
pg_dump "postgresql://postgres:DevPassword123!@db.gqucazglcjgvnzycwwia.supabase.co:5432/postgres" > dev-backup-$(date +%Y%m%d).sql

# Production database backup (via Supabase dashboard recommended)
# Or using CLI with proper credentials
```

## Troubleshooting

### Database Access Issues (COMMON PROBLEMS)

#### Problem: "Invalid API key" or "Failed to fetch"

**SOLUTION**: Use the centralized database client, not manual client creation:

```typescript
// ❌ WRONG - causes "Invalid API key" errors
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(url, serviceRoleKey);

// ✅ CORRECT - use centralized client
import { supabase } from "@/lib/database";
```

**Why this happens**: Manual client creation often uses wrong keys or fails environment variable access.

#### Problem: "Categories showing as null" or missing data

**SOLUTION**: Restart the Next.js dev server after environment changes:

```bash
# Kill existing server
kill $(lsof -ti:3000)

# Restart
npm run dev
```

**Why this happens**: Environment variables are cached, new connections need fresh env vars.

#### Problem: "Service role key not working"

**SOLUTION**: Use anon key client for 99% of operations:

```typescript
// ❌ Most operations don't need admin access
import { supabaseAdmin } from "@/lib/database";

// ✅ Use regular client for API routes
import { supabase } from "@/lib/database";
```

**Why this happens**: Our database permissions allow anon key access to most tables.

#### Problem: "Environment variables undefined"

**SOLUTION**: Use bracket notation:

```typescript
// ❌ WRONG - fails in production
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

// ✅ CORRECT - works everywhere
const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
```

### Environment Issues

#### Problem: "Can't connect to database"

```bash
# Check current environment
./scripts/switch-env.sh status

# Verify environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Test connection
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

#### Problem: "Wrong database - seeing unexpected data"

```bash
# Check which environment you're in
./scripts/switch-env.sh status

# Switch to correct environment
./scripts/switch-env.sh dev  # or prod
```

### Import Issues

#### Problem: "Schema validation failed"

```bash
# Run validation only mode first
node scripts/import-data.js data/imports/your-file.json

# Check the example files for correct format
cat data/imports/example-metrics-history.json
```

#### Problem: "Duplicate key error"

```bash
# Use upsert mode to update existing records
# Ensure your JSON has "upsert": true in options
```

#### Problem: "Foreign key constraint violation"

```bash
# Ensure referenced records exist first
# For tools: company_id must exist in companies table
# For metrics: tool_id must exist in tools table
```

### Common Database Issues

#### 1. "relation does not exist"

The schema hasn't been created. Run the schema creation:

```sql
-- Run contents of database/schema-complete.sql
```

#### 2. "permission denied"

Use the service role key for admin operations:

```typescript
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
```

#### 3. Connection timeouts

Check network access and correct database URL:

```bash
# Test basic connectivity
ping db.gqucazglcjgvnzycwwia.supabase.co
```

## Best Practices

### Development Workflow

1. **Always work in development first**

   ```bash
   ./scripts/switch-env.sh dev
   ```

2. **Test imports with validation mode**

   ```bash
   node scripts/import-data.js --validate-only your-file.json
   ```

3. **Keep environments synchronized**

   - Export production data periodically to development
   - Test all changes in development before production

4. **Use version control for schema changes**
   - Keep migration files in `database/migrations/`
   - Document all manual database changes

### Data Management

1. **Use appropriate value columns**

   - `value_integer` for whole numbers (users, stars)
   - `value_decimal` for precise numbers (scores, money)
   - `value_boolean` for yes/no values
   - `value_json` for complex data structures

2. **Include source attribution**

   - Always specify `source` for metrics
   - Include `source_url` when available
   - Add `notes` for context

3. **Maintain data quality**
   - Validate data before import
   - Use consistent naming conventions
   - Regular data integrity checks

### Security

1. **Environment separation**

   - Never test destructive operations on production
   - Use development environment for all experiments
   - Keep production credentials secure

2. **Access control**
   - Use anon key for client-side operations
   - Use service role key only for admin operations
   - Monitor database access logs

## Database Migration Strategies

### Production to Development Migration

When migrating data between databases with different schemas:

#### 1. Handle Foreign Key Constraints

```typescript
// Option A: Drop constraints temporarily
ALTER TABLE tools DROP CONSTRAINT IF EXISTS tools_company_id_fkey;
// ... perform migration ...
ALTER TABLE tools ADD CONSTRAINT tools_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id);

// Option B: Use upsert with proper ordering
// 1. Migrate referenced tables first (companies)
// 2. Then migrate dependent tables (tools)
// 3. Finally migrate junction/history tables
```

#### 2. Schema Transformation

When migrating to enhanced schema (e.g., adding `info` field):

```typescript
// Transform data during migration
const toolsWithInfo = prodTools.map((tool) => ({
  ...tool,
  info: {
    company: {
      name: tool.name,
      website: tool.website_url,
      founded_date: tool.founded_date,
    },
    product: {
      tagline: tool.tagline,
      description: tool.description,
      pricing_model: tool.pricing_model,
      license_type: tool.license_type,
    },
    links: {
      website: tool.website_url,
      github: tool.github_repo,
    },
    metadata: {
      logo_url: tool.logo_url,
    },
  },
}));
```

#### 3. Handling Duplicate Keys

```typescript
// Use upsert to handle existing records
const { error } = await supabase.from("table_name").upsert(data, { onConflict: "id" });

// For unique constraints on multiple columns
const { error } = await supabase
  .from("metrics_history")
  .upsert(data, { onConflict: "tool_id,metric_key,recorded_at" });
```

### Migration Scripts

Example migration scripts are available in `/scripts/`:

- `migrate-prod-to-dev.ts` - Basic migration
- `migrate-with-constraints.ts` - Advanced migration with constraint handling
- `compare-databases.ts` - Compare data between environments
- `check-schemas.ts` - Verify schema differences

### Best Practices for Migration

1. **Always backup before migration**

   ```bash
   pg_dump "postgresql://..." > backup-$(date +%Y%m%d).sql
   ```

2. **Test migrations with small datasets first**

   ```typescript
   const testBatch = data.slice(0, 10);
   // Test with small batch before full migration
   ```

3. **Use transactions for critical operations**

   ```sql
   BEGIN;
   -- migration operations
   COMMIT; -- or ROLLBACK if issues
   ```

4. **Monitor for orphaned records**
   ```sql
   SELECT t.* FROM tools t
   LEFT JOIN companies c ON c.id = t.company_id
   WHERE c.id IS NULL;
   ```

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- **Project Files**:
  - Schema: `database/schema-complete.sql`
  - Import Examples: `data/imports/`
  - Scripts: `scripts/`
  - Environment Management: `scripts/switch-env.sh`

## Quick Reference

### Environment Commands

```bash
./scripts/switch-env.sh dev     # Switch to development
./scripts/switch-env.sh prod    # Switch to production
./scripts/switch-env.sh status  # Check current environment
```

### Data Operations

```bash
node scripts/export-tools.js                    # Export all data
node scripts/import-data.js <file.json>         # Import data
node scripts/import-data.js --validate <file>   # Validate only
```

### Database URLs

- **Development**: `https://gqucazglcjgvnzycwwia.supabase.co`
- **Production**: `https://fukdwnsvjdgyakdvtdin.supabase.co`
