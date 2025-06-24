# AI Power Rankings CMS API Documentation

This document provides comprehensive documentation for interacting with the AI Power Rankings CMS API, including authentication, endpoints, and examples.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [REST API Endpoints](#rest-api-endpoints)
4. [Local API (Server-Side)](#local-api-server-side)
5. [Common Operations](#common-operations)
6. [Examples](#examples)
7. [Error Handling](#error-handling)

## Overview

The AI Power Rankings CMS is built on Payload CMS v3, providing both REST API and Local API access to all content. The API supports full CRUD operations on all collections.

### Base URL

- Development: `http://localhost:3000/api`
- Production: `https://aipowerrankings.com/api`

### Content Types

- `Content-Type: application/json`
- All responses are in JSON format

## Authentication

### API Key Authentication (Recommended for Server-to-Server)

For cron jobs and server-to-server communication:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://aipowerrankings.com/api/tools
```

### Session Authentication (Browser-Based)

The CMS uses NextAuth.js for authentication. Login via OAuth providers:

- Google OAuth (primary)
- GitHub OAuth

### User Roles

- `admin`: Full access to all operations
- `editor`: Create and edit content
- `viewer`: Read-only access

## REST API Endpoints

### Tools

#### Get All Tools

```bash
GET /api/tools

# Query parameters
?limit=20              # Number of results (default: 10, max: 100)
&page=1               # Page number
&sort=-createdAt      # Sort by field (- for descending)
&where[category][equals]=code-editor
&where[status][equals]=active
&depth=1              # Include relationships (0-2)
```

#### Get Single Tool

```bash
GET /api/tools/{id}
GET /api/tools?where[slug][equals]=cursor  # By slug
```

#### Create Tool

```bash
POST /api/tools
Content-Type: application/json

{
  "name": "New AI Tool",
  "slug": "new-ai-tool",
  "category": "code-editor",
  "subcategory": "ai-powered-ide",
  "description": [
    {
      "children": [
        { "text": "AI-powered development tool" }
      ]
    }
  ],
  "tagline": "Build faster with AI",
  "website_url": "https://example.com",
  "pricing_model": "freemium",
  "license_type": "proprietary",
  "status": "active",
  "company": "company-id-here"
}
```

#### Update Tool

```bash
PATCH /api/tools/{id}
Content-Type: application/json

{
  "current_ranking": 5,
  "is_featured": true
}
```

#### Delete Tool

```bash
DELETE /api/tools/{id}
```

### Rankings

#### Get Current Rankings

```bash
GET /api/rankings?where[period][equals]=2025-06&sort=position&limit=50
```

#### Create Ranking Entry

```bash
POST /api/rankings
{
  "period": "2025-06",
  "tool": "tool-id",
  "position": 1,
  "score": 8.5,
  "market_traction_score": 9.0,
  "technical_capability_score": 8.2,
  "developer_adoption_score": 8.8,
  "development_velocity_score": 8.1,
  "platform_resilience_score": 8.4,
  "community_sentiment_score": 8.0,
  "algorithm_version": "v6.0",
  "movement": "up",
  "movement_positions": 2,
  "previous_position": 3
}
```

### Metrics

#### Get Tool Metrics

```bash
GET /api/metrics?where[tool][equals]=tool-id&sort=-recorded_at
```

#### Record New Metric

```bash
POST /api/metrics
{
  "tool": "tool-id",
  "metric_key": "monthly_arr",
  "value": 50000000,
  "value_display": "$50M",
  "metric_type": "financial",
  "recorded_at": "2025-06-24T00:00:00Z",
  "source": "earnings_report",
  "confidence_score": 0.95
}
```

### News

#### Get Latest News

```bash
GET /api/news?sort=-published_at&limit=20&where[is_featured][equals]=true
```

#### Create News Article

```bash
POST /api/news
{
  "title": "Cursor Reaches 500K Developers",
  "slug": "cursor-500k-developers",
  "summary": "AI code editor hits major milestone",
  "content": "...",
  "tools": ["cursor-tool-id"],
  "companies": ["anysphere-company-id"],
  "category": "product_update",
  "sentiment": "positive",
  "published_at": "2025-06-24T12:00:00Z",
  "source_url": "https://example.com/article",
  "is_featured": true
}
```

### Companies

#### Get Company Details

```bash
GET /api/companies?where[slug][equals]=anthropic
```

#### Update Company

```bash
PATCH /api/companies/{id}
{
  "company_size": "medium",
  "headquarters": "San Francisco, CA",
  "website_url": "https://anthropic.com"
}
```

## Local API (Server-Side)

For server-side operations, use the Payload Local API for better performance:

```typescript
import { getPayloadClient } from "@/lib/payload-direct";

// Get Payload instance
const payload = await getPayloadClient();

// Find operations
const tools = await payload.find({
  collection: "tools",
  where: {
    category: { equals: "autonomous-agent" },
    status: { equals: "active" },
  },
  sort: "-current_ranking",
  limit: 20,
  depth: 1, // Include relationships
});

// Create operation
const newTool = await payload.create({
  collection: "tools",
  data: {
    name: "Claude Code",
    slug: "claude-code",
    // ... other fields
  },
});

// Update operation
await payload.update({
  collection: "tools",
  id: toolId,
  data: {
    current_ranking: 1,
  },
});

// Delete operation
await payload.delete({
  collection: "tools",
  id: toolId,
});

// Find by ID
const tool = await payload.findByID({
  collection: "tools",
  id: toolId,
  depth: 2, // Include nested relationships
});
```

## Common Operations

### 1. Update Tool Ranking

```typescript
// Update a tool's current ranking position
await payload.update({
  collection: "tools",
  where: { slug: { equals: "cursor" } },
  data: {
    current_ranking: 1,
  },
});
```

### 2. Record Tool Metrics

```typescript
// Record monthly ARR for a tool
const tool = await payload.find({
  collection: "tools",
  where: { slug: { equals: "github-copilot" } },
  limit: 1,
});

if (tool.docs.length > 0) {
  await payload.create({
    collection: "metrics",
    data: {
      tool: tool.docs[0].id,
      metric_key: "monthly_arr",
      value: 2000000000, // $2B
      value_display: "$2B",
      metric_type: "financial",
      recorded_at: new Date().toISOString(),
      source: "public_disclosure",
      confidence_score: 0.95,
    },
  });
}
```

### 3. Create Weekly Rankings

```typescript
// Generate rankings for a new period
const currentPeriod = "2025-W26"; // Week 26 of 2025
const tools = await payload.find({
  collection: "tools",
  where: { status: { equals: "active" } },
  limit: 100,
});

// Calculate scores and create ranking entries
for (const tool of tools.docs) {
  const scores = calculateToolScores(tool); // Your scoring logic

  await payload.create({
    collection: "rankings",
    data: {
      period: currentPeriod,
      tool: tool.id,
      position: scores.position,
      score: scores.overall,
      market_traction_score: scores.marketTraction,
      technical_capability_score: scores.technicalCapability,
      developer_adoption_score: scores.developerAdoption,
      development_velocity_score: scores.developmentVelocity,
      platform_resilience_score: scores.platformResilience,
      community_sentiment_score: scores.communitySentiment,
      algorithm_version: "v6.0",
      movement: scores.movement,
      movement_positions: scores.movementPositions,
      previous_position: scores.previousPosition,
    },
  });
}
```

### 4. Ingest News Articles

```typescript
// Ingest and link news to tools
const article = {
  title: "OpenAI Launches New Code Assistant",
  url: "https://example.com/article",
  tools: ["chatgpt", "openai-codex"],
};

// Find or create tool relationships
const toolIds = [];
for (const toolSlug of article.tools) {
  const tool = await payload.find({
    collection: "tools",
    where: { slug: { equals: toolSlug } },
    limit: 1,
  });

  if (tool.docs.length > 0) {
    toolIds.push(tool.docs[0].id);
  }
}

// Create news entry
await payload.create({
  collection: "news",
  data: {
    title: article.title,
    slug: slugify(article.title),
    source_url: article.url,
    tools: toolIds,
    category: "product_launch",
    sentiment: "positive",
    published_at: new Date().toISOString(),
  },
});
```

### 5. Bulk Update Tool Display Names

```typescript
// Fix tool_display fields
const rankings = await payload.find({
  collection: "rankings",
  where: {
    tool_display: { equals: "No Tool Selected" },
  },
  limit: 1000,
  depth: 1,
});

for (const ranking of rankings.docs) {
  if (ranking.tool && typeof ranking.tool === "object") {
    await payload.update({
      collection: "rankings",
      id: ranking.id,
      data: {
        tool_display: ranking.tool.name,
      },
    });
  }
}
```

## Examples

### Example 1: Get Top 10 Tools with Full Details

```bash
curl -X GET "https://aipowerrankings.com/api/tools?limit=10&sort=-current_ranking&depth=1" \
  -H "Accept: application/json"
```

Response:

```json
{
  "docs": [
    {
      "id": "1",
      "name": "Cursor",
      "slug": "cursor",
      "category": "code-editor",
      "company": {
        "id": "2",
        "name": "Anysphere Inc.",
        "website_url": "https://cursor.com"
      },
      "current_ranking": 1,
      "createdAt": "2025-06-23T15:40:36.303Z"
    }
  ],
  "totalDocs": 30,
  "limit": 10,
  "page": 1,
  "totalPages": 3,
  "hasNextPage": true,
  "hasPrevPage": false
}
```

### Example 2: Search Tools by Category

```typescript
const response = await fetch(
  "/api/tools?where[category][equals]=autonomous-agent&where[status][equals]=active"
);
const { docs: autonomousAgents } = await response.json();

console.log(`Found ${autonomousAgents.length} autonomous agents`);
```

### Example 3: Update Site Settings

```typescript
// Update algorithm version globally
await payload.updateGlobal({
  slug: "site-settings",
  data: {
    algorithm_version: "v6.0",
    ranking_update_frequency: "weekly",
  },
});
```

## Error Handling

### Common Error Responses

```json
// 400 Bad Request
{
  "errors": [
    {
      "message": "The following field is invalid: tool",
      "field": "tool"
    }
  ]
}

// 401 Unauthorized
{
  "error": "You are not allowed to perform this action"
}

// 404 Not Found
{
  "error": "The requested resource was not found"
}

// 500 Internal Server Error
{
  "error": "An internal server error occurred"
}
```

### Best Practices

1. **Always handle errors gracefully**

```typescript
try {
  const result = await payload.create({
    collection: "tools",
    data: toolData,
  });
  return result;
} catch (error) {
  console.error("Failed to create tool:", error);
  // Handle specific error cases
  if (error.status === 400) {
    // Validation error
  } else if (error.status === 401) {
    // Authentication error
  }
}
```

2. **Use transactions for related operations**

```typescript
// When creating a tool with metrics
const tool = await payload.create({
  collection: "tools",
  data: toolData,
});

// If this fails, consider rolling back the tool creation
const metric = await payload.create({
  collection: "metrics",
  data: {
    tool: tool.id,
    ...metricData,
  },
});
```

3. **Implement retry logic for network errors**

```typescript
import { withConnectionRetry } from "@/lib/db-connection";

const result = await withConnectionRetry(async () => {
  return await payload.find({
    collection: "tools",
    limit: 100,
  });
});
```

## Rate Limits

- **REST API**: 100 requests per minute per IP
- **Authenticated**: 1000 requests per minute per user
- **Bulk operations**: Limited to 100 items per request

## Webhook Events

Payload CMS can trigger webhooks on content changes:

```typescript
// In collection configuration
hooks: {
  afterChange: [
    async ({ doc, operation }) => {
      if (operation === "create") {
        // Trigger webhook
        await fetch("https://your-webhook-url.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "tool.created",
            data: doc,
          }),
        });
      }
    },
  ];
}
```

## Additional Resources

- [Payload CMS Documentation](https://payloadcms.com/docs)
- [TypeScript Types](/src/types/payload-types.ts)
- [Migration Guide](/docs/PAYLOAD-MIGRATION-GUIDE.md)
- [Database Schema](/docs/DATABASE.md)
