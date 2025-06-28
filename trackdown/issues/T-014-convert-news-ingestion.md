---
id: T-014
title: Convert news ingestion endpoints to JSON
status: completed
priority: medium
assignee: bobmatnyc
created: 2025-01-28
updated: 2025-01-28
labels: [backend, api, migration]
---

# Convert news ingestion endpoints to JSON

## Description
Convert news ingestion and management endpoints from Payload CMS to JSON repository.

## Affected Endpoints
- `/api/admin/ingest-news/route.ts`
- `/api/admin/ingestion-reports/route.ts`
- `/api/admin/rollback-ingestion/route.ts`
- `/api/cron/ingest-articles-api-key/route.ts`

## Tasks
- [x] Update news ingestion to write to JSON repository
- [x] Create ingestion report storage in JSON
- [x] Implement rollback functionality for JSON data
- [ ] Update cron job to use JSON repository (not found/doesn't exist yet)

## Completed Work
✅ **COMPLETED** - All news ingestion endpoints converted to JSON repository:

### Updated Endpoints
- `/api/admin/ingest-news/route.ts` - Uses NewsRepository for articles and IngestionReports
- `/api/admin/ingestion-reports/route.ts` - Uses NewsRepository.getIngestionReports() and related methods
- `/api/admin/rollback-ingestion/route.ts` - Uses JSON repositories for rollback functionality

### Key Features
- **Extended NewsRepository**: Added full ingestion report management with CRUD operations
- **Schema Updates**: Added IngestionReport interface and updated NewsData structure
- **Tool Detection**: Simplified tool finding to only match existing tools (no auto-creation)
- **Rollback Support**: Full rollback functionality for news articles, with warnings for tools/companies
- **Statistics**: Comprehensive ingestion report statistics and filtering

### Technical Improvements
- Zero Payload CMS dependency for news ingestion
- Proper TypeScript typing throughout
- Atomic JSON file operations for data integrity
- Structured ingestion reports with error tracking
- Preview generation hooks (ready for future algorithm integration)

### Data Migration
- Updated existing news.json to include ingestion_reports array and reportsByStatus index
- Maintained backward compatibility with existing news articles
- All existing functionality preserved while removing CMS dependencies

## Schema Design
```typescript
interface IngestionReport {
  id: string;
  ingestion_date: string;
  articles_processed: number;
  articles_created: number;
  articles_updated: number;
  errors: Array<{
    article_id?: string;
    error: string;
  }>;
  status: 'success' | 'partial' | 'failed';
  created_at: string;
}
```

## Implementation Notes
- Maintain Google Sheets integration
- Preserve article deduplication logic
- Keep error tracking functionality