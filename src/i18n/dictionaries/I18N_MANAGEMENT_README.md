# AI Power Rankings - i18n Management System

## Overview

Complete internationalization (i18n) management toolkit for the AI Power Rankings project. This system manages translations for 8 languages with 487 translation keys across all major application sections.

## Supported Languages

- **English (en)** - Reference language (487 keys)
- **German (de)** - 100% complete
- **French (fr)** - 100% complete  
- **Korean (ko)** - 100% complete
- **Japanese (jp)** - 100% complete
- **Chinese (zh)** - 100% complete
- **Croatian (hr)** - 100% complete
- **Italian (it)** - 100% complete
- **Ukrainian (uk)** - 100% complete

## Quick Commands

```bash
# Navigate to dictionaries directory
cd /Users/masa/Projects/ai-power-rankings/src/i18n/dictionaries

# Verify all translations
node verify_i18n.js

# Run complete workflow
./update_workflow.sh

# Check file sizes
node check_sizes.js

# Create backup
./backup_files.sh

# Clean temporary files
./cleanup_temp_files.sh
```

## Core Workflows

### Adding New Keys
1. Add keys to `en.json` first
2. Run `node sync_structure.js` to propagate structure
3. Edit `update_template.js` with translations
4. Run `node update_template.js`
5. Verify with `node verify_i18n.js`

### Pre-deployment Validation
```bash
./update_workflow.sh
```

### Backup and Recovery
```bash
# Create backup
./backup_files.sh

# Restore from backup
tar -xzf i18n_backup_YYYYMMDD_HHMMSS.tar.gz
```

## Translation Categories (487 keys total)

- **About** (61 keys) - About page content
- **Categories** (14 keys) - AI tool categories  
- **Common** (18 keys) - Shared UI elements
- **Errors** (9 keys) - Error messages
- **Features** (6 keys) - Feature descriptions
- **Footer** (4 keys) - Footer content
- **Home** (78 keys) - Homepage content
- **Methodology** (74 keys) - Ranking methodology
- **Navigation** (14 keys) - Navigation elements
- **News** (20 keys) - News section
- **Newsletter** (64 keys) - Newsletter signup
- **Rankings** (34 keys) - Rankings page
- **Sidebar** (6 keys) - Sidebar elements
- **Status** (5 keys) - Tool status labels
- **Tools** (80 keys) - Tools section

## Management Scripts

- `verify_i18n.js` - Check translation completeness
- `sync_structure.js` - Synchronize JSON structure
- `update_template.js` - Bulk update translations
- `check_sizes.js` - Monitor file size consistency
- `update_workflow.sh` - Complete verification workflow
- `key_comparison.js` - Analyze key structure
- `extract_used_keys.js` - Extract keys from codebase
- `backup_files.sh` - Create backup archive
- `cleanup_temp_files.sh` - Clean temporary files

## Status: Production Ready
✅ 8 Languages - 487 Keys - 100% Complete
