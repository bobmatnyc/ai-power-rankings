# Schema Update - June 9, 2025

## Overview

This update modernizes the database schema to use JSON for flexible tool information storage and adds metric history tracking to tool detail pages.

## Changes Made

### 1. Database Schema Updates

#### Tools Table Enhancement

- Added `info` JSONB column to the `tools` table
- Migrated existing columns into structured JSON format
- Added indexes for efficient JSON queries

**New JSON Structure:**

```json
{
  "company": {
    "name": "string",
    "website": "string",
    "founded_date": "string",
    "headquarters": "string"
  },
  "product": {
    "tagline": "string",
    "description": "string",
    "pricing_model": "string",
    "license_type": "string",
    "deployment_options": ["string"],
    "integrations": ["string"]
  },
  "links": {
    "website": "string",
    "github": "string",
    "documentation": "string",
    "pricing": "string",
    "blog": "string"
  },
  "tags": ["string"],
  "features": {
    "key_features": ["string"],
    "languages_supported": ["string"],
    "ide_support": ["string"],
    "llm_providers": ["string"]
  },
  "metadata": {
    "first_tracked_date": "string",
    "logo_url": "string",
    "last_major_update": "string",
    "acquisition_date": "string",
    "discontinued_date": "string"
  }
}
```

#### Metric History Functions

- Added `get_tool_metrics_for_scoring()` function
- Created `latest_scoring_metrics` materialized view
- Added automatic refresh triggers

### 2. Application Updates

#### TypeScript Types

- Updated `Tool` interface to use `ToolInfo` structure
- Added `MetricHistory` and `MetricValue` interfaces
- Maintained backward compatibility

#### Tool Detail Page

- Added "Metric History" tab showing scoring-relevant metrics
- Displays source, date, and metric values
- Links to original sources when available

#### API Endpoints

- Updated `/api/tools/[slug]` to:
  - Return tool info in JSON format
  - Include metric history data
  - Use materialized views for performance
- Updated `/api/tools` and `/api/rankings` for compatibility

### 3. Migration Script

Run the migration with:

```bash
npm run db:migrate:tools-json
```

Or manually:

```bash
tsx scripts/apply-tools-json-migration.ts
```

## Benefits

1. **Flexibility**: JSON storage allows adding new fields without schema changes
2. **Performance**: Materialized views and indexes optimize queries
3. **Transparency**: Users can see metric history affecting rankings
4. **Maintainability**: Cleaner data model with proper separation of concerns

## Backward Compatibility

- APIs maintain backward compatibility by transforming old fields to new structure
- Existing queries continue to work via the `tools_expanded` view
- Migration preserves all existing data

## Next Steps

1. Run the migration script
2. Update any direct SQL queries to use the new structure
3. Consider adding more metadata fields as needed
4. Update data ingestion scripts to populate the JSON structure

## Example Usage

### Updating Tool Info

```sql
-- Add company headquarters
SELECT update_tool_info('cursor', '{company,headquarters}', '"San Francisco, CA"');

-- Add tags
SELECT update_tool_info('cursor', '{tags}', '["ai-native", "ide", "code-completion"]');

-- Add features
SELECT update_tool_info('cursor', '{features,key_features}',
  '["AI pair programming", "Multi-file editing", "Natural language to code"]'
);
```

### Querying Metric History

```sql
-- Get scoring metrics for a tool
SELECT * FROM get_tool_metrics_for_scoring('cursor', 10);

-- Get latest metrics from materialized view
SELECT * FROM latest_scoring_metrics WHERE tool_id = 'cursor';
```
