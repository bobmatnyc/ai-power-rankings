# Rankings API

Public read endpoints for tool rankings. All three routes read through the
Drizzle repositories in `lib/db/repositories/` (`rankings.repository`,
`tools.repository`) against the Postgres database — there is no JSON-file
data source.

## `GET /api/rankings`

Source: `app/api/rankings/route.ts`

Returns one list's current board with resolved tool details (#186).

| Parameter | Values | Default |
|---|---|---|
| `list` (alias `kind`) | `harness`, `model`, `productivity`, or the slugs `coding-harnesses`, `models`, `productivity-tools` | `harness` |

An unknown list is a 400 whose body lists the valid ones. Every response
names its `list` and carries `list_meta` (`entry_count`, `indexable`,
`tier_scheme`, `provisional_note`). Ranks, `previousRank`, `rankChange` and
`tier` are counted within the list; a list below 10 entries uses S/A/B tiers
by thirds. Rules: `lib/rankings/lists.ts`. #185: the board is the list's own
current row; a list with no current row returns the empty board, never the
legacy combined board.

In `NODE_ENV=test`, this route returns mock data from
`lib/test-utils/mock-rankings` instead of querying the database.

Response body:

```json
{
  "rankings": [
    {
      "rank": 1,
      "previousRank": 2,
      "rankChange": 1,
      "changeReason": "string",
      "tool": {
        "id": "string",
        "slug": "string",
        "name": "string",
        "category": "string",
        "status": "active",
        "website_url": "string",
        "logo": "string",
        "description": "string"
      },
      "total_score": 87.2,
      "scores": {
        "overall": 87.2,
        "base_score": 80,
        "news_impact": 12.4,
        "agentic_capability": 8.7,
        "innovation": 8.1
      },
      "metrics": {
        "news_articles_count": 3,
        "recent_funding_rounds": 0,
        "recent_product_launches": 1,
        "users": 120000,
        "swe_bench_score": 62.3
      },
      "tier": "S"
    }
  ],
  "published_at": "2025-09-01T00:00:00.000Z",
  "period": "2025-09",
  "algorithm": {
    "version": "v1.0",
    "name": "Database Rankings",
    "date": "2025-09-01T00:00:00.000Z",
    "weights": { "newsImpact": 0.3, "baseScore": 0.7 }
  },
  "stats": {
    "total_tools": 31,
    "tools_with_news": 12,
    "avg_news_boost": 4.1,
    "max_news_impact": 18.2
  },
  "_source": "database",
  "_timestamp": "2025-09-01T00:00:00.000Z"
}
```

If no rankings are marked current, the route returns the same shape with an
empty `rankings` array and `_source: "empty"`. On a database outage it
returns HTTP 503; on an unexpected error, HTTP 500.

## `GET /api/rankings/current`

Source: `app/api/rankings/current/route.ts`

#185: returns one list's current board, never the legacy combined board.
`list` (alias `kind`) takes the same values as `/api/rankings`; absent means
`harness`; an unknown, empty or conflicting value is 400. `data` also
carries `list` and `list_meta`. Result is cached in-memory for 60 seconds per
list (`CACHE_TTL.rankings`). Supports `OPTIONS` for CORS.

Response body:

```json
{
  "success": true,
  "data": {
    "period": "2025-09",
    "algorithm_version": "v1.0",
    "rankings": [
      {
        "tool_id": "string",
        "tool_name": "string",
        "tool_slug": "string",
        "description": "string",
        "website_url": "string",
        "logo": "string",
        "position": 1,
        "score": 87.2,
        "tier": "S",
        "factor_scores": {
          "overall": 87.2,
          "agentic_capability": 78.5,
          "innovation": 74.1,
          "technical_performance": 71.5,
          "developer_adoption": 68,
          "market_traction": 65.4,
          "business_sentiment": 74.1,
          "development_velocity": 61,
          "platform_resilience": 62.8
        },
        "movement": { "previous_position": 2, "change": 1, "direction": "up" },
        "category": "string",
        "status": "active",
        "tool": {}
      }
    ],
    "metadata": { "total_tools": 31, "generated_at": "2025-09-01T00:00:00.000Z", "is_current": true }
  },
  "timestamp": "2025-09-01T00:00:00.000Z",
  "statusCode": 200
}
```

`factor_scores` dimensions that are missing from the stored ranking are
derived from the overall `score` using fixed multipliers (see
`deriveCompleteScores` in the route file) so all nine dimensions are always
present. `tool` is the full tool record from `tools.repository`, or `null` if
it could not be resolved.

When the list has no current row, the route returns
`{ success: false, error, list, message, timestamp, statusCode: 404 }`.
#185: only a 200 is cached (in memory and with a public `s-maxage`); a 404,
500 or 503 is `Cache-Control: no-store`. A per-list publish clears the
in-memory entries and revalidates the `rankings` tag. On a
database outage it returns `statusCode: 503`; on an unexpected error, HTTP
500.

## `GET /api/rankings/trending`

Source: `app/api/rankings/trending/route.ts`

Query parameters:

- `months` — `number | "all"`. Default `"all"`. Any value that does not parse
  as a positive integer is ignored and treated as `"all"`.
- `list` (alias `kind`) — #185, as for `/api/rankings`; default `harness`.

Reads every stored board of the list (`rankingsRepository.findAllForList()`)
and analyzes movement in and out of the top 10 via
`lib/trending-analyzer.ts`. A list's history starts at its first per-list
publish; the legacy combined rows are not read. Result is cached in-memory
for 1 hour, keyed by list and `months`. The body also names its `list`.
Supports `OPTIONS` for CORS.

Response body:

```json
{
  "periods": ["2025-06", "2025-07", "2025-08", "2025-09"],
  "tools": [
    {
      "tool_id": "string",
      "tool_name": "string",
      "periods_in_top10": 4,
      "best_position": 1,
      "current_position": 1
    }
  ],
  "chart_data": [
    { "period": "2025-06", "date": "Jun 2025", "1": 1, "2": 3 }
  ],
  "metadata": {
    "total_periods": 4,
    "date_range": { "start": "2025-06", "end": "2025-09" },
    "top_tools_count": 10
  }
}
```

If the list has no stored boards, the route returns HTTP 200 with empty
`periods`/`tools`/`chart_data` arrays and a `warning` string. #185: a failed
read is HTTP 500, never an empty 200.

## Testing

`npm run test:api` runs `tests/e2e/api.spec.ts` (Playwright), which exercises
`/api/rankings/current` and `/api/rankings/trending` directly, including
response shape, cache headers, and response-time checks.
