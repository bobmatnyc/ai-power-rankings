# Nested Tool Data Extraction Guide

## Overview

The `extract-nested-tool-data.ts` script automatically extracts data from nested `info` JSONB fields in the tools table and promotes them to standard top-level fields for consistency and easier querying.

## Background

During the audit, we discovered that many tools have rich metadata stored in nested `info` objects with varying structures. For example:

```json
{
  "info": {
    "product": {
      "tagline": "The AI-first code editor",
      "features": ["AI-powered code completion", "Multi-file editing"]
    },
    "technical": {
      "language_support": ["Python", "JavaScript", "TypeScript"],
      "ide_integration": "VS Code Fork"
    },
    "links": {
      "github": "https://github.com/...",
      "website": "https://..."
    }
  }
}
```

This script extracts such data and moves it to top-level fields like `tagline`, `features`, `supported_languages`, etc.

## Features

### ✨ Smart Multi-Path Extraction
The script tries multiple possible nested paths for each field:

- **tagline**: `info.product.tagline`, `info.tagline`, `info.product.summary`, `info.summary`
- **features**: `info.features`, `info.product.features`, `info.capabilities`
- **supported_languages**: `info.technical.language_support`, `info.technical.languages`, `info.languages`, `info.supported_languages`
- **ide_support**: `info.technical.ide_integration`, `info.integrations`, `info.ide_support`
- **github_repo**: `info.links.github`, `info.github_repo`, `info.github`, `info.repository`
- **logo_url**: `info.metadata.logo_url`, `info.logo_url`, `info.metadata.image_url`, `info.image_url`

### 🔒 Non-Destructive Operation
- Only fills fields that are currently `null`, `undefined`, or empty
- Preserves all existing data
- No data loss risk

### 🎯 Format Normalization
- Converts string arrays to proper arrays
- Handles comma/semicolon/pipe-separated strings
- Validates and normalizes GitHub URLs
- Validates logo URLs for correctness

### 🔍 Dry-Run Mode (Default)
- Preview all changes before applying them
- No database modifications
- Full reporting of what would be changed

## Usage

### 1. Dry-Run (Preview Only)

```bash
# Basic dry-run - shows which tools will be updated
npx tsx scripts/extract-nested-tool-data.ts

# Verbose dry-run - shows detailed extraction paths and values
npx tsx scripts/extract-nested-tool-data.ts --verbose
```

### 2. Execute Migration

```bash
# Apply the changes to the database
npx tsx scripts/extract-nested-tool-data.ts --execute

# Execute with verbose logging
npx tsx scripts/extract-nested-tool-data.ts --execute --verbose
```

## Example Output

### Dry-Run Summary
```
╔════════════════════════════════════════════════════════════════╗
║        Extract Nested Tool Data Migration                     ║
╚════════════════════════════════════════════════════════════════╝

Mode: 🔍 DRY-RUN MODE

ℹ️  Running in dry-run mode. No changes will be made to the database.
   Use --execute flag to apply changes.

📥 Fetching all tools from database...

Found 46 tools

✨ Cursor (cursor)
   Fields to extract: tagline, features, supported_languages, ide_support

✨ GitHub Copilot (github-copilot)
   Fields to extract: tagline, features, supported_languages

⏭️  Anything Max: No fields to extract (already populated)

...

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
```

### Verbose Mode Details
```
✨ Cursor (cursor)
   Fields to extract: tagline, features, supported_languages, ide_support
   • tagline:
     Path: info.summary
     Value: The AI-first code editor
   • features:
     Path: info.features
     Value: [AI-powered code completion with Tab, Context-aware chat, ...] (15 items)
   • supported_languages:
     Path: info.technical.language_support
     Value: [Python, JavaScript, TypeScript, Java, ...] (20 items)
   • ide_support:
     Path: info.technical.ide_integration
     Value: [VS Code Fork (Proprietary)] (1 items)
```

## What Gets Extracted

### Current Results (as of latest run)

Based on the most recent execution:

- **42 tools** (91.3%) will have `tagline` extracted
- **42 tools** (91.3%) will have `supported_languages` extracted
- **15 tools** (32.6%) will have `features` extracted
- **7 tools** (15.2%) will have `ide_support` extracted
- **0 tools** currently need `github_repo` extraction (likely already populated)
- **0 tools** currently need `logo_url` extraction (likely already populated)

### Tools Without Changes

4 tools already have all extractable fields populated:
- GitLab Duo
- Anything Max
- (2 others - check dry-run output for current list)

## Validation

The script performs several validation checks:

### URL Validation
- GitHub URLs are validated and normalized
- Supports formats:
  - `https://github.com/user/repo`
  - `github.com/user/repo` → converted to full URL
  - `user/repo` → converted to `https://github.com/user/repo`

### Array Normalization
- Handles arrays of strings
- Converts comma-separated strings to arrays
- Filters out empty values
- Example: `"Python, JavaScript, "` → `["Python", "JavaScript"]`

### Logo URL Validation
- Validates URL format
- Only accepts well-formed HTTP/HTTPS URLs

## Safety Features

1. **Non-destructive**: Only fills empty fields, never overwrites existing data
2. **Dry-run default**: Must explicitly use `--execute` to modify database
3. **Error handling**: Catches and reports errors without stopping migration
4. **Validation**: All extracted data is validated before insertion
5. **Transaction safety**: Uses database transactions for data integrity

## Troubleshooting

### No fields extracted for a tool
This means the tool either:
- Already has all fields populated at the top level
- Has no nested `info` data
- Has nested data in non-standard paths not covered by the script

### GitHub URL not extracted
The script validates GitHub URLs. If extraction fails:
- Check if the value in `info.links.github` is a valid URL
- Verify the format matches one of the supported patterns

### Script shows errors
- Check database connection
- Verify the tool's `data` field is valid JSON
- Review the specific error message for details

## Next Steps After Migration

After running the extraction:

1. **Verify Results**: Check a sample of tools to ensure data was extracted correctly
2. **Manual Review**: Tools that still have missing fields may need manual data entry
3. **Update Import Scripts**: Ensure future tool imports populate top-level fields directly
4. **Documentation**: Update tool data entry documentation to use new structure

## Related Scripts

- `scripts/audit-tools-data.ts` - Audit tool data completeness
- `scripts/detailed-tools-audit.ts` - Comprehensive tool data analysis
- `scripts/migrate-tool-data-to-top-level.ts` - Manual tool data migration

## Schema Reference

The script extracts to these fields in the `data` JSONB:

```typescript
{
  tagline?: string;              // Short description
  features?: string[];           // Array of feature strings
  supported_languages?: string[]; // Programming languages supported
  ide_support?: string[];        // IDE integrations
  github_repo?: string;          // GitHub repository URL
  logo_url?: string;             // Logo image URL
}
```

## Questions?

If you encounter issues or have questions:
1. Review the verbose output: `--verbose` flag
2. Check the script source: `scripts/extract-nested-tool-data.ts`
3. Verify database schema: `lib/db/schema.ts`
