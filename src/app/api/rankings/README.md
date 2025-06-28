# Rankings API Migration Status

## Overview
The rankings API is being migrated from Payload CMS to the JSON database.

## Public Endpoints

### Get Current Rankings
**GET** `/api/rankings`
- **Current**: `route.ts` - Uses Payload CMS with news-enhanced algorithm
- **JSON Version**: `route.json.ts` - Uses JSON database

### Get Rankings with Options
**GET** `/api/rankings/json`

Query parameters:
- `period` - Specific period (YYYY-MM format). If not provided, returns current period
- `limit` - Number of rankings to return (default: 100)

Response includes tool details, scores, movement, and tier information.

### Get Available Periods
**POST** `/api/rankings/json`

Request body:
```json
{
  "action": "get-periods"
}
```

## Admin Endpoints

### List All Periods
**GET** `/api/admin/rankings/periods`

Returns all ranking periods with metadata.

### Get/Update/Delete Period
**GET/PUT/DELETE** `/api/admin/rankings/[period]`

Manage specific ranking periods.

### Build New Rankings
**POST** `/api/admin/rankings/build`

Request body:
```json
{
  "period": "2025-07",
  "preview_date": "2025-07-01" // Optional
}
```

Builds rankings using the v6-news algorithm.

### Set Current Period
**POST** `/api/admin/rankings/set-current`

Request body:
```json
{
  "period": "2025-06"
}
```

## Migration Steps

1. ✅ Created JSON database infrastructure
2. ✅ Migrated 38 rankings for June 2025
3. ✅ Created new API endpoints using JSON data
4. ✅ Created admin endpoints for managing rankings
5. ⏳ Update main `/api/rankings` route to use JSON (rename route.json.ts to route.ts)
6. ⏳ Update frontend to use new endpoints
7. ⏳ Remove Payload CMS dependencies

## Data Structure

### Ranking Entry
```typescript
{
  tool_id: string;
  tool_name: string;
  position: number;
  score: number;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  factor_scores: {
    agentic_capability: number;
    innovation: number;
    technical_performance: number;
    developer_adoption: number;
    market_traction: number;
    business_sentiment: number;
    development_velocity: number;
    platform_resilience: number;
  };
  movement?: {
    previous_position?: number;
    change: number;
    direction: 'up' | 'down' | 'same' | 'new';
  };
  change_analysis?: {
    primary_reason?: string;
    narrative_explanation?: string;
  };
}
```

## Algorithm

The v6-news algorithm uses:
- 70% base score (from tool category)
- 30% news impact score (from recent news coverage)

Categories have different base scores ranging from 45-75.

## Testing
Run `npm run test:api:rankings` to test all rankings API endpoints.