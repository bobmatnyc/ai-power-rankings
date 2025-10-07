# Database Schema Comparison Guide

## Overview

This guide documents how to compare production and development database schemas, identify differences, and safely synchronize schema changes between environments.

## Database Configuration

### Environment Variables

The application uses different database URLs based on environment:

```bash
# Development (local)
DATABASE_URL_DEVELOPMENT=postgresql://...  # Primary dev database
DATABASE_URL=postgresql://...              # Fallback

# Production (Vercel)
DATABASE_URL=postgresql://...              # Production database

# For schema comparison
PROD_DATABASE_URL=postgresql://...         # Optional, for comparison script
```

### Database Branching Strategy

- **Development**: Uses `DATABASE_URL_DEVELOPMENT` (falls back to `DATABASE_URL`)
- **Production**: Always uses `DATABASE_URL`
- **Staging**: Uses `DATABASE_URL_STAGING` (if configured)

Configuration in: `/Users/masa/Projects/managed/aipowerranking/lib/db/connection.ts`

## Current Schema Status

### Migration Journal

Location: `/Users/masa/Projects/managed/aipowerranking/lib/db/migrations/meta/_journal.json`

Applied migrations:
1. **0000_oval_manta** (Base schema)
   - Tables: tools, rankings, news, companies, migrations

2. **0001_easy_mesmero** (Article management)
   - Tables: articles, article_rankings_changes, article_processing_logs
   - Note: `ranking_versions` table defined in schema but **NOT** in migration

3. **0002_add_user_preferences** (User preferences - deprecated)
   - Status: User preferences moved to Clerk privateMetadata
   - This migration may need to be removed/rolled back

4. **0003_add_scoring_columns** (Scoring system)
   - Adds to tools table: baseline_score, delta_score, current_score, score_updated_at
   - Created: 2025-10-01

### Schema Files

- **Main schema**: `/Users/masa/Projects/managed/aipowerranking/lib/db/schema.ts`
  - Core tables: tools, rankings, news, companies, migrations
  - Note: User preferences table commented out (moved to Clerk)

- **Article schema**: `/Users/masa/Projects/managed/aipowerranking/lib/db/article-schema.ts`
  - Article management tables: articles, article_rankings_changes, article_processing_logs
  - **WARNING**: Defines `ranking_versions` table but no migration exists for it

## Schema Comparison Tools

### 1. Compare Production vs Development Schemas

**Command:**
```bash
npm run db:compare
# or
tsx scripts/compare-db-schemas.ts
```

**What it does:**
- Connects to both production and development databases
- Compares all tables, columns, indexes, and constraints
- Identifies schema differences
- Shows migration status in both environments
- Provides recommendations for schema synchronization

**Prerequisites:**
- Set `PROD_DATABASE_URL` in `.env.local` (or uses `DATABASE_URL`)
- Set `DATABASE_URL_DEVELOPMENT` in `.env.local`

**Output includes:**
- Tables only in production
- Tables only in development
- Column differences (by table)
- Index differences (by table)
- Migration status comparison
- Critical missing schema elements
- Recommended actions

### 2. Verify Tools Table Schema

**Command:**
```bash
npm run db:verify-tools
# or
tsx scripts/verify-tools-schema.ts
```

**What it does:**
- Checks if tools table has all required columns
- Specifically verifies scoring columns
- Shows complete column listing with types

**Use when:**
- Verifying scoring migration was applied
- Debugging schema issues

### 3. Apply Scoring Migration

**Command:**
```bash
npm run db:apply-scoring
# or
tsx scripts/apply-scoring-migration.ts
```

**What it does:**
- Reads migration file: `0003_add_scoring_columns.sql`
- Applies ALTER TABLE statements to add scoring columns
- Verifies columns were created successfully
- Safe to run multiple times (skips if columns exist)

**Use when:**
- Production database is missing scoring columns
- After creating new database branch

## Identified Schema Differences

### Critical Differences (Likely)

1. **Scoring Columns in `tools` table**
   - Migration `0003_add_scoring_columns` created on 2025-10-01
   - May not be applied to production yet
   - Columns: baseline_score, delta_score, current_score, score_updated_at

2. **Missing `ranking_versions` table**
   - Defined in `article-schema.ts`
   - **No migration file exists for this table**
   - Used for: Complete ranking snapshot versioning and rollback
   - Status: This table needs a migration to be created

3. **User Preferences Migration**
   - Migration `0002_add_user_preferences` may exist in DB
   - User preferences moved to Clerk (schema comments indicate this)
   - This migration may need rollback/cleanup

### Potential Differences

These depend on when production database was last updated:

