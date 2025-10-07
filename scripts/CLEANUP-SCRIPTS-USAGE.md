# Database Maintenance Scripts

TypeScript scripts for database cleanup, data migration, and tool data management.

## 📋 Overview

### Data Quality & Migration
- **`extract-nested-tool-data.ts`** - Extract nested tool data from `info` JSONB to top-level fields
- **`audit-tools-data.ts`** - Audit tool data completeness and identify missing fields
- **`detailed-tools-audit.ts`** - Comprehensive tool data analysis with prioritization

### Cleanup & Fixes
- **`cleanup-test-articles.ts`** - Identifies and removes test articles with cascade deletion
- **`fix-article-dates.ts`** - Restores correct article dates from backup file

## 🚀 Quick Start

### Prerequisites

1. Ensure you're connected to the **staging database**: `ep-dark-firefly-adp1p3v8`
2. Set the appropriate `DATABASE_URL` in your environment
3. Have `tsx` installed (already in project dependencies)

### Tool Data Extraction (NEW)

```bash
# 1. Dry run - Preview what will be extracted (RECOMMENDED FIRST)
npx tsx scripts/extract-nested-tool-data.ts

# 2. Verbose dry run - See detailed extraction paths and values
npx tsx scripts/extract-nested-tool-data.ts --verbose

# 3. Execute - Apply the extraction to database
npx tsx scripts/extract-nested-tool-data.ts --execute

# 4. Execute with verbose logging
npx tsx scripts/extract-nested-tool-data.ts --execute --verbose
```

**See detailed guide**: [docs/guides/nested-data-extraction-guide.md](../docs/guides/nested-data-extraction-guide.md)

### Test Articles Cleanup

```bash
# 1. Dry run - See what will be deleted (RECOMMENDED FIRST)
tsx scripts/cleanup-test-articles.ts --dry-run

# 2. Interactive mode - Review and confirm before deletion
tsx scripts/cleanup-test-articles.ts

# 3. Auto-confirm mode - Skip confirmation prompt
tsx scripts/cleanup-test-articles.ts --auto-confirm
```

### Article Dates Fix

```bash
# 1. Dry run - See what dates will be updated (RECOMMENDED FIRST)
tsx scripts/fix-article-dates.ts --dry-run

# 2. Interactive mode - Review and confirm before updates
tsx scripts/fix-article-dates.ts

# 3. Auto-confirm mode - Skip confirmation prompt
tsx scripts/fix-article-dates.ts --auto-confirm
```

## 📝 Script Details

### 0. extract-nested-tool-data.ts (NEW)

**Purpose**: Extract and migrate data from nested `info` JSONB fields to standard top-level fields

**What it does**:
- ✅ Tries multiple nested paths for each field (smart extraction)
- ✅ Non-destructive: only fills empty/null fields
- ✅ Handles arrays and strings appropriately
- ✅ Validates URLs and normalizes formats
- ✅ Dry-run mode by default
- ✅ Detailed before/after reporting
- ✅ 100% success rate with error handling

**Fields Extracted**:
1. **tagline** - From: `info.product.tagline`, `info.tagline`, `info.summary`
2. **features** - From: `info.features`, `info.product.features`, `info.capabilities`
3. **supported_languages** - From: `info.technical.language_support`, `info.languages`
4. **ide_support** - From: `info.technical.ide_integration`, `info.integrations`
5. **github_repo** - From: `info.links.github`, `info.github_repo`, `info.github`
6. **logo_url** - From: `info.metadata.logo_url`, `info.logo_url`, `info.image_url`

**Current Statistics** (as of latest run):
- 46 total tools in database
- 42 tools (91.3%) will have `tagline` extracted
- 42 tools (91.3%) will have `supported_languages` extracted
- 15 tools (32.6%) will have `features` extracted
- 7 tools (15.2%) will have `ide_support` extracted
- 4 tools already have all fields populated

**Output Example**:
```
╔════════════════════════════════════════════════════════════════╗
║        Extract Nested Tool Data Migration                     ║
╚════════════════════════════════════════════════════════════════╝

Mode: 🔍 DRY-RUN MODE

📥 Fetching all tools from database...
Found 46 tools

✨ Cursor (cursor)
   Fields to extract: tagline, features, supported_languages, ide_support

✨ GitHub Copilot (github-copilot)
   Fields to extract: tagline, features, supported_languages

⏭️  Anything Max: No fields to extract (already populated)

╔════════════════════════════════════════════════════════════════╗
║                      MIGRATION SUMMARY                         ║
╚════════════════════════════════════════════════════════════════╝

📊 Overall Statistics:
   Total tools in database:        46
   Tools processed:                46
   Tools with extracted data:      42
   Tools without changes:          4
   Errors encountered:             0

📈 Fields Extracted:
   tagline                  :  42 tools (91.3%)
   features                 :  15 tools (32.6%)
   supported_languages      :  42 tools (91.3%)
   ide_support              :   7 tools (15.2%)
   github_repo              :   0 tools (0.0%)
   logo_url                 :   0 tools (0.0%)

✅ Success Rate: 100.0%

💡 This was a dry-run. To apply these changes, run:
   npx tsx scripts/extract-nested-tool-data.ts --execute
```

