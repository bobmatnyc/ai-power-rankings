# Payload CMS Developer Guide

This guide covers everything developers need to know about managing and working with Payload CMS in the AI Power Rankings project.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Development Setup](#development-setup)
4. [Authentication & Security](#authentication--security)
5. [Collections](#collections)
6. [API Access](#api-access)
7. [Database Management](#database-management)
8. [Admin Panel](#admin-panel)
9. [Common Tasks](#common-tasks)
10. [Troubleshooting](#troubleshooting)
11. [Best Practices](#best-practices)

## Overview

AI Power Rankings uses Payload CMS v3 as its content management system. Payload provides:

- **Headless CMS** with REST and GraphQL APIs
- **Admin UI** for content management
- **TypeScript-first** development
- **PostgreSQL** database via Supabase
- **NextAuth** integration for authentication
- **API key** support for programmatic access

### Key Files

- `/payload.config.ts` - Main Payload configuration
- `/src/collections/*.ts` - Collection definitions
- `/src/types/payload-types.ts` - Auto-generated TypeScript types
- `/src/lib/payload-direct.ts` - Server-side Payload client

## Architecture

### Integration with Next.js

Payload is integrated directly into the Next.js application:

```typescript
// payload.config.ts
export default buildConfig({
  secret: process.env["PAYLOAD_SECRET"],
  db: postgresAdapter({
    pool: {
      connectionString: process.env["SUPABASE_DATABASE_URL"],
    },
    schemaName: "payload",
  }),
  // ... rest of config
});
```

### Database Schema

Payload manages its own schema within the `payload` schema in PostgreSQL:

- Collections are prefixed with `payload_`
- Relationships use foreign keys
- Migrations are tracked in `payload_migrations`
- All content is versioned (if enabled)

## Development Setup

### 1. Environment Variables

Required environment variables for Payload:

```bash
# Payload Secret (required)
PAYLOAD_SECRET="your-secret-key-min-32-chars"

# Database (uses Supabase)
SUPABASE_DATABASE_URL="postgresql://..."

# Email (optional, for notifications)
RESEND_API_KEY="re_..."
EMAIL_FROM="noreply@aipowerranking.com"
```

### 2. Database Setup

Payload automatically creates its schema on first run:

```bash
# Start dev server (creates tables if needed)
pnpm dev

# Access admin panel
open http://localhost:3000/admin
```

### 3. TypeScript Types

Generate TypeScript types after schema changes:

```bash
# Automatic generation on dev server start
pnpm dev

# Manual generation
pnpm payload generate:types
```

## Authentication & Security

### OAuth Integration

Primary authentication uses NextAuth with Google OAuth:

```typescript
// Only specific email is allowed admin access
if (session.user?.email === "bob@matsuoka.com") {
  // Grant admin access
}
```

### API Key Authentication

API keys are enabled for programmatic access:

1. Login to admin panel
2. Navigate to Users collection
3. Generate an API key for your user
4. Enable "Enable API Key" checkbox
5. Use in requests:

```bash
curl -H "Authorization: users API-Key YOUR_KEY" \
  http://localhost:3000/api/tools
```

### User Roles

- **admin**: Full access to all operations
- **editor**: Create and edit content
- **viewer**: Read-only access

## Collections

### Core Collections

#### Tools
Primary collection for AI coding tools:
- Slug-based URLs
- Company relationships
- Rich text descriptions
- Status tracking
- SEO metadata

#### Companies
Organizations behind the tools:
- Funding information
- Size categories
- Contact details
- Related tools

#### Rankings
Monthly ranking snapshots:
- Position tracking
- Score breakdowns
- Movement indicators
- Algorithm version

#### Metrics
Time-series data for tools:
- Financial metrics (ARR, funding)
- Usage metrics (users, downloads)
- Performance metrics (benchmarks)
- Source attribution

#### News
Articles and updates:
- Tool relationships
- Sentiment analysis
- Category classification
- Source URLs

### Collection Hooks

Payload collections support lifecycle hooks:

```typescript
// Example: Auto-generate slug
hooks: {
  beforeChange: [
    ({ data }) => {
      if (data.name && !data.slug) {
        data.slug = slugify(data.name);
      }
      return data;
    },
  ],
}
```

## API Access

### REST API

All collections are available via REST API:

```typescript
// GET all tools
GET /api/tools

// GET with filters
GET /api/tools?where[category][equals]=code-editor

// CREATE new tool
POST /api/tools
Content-Type: application/json
Authorization: users API-Key YOUR_KEY

// UPDATE tool
PATCH /api/tools/{id}

// DELETE tool
DELETE /api/tools/{id}
```

### Local API (Server-Side)

For server-side operations, use the Payload Local API:

```typescript
import { getPayloadClient } from "@/lib/payload-direct";

const payload = await getPayloadClient();

// Find tools
const tools = await payload.find({
  collection: "tools",
  where: { status: { equals: "active" } },
  sort: "-current_ranking",
  depth: 1, // Include relationships
});

// Create tool
const tool = await payload.create({
  collection: "tools",
  data: { name: "New Tool", ... },
});
```

### GraphQL API

GraphQL is also available at `/api/graphql`:

```graphql
query GetTools {
  Tools(limit: 10, where: { status: { equals: "active" } }) {
    docs {
      id
      name
      slug
      category
      company {
        name
      }
    }
  }
}
```

## Database Management

### Direct Database Access

When needed, access the database directly:

```typescript
import { supabaseAdmin } from "@/lib/database";

// Query Payload tables
const { data } = await supabaseAdmin
  .from("payload_tools")
  .select("*")
  .eq("status", "active");
```

### Migrations

Payload handles migrations automatically:

```bash
# Migrations are applied on startup
pnpm dev

# Check migration status
SELECT * FROM payload.payload_migrations;
```

### Backup Considerations

- Payload tables are in the `payload` schema
- Include in regular Supabase backups
- Critical tables: tools, companies, rankings, metrics

## Admin Panel

### Accessing the Admin Panel

```
http://localhost:3000/admin
```

Features:
- Visual content editor
- Bulk operations
- Live preview
- Version history (if enabled)
- Media management

### Customizing the Admin UI

```typescript
// In collection config
admin: {
  useAsTitle: "name",
  defaultColumns: ["name", "category", "status"],
  group: "Content",
  description: "Manage AI coding tools",
}
```

### Admin Components

Custom fields and components:

```typescript
fields: [
  {
    name: "custom_field",
    type: "text",
    admin: {
      position: "sidebar",
      description: "Help text here",
      condition: (data) => data.status === "active",
    },
  },
]
```

## Common Tasks

### 1. Adding a New Tool

```typescript
const payload = await getPayloadClient();

// Check if company exists
const company = await payload.find({
  collection: "companies",
  where: { slug: { equals: "anthropic" } },
});

// Create tool
const tool = await payload.create({
  collection: "tools",
  data: {
    name: "Claude",
    slug: "claude",
    category: "code-assistant",
    company: company.docs[0]?.id,
    status: "active",
    description: "AI assistant for coding",
    website_url: "https://claude.ai",
  },
});
```

### 2. Recording Metrics

```typescript
// Record monthly active users
await payload.create({
  collection: "metrics",
  data: {
    tool: toolId,
    metric_key: "monthly_active_users",
    value: 500000,
    value_display: "500K",
    metric_type: "usage",
    recorded_at: new Date().toISOString(),
    source: "official_blog",
    confidence_score: 0.95,
  },
});
```

### 3. Generating Rankings

```typescript
// See /src/scripts/generate-rankings.ts for full implementation
const tools = await payload.find({
  collection: "tools",
  where: { status: { equals: "active" } },
});

for (const tool of tools.docs) {
  const score = calculateScore(tool);
  await payload.create({
    collection: "rankings",
    data: {
      period: "2025-06",
      tool: tool.id,
      position: score.rank,
      score: score.total,
      // ... other scores
    },
  });
}
```

### 4. Bulk Operations

```typescript
// Update all tools in a category
const tools = await payload.find({
  collection: "tools",
  where: { category: { equals: "code-editor" } },
  limit: 100,
});

for (const tool of tools.docs) {
  await payload.update({
    collection: "tools",
    id: tool.id,
    data: { subcategory: "ai-enhanced-editor" },
  });
}
```

## Troubleshooting

### Common Issues

#### 1. "Cannot connect to database"
- Check `SUPABASE_DATABASE_URL` is set
- Verify database is accessible
- Check connection pool settings

#### 2. "Unauthorized" errors
- Verify API key is correct
- Check user has correct role
- Ensure authentication headers are set

#### 3. "Type errors after schema change"
- Regenerate types: `pnpm dev`
- Restart TypeScript server in VS Code
- Check for circular dependencies

#### 4. "Migration failed"
- Check database permissions
- Review migration files in `/src/migrations`
- Manually run failed migrations if needed

### Debug Mode

Enable debug logging:

```typescript
// In payload.config.ts
db: postgresAdapter({
  logger: true, // Enable query logging
}),
```

### Database Queries

Monitor Payload queries:

```sql
-- Check recent queries
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
WHERE query LIKE '%payload%'
ORDER BY mean_exec_time DESC;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'payload'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Best Practices

### 1. Use Slugs for URLs

Always use slugs instead of IDs for public-facing URLs:

```typescript
// Good
const tool = await payload.find({
  collection: "tools",
  where: { slug: { equals: "cursor" } },
});

// Avoid
const tool = await payload.findByID({
  collection: "tools",
  id: "123456",
});
```

### 2. Optimize Queries

Use depth parameter wisely:

```typescript
// Only include needed relationships
const tools = await payload.find({
  collection: "tools",
  depth: 1, // Include direct relationships only
  select: {
    name: true,
    slug: true,
    company: true,
  },
});
```

### 3. Handle Relationships

Always check relationship data:

```typescript
// Safe relationship access
const companyName = tool.company && typeof tool.company === "object"
  ? tool.company.name
  : "Unknown Company";
```

### 4. Cache Expensive Operations

Use cache for rankings and aggregations:

```typescript
import { cacheManager } from "@/lib/cache/cache-manager";

const rankings = await cacheManager.get("rankings");
if (!rankings) {
  const fresh = await generateRankings();
  await cacheManager.set("rankings", fresh);
  return fresh;
}
```

### 5. Validate Data

Use Payload's built-in validation:

```typescript
fields: [
  {
    name: "website_url",
    type: "text",
    validate: (value) => {
      if (!value) return true; // Optional
      try {
        new URL(value);
        return true;
      } catch {
        return "Must be a valid URL";
      }
    },
  },
]
```

### 6. Monitor Performance

Track slow queries and optimize:

```typescript
// Add query timing
console.time("fetch-tools");
const tools = await payload.find({
  collection: "tools",
  limit: 100,
});
console.timeEnd("fetch-tools");
```

## Related Documentation

- [PAYLOAD-CMS-API.md](./PAYLOAD-CMS-API.md) - API reference for Claude.AI
- [DATABASE.md](./DATABASE.md) - Database schema and queries
- [CACHE.md](./CACHE.md) - Caching strategy
- [Payload Docs](https://payloadcms.com/docs) - Official documentation