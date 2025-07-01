# JSON Database Migration Scripts

This directory contains scripts for migrating from Payload CMS to JSON database files as part of Epic EP-001.

## Scripts Overview

### 1. `migrate-to-json.ts`
Main migration script that exports data from Payload CMS and transforms it to JSON format.

**Features:**
- Migrates companies, tools, rankings, and news data
- Maintains relationships between collections
- Creates automatic backups before migration
- Progress tracking and error reporting
- Comprehensive data transformation

**Usage:**
```bash
npm run json:migrate
```

### 2. `validate-migration.ts`
Validation script to verify migration integrity and completeness.

**Features:**
- Compares Payload data with JSON data
- Validates record counts and data integrity
- Checks for missing records and data mismatches
- Generates detailed validation report
- Verifies relationships and factor scores

**Usage:**
```bash
npm run json:validate
```

### 3. `rollback-migration.ts`
Rollback mechanism for migration recovery.

**Features:**
- Interactive backup selection
- Pre-rollback backup creation
- Selective collection rollback
- Safety confirmations
- List available backups

**Usage:**
```bash
# Interactive rollback
npm run json:rollback

# List available backups
npm run json:rollback:list

# Clear all JSON data (dangerous)
npm run json:rollback:clear

# Rollback from specific backup
tsx scripts/json-migration/rollback-migration.ts rollback /path/to/backup
```

## Migration Process

### Phase 1: Preparation
1. Ensure all repositories are initialized
2. Verify Payload CMS connectivity
3. Create pre-migration backup

### Phase 2: Data Migration
1. **Companies** - Migrated first (no dependencies)
2. **Tools** - Migrated second (depends on companies)
3. **Rankings** - Migrated third (depends on tools)
4. **News** - Migrated last (depends on tools)

### Phase 3: Validation
1. Compare record counts
2. Validate data integrity
3. Check relationships
4. Verify factor scores and calculations

### Phase 4: Verification
1. Run validation script
2. Review migration report
3. Test repository functionality
4. Verify API compatibility

## Data Transformation

### Companies
- `website_url` → `website`
- `founded_year` → `founded` (string)
- `company_size` → `size`
- Add `created_at`/`updated_at` timestamps

### Tools
- Flatten nested structure into `info` object
- Separate `technical`, `business`, `metrics` sections
- Convert `programming_languages` → `languages`
- Maintain company relationships via `company_id`

### Rankings
- Group by ranking period
- Convert factor scores to structured format
- Calculate movement data
- Preserve algorithm versioning
- Handle multiple rankings per period

### News
- Extract text content from Lexical editor format
- Convert `related_tools` to `tool_mentions` array
- Preserve publication dates and metadata
- Handle rich text content conversion

## File Structure

```
data/json/
├── companies/
│   └── companies.json
├── tools/
│   └── tools.json
├── rankings/
│   ├── index.json
│   └── periods/
│       ├── 2025-06.json
│       └── 2025-05.json
├── news/
│   └── news.json
├── backups/
│   ├── pre-migration/
│   └── pre-rollback-{timestamp}/
├── schema/
│   └── v1/
│       └── schema.json
└── migration-results.json
```

## Error Handling

### Migration Errors
- Individual record failures don't stop migration
- All errors are logged and reported
- Failed records are listed in migration results
- Backups allow for recovery

### Validation Errors
- Missing records are identified
- Data mismatches are flagged
- Relationship integrity is verified
- Detailed error reports generated

### Rollback Safety
- Automatic pre-rollback backups
- Confirmation prompts for destructive operations
- Selective collection rollback
- Backup integrity verification

## Monitoring and Logging

All scripts use structured logging with:
- Operation progress tracking
- Error details and context
- Performance metrics
- File operation logs
- Backup creation confirmation

## Environment Requirements

- Node.js with TypeScript support
- Payload CMS database connection
- Write permissions to `data/json/` directory
- Sufficient disk space for backups

## Troubleshooting

### Common Issues

1. **Connection Errors**
   - Verify Payload CMS configuration
   - Check database connection
   - Ensure environment variables are set

2. **Permission Errors**
   - Check file system permissions
   - Ensure backup directory is writable
   - Verify TypeScript compilation

3. **Data Issues**
   - Review validation report
   - Check for missing relationships
   - Verify schema compatibility

4. **Memory Issues**
   - Large datasets may require streaming
   - Monitor Node.js memory usage
   - Consider batch processing

### Recovery Procedures

1. **Failed Migration**
   - Use rollback script to restore pre-migration state
   - Review error logs for specific issues
   - Fix issues and retry migration

2. **Validation Failures**
   - Check validation report for specific issues
   - Re-run migration for affected collections
   - Verify data transformation logic

3. **Corrupted Data**
   - Use most recent backup for rollback
   - Clear JSON data and re-migrate
   - Verify backup integrity

## Performance Considerations

- Migration time scales with data volume
- Large ranking periods may take longer
- News content extraction can be slow
- Consider running during low-traffic periods

## Security

- Backup files contain sensitive data
- Ensure proper file permissions
- Consider encrypting backup storage
- Rotate old backups regularly