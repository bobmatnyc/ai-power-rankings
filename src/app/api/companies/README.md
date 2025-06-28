# Companies API

## Overview
The companies API provides endpoints for managing company data using the JSON database.

## Endpoints

### List Companies
**GET** `/api/companies`

Query parameters:
- `limit` - Number of items per page (default: 50)
- `page` - Page number (default: 1)
- `search` - Search companies by name or description
- `size` - Filter by company size (startup, small, medium, large, enterprise)

Response:
```json
{
  "companies": [...],
  "total": 27,
  "page": 1,
  "totalPages": 1,
  "hasMore": false,
  "_source": "json-db"
}
```

### Get Company
**GET** `/api/companies/[id]`

Get company by ID or slug. Includes associated tools.

Response:
```json
{
  "company": {
    "id": "...",
    "slug": "anthropic",
    "name": "Anthropic",
    "tools": [...]
  },
  "_source": "json-db"
}
```

### Create Company
**POST** `/api/companies`

Request body:
```json
{
  "name": "Company Name",
  "description": "Description",
  "website": "https://example.com",
  "founded": "2020",
  "headquarters": "San Francisco, CA",
  "size": "startup",
  "funding_total": 1000000,
  "last_funding_round": "Series A",
  "investors": ["Investor 1", "Investor 2"]
}
```

### Update Company
**PUT** `/api/companies/[id]`

Update company by ID or slug. Request body contains fields to update.

### Delete Company
**DELETE** `/api/companies/[id]`

Delete company by ID or slug. Will fail if company has associated tools.

### Get Company Tools
**GET** `/api/companies/[id]/tools`

Get all tools associated with a company.

Response:
```json
{
  "company": {
    "id": "...",
    "slug": "anthropic",
    "name": "Anthropic"
  },
  "tools": [...],
  "total": 2,
  "_source": "json-db"
}
```

### Company Statistics
**GET** `/api/companies/stats`

Get aggregated statistics about companies.

Response:
```json
{
  "stats": {
    "totalCompanies": 27,
    "companiesWithTools": 20,
    "companiesWithoutTools": 7,
    "sizeDistribution": {
      "startup": 15,
      "small": 3,
      "medium": 2,
      "large": 5,
      "enterprise": 2
    },
    "averageToolsPerCompany": "1.5"
  },
  "topCompanies": [...],
  "_source": "json-db"
}
```

## Migration Status
✅ All company endpoints have been migrated to use the JSON database.

## Testing
Run tests with: `npm run test:api:companies` (test script to be created)