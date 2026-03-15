# Non-AI Tool Deletion Report

**Date:** 2026-03-15
**Status:** Completed
**Database:** ep-dark-firefly-adp1p3v8 (development/main branch)

## Summary

9 non-AI-coding tools were identified and permanently deleted from the tools table. Total tool count dropped from 137 to 128.

## Working Database Connection

The working connection is `DATABASE_URL_DEVELOPMENT` (and the pooled variant used in the backup `.env.local.bak`):

```
postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-dark-firefly-adp1p3v8-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

The current `.env.local` has two URLs pointing to different (empty) Neon branches:
- `DATABASE_URL` (pooled): `ep-bold-sunset-adneqlo6` — authentication fails (expired)
- `DATABASE_URL_UNPOOLED`: `ep-autumn-glitter-ad1uqvfm` — connects but has 0 tools (empty branch)

The live data is on `ep-dark-firefly-adp1p3v8`, found in `.env.local.bak`.

## Deleted Tools

| UUID | Name | Slug | Category | Created At | Source |
|------|------|------|----------|------------|--------|
| e37318be-2675-4ece-a9f5-9fa679977584 | AI coding tools | ai-coding-tools | other | 2026-03-12 | autoCreated |
| 6289c4b5-dcd1-4af1-97c0-6038991184c5 | Apache Iceberg | apache-iceberg | other | 2026-03-14 | autoCreated |
| ddc22266-3280-463d-9f4f-57694bcb23c7 | Armadin autonomous cybersecurity agents | armadin-autonomous-cybersecurity-agents | other | 2026-03-14 | autoCreated |
| baae14fc-dbf5-451b-9447-372a3e95102c | Playwright | playwright | other | 2026-03-14 | autoCreated |
| 11e53190-71ec-4263-b12f-e6508a1c635a | Potpie | potpie | other | 2026-03-12 | autoCreated |
| 3a4b322e-8bf4-4ec4-b9ac-a1debdf2cdf0 | Tower | tower | other | 2026-03-14 | autoCreated |
| 30a90a6c-e082-450c-8e11-70b158c0039a | Tower Python SDK | tower-python-sdk | other | 2026-03-14 | autoCreated |
| 7d9a798d-740f-4a86-bf98-f0a9b4d356d1 | Vib-OS | vib-os | other | 2026-03-10 | autoCreated |
| 8790a819-39d3-4182-8da8-cd87ca065a20 | gws | gws | other | 2026-03-13 | autoCreated |

## Root Cause: Auto-Creation Mechanism

All 9 tools were created by the article ingestion system via `ArticlesEntitiesService.createAutoTool()` in:

```
lib/db/repositories/articles/articles-entities.service.ts
```

When the ingestion pipeline processes an article and detects a new entity mentioned (tool name), it calls `createAutoTool()` which inserts into the `tools` table with:
- `category: "other"`
- `status: "active"`
- `data.autoCreated: true`
- `data.createdByArticleId: <article UUID>`

There is **no validation or allowlist** that checks whether an auto-created entity is actually an AI coding tool. Any mentioned technology name can become a tool record.

### Triggering Articles

| Tool slug | Article that triggered creation |
|-----------|--------------------------------|
| playwright | "Stockholm's Endform secures 1.5M to accelerate AI-driven te..." |
| tower | "Tower raises 5.5m to empower data engineers in the AI era" |
| apache-iceberg | "Tower raises 5.5m..." (same article) |
| armadin-autonomous-cybersecurity-agents | "Mandiant's founder just raised 190M for his autonomous AI a..." |
| potpie | "Potpie AI raises 2.2 million to help AI agents operate in c..." |
| vib-os | "Entirely Vibe-Coded Operating System Is a Bug-Filled Disaste..." |
| gws | "Google made Gmail and Drive easier for AI agents to use" |
| ai-coding-tools | (article unknown — created 2026-03-12) |

## Deletion Method

Direct SQL via the Neon serverless driver (no TypeScript compilation required):

```javascript
const {neon} = require('@neondatabase/serverless');
const sql = neon(DATABASE_URL);

const targetIds = [
  'e37318be-2675-4ece-a9f5-9fa679977584',
  '6289c4b5-dcd1-4af1-97c0-6038991184c5',
  'ddc22266-3280-463d-9f4f-57694bcb23c7',
  'baae14fc-dbf5-451b-9447-372a3e95102c',
  '11e53190-71ec-4263-b12f-e6508a1c635a',
  '3a4b322e-8bf4-4ec4-b9ac-a1debdf2cdf0',
  '30a90a6c-e082-450c-8e11-70b158c0039a',
  '7d9a798d-740f-4a86-bf98-f0a9b4d356d1',
  '8790a819-39d3-4182-8da8-cd87ca065a20',
];

await sql`DELETE FROM tools WHERE id = ANY(${targetIds}) RETURNING id, slug, name`;
```

No cascading deletes were needed: the `tools` table has no FK constraints. The 6 articles that had these tools in `tool_mentions` were not modified — the mentions are denormalized text/JSONB references, not FK-enforced rows. The `article_rankings_changes` table had zero references to these tool IDs.

## Existing Script Reference

A prior deletion script exists at `scripts/delete-invalid-tools.ts` and was used to remove a previous batch of non-AI tools (GitLab, Jira, Docker, VS Code, etc.). This confirms the problem has recurred.

## Recommended Fixes

### 1. Add category allowlist to `createAutoTool()`

In `lib/db/repositories/articles/articles-entities.service.ts`, before inserting, validate the inferred category against a list of acceptable AI coding tool categories:

```typescript
const VALID_AI_TOOL_CATEGORIES = [
  'code-editor', 'autonomous-agent', 'code-completion',
  'code-review', 'ai-assistant', 'chat-assistant',
  'testing', 'documentation', 'devtools'
];

// Reject if category is 'other' or not in the allowlist
if (!VALID_AI_TOOL_CATEGORIES.includes(toolData.category)) {
  console.log(`[ArticlesEntitiesService] Skipping auto-creation of non-AI tool: ${toolData.name}`);
  return null; // caller must handle null
}
```

### 2. Add a slug blocklist for known non-AI packages

Maintain a blocklist (or check against package registries) before auto-creation:

```typescript
const NON_AI_TOOL_SLUGS = new Set([
  'playwright', 'apache-iceberg', 'gws', 'tower-python-sdk',
  'docker', 'gitlab', 'jira', 'visual-studio-code',
  // ... extend as needed
]);
```

### 3. Change default status of auto-created tools to `pending_review`

Instead of `status: "active"`, set `status: "pending_review"` for all auto-created tools. This prevents them from appearing on the site until manually approved:

```typescript
status: "pending_review",  // was "active"
```

Add a `findByStatus("pending_review")` admin UI view for curator review.

### 4. Fix `.env.local` to point at the live database

Update `DATABASE_URL` in `.env.local` to use the `ep-dark-firefly-adp1p3v8` endpoint (from `.env.local.bak`) so local development connects to the correct branch.
