# Archive Guide

This guide explains the structure and purpose of the archive directory.

## Purpose

The archive directory preserves historical artifacts, obsolete files, and documentation from various cleanup operations. These files are kept for reference but are no longer actively used in the project.

## Structure

```
archive/
├── 2025-01-cleanup/     # January 2025 cleanup operation
├── 2025-06-cleanup/     # June 2025 cleanup operation
├── 2025-07-cleanup/     # July 2025 cleanup operation
└── ARCHIVE-GUIDE.md     # This file
```

## Cleanup Operations

### 2025-01-cleanup (January 29, 2025)

Major repository cleanup removing obsolete files and organizing backups.

**Key Artifacts:**
- `CLEANUP-SUMMARY.md` - Detailed summary of cleanup operations
- `backups/` - All backup files moved from various locations
- `old-docs/` - Archived documentation (release notes, summaries)
- `scripts/` - Obsolete Python news collection scripts
- `temp-files/` - Temporary and processed files

**Notable Items:**
- Python-based news collection system (replaced with TypeScript)
- Old release notes and PR descriptions
- Numerous backup files from July 2025 updates
- Claude project manager backup files

### 2025-06-cleanup (June 2025)

Initial project setup and database configuration artifacts.

**Key Artifacts:**
- Database setup documentation
- Supabase CLI configuration
- Initial scaffolding plans
- V0 project instructions

**Purpose:** Preserves the original setup process and decisions made during initial development.

### 2025-07-cleanup (July 2025)

Payload CMS migration and database-related cleanup.

**Key Artifacts:**
- `PAYLOAD*.md` - Payload CMS documentation
- `*.sql` - Database backup files
- `SUPABASE-CONNECTION-GUIDE.md` - Database connection docs
- `VERCEL_DATABASE_SETUP.md` - Vercel database configuration

**Purpose:** Documents the transition away from Payload CMS and database-centric architecture.

## When to Create New Archive Directories

Create a new dated archive directory when:
1. Performing a major cleanup operation
2. Deprecating a significant feature or system
3. Migrating away from a technology or approach
4. Reorganizing the repository structure

## Archive Naming Convention

- Use format: `YYYY-MM-cleanup/` (e.g., `2025-01-cleanup/`)
- Always include a `CLEANUP-SUMMARY.md` or similar documentation
- Organize files into logical subdirectories within the archive

## Important Notes

1. **Do Not Delete Archives**: These files serve as historical reference
2. **Do Not Modify Archive Contents**: Preserve files as they were archived
3. **Reference Only**: These files should not be imported or used in active code
4. **Documentation Value**: Archives help understand project evolution and decisions

## Finding Archived Content

To locate specific archived content:

1. Check the cleanup summary files for descriptions
2. Use grep/search within the archive directory
3. Review the subdirectory structure for logical grouping
4. Check file timestamps for chronological context

## Common Archived Items

- **Backup Files**: `.backup`, `.bak`, timestamped backups
- **Old Documentation**: Release notes, migration guides, setup instructions
- **Deprecated Scripts**: Replaced automation scripts and tools
- **Temporary Files**: `.tmp`, `.processed`, cache files
- **Configuration Files**: Old configs for removed systems

Remember: The archive is a historical record. When in doubt about whether to archive something, err on the side of preservation.