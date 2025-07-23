# Backup and Recovery Procedures

## Overview

The AI Power Rankings system includes comprehensive backup and recovery procedures for all JSON data files. Backups are created automatically before major operations and can also be triggered manually.

## Backup Strategy

### Automatic Backups

1. **Pre-write Backups**: Created automatically before any write operation
2. **Daily Backups**: Scheduled to run at 2 AM local time
3. **Retention Policy**: Last 10 backups are retained automatically

### Manual Backups

Create backups on-demand using npm scripts:

```bash
# Create a backup immediately
npm run backup:create

# Output example:
# ✅ Backup created: backup-2025-01-29-143022
```

## Backup Structure

Backups are stored in `/data/backups/` with the following structure:

```
/data/backups/
├── backup-2025-01-29-143022/
│   ├── companies.json
│   ├── tools/
│   │   ├── individual/
│   │   │   ├── aider.json
│   │   │   ├── cursor.json
│   │   │   └── ... (30 individual tool files)
│   │   ├── tools-index.json
│   │   └── tools.json (legacy, if present)
│   ├── rankings/
│   │   ├── 2025-01-15.json
│   │   ├── 2025-01-22.json
│   │   └── current.json
│   ├── news/
│   │   ├── articles.json
│   │   └── ingestion-reports.json
│   └── backup-metadata.json
└── pre-restore-2025-01-29-144530/
    └── ... (automatic backup before restore)
```

### Backup Metadata

Each backup includes metadata with:
- Timestamp of creation
- Number of files backed up
- Total size of backup
- Backup name/identifier

## Recovery Procedures

### Interactive Restore

The recommended way to restore data:

```bash
# Launch interactive restore
npm run backup:restore

# You'll see:
# ? Select a backup to restore:
# > backup-2025-01-29-143022 (2025-01-29 14:30:22, 156 files, 4.32 MB)
#   backup-2025-01-29-093015 (2025-01-29 09:30:15, 155 files, 4.28 MB)
#   backup-2025-01-28-203008 (2025-01-28 20:30:08, 154 files, 4.25 MB)

# ? Are you sure you want to restore this backup? (y/N)
```

### Quick Restore Options

```bash
# Restore the latest backup
npm run backup:restore:latest

# Restore a specific backup
npm run backup:restore -- --backup=backup-2025-01-29-143022
```

### Pre-Restore Safety

Before any restore operation:
1. Current data is automatically backed up with prefix `pre-restore-`
2. You can cancel the restore operation before confirmation
3. The pre-restore backup allows you to undo if needed

## Data Validation

### Validate All Data

Check data integrity and schema compliance:

```bash
npm run validate:all

# Output:
# 📊 Validation Summary:
#    Total files: 156
#    Valid files: 156 ✅
#    Invalid files: 0 ❌
```

### Health Check

Comprehensive health check including validation:

```bash
npm run health:check
```

### Common Validation Errors

1. **Schema Violations**
   - Missing required fields
   - Invalid data types
   - Incorrect enum values

2. **Referential Integrity**
   - Tools referencing non-existent companies
   - Rankings referencing non-existent tools
   - News articles with invalid tool mentions

## Disaster Recovery

### Complete Data Loss

If all data is lost:

1. **Check Git Repository**
   ```bash
   # JSON files are tracked in git
   git status data/json/
   git checkout data/json/
   ```

2. **Restore from Latest Backup**
   ```bash
   npm run backup:restore:latest
   ```

3. **Rebuild from Cache**
   ```bash
   # If backups are corrupted, rebuild from cache
   npm run json:migrate:cache
   ```

### Corrupted Data

If data files are corrupted:

1. **Identify Corrupted Files**
   ```bash
   npm run validate:all
   ```

2. **Restore Specific Files**
   ```bash
   # Copy specific files from backup
   # For tools (now stored as individual files):
   cp -r data/backups/backup-2025-01-29-143022/tools/ data/json/
   
   # Or restore just specific tool files:
   cp data/backups/backup-2025-01-29-143022/tools/individual/cursor.json data/json/tools/individual/
   
   # Restore the index:
   cp data/backups/backup-2025-01-29-143022/tools/tools-index.json data/json/tools/
   ```

3. **Validate After Restore**
   ```bash
   npm run validate:all
   ```

## Best Practices

### Regular Backups

1. **Before Major Operations**
   - Always backup before bulk imports
   - Backup before schema migrations
   - Backup before production deployments

2. **Scheduled Backups**
   - Daily automated backups at 2 AM
   - Weekly manual verification of backups
   - Monthly backup rotation check

### Testing Recovery

1. **Regular Drills**
   - Test restore procedure monthly
   - Verify data integrity after restore
   - Document any issues found

2. **Backup Verification**
   ```bash
   # List available backups
   ls -la data/backups/
   
   # Check backup size and file count
   du -sh data/backups/backup-*
   find data/backups/backup-* -name "*.json" | wc -l
   ```

### Monitoring

1. **Backup Success**
   - Check logs for backup failures
   - Monitor backup directory size
   - Alert on backup age > 48 hours

2. **Data Integrity**
   - Run validation daily
   - Check referential integrity
   - Monitor for data anomalies

## Automation

### Scheduled Backups

Backups run automatically via the BackupManager:

```typescript
// In production, backups run daily at 2 AM
import { backupManager } from '@/lib/json-db/backup-manager';
backupManager.startAutomatedBackups();
```

### Pre-Write Backups

Integrated into repository write operations:

```typescript
// Automatic backup before write
await backupManager.createBackupBeforeWrite('tool-update');
await toolsRepo.upsert(tool);
```

## Troubleshooting

### Common Issues

1. **"No backups found"**
   - Check backup directory exists: `mkdir -p data/backups`
   - Verify permissions: `ls -la data/`

2. **"Backup failed: ENOSPC"**
   - Disk space issue
   - Clean old backups: `rm -rf data/backups/backup-2025-01-*`

3. **"Validation failed after restore"**
   - Check backup integrity
   - Try an older backup
   - Rebuild from git history

### Emergency Contacts

For critical data loss scenarios:
1. Check GitHub repository history
2. Contact system administrator
3. Review application logs for recent changes

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run backup:create` | Create manual backup |
| `npm run backup:restore` | Interactive restore |
| `npm run backup:restore:latest` | Restore latest backup |
| `npm run validate:all` | Validate all JSON data |
| `npm run health:check` | Full system health check |

## Storage Requirements

- Each backup: ~5-10 MB
- Retention: 10 backups
- Total space needed: ~100 MB
- Growth rate: ~5 MB/day

Monitor disk space regularly to ensure backup operations can complete successfully.