# Database Schema Management Scripts

Quick reference guide for database schema comparison and migration scripts.

## Quick Commands

```bash
# Compare production and development schemas
npm run db:compare

# Verify tools table has scoring columns
npm run db:verify-tools

# Verify monthly_summaries table and data
npm run db:verify-summaries

# Apply scoring columns migration to current DB
npm run db:apply-scoring

# Apply monthly_summaries table migration
npm run db:apply-summaries

# Copy all data from production to development
npm run migrate:prod-to-dev
```

## Setup Requirements

### Environment Variables (.env.local)

```bash
# Required for all scripts
DATABASE_URL_DEVELOPMENT=postgresql://user:pass@host/db  # Your dev database
DATABASE_URL=postgresql://user:pass@host/db              # Fallback/prod

# Required for comparison script
PROD_DATABASE_URL=postgresql://user:pass@host/db         # Production database

# For Vercel production access
# Set in Vercel dashboard: Settings > Environment Variables
DATABASE_URL=postgresql://user:pass@host/db              # Production
```

## Script Details

### 1. `npm run db:compare`

**File**: `scripts/compare-db-schemas.ts`

**Purpose**: Compare production and development database schemas

**What it compares**:
- All tables in both databases
- All columns for common tables (name, type, nullable, defaults)
- All indexes for common tables (name, columns, type, unique)
- Migration records in migrations table

**Output**:
- Tables only in production
- Tables only in development
- Column differences by table
- Index differences by table
- Migration status in both databases
- Recommendations for sync

**Use cases**:
- Before deploying schema changes
- After creating new migrations
- Diagnosing production issues
- Planning migration strategy

**Example output**:
```
========================================
     DATABASE SCHEMA COMPARISON
========================================

⚠️  Tables ONLY in Development:
   - ranking_versions

🔧 Column Differences:

   tools:
      Columns only in DEVELOPMENT:
         - baseline_score (jsonb)
         - delta_score (jsonb)
         - current_score (jsonb)
         - score_updated_at (timestamp)

========================================
        MIGRATION RECOMMENDATIONS
========================================

⚠️  CRITICAL: Production is missing scoring columns in 'tools' table:
   - baseline_score (jsonb)
   - delta_score (jsonb)
   - current_score (jsonb)
   - score_updated_at (timestamp)

   📝 Apply migration: npm run db:apply-scoring
```

---

### 2. `npm run db:verify-tools`

**File**: `scripts/verify-tools-schema.ts`

**Purpose**: Verify tools table structure and scoring columns

**What it checks**:
- All columns in tools table
- Specifically highlights scoring columns
- Column types, nullability, and defaults

**Use cases**:
- After applying scoring migration
- Debugging tools table issues
- Verifying schema matches code expectations

**Example output**:
```
🔍 Verifying tools table schema...

📋 Tools table has 17 columns:

   1. id                 uuid                      not null default: gen_random_uuid()
   2. slug               text                      not null
   3. name               text                      not null
   4. category           text                      not null
   5. status             text                      not null default: 'active'
🎯 6. baseline_score      jsonb                     nullable default: '{}'
🎯 7. delta_score         jsonb                     nullable default: '{}'
🎯 8. current_score       jsonb                     nullable default: '{}'
🎯 9. score_updated_at    timestamp                 nullable

✅ All 4 scoring columns present in database
```

---

### 3. `npm run db:apply-scoring`

**File**: `scripts/apply-scoring-migration.ts`

**Purpose**: Apply scoring columns migration (0003_add_scoring_columns)

**What it does**:
- Reads migration SQL file
- Parses and executes ALTER TABLE statements
- Adds 4 scoring columns to tools table
- Verifies columns were created
- Safe to run multiple times (skips if exists)

**Columns added**:
- `baseline_score` (jsonb) - Baseline scores per factor
- `delta_score` (jsonb) - Delta modifications per factor
- `current_score` (jsonb) - Cached current score
- `score_updated_at` (timestamp) - Last score recalculation time

**Use cases**:
- Applying migration to production
- Setting up new database branch
- After fresh database creation

**Safety**: ✅ **LOW RISK**
- Only adds columns with defaults
- Non-destructive
- No data loss possible
- Idempotent (safe to re-run)

**Example output**:
```
🚀 Starting scoring columns migration...

📍 Using database: ep-wispy-fog-ad8d4skz-pooler.c-2.us-east-1.aws.neon.tech
📄 Reading migration file: .../lib/db/migrations/0003_add_scoring_columns.sql

📝 Found 4 SQL statements to execute

⚙️  Executing statement 1/4...
   ALTER TABLE "tools" ADD COLUMN "baseline_score" jsonb DEFAULT '{}'
✅ Statement 1 executed successfully

🔍 Verifying columns were added...

✅ All scoring columns verified in database:
   - baseline_score: jsonb (default: '{}'::jsonb)
   - current_score: jsonb (default: '{}'::jsonb)
   - delta_score: jsonb (default: '{}'::jsonb)
   - score_updated_at: timestamp without time zone

🎉 Migration completed successfully!
```

---

