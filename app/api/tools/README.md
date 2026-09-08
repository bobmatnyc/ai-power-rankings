# Tools API

Public read endpoints for tool records. All three routes read through the
Drizzle repositories in `lib/db/repositories/` (`tools.repository`,
`companies.repository`, `rankings.repository`, `news`) against the Postgres
database — there is no JSON-file data source.

## `GET /api/tools`

Source: `app/api/tools/route.ts`

No query parameters. Returns every tool with `status: "active"`
(`toolsRepo.findByStatus("active")`). Result is cached in-memory
(`CACHE_TTL.tools`).

Response body:

```json
{
  "tools": [
    {
      "id": "string",
      "slug": "string",
      "name": "string",
      "description": "string",
      "category": "string",
      "status": "active",
      "created_at": "2025-09-01T00:00:00.000Z",
      "updated_at": "2025-09-01T00:00:00.000Z",
      "tags": ["string"],
      "info": {
        "company": { "name": "string", "id": "string" },
        "product": {
          "description": "string",
          "tagline": "string",
          "pricing_model": "string",
          "license_type": "proprietary"
        },
        "links": { "website": "string", "github": "string" },
        "technical": {
          "supported_languages": ["string"],
          "ide_integrations": ["string"],
          "api_available": true
        },
        "business": { "pricing_model": "string", "free_tier": true },
        "metrics": { "swe_bench": {}, "github_stars": 0, "user_count": 0 },
        "metadata": { "logo_url": "string" }
      },
      "scoring": {
        "baseline_score": {},
        "delta_score": {},
        "current_score": 0,
        "score_updated_at": "2025-09-01T00:00:00.000Z"
      },
      "use_cases": ["string"],
      "website_url": "string",
      "logo_url": "string"
    }
  ],
  "_source": "database",
  "_timestamp": "2025-09-01T00:00:00.000Z"
}
```

The `tools[]` entry shape is the `APITool` type in `lib/types/api.ts`.
`scoring` is only present when scoring data exists for the tool. On a
database outage the route returns HTTP 503; on any other error, HTTP 500.

## `GET /api/tools/[slug]/json`

Source: `app/api/tools/[slug]/json/route.ts`

Path parameter: `slug` — the tool's slug. No query parameters. Supports
`OPTIONS` for CORS.

Looks up the tool by slug, then augments it with its entry from the current
rankings snapshot, the last 10 ranking-version snapshots that mention it, up
to 20 recent news articles that mention it (used to build metric history),
and up to 10 recent news items.

Response body:

```json
{
  "tool": {
    "id": "string",
    "slug": "string",
    "name": "string",
    "category": "string",
    "status": "active",
    "info": {},
    "website_url": "string",
    "github_repo": "string",
    "description": "string",
    "tagline": "string",
    "features": ["string"],
    "supported_languages": ["string"],
    "ide_support": ["string"],
    "pricing_model": "string",
    "license_type": "string",
    "logo_url": "string"
  },
  "ranking": {
    "rank": 1,
    "previousRank": 2,
    "rankChange": 1,
    "scores": {
      "overall": 87.2,
      "agentic_capability": 78.5,
      "innovation": 74.1,
      "technical_performance": 71.5,
      "developer_adoption": 68,
      "market_traction": 65.4,
      "business_sentiment": 74.1,
      "development_velocity": 61,
      "platform_resilience": 62.8
    }
  },
  "metrics": {
    "users": 0,
    "monthly_arr": 0,
    "swe_bench_score": 0,
    "github_stars": 0,
    "valuation": 0,
    "funding": 0,
    "employees": 0
  },
  "metricHistory": [
    {
      "metric_date": "2025-09-01T00:00:00.000Z",
      "source_name": "string",
      "source_url": "string",
      "metrics": {},
      "scoring_metrics": {},
      "published_date": "2025-09-01T00:00:00.000Z"
    }
  ],
  "rankingsHistory": [
    {
      "position": 1,
      "score": 87.2,
      "period": "2025-09-01",
      "ranking_periods": {
        "period": "2025-09-01",
        "display_name": "string",
        "calculation_date": "2025-09-01T00:00:00.000Z"
      }
    }
  ],
  "newsItems": [
    {
      "id": "string",
      "title": "string",
      "summary": "string",
      "url": "string",
      "source": "string",
      "published_at": "2025-09-01T00:00:00.000Z",
      "category": "string",
      "type": "news"
    }
  ],
  "_source": "database",
  "_timestamp": "2025-09-01T00:00:00.000Z"
}
```

`ranking`, `metricHistory`, `rankingsHistory`, and `newsItems` are each
omitted (or `null` for `ranking`) when no matching data is found — none of
the lookups are treated as fatal. Missing dimensions in `ranking.scores` are
derived from the overall score the same way `/api/rankings/current` does
(see `deriveCompleteScores` in the route file). Returns HTTP 404 if the slug
does not match a tool, HTTP 503 on a database outage, HTTP 500 on any other
error.

## `GET /api/tools/recent-updates`

Source: `app/api/tools/recent-updates/route.ts`

Query parameters:

- `days` — number of days to look back. Default `7`. Must be between `1` and
  `365` inclusive; any other value returns HTTP 400.

Returns up to 10 active tools updated within the window, most recently
updated first. Supports `OPTIONS` for CORS.

Response body:

```json
{
  "success": true,
  "tools": [
    {
      "id": "string",
      "name": "string",
      "slug": "string",
      "description": "string",
      "updatedAt": "2025-09-01T00:00:00.000Z",
      "category": "string"
    }
  ],
  "count": 1,
  "timestamp": "2025-09-01T00:00:00.000Z"
}
```

## Testing

`npm run test:api` runs `tests/e2e/api.spec.ts` (Playwright), which exercises
`/api/tools` directly (list shape, active-only filtering) alongside the
rankings, health, and news endpoint checks in the same suite.
