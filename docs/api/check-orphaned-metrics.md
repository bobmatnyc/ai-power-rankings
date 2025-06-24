# Check Orphaned Metrics API

## Overview

The `/api/admin/check-orphaned-metrics` endpoint helps identify metrics that have null or missing tool relationships. This is useful for data integrity checks and understanding why some metrics might not be properly associated with tools.

## Endpoints

### GET /api/admin/check-orphaned-metrics

Analyzes all metrics in the system to find:

- Metrics without any tool relationship
- Metrics with invalid tool IDs (tool ID exists but tool doesn't)

**Response:**

```json
{
  "totalMetrics": 1234,
  "orphanedMetrics": [...],
  "orphanedCount": 5,
  "metricsWithInvalidTools": [...],
  "invalidToolsCount": 3,
  "metricsByKey": {
    "github_stars": 150,
    "weekly_downloads": 120,
    ...
  },
  "summary": {
    "hasOrphans": true,
    "hasInvalidTools": true,
    "totalIssues": 8
  }
}
```

### POST /api/admin/check-orphaned-metrics

Fix orphaned metrics by either deleting them or assigning them to a tool.

**Delete orphaned metrics:**

```json
{
  "action": "delete",
  "metricIds": ["metric-id-1", "metric-id-2"]
}
```

**Assign metrics to a tool:**

```json
{
  "action": "assign",
  "metricIds": ["metric-id-1", "metric-id-2"],
  "targetToolId": "tool-id"
}
```

## Usage

### Command Line Script

Run the check script:

```bash
npm run check:orphaned-metrics
```

### Direct API Call

```bash
# Check for orphaned metrics
curl http://localhost:3000/api/admin/check-orphaned-metrics

# Delete specific orphaned metrics
curl -X POST http://localhost:3000/api/admin/check-orphaned-metrics \
  -H "Content-Type: application/json" \
  -d '{"action": "delete", "metricIds": ["metric-id-1"]}'

# Assign orphaned metrics to a tool
curl -X POST http://localhost:3000/api/admin/check-orphaned-metrics \
  -H "Content-Type: application/json" \
  -d '{"action": "assign", "metricIds": ["metric-id-1"], "targetToolId": "tool-id"}'
```

## Why Metrics Might Be Orphaned

1. **Migration Issues**: During data migration from Supabase to Payload, tool relationships might not have been properly mapped
2. **Deleted Tools**: If a tool was deleted but its metrics weren't cleaned up
3. **Failed Imports**: Partial failures during bulk metric imports
4. **Invalid Tool IDs**: Tool IDs that don't correspond to any existing tool in the system

## Notes

- The `tool` field in the Metrics collection is marked as required, so new orphaned metrics shouldn't be created
- This endpoint is primarily useful for identifying and fixing legacy data issues
- Always review orphaned metrics before deleting them to ensure no important data is lost
