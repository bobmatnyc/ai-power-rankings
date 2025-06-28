---
id: T-011
title: Convert main public API endpoints to pure JSON
status: completed
priority: high
assignee: bobmatnyc
created: 2025-01-28
updated: 2025-01-28
labels: [backend, api, migration]
---

# Convert main public API endpoints to pure JSON

## Description
Convert the main public-facing API endpoints from hybrid (Payload with cache fallback) to pure JSON data format.

## Affected Endpoints
- `/api/tools/route.ts` - Main tools API ✅
- `/api/news/route.ts` - Main news API ✅
- `/api/rankings/route.ts` - Main rankings API ✅
- `/api/news/historical/route.ts` - Historical news API (skipped - less critical)

## Current State
✅ COMPLETED - All critical public endpoints now use JSON repositories

## Tasks
- [x] Replace payloadDirect calls with JSON repository calls
- [x] Update response formatting to match existing API contracts
- [x] Test endpoints maintain backward compatibility
- [x] Remove cache fallback logic (now primary data source)

## Implementation Notes
All main public-facing endpoints have been converted to use pure JSON data sources. The endpoints now:
- Use `getToolsRepo()`, `getNewsRepo()`, `getRankingsRepo()` 
- Return data in same format as before for backward compatibility
- Include `_source: "json-db"` metadata to indicate JSON source
- Remove complex hybrid cache fallback logic