- Article management tables (if production doesn't have migration 0001)
  - articles
  - article_rankings_changes
  - article_processing_logs

## Migration Application Strategy

### For Production Database

**IMPORTANT**: Always test in development first, then backup production before applying.

#### Step 1: Compare Schemas
```bash
npm run db:compare
```

Review the output to understand all differences.

#### Step 2: Backup Production Data
```bash
# This script copies prod to dev, can be adapted for backup
npm run migrate:prod-to-dev
```

#### Step 3: Apply Missing Migrations

**Option A: Manual SQL Application** (Recommended for production)
1. Connect to production database via Neon console or psql
2. Apply migration SQL files manually in order:
   - If missing: `lib/db/migrations/0001_easy_mesmero.sql` (articles)
   - If missing: `lib/db/migrations/0003_add_scoring_columns.sql` (scoring)

**Option B: Use Migration Scripts** (Test in staging first)
```bash
# For scoring columns specifically
PROD_DATABASE_URL=your_prod_url tsx scripts/apply-scoring-migration.ts

# For general schema verification
PROD_DATABASE_URL=your_prod_url tsx scripts/verify-tools-schema.ts
```

#### Step 4: Create Missing Table Migration

The `ranking_versions` table needs a migration file created:

```bash
# After adding to schema (already done), generate migration:
# Note: This requires drizzle-kit installed
npx drizzle-kit generate:pg
```

### Recommended Migration Order

1. ✅ Base schema (0000) - Already applied
2. ✅ Article tables (0001) - Verify if applied to prod
3. ⚠️ User preferences (0002) - Consider removal (deprecated)
4. 🔄 Scoring columns (0003) - Apply to prod if missing
5. ❌ Ranking versions - **Needs migration file creation**

## Safety Checklist

Before applying migrations to production:

- [ ] Ran `npm run db:compare` to identify all differences
- [ ] Backed up production database (Neon provides automatic backups)
- [ ] Tested migration in development environment
- [ ] Tested migration in staging environment (if available)
- [ ] Verified application still works after migration in dev
- [ ] Reviewed migration SQL for any destructive operations
- [ ] Scheduled maintenance window (if needed)
- [ ] Have rollback plan ready
- [ ] Notified team of database changes

## Risks and Precautions

### High Risk Operations

❌ **NEVER DO THESE WITHOUT BACKUP:**
- DROP TABLE statements
- DROP COLUMN statements
- ALTER COLUMN with TYPE change (data loss risk)
- DELETE or TRUNCATE operations

### Low Risk Operations

✅ **Generally safe:**
- ADD COLUMN (especially with DEFAULT)
- CREATE INDEX
- CREATE TABLE (new tables)
- ADD CONSTRAINT (if data already valid)

### Current Migration Risk Assessment

**0003_add_scoring_columns.sql**: ✅ **LOW RISK**
- Only adds columns with defaults
- Non-destructive
- No data loss possible
- Safe to apply to production

**Missing ranking_versions table**: ⚠️ **MEDIUM RISK**
- Table doesn't exist in prod or dev yet
- Need to generate proper migration
- No foreign key dependencies yet
- Safe to add, but must be done correctly

## Accessing Production Database

### Via Neon Console
1. Go to https://console.neon.tech
2. Select your production project
3. Use SQL Editor for manual queries

### Via psql (Command Line)
```bash
# Set environment variable or use direct URL
export DATABASE_URL="your_production_url"
psql $DATABASE_URL
```

### Via Code Scripts
```bash
# Set PROD_DATABASE_URL in .env.local
PROD_DATABASE_URL=your_prod_url tsx scripts/compare-db-schemas.ts
```

## Common Issues and Solutions

### Issue: "Column already exists" error
**Solution**: Migration already applied. Use `npm run db:verify-tools` to confirm.

### Issue: "Table not found" error
**Solution**: Check which migrations have been applied. Use `npm run db:compare`.

### Issue: Migrations table doesn't exist
**Solution**: Run base migration (0000) first. This initializes the migrations tracking table.

### Issue: Schema drift between prod and dev
**Solution**:
1. Run `npm run db:compare` to identify differences
2. Apply missing migrations in order
3. Consider using `npm run migrate:prod-to-dev` to sync data

## Monitoring Schema Changes

### During Development

When schema changes are needed:

1. Update schema files (`schema.ts` or `article-schema.ts`)
2. Generate migration: `npx drizzle-kit generate:pg`
3. Review generated SQL in `lib/db/migrations/`
4. Test migration in development
5. Apply to production when ready
6. Update this documentation

### Post-Deployment

After deploying schema changes:

1. Run `npm run db:compare` to verify sync
2. Check Vercel deployment logs for errors
3. Monitor application for schema-related errors
4. Verify new features using new schema work correctly

## Current Action Items

Based on analysis as of 2025-10-01:

1. **HIGH PRIORITY**: Compare prod vs dev schemas
   - Run: `npm run db:compare`
   - Identify actual differences (not assumptions)

2. **HIGH PRIORITY**: Apply scoring columns to production (if missing)
   - Verify dev has columns: `npm run db:verify-tools`
   - Apply to prod: Set PROD_DATABASE_URL and run migration script

3. **MEDIUM PRIORITY**: Create migration for ranking_versions table
   - Currently defined in schema but no migration exists
   - Will cause issues when this table is first used
   - Generate migration: `npx drizzle-kit generate:pg`

4. **LOW PRIORITY**: Clean up user preferences migration
   - Migration 0002 may exist but feature moved to Clerk
   - Consider documenting deprecation
   - No urgency as it doesn't break anything

## Additional Resources

- **Drizzle ORM Docs**: https://orm.drizzle.team/
- **Neon Database Docs**: https://neon.tech/docs
- **Migration Files**: `/Users/masa/Projects/managed/aipowerranking/lib/db/migrations/`
- **Schema Files**: `/Users/masa/Projects/managed/aipowerranking/lib/db/`

## Database Scripts Summary

| Script | Command | Purpose |
|--------|---------|---------|
| Compare Schemas | `npm run db:compare` | Compare prod vs dev schemas |
| Verify Tools Schema | `npm run db:verify-tools` | Check tools table structure |
| Apply Scoring Migration | `npm run db:apply-scoring` | Add scoring columns to tools |
| Migrate Prod to Dev | `npm run migrate:prod-to-dev` | Copy all data from prod to dev |

## Notes

- This project uses **Neon Serverless Postgres**
- Connection pooling enabled for production/staging
- HTTP mode (no pooling) for development
- Schema changes should be backward compatible when possible
- Always test migrations in dev before production