**Verbose Mode Output**:
```
✨ Cursor (cursor)
   Fields to extract: tagline, features, supported_languages, ide_support
   • tagline:
     Path: info.summary
     Value: The AI-first code editor
   • features:
     Path: info.features
     Value: [AI-powered code completion with Tab, ...] (15 items)
   • supported_languages:
     Path: info.technical.language_support
     Value: [Python, JavaScript, TypeScript, ...] (20 items)
   • ide_support:
     Path: info.technical.ide_integration
     Value: [VS Code Fork (Proprietary)] (1 items)
```

**See Full Documentation**: [docs/guides/nested-data-extraction-guide.md](../docs/guides/nested-data-extraction-guide.md)

### 1. cleanup-test-articles.ts

**Purpose**: Remove test articles and their related records from the database

**What it does**:
- ✅ Identifies test articles using multiple detection patterns
- ✅ Shows detailed list of articles to be deleted
- ✅ Checks for related ranking changes (cascade deletion)
- ✅ Requires user confirmation (unless `--auto-confirm`)
- ✅ Uses database transactions for safety
- ✅ Provides comprehensive audit log

**Test Article Detection Patterns**:
1. **Known test IDs** - 16 pre-identified test article IDs
2. **Title patterns** - test, demo, sample, placeholder, "Show HN:", etc.
3. **Slug patterns** - news-test*, news-demo*, news-sample*
4. **Tool mentions** - test-tool, demo-tool, sample-tool
5. **Content length** - Articles with < 200 characters (likely placeholders)

**Output Example**:
```
🧹 TEST ARTICLE CLEANUP SCRIPT
════════════════════════════════════════════════════════════════════════════════

📚 Fetching all articles from database...
   Found 89 total articles

🔍 Analyzing articles for test patterns...
   ✅ 73 legitimate articles
   ❌ 16 test articles identified

📋 TEST ARTICLES TO BE DELETED:
────────────────────────────────────────────────────────────────────────────────

1. Show HN: Octofriend, a cute coding agent that can swap between GPT-5 and Claude
   ID: 0931ca7b-e0ca-41d4-abe7-3c2bb9151d72
   Slug: news-show-hn-octofriend-a-cute-coding-agent-that
   Date: 2025-08-07T18:34:21.000Z
   Source: Hacker News
   Tool Mentions: claude-code, chatgpt-canvas
   Reason: Title matches test pattern: /Show HN:/i

[... more articles ...]

📊 Checking for related ranking changes...
   Found 31 ranking changes from test articles

📝 DELETION SUMMARY:
────────────────────────────────────────────────────────────────────────────────
   Articles to delete: 16
   Ranking changes to cascade delete: 31
   Legitimate articles to preserve: 73

⚠️  WARNING: This action will permanently delete the test articles!
   The deletion will CASCADE to related records in article_rankings_changes

Delete these 16 test articles? (yes/no):
```

### 2. fix-article-dates.ts

**Purpose**: Restore correct article dates from the backup file

**What it does**:
- ✅ Loads backup from: `data/json/backup/news.json.backup-2025-08-19T06-02-32.737Z`
- ✅ Matches database articles with backup by ID or slug
- ✅ Validates dates (must be between 2024-2026)
- ✅ Shows before/after date ranges
- ✅ Creates backup of current dates before updating
- ✅ Uses database transactions for safety
- ✅ Identifies articles not found in backup (need manual review)

**Output Example**:
```
📅 ARTICLE DATE FIXING SCRIPT
════════════════════════════════════════════════════════════════════════════════

📚 Step 1: Loading backup articles...
📂 Loading backup from: /Users/masa/Projects/managed/aipowerranking/data/json/backup/news.json.backup-2025-08-19T06-02-32.737Z
   Found 73 articles in backup

📊 Step 2: Fetching articles from database...
   Found 89 articles in database

🔍 Step 3: Matching articles with backup...
   ✅ 73 articles need date updates
   ✅ 0 articles already have correct dates
   ⚠️  16 articles not found in backup
   ⚠️  0 articles have invalid dates in backup

📈 Step 4: Date Range Analysis
────────────────────────────────────────────────────────────────────────────────

   Current dates in database:
      Range: 2025-09-13 to 2025-10-01
      Count: 89 articles with dates

   Correct dates from backup:
      Range: 2025-08-07 to 2025-08-19
      Count: 73 dates to update

📋 Sample Date Updates (first 10):
────────────────────────────────────────────────────────────────────────────────

1. GPT-5: Key characteristics, pricing and system card
   Slug: news-gpt-5-key-characteristics-pricing-and-system-card
   Current: 2025-09-15
   Correct: 2025-08-07

[... more samples ...]

📝 UPDATE SUMMARY:
────────────────────────────────────────────────────────────────────────────────
   Total articles in database: 89
   Articles to update: 73
   Already correct: 0
   Not found in backup: 16
   Invalid backup dates: 0

⚠️  This will update dates for 73 articles

Proceed with date updates? (yes/no):
```

