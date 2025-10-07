# Tool Data Migration - Quick Start Guide

## What This Does

Extracts tool metadata from nested `data.info` JSONB to top-level fields (description, tagline, logo_url, website_url, github_repo, pricing_model).

## Quick Commands

```bash
# 1. Preview changes (safe, no modifications)
npm run migrate-tool-data

# 2. See detailed preview
npm run migrate-tool-data -- --verbose

# 3. Execute migration
npm run migrate-tool-data -- --execute

# 4. Verify results
npm run migrate-tool-data -- --verify
```

## Expected Results

**Before execution, you'll see:**
- 56 total tools
- 42 tools with nested data
- 42 tools that would be updated
- 3 main fields extracted: description, website_url, pricing_model

## Safety

✅ **Dry-run by default** - won't modify data unless you use `--execute`
✅ **Non-destructive** - only fills empty fields, never overwrites
✅ **Preserves original data** - nested JSONB remains intact

## Files

- **Script**: `/scripts/migrate-tool-data-to-top-level.ts`
- **Full Documentation**: `/scripts/MIGRATION-TOOL-DATA-README.md`
- **Summary**: `/TOOL-DATA-MIGRATION-SUMMARY.md`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Database not connected | Check `DATABASE_URL` or `DATABASE_URL_DEVELOPMENT` env var |
| No changes to make | Tools already have data or missing nested info |
| Partial extraction | Some fields don't exist in nested data |

## Next Steps After Migration

1. Test tool detail pages in the application
2. Verify metadata displays correctly
3. Check that search/filtering still works
4. Consider creating a database migration file for version control

## Full Documentation

For detailed information, see: `/scripts/MIGRATION-TOOL-DATA-README.md`
