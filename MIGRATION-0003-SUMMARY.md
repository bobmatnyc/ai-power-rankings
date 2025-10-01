# Migration 0003: Add Scoring Columns to Tools Table

## Summary
Successfully added missing scoring columns to the `tools` table to support baseline and delta score tracking functionality.

## Problem Identified
- **Root Cause**: Schema drift - columns were defined in `lib/db/schema.ts` but never migrated to the database
- **Missing Columns**: `baseline_score`, `delta_score`, `current_score`, `score_updated_at`
- **Impact**: Tool scoring functionality was not operational due to missing database columns

## Fixes Applied

### 1. Drizzle Config Fix
**File**: `drizzle.config.ts`
**Change**: Updated output directory from `./drizzle` to `./lib/db/migrations`
```typescript
// Before
out: "./drizzle"

// After
out: "./lib/db/migrations"
```

### 2. Migration Created
**File**: `lib/db/migrations/0003_add_scoring_columns.sql`

Added 4 columns to the `tools` table:
- `baseline_score` (jsonb, default: '{}') - Stores baseline scores per factor
- `delta_score` (jsonb, default: '{}') - Stores delta modifications per factor  
- `current_score` (jsonb, default: '{}') - Cached current score calculation
- `score_updated_at` (timestamp, nullable) - Last score recalculation timestamp

### 3. Migration Scripts Created

**Apply Migration**: `scripts/apply-scoring-migration.ts`
- Reads migration SQL file
- Parses and executes ALTER TABLE statements
- Verifies columns were added successfully
- Handles duplicate column errors gracefully

**Verify Schema**: `scripts/verify-tools-schema.ts`
- Lists all columns in tools table
- Highlights scoring columns
- Confirms all required columns are present

### 4. Migration Journal Updated
**File**: `lib/db/migrations/meta/_journal.json`
- Added entry for migration 0003

## Verification Results

All 4 scoring columns successfully added to production database:

```
🎯 13. baseline_score       jsonb      nullable  default: '{}'::jsonb
🎯 14. delta_score          jsonb      nullable  default: '{}'::jsonb
🎯 15. current_score        jsonb      nullable  default: '{}'::jsonb
🎯 16. score_updated_at     timestamp  nullable
```

## Commands Executed

```bash
# Apply the migration
npx tsx scripts/apply-scoring-migration.ts

# Verify schema
npx tsx scripts/verify-tools-schema.ts
```

## Files Modified
- `drizzle.config.ts` - Fixed output directory path
- `lib/db/migrations/meta/_journal.json` - Added migration entry

## Files Created
- `lib/db/migrations/0003_add_scoring_columns.sql` - Migration SQL
- `scripts/apply-scoring-migration.ts` - Migration application script
- `scripts/verify-tools-schema.ts` - Schema verification script

## Next Steps
The scoring columns are now ready for use. The tool ranking system can now:
1. Store baseline scores for each tool
2. Track delta modifications from news/events
3. Calculate and cache current scores
4. Monitor when scores were last updated

## LOC Impact
- **Files Modified**: 2 files (config fix + journal update)
- **Files Created**: 3 files (1 migration SQL, 2 utility scripts)
- **Net LOC**: +140 lines (migration infrastructure for future use)