## ⚙️ Command Line Flags

### Both Scripts Support:

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview changes without making any modifications |
| `--auto-confirm` | Skip confirmation prompt (use with caution!) |
| (no flags) | Interactive mode with confirmation required |

## 🔒 Safety Features

### cleanup-test-articles.ts
1. ✅ Multiple detection patterns to avoid false positives
2. ✅ Shows detailed list before deletion
3. ✅ Requires explicit user confirmation
4. ✅ Uses database transactions (rollback on error)
5. ✅ Cascade deletion properly removes related records
6. ✅ Comprehensive audit logging

### fix-article-dates.ts
1. ✅ Validates all dates before updating
2. ✅ Creates backup of current dates before changes
3. ✅ Shows before/after date ranges
4. ✅ Requires explicit user confirmation
5. ✅ Uses database transactions (rollback on error)
6. ✅ Identifies articles needing manual review
7. ✅ Comprehensive audit logging

## 📊 Expected Results

### After Running cleanup-test-articles.ts:
- **Before**: 89 total articles (73 legitimate + 16 test)
- **After**: 73 legitimate articles
- **Cascade deleted**: 31 ranking changes from test articles

### After Running fix-article-dates.ts:
- **Before**: Articles dated Sept 13 - Oct 1, 2025
- **After**: Articles dated correctly (Aug 7 - Aug 19, 2025)
- **Manual review**: 16 articles not in backup (test articles should be deleted first)

## 🎯 Recommended Workflow

**Step 1: Preview Everything** (Dry Runs)
```bash
# See what will be deleted
tsx scripts/cleanup-test-articles.ts --dry-run

# See what dates will be updated
tsx scripts/fix-article-dates.ts --dry-run
```

**Step 2: Clean Up Test Articles**
```bash
# Delete test articles (will ask for confirmation)
tsx scripts/cleanup-test-articles.ts
```

**Step 3: Fix Article Dates**
```bash
# Fix dates for remaining legitimate articles
tsx scripts/fix-article-dates.ts
```

**Step 4: Verify**
```bash
# Check the database state
tsx scripts/check-test-article-impact.ts
```

## 🚨 Important Notes

1. **Database Connection**: Ensure `DATABASE_URL` points to staging database
2. **Backup First**: Both scripts create backups, but verify your backups
3. **Test Articles First**: Run cleanup before date fix to avoid updating test article dates
4. **Manual Review**: Some articles may need manual attention (not in backup)
5. **Dry Run**: Always run with `--dry-run` first to preview changes
6. **Transactions**: Both scripts use transactions - partial failures will rollback

## 📂 Files Modified/Created

### cleanup-test-articles.ts creates:
- No new files (only deletes from database)
- Audit log in console output

### fix-article-dates.ts creates:
- `data/json/backup/article-dates-backup-<timestamp>.json` - Current dates backup

### Backup files:
- Uses: `data/json/backup/news.json.backup-2025-08-19T06-02-32.737Z`

## 🔍 Troubleshooting

### Error: "Database connection required"
- Check that `DATABASE_URL` is set in environment
- Verify you're connected to staging database

### Error: "Backup file not found"
- Verify the backup file exists at: `data/json/backup/news.json.backup-2025-08-19T06-02-32.737Z`
- Check file path is correct

### Warning: "X articles not found in backup"
- These are likely test articles created after backup
- Run cleanup-test-articles.ts first to remove them

### No articles detected for deletion
- Test articles may have already been removed
- Pattern matching may need adjustment
- Check known test IDs list in script

## 📈 Success Metrics

**Cleanup Success**:
- ✅ 16 test articles removed
- ✅ 31 ranking changes cascade deleted
- ✅ 73 legitimate articles preserved
- ✅ No errors in audit log

**Date Fix Success**:
- ✅ 73 articles updated with correct dates
- ✅ Date range: Aug 7-19, 2025 (from backup)
- ✅ Backup created successfully
- ✅ All dates validated and within expected range
- ✅ No invalid dates

## 🤝 Support

For issues or questions:
1. Check the console output for detailed error messages
2. Review the dry-run output carefully
3. Verify database connection and backup files
4. Check transaction logs in database if needed
