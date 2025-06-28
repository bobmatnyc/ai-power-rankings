---
id: T-017
title: Remove all Payload CMS dependencies
status: completed
priority: low
assignee: bobmatnyc
created: 2025-01-28
updated: 2025-01-28
labels: [cleanup, dependencies]
depends_on: [T-011, T-013, T-014, T-015, T-016]
---

# Remove all Payload CMS dependencies

## Description
Remove all Payload CMS related dependencies and configuration files after completing the JSON migration.

## Tasks
- [x] Remove Payload packages from package.json
- [x] Remove payload.config.ts (none found)
- [x] Remove Payload-related environment variables
- [x] Clean up Payload imports across codebase  
- [x] Remove database connection configurations
- [x] Update Docker/deployment configurations (none found)

## Packages to Remove
- `@payloadcms/db-postgres`
- `@payloadcms/email-nodemailer`
- `@payloadcms/email-resend`
- `@payloadcms/next`
- `@payloadcms/richtext-lexical`
- `payload`
- `pg` (if not used elsewhere)

## Completed Work
✅ **COMPLETED** - All Payload CMS dependencies successfully removed:

### Removed Packages
- `@payloadcms/db-postgres` ❌ REMOVED
- `@payloadcms/email-nodemailer` ❌ REMOVED  
- `@payloadcms/email-resend` ❌ REMOVED
- `@payloadcms/next` ❌ REMOVED
- `@payloadcms/richtext-lexical` ❌ REMOVED
- `payload` ❌ REMOVED
- `pg` ❌ REMOVED
- `@types/pg` ❌ REMOVED

### Cleanup Actions Performed
- ✅ Removed all Payload packages from package.json
- ✅ Cleaned up PAYLOAD_SECRET reference in newsletter subscribe endpoint
- ✅ Verified no remaining Payload imports in codebase
- ✅ Confirmed no payload.config.ts or related config files
- ✅ Successfully reinstalled dependencies (removed 249 packages)
- ✅ Zero Payload CMS dependencies remain

### Verification
- `npm list | grep payload` returns no results
- All Payload-related environment variable checks removed
- No Payload imports found in TypeScript/JavaScript files
- pnpm install successfully removed all Payload packages

## Implementation Notes
- Executed after all endpoints were converted to JSON repositories
- Project now runs on pure JSON file-based architecture
- Zero database or CMS dependencies achieved