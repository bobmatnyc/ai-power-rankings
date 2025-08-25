# API Route Consolidation Summary

## Overview
Consolidated multiple API routes to reduce redundancy and improve maintainability in the AI Power Rankings project.

## Consolidations Completed

### 1. Admin Tool Management (`/api/admin/tools`)
**Consolidated 6 routes into 1:**
- `check-tools-exist` → GET with `?action=check-exist`
- `cleanup-auto-tools` → GET with `?action=cleanup-auto` / POST with `action=cleanup-auto`
- `delete-tools` → POST with `action=delete` / DELETE
- `refresh-tool-display` → POST with `action=refresh-display`
- `quick-fix-tool-display` → PUT with `action=quick-fix-display`
- `update-company` → POST with `action=update-company`

**Methods:**
- GET: Check existence, list tools
- POST: Delete multiple, refresh, cleanup, update
- DELETE: Delete single tool
- PUT: Quick fixes and batch updates

### 2. Admin Rankings Management (`/api/admin/rankings`)
**Consolidated 8 routes into 1:**
- `ranking-periods` → GET with `?action=periods`
- `check-rankings-data` → GET with `?action=check-data`
- `ranking-progress` → GET with `?action=progress`
- `preview-rankings` → POST with `action=preview`
- `build-rankings-json` → POST with `action=build`
- `set-live-ranking` → POST with `action=set-current`
- `create-ranking-period` → POST with `action=create-period`
- `sync-current-rankings` → POST with `action=sync-current`

**Methods:**
- GET: List periods, check data, get progress
- POST: Preview, build, set current, create period, sync
- DELETE: Delete ranking period

### 3. Admin News Management (`/api/admin/news`)
**Consolidated 5 routes into 1:**
- `ingestion-reports` → GET with `?action=reports`
- `fetch-article` → GET with `?action=fetch-article`
- `ingest-news` → POST with `action=ingest`
- `manual-ingest` → POST with `action=manual-ingest`
- `rollback-ingestion` → POST with `action=rollback`

**Methods:**
- GET: Reports, fetch articles, status
- POST: Ingest, manual add, rollback, update metrics
- DELETE: Delete article or batch

### 4. Debug Endpoints (`/api/debug`)
**Consolidated 6 routes into 1:**
- `debug-env` → GET with `?type=env`
- `debug-runtime` → GET with `?type=runtime`
- `debug-static` → GET with `?type=static`
- `debug-urls` → GET with `?type=urls`
- `debug-trending` → GET with `?type=trending`
- `missing-translations` → GET with `?type=translations`

**Method:**
- GET: Various debug information based on type parameter

## Benefits

### Code Reduction
- **Before:** 25+ separate route files
- **After:** 4 consolidated route files
- **Reduction:** ~85% fewer route files

### Improved Maintainability
- Related operations grouped together
- Consistent patterns across endpoints
- Easier to understand API structure
- Reduced duplication of imports and helpers

### Better Organization
- Clear HTTP method semantics (GET for read, POST for create/action, PUT for update, DELETE for remove)
- Logical grouping by domain (tools, rankings, news, debug)
- Consistent parameter patterns (action/type query params)

## Migration Guide

### For Admin Tool Operations
```typescript
// Old
await fetch('/api/admin/check-tools-exist')
await fetch('/api/admin/delete-tools', { method: 'POST', body: { toolIds } })

// New
await fetch('/api/admin/tools?action=check-exist')
await fetch('/api/admin/tools', { method: 'POST', body: { action: 'delete', toolIds } })
```

### For Admin Rankings Operations
```typescript
// Old
await fetch('/api/admin/preview-rankings', { method: 'POST', body: { period } })
await fetch('/api/admin/ranking-periods')

// New
await fetch('/api/admin/rankings', { method: 'POST', body: { action: 'preview', period } })
await fetch('/api/admin/rankings?action=periods')
```

### For Admin News Operations
```typescript
// Old
await fetch('/api/admin/ingest-news', { method: 'POST', body: { dry_run } })
await fetch('/api/admin/ingestion-reports')

// New
await fetch('/api/admin/news', { method: 'POST', body: { action: 'ingest', dry_run } })
await fetch('/api/admin/news?action=reports')
```

### For Debug Operations
```typescript
// Old
await fetch('/api/debug-env')
await fetch('/api/debug-runtime')

// New
await fetch('/api/debug?type=env')
await fetch('/api/debug?type=runtime')
```

## Next Steps

### Remaining Consolidations (Priority)
1. Public tool endpoints (`/api/tools/*`)
2. Public ranking endpoints (`/api/rankings/*`)
3. Public news endpoints (`/api/news/*`)
4. Company endpoints (`/api/companies/*`)

### Implementation Notes
- Some imports are temporarily commented out pending module availability
- Type assertions added for backwards compatibility with existing schemas
- Placeholder implementations for external dependencies (news fetcher, ingestor)

### Testing Required
- Update all frontend API calls to use new consolidated endpoints
- Test each action/method combination
- Verify backward compatibility where needed
- Update API documentation

## File Structure After Consolidation

```
src/app/api/
├── admin/
│   ├── tools/
│   │   └── route.ts (consolidated)
│   ├── rankings/
│   │   └── route.ts (consolidated)
│   ├── news/
│   │   └── route.ts (consolidated)
│   └── [other admin routes...]
├── debug/
│   └── route.ts (consolidated)
└── [public routes to be consolidated...]
```

## Technical Debt Notes

### TypeScript Issues to Address
- Add proper types for extended Tool/Ranking schemas
- Remove type assertions once schemas updated
- Restore imports for news-ingestor, news-fetcher modules

### Module Dependencies
- `@/lib/news-ingestor` - needs implementation
- `@/lib/news-fetcher` - needs implementation
- `@/lib/ranking-news-enhancer` - needs implementation
- `@/lib/i18n/server` - needs configuration

## Summary

This consolidation reduces API route complexity by ~85%, improves code organization, and establishes clear patterns for API operations. The consolidated routes use RESTful principles with action-based routing for complex operations, making the API more maintainable and easier to understand.