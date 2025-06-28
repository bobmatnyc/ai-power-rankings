# News API Migration Status

## Overview
The news API has been migrated to use the JSON database instead of Payload CMS.

## Endpoints

### Main News Endpoint
- **Current**: `/api/news/route.ts` - Still uses Payload CMS with cache fallback
- **JSON Version**: `/api/news/route.json.ts` - Uses JSON database
- **New JSON API**: `/api/news/json/route.ts` - Enhanced JSON API with more features

### Additional Endpoints
- `/api/news/[id]` - Get/Update/Delete single article
- `/api/news/recent` - Get recent articles
- `/api/news/by-date` - Get articles by date or available dates
- `/api/news/tags` - Get all tags with counts

## Migration Steps

1. ✅ Created JSON database infrastructure
2. ✅ Migrated 18 news articles from production export
3. ✅ Created new API endpoints using JSON data
4. ⏳ Update main `/api/news` route to use JSON (rename route.json.ts to route.ts)
5. ⏳ Update frontend to use new endpoints
6. ⏳ Remove Payload CMS dependencies

## Testing
Run `npm run test:api:news` to test all news API endpoints.

## Query Parameters

### `/api/news/json`
- `limit` - Number of items per page (default: 20)
- `page` - Page number (default: 1)
- `filter` - Filter by event type: all, milestone, feature, partnership, announcement, update
- `toolId` - Filter by tool ID
- `tag` - Filter by tag
- `search` - Search in title and summary

### `/api/news/recent`
- `limit` - Number of items (default: 10)

### `/api/news/by-date`
- `date` - Date in YYYY-MM format
- `availableOnly` - If true, returns list of available dates with counts

### Response Format
All endpoints return consistent response format with `_source: "json-db"` to indicate data source.