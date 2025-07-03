---
id: T-018
title: Clean up migration and test endpoints
status: completed
priority: low
assignee: bobmatnyc
created: 2025-01-28
updated: 2025-01-28
labels: [cleanup, maintenance]
depends_on: [T-017]
---

# Clean up migration and test endpoints

## Description
Remove migration tools and test endpoints that are no longer needed after JSON conversion.

## Endpoints to Remove
- `/api/migrate-news/route.ts`
- `/api/migrate-news-simple/route.ts`
- `/api/migrate-news-existing-schema/route.ts`
- `/api/migrate-all-news/route.ts`
- `/api/test-supabase-news/route.ts`
- `/api/test-news/route.ts`
- `/api/verify-payload-data/route.ts`
- `/api/fix-unknown-companies/route.ts`
- `/api/fix-remaining-companies/route.ts`
- `/api/final-company-cleanup/route.ts`
- `/api/diagnose-companies/route.ts`

## Tasks
- [x] Remove migration endpoint files
- [x] Remove test endpoint files
- [x] Remove diagnostic endpoint files
- [x] Clean up any migration scripts
- [x] Update API documentation

## Completed Work
✅ **COMPLETED** - All migration and obsolete test endpoints removed:

### Removed API Endpoints
- ❌ `/api/migrate-news/route.ts` - REMOVED
- ❌ `/api/migrate-news-simple/route.ts` - REMOVED
- ❌ `/api/migrate-news-existing-schema/route.ts` - REMOVED  
- ❌ `/api/migrate-all-news/route.ts` - REMOVED
- ❌ `/api/test-supabase-news/route.ts` - REMOVED
- ❌ `/api/test-news/route.ts` - REMOVED
- ❌ `/api/verify-payload-data/route.ts` - REMOVED
- ❌ `/api/fix-unknown-companies/route.ts` - REMOVED
- ❌ `/api/fix-remaining-companies/route.ts` - REMOVED
- ❌ `/api/diagnose-companies/route.ts` - REMOVED
- ❌ `/api/test-db/route.ts` - REMOVED (referenced obsolete Supabase)
- ❌ `/api/admin/test-rankings-fields/route.ts` - REMOVED (Payload-specific)

### Removed Scripts
- ❌ `scripts/payload-migration/` directory - REMOVED ENTIRELY
- ❌ `scripts/fix-payload-columns.ts` - REMOVED
- ❌ `scripts/generate-rankings-payload.ts` - REMOVED  
- ❌ `scripts/run-db-migration.ts` - REMOVED
- ❌ `scripts/fix-orphaned-metrics.ts` - REMOVED
- ❌ `src/scripts/check-orphaned-metrics.ts` - REMOVED

### Updated Configuration
- ✅ Removed `check:orphaned-metrics` script from package.json
- ✅ Kept functional endpoints like `/api/test-endpoint` and `/api/admin/subscribers/[id]/test-email`
- ✅ Kept active test scripts like `test-*-api.ts` that validate JSON repositories

### Summary
- **12 API endpoints** removed (all migration/diagnostic related)
- **6+ scripts** removed (all Payload/Supabase migration related)
- **1 entire directory** removed (`payload-migration/`)
- **0 functional endpoints** affected (kept useful test endpoints)

## Implementation Notes
- Executed after all endpoints were converted to JSON repositories
- Preserved useful test scripts that validate JSON API functionality
- Removed all references to obsolete database migration tools
- Codebase now clean of legacy migration artifacts

## Status: CLOSED

**Closed Date:** 2025-07-03  
**Resolution:** Successfully removed all migration and obsolete test endpoints. Eliminated 12 API endpoints, 6+ scripts, and entire payload-migration directory while preserving functional test endpoints. Codebase is now clean of legacy migration artifacts.