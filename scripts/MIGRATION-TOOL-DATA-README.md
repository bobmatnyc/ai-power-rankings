# Tool Data Migration Script

## Overview

This migration script extracts tool metadata from nested `data.info` JSONB structures to top-level fields in the `tools` table for better queryability and application compatibility.

## Problem Statement

Research found that **42 tools** have rich data stored in nested `data.info` JSONB fields but are missing critical top-level fields like `description`, `tagline`, `logo_url`, and `website_url`. The application expects these fields at the top level for proper display and functionality.

## What This Script Does

The script automatically:

1. **Scans all tools** in the database for nested `data.info` structures
2. **Extracts metadata** from multiple possible paths within the JSONB data
3. **Populates top-level fields** with the extracted values
4. **Preserves existing data** - only fills empty fields, doesn't overwrite
5. **Maintains data integrity** - keeps the original JSONB structure intact

## Field Mappings

The script extracts the following fields with fallback paths:

| Top-Level Field | Source Paths (in priority order) |
|----------------|----------------------------------|
| `description` | `info.product.description` → `info.description` → `info.summary` |
| `tagline` | `info.product.tagline` → `info.tagline` |
| `logo_url` | `info.metadata.logo_url` → `info.metadata.image_url` → `info.logo_url` |
| `website_url` | `info.links.website` → `info.website_url` → `info.website` |
| `github_repo` | `info.links.github` → `info.github_repo` |
| `pricing_model` | `info.pricing.model` → `info.pricing.pricing_model` → `info.business.pricing_model` → `info.pricing_model` |

## Usage

### Dry-Run Mode (Preview Changes)

**Recommended first step** - see what would be changed without modifying data:

```bash
npm run migrate-tool-data
```

Or with detailed output:

```bash
npm run migrate-tool-data -- --verbose
```

This will show:
- How many tools would be updated
- Which fields would be extracted
- Detailed preview of changes for each tool

### Execute Migration

After reviewing the dry-run results, apply the changes:

```bash
npm run migrate-tool-data -- --execute
```

With detailed logging:

```bash
npm run migrate-tool-data -- --execute --verbose
```

### Verify Results

Check the migration results after execution:

```bash
npm run migrate-tool-data -- --verify
```

## Command-Line Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--execute` | `-e` | Apply changes to the database (default is dry-run) |
| `--verbose` | `-v` | Show detailed output for each tool |
| `--verify` | | Only verify migration results, don't run migration |

## Output Examples

### Dry-Run Summary

```
📊 Dry-Run Statistics:
   Total tools: 56
   Tools with nested data: 42
   Tools that would be updated: 42

📈 Fields to be extracted:
   description: 42 tools
   website_url: 42 tools
   pricing_model: 42 tools
```

### Detailed Change Preview (with --verbose)

```
═══ Cursor (cursor) ═══
Tool ID: 1
Fields to extract: description, website_url, pricing_model

  description:
    FROM: null
    TO:   "AI-powered code editor with $500M ARR and 360K+ paying developers"

  website_url:
    FROM: null
    TO:   "https://cursor.com"

  pricing_model:
    FROM: null
    TO:   "freemium"
```

### Execution Results

```
✅ Migration completed!

📊 Final Statistics:
   Total tools: 56
   Tools with nested data: 42
   Tools updated: 42
   Errors: 0

📈 Fields extracted:
   description: 42 tools
   website_url: 42 tools
   pricing_model: 42 tools
```

### Verification Results

```
📊 Verification Results:
   Total tools: 56
   Tools with missing fields: 14

📉 Still missing by field:
   description: 0 tools
   tagline: 14 tools
   logo_url: 28 tools
   website_url: 0 tools
   github_repo: 45 tools
   pricing_model: 0 tools

✅ All tools have complete field data!
```

## Safety Features

1. **Dry-Run Default**: Script runs in preview mode by default
2. **Non-Destructive**: Only fills empty fields, never overwrites existing data
3. **Preserves JSONB**: Original nested data remains intact
4. **Error Handling**: Continues on errors, reports failures at the end
5. **Verification**: Built-in verification step to check results

## Technical Details

### How It Works

1. **Query**: Fetches all tools from the database
2. **Filter**: Identifies tools with `data.info` structures
3. **Extract**: Tries multiple paths to find meaningful values
4. **Validate**: Checks if values are meaningful (not null/empty)
5. **Update**: Updates the JSONB data field with extracted top-level fields
6. **Verify**: Confirms successful extraction

### Data Structure

**Before Migration:**
```json
{
  "data": {
    "id": "1",
    "info": {
      "description": "AI-powered code editor",
      "website": "https://cursor.com",
      "pricing": {
        "model": "freemium"
      }
    }
  }
}
```

**After Migration:**
```json
{
  "data": {
    "id": "1",
    "description": "AI-powered code editor",
    "website_url": "https://cursor.com",
    "pricing_model": "freemium",
    "info": {
      "description": "AI-powered code editor",
      "website": "https://cursor.com",
      "pricing": {
        "model": "freemium"
      }
    }
  }
}
```

### Database Impact

- **Table**: `tools`
- **Modified Columns**: `data` (JSONB), `updated_at` (timestamp)
- **Transaction**: Each update is a separate transaction
- **Performance**: ~1-2 seconds per tool, total ~2 minutes for 42 tools

## Troubleshooting

### "Database not connected" Error

Ensure your `DATABASE_URL` or `DATABASE_URL_DEVELOPMENT` environment variable is set:

```bash
export DATABASE_URL_DEVELOPMENT="postgresql://..."
npm run migrate-tool-data
```

### "No changes would be made" Result

This means:
- Tools already have top-level fields populated, OR
- Tools don't have nested `data.info` structures

Verify with verbose mode:
```bash
npm run migrate-tool-data -- --verbose
```

### Partial Extraction

Some fields may not be extracted if:
- The nested data doesn't contain those fields
- The values are empty/null in the source
- The top-level field already has data

Check verification results to see which fields are still missing.

## Related Files

- **Script**: `/scripts/migrate-tool-data-to-top-level.ts`
- **Repository**: `/lib/db/repositories/tools.repository.ts`
- **Schema**: `/lib/db/schema.ts`
- **Package Script**: `package.json` → `migrate-tool-data`

## Next Steps After Migration

1. **Verify**: Run with `--verify` flag to check results
2. **Test**: Verify tool pages display correctly with new fields
3. **Monitor**: Check application logs for any issues
4. **Update**: Consider creating a database migration file if needed

## Support

For issues or questions:
1. Check the verification report
2. Run with `--verbose` for detailed output
3. Review error messages in the output
4. Check database connection and permissions
