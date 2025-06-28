# Tools API Migration Status

## Overview
The tools API is being migrated from Supabase/Payload CMS to the JSON database.

## Endpoints

### Main Tools Endpoint
- **Current**: `/api/tools/route.ts` - Uses Payload CMS with cache fallback
- **JSON Version**: `/api/tools/route.json.ts` - Uses JSON database
- **New JSON API**: `/api/tools/json/route.ts` - Enhanced JSON API with more features

### Tool Details
- **Current**: `/api/tools/[slug]/route.ts` - Uses Payload CMS
- **JSON Version**: `/api/tools/[slug]/json/route.ts` - Uses JSON database

### Additional Endpoints
- `/api/tools/categories` - Get all tool categories with counts
- `/api/tools/stats` - Get tool statistics and analytics

## Migration Steps

1. ✅ Created JSON database infrastructure
2. ✅ Migrated 30 tools from cache
3. ✅ Created new API endpoints using JSON data
4. ⏳ Update main `/api/tools` route to use JSON (rename route.json.ts to route.ts)
5. ⏳ Update `/api/tools/[slug]` route to use JSON
6. ⏳ Update frontend to use new endpoints
7. ⏳ Remove Supabase/Payload dependencies

## Query Parameters

### `/api/tools/json`
- `limit` - Number of items per page (default: 1000)
- `page` - Page number (default: 1)
- `category` - Filter by category
- `status` - Filter by status (active, inactive, deprecated)
- `search` - Search in name and description
- `includeDeprecated` - Include deprecated tools (default: false)

### Response Format
All endpoints return consistent response format with `_source: "json-db"` to indicate data source.

## Testing
Run `npm run test:api:tools` to test all tools API endpoints.

## Tool Schema
```typescript
interface Tool {
  id: string;
  slug: string;
  name: string;
  display_name: string;
  category: string;
  subcategory?: string;
  description?: string;
  tagline?: string;
  status: 'active' | 'inactive' | 'deprecated';
  launch_date?: string;
  company_id?: string;
  website_url?: string;
  github_repo?: string;
  documentation_url?: string;
  logo_url?: string;
  pricing_model?: string;
  pricing_tiers?: any[];
  license_type?: string;
  key_features?: string[];
  supported_platforms?: string[];
  integration_capabilities?: string[];
  target_audience?: string[];
  use_cases?: string[];
  created_at: string;
  updated_at: string;
}
```