### 4. `npm run migrate:prod-to-dev`

**File**: `scripts/migrate-prod-to-dev.ts`

**Purpose**: Copy all data from production to development database

**What it copies**:
- All records from all tables
- Uses upsert (INSERT ... ON CONFLICT DO UPDATE)
- Processes in batches of 100 records

**Tables migrated** (in order):
1. companies
2. tools
3. rankings
4. news
5. articles
6. article_rankings_changes
7. article_processing_logs
8. ranking_versions

**Use cases**:
- Syncing development data with production
- Creating backups
- Testing migrations with real data
- Debugging production issues locally

**Safety**: ⚠️ **OVERWRITES DEVELOPMENT DATA**
- Does not affect production (read-only)
- Overwrites development database records
- Backup dev data first if needed

**Example output**:
```
========================================
   Production to Development Migration
========================================

Starting migration for table: tools
Found 45 records in production tools
  Progress: 100% (45/45)
Completed tools: 45 records processed in 2.34s

========================================
           Migration Summary
========================================

Table                    Source  Target  Target  Processed  Errors  Duration
                         Records Before  After                      (s)
─────────────────────────────────────────────────────────────────────────────
tools                    45      40      45      45         0       2.34
rankings                 12      10      12      12         0       0.89
news                     234     200     234     234        0       8.45
articles                 15      10      15      15         0       1.23

Total records processed: 306
Total errors: 0
Total duration: 12.91s
```

## Common Workflows

### Before Deploying to Production

```bash
# 1. Verify dev schema is correct
npm run db:verify-tools

# 2. Compare with production
npm run db:compare

# 3. Review differences and plan migration

# 4. Apply migrations to production (if needed)
# Set PROD_DATABASE_URL in .env.local
PROD_DATABASE_URL=your_prod_url npm run db:apply-scoring
```

### After Creating New Migration

```bash
# 1. Apply migration to dev database
npm run db:apply-scoring  # or relevant migration script

# 2. Verify schema
npm run db:verify-tools

# 3. Compare with production
npm run db:compare

# 4. Document the changes
```

### Debugging Production Issues

```bash
# 1. Compare schemas
npm run db:compare

# 2. Copy production data to dev for testing
npm run migrate:prod-to-dev

# 3. Test locally with production data
npm run dev

# 4. Investigate differences
```

### Setting Up New Development Environment

```bash
# 1. Copy data from production
npm run migrate:prod-to-dev

# 2. Verify schema matches
npm run db:compare

# 3. Apply any missing migrations
npm run db:apply-scoring  # if needed
```

## Troubleshooting

### "Database URL not found"

**Problem**: Script can't find database connection string

**Solution**:
1. Check `.env.local` exists in project root
2. Verify environment variable names:
   - `DATABASE_URL_DEVELOPMENT` for dev
   - `PROD_DATABASE_URL` for prod comparison
   - `DATABASE_URL` as fallback
3. Ensure URLs don't contain placeholder text like "YOUR_PASSWORD"

### "Column already exists"

**Problem**: Migration script finds column already created

**Result**: ✅ This is normal behavior
- Script skips the statement
- Continues with next statement
- Safe to ignore

### "Table not found"

**Problem**: Schema comparison finds table missing

**Solution**:
1. Check which migration creates the table
2. Apply that migration to the database
3. Verify with `npm run db:compare`

### "Connection timeout"

**Problem**: Can't connect to database

**Solution**:
1. Check database is running (Neon dashboard)
2. Verify URL format is correct
3. Check firewall/network settings
4. Try connecting via Neon console first

### "Permission denied"

**Problem**: Database user lacks permissions

**Solution**:
1. Verify using correct credentials
2. Check user has ALTER TABLE permissions
3. For production, may need admin access

## Migration File Locations

```
lib/db/migrations/
├── meta/
│   └── _journal.json                  # Migration tracking
├── 0000_oval_manta.sql                # Base schema
├── 0001_easy_mesmero.sql              # Article management
├── 0002_add_user_preferences.sql      # User prefs (deprecated)
├── 0003_add_scoring_columns.sql       # Scoring system
├── 0004_ranking_versions.sql          # Ranking versions
├── 0005_add_article_url_to_rankings_changes.sql
├── 0006_add_timestamp_indexes.sql     # Performance indexes
└── 0007_add_monthly_summaries.sql     # What's New summaries (NEW)
```

## Schema File Locations

```
lib/db/
├── connection.ts                   # Database connection logic
├── schema.ts                       # Main schema (tools, news, rankings)
└── article-schema.ts               # Article management schema
```

## Next Steps

1. **Run comparison**: `npm run db:compare` to see current state
2. **Review output**: Identify critical differences
3. **Plan migration**: Decide which changes to apply to production
4. **Test in dev**: Apply and verify in development first
5. **Apply to prod**: When ready, apply to production with backups

## Additional Resources

- **Full Documentation**: See `DATABASE_SCHEMA_COMPARISON.md`
- **Drizzle ORM**: https://orm.drizzle.team/
- **Neon Database**: https://neon.tech/docs
- **Migration Guide**: See main documentation file
