# Payload CMS Migration Scripts

This directory contains scripts for migrating data from Supabase to Payload CMS.

## Scripts

### 1. `migrate-to-payload.ts`
Main migration script that transfers data from Supabase to Payload CMS.

**Usage:**
```bash
pnpm tsx scripts/payload-migration/migrate-to-payload.ts
```

**What it migrates:**
- Companies (with parent relationships)
- Tools (with company relationships)
- Recent metrics (5000 most recent by default)
- Rankings history
- Preserves all Supabase IDs for reference

### 2. `validate-migration.ts`
Validates the migrated data to ensure integrity.

**Usage:**
```bash
pnpm tsx scripts/payload-migration/validate-migration.ts
```

**What it validates:**
- Record counts match between systems
- All relationships are preserved
- No orphaned records
- Generates a detailed report in `validation-report.json`

### 3. `clear-payload-data.ts`
⚠️ **DANGER**: Clears all data from Payload CMS collections.

**Usage:**
```bash
pnpm tsx scripts/payload-migration/clear-payload-data.ts
```

## Migration Process

1. **Test Migration**
   ```bash
   # Clear any existing test data
   pnpm tsx scripts/payload-migration/clear-payload-data.ts
   
   # Run the migration
   pnpm tsx scripts/payload-migration/migrate-to-payload.ts
   
   # Validate the results
   pnpm tsx scripts/payload-migration/validate-migration.ts
   ```

2. **Review Results**
   - Check the console output for any errors
   - Review `validation-report.json` for detailed validation results
   - Access Payload admin at `http://localhost:3000/admin` to verify data

3. **Production Migration**
   - Ensure all environment variables are set correctly
   - Run migration during low-traffic period
   - Keep the original Supabase data intact (no deletions)
   - Run validation immediately after migration

## Environment Requirements

The scripts require the following environment variables:
- `PAYLOAD_SECRET`
- `SUPABASE_DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Notes

- The migration preserves all Supabase IDs in special fields (e.g., `supabase_tool_id`)
- Parent-child relationships are migrated in two passes to handle circular dependencies
- Metrics migration is limited to recent records by default (configurable)
- All rich text content is converted to Lexical format
- The migration is idempotent - running it multiple times won't create duplicates

## Troubleshooting

### Common Issues

1. **Connection errors**
   - Verify database URLs and credentials
   - Ensure Payload server is running

2. **Relationship errors**
   - Companies must be migrated before tools
   - Parent companies are updated in a second pass

3. **Memory issues**
   - Reduce the metrics limit if needed
   - Run collections separately if necessary

### Logs

All errors are logged to console with details. The validation report provides a comprehensive overview of any issues.