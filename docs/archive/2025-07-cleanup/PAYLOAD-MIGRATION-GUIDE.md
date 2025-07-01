# Payload CMS Migration Guide

This guide helps migrate from direct Supabase queries to Payload CMS API calls.

## Overview

The migration involves replacing Supabase client calls with Payload API calls. A new `payload-api.ts` service layer has been created to facilitate this transition.

## Import Changes

### Before (Supabase)

```typescript
import { supabase } from "@/lib/database";
```

### After (Payload)

```typescript
import { payloadAPI } from "@/lib/payload-api";
```

## Common Query Patterns

### 1. Fetching All Records

**Before:**

```typescript
const { data: tools, error } = await supabase.from("tools").select("*").order("name");
```

**After:**

```typescript
const response = await payloadAPI.getTools({ sort: "name" });
const tools = response.docs;
```

### 2. Fetching Single Record by ID/Slug

**Before:**

```typescript
const { data: tool, error } = await supabase.from("tools").select("*").eq("slug", slug).single();
```

**After:**

```typescript
const tool = await payloadAPI.getTool(slug);
```

### 3. Fetching with Filters

**Before:**

```typescript
const { data: rankings, error } = await supabase
  .from("ranking_cache")
  .select("*")
  .eq("period", "june-2025")
  .order("position");
```

**After:**

```typescript
const response = await payloadAPI.getRankings({
  period: "june-2025",
  sort: "position",
});
const rankings = response.docs;
```

### 4. Fetching with Relationships

**Before:**

```typescript
const { data: tools, error } = await supabase.from("tools").select(`
    *,
    company:companies(*)
  `);
```

**After:**

```typescript
// Payload automatically includes relationships based on schema
const response = await payloadAPI.getTools();
const tools = response.docs; // company data included in tool.company
```

### 5. Complex Queries

**Before:**

```typescript
const { data: metrics, error } = await supabase
  .from("metrics_history")
  .select("*")
  .eq("tool_id", toolId)
  .eq("metric_key", "github_stars")
  .order("recorded_at", { ascending: false })
  .limit(30);
```

**After:**

```typescript
const response = await payloadAPI.getMetrics({
  tool: toolId,
  metric_key: "github_stars",
  sort: "-recorded_at",
  limit: 30,
});
const metrics = response.docs;
```

## Error Handling

**Before:**

```typescript
const { data, error } = await supabase.from("tools").select();
if (error) {
  console.error("Error:", error);
  return null;
}
```

**After:**

```typescript
try {
  const response = await payloadAPI.getTools();
  return response.docs;
} catch (error) {
  console.error("Error:", error);
  return null;
}
```

## API Route Updates

### Before (API Route with Supabase)

```typescript
import { supabase } from "@/lib/database";

export async function GET() {
  const { data: tools, error } = await supabase.from("tools").select("*").order("current_ranking");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tools });
}
```

### After (API Route with Payload)

```typescript
import { payloadAPI } from "@/lib/payload-api";

export async function GET() {
  try {
    const response = await payloadAPI.getTools({ sort: "current_ranking" });
    return NextResponse.json({ tools: response.docs });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

## Component Updates

### Before (Component with Supabase)

```typescript
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/database'

export function ToolsList() {
  const [tools, setTools] = useState([])

  useEffect(() => {
    async function fetchTools() {
      const { data } = await supabase
        .from('tools')
        .select('*')
      setTools(data || [])
    }
    fetchTools()
  }, [])

  return <div>{/* render tools */}</div>
}
```

### After (Component with Payload)

```typescript
'use client'
import { useState, useEffect } from 'react'
import { payloadAPI } from '@/lib/payload-api'

export function ToolsList() {
  const [tools, setTools] = useState([])

  useEffect(() => {
    async function fetchTools() {
      try {
        const response = await payloadAPI.getTools()
        setTools(response.docs)
      } catch (error) {
        console.error('Failed to fetch tools:', error)
      }
    }
    fetchTools()
  }, [])

  return <div>{/* render tools */}</div>
}
```

## Server Components

For server components, you can directly use the Payload API:

```typescript
import { payloadAPI } from '@/lib/payload-api'

export default async function ToolsPage() {
  const response = await payloadAPI.getTools({
    limit: 20,
    sort: '-current_ranking'
  })

  return (
    <div>
      {response.docs.map(tool => (
        <div key={tool.id}>{tool.name}</div>
      ))}
    </div>
  )
}
```

## Migration Checklist

1. [ ] Replace `@/lib/database` imports with `@/lib/payload-api`
2. [ ] Update query syntax from Supabase to Payload API
3. [ ] Handle pagination using Payload's response structure
4. [ ] Update error handling from `{ data, error }` to try/catch
5. [ ] Test all affected components and API routes
6. [ ] Remove unused Supabase dependencies once migration is complete

## Notes

- Payload includes relationships automatically based on your schema
- Payload uses MongoDB-style query syntax for complex filters
- The API returns paginated responses with metadata
- Rich text fields return Slate/Lexical format instead of plain text

## Unknown Company Cleanup

During the migration from Supabase to Payload CMS, some companies were created with placeholder data (UUID as identifier, "Unknown Company" as name). This section documents the cleanup process and tools created to fix these issues.

### Problem Description

After migration, approximately 70% of companies in the database were "Unknown Company" entries with:

- UUID as identifier (e.g., "Unknown Company (3f8e4b2a-...)")
- Missing essential data (name, website_url, founded_year)
- Some entries had tools associated with them, others were orphaned

### API Endpoints Created

#### 1. Diagnose Companies - `/api/diagnose-companies`

Lightweight diagnostic endpoint to check Unknown Company statistics without heavy database operations.

**Usage:**

```bash
curl http://localhost:3000/api/diagnose-companies
```

**Response:**

```json
{
  "summary": {
    "total_companies": 47,
    "unknown_companies": 33,
    "percentage_unknown": "70.21%"
  },
  "sample_unknown_companies": [...],
  "recommendation": "Run the /api/fix-unknown-companies endpoint to analyze and fix these entries"
}
```

#### 2. Fix Unknown Companies - `/api/fix-unknown-companies`

Main analysis and fix endpoint with two methods:

- **GET**: Analyzes Unknown Companies and attempts automatic fixes
- **DELETE**: Removes orphaned Unknown Company entries

**Usage:**

```bash
# Analyze and auto-fix
curl http://localhost:3000/api/fix-unknown-companies

# Delete orphaned entries
curl -X DELETE http://localhost:3000/api/fix-unknown-companies
```

#### 3. Check Company Slug - `/api/check-company-slug`

Verifies if a company slug already exists to prevent conflicts.

**Usage:**

```bash
curl "http://localhost:3000/api/check-company-slug?slug=anthropic"
```

#### 4. Final Company Cleanup - `/api/final-company-cleanup`

Handles edge cases by reassigning tools to existing companies and deleting Unknown Company entries.

**Usage:**

```bash
curl -X POST http://localhost:3000/api/final-company-cleanup
```

### Company Name Mappings

The cleanup process uses these mappings to associate tools with their correct companies:

```typescript
const COMPANY_MAPPINGS = {
  Windsurf: "Codeium Inc.",
  "Google Gemini Code Assist": "Google",
  "Google Jules": "Google",
  v0: "Vercel",
  "Replit Agent": "Replit Inc.",
  "Bolt.new": "StackBlitz",
  "Claude Artifacts": "Anthropic",
  "Claude Code": "Anthropic",
  "GitHub Copilot": "GitHub (Microsoft)",
  // ... additional mappings
};
```

### TypeScript Considerations

When working with Payload CMS in strict TypeScript mode, use bracket notation for property access:

```typescript
// ❌ Will cause TypeScript error
const name = company.name;

// ✅ Correct approach
const name = company["name"];
```

### Database Connection Issues

If you encounter database termination errors (`{:shutdown, :db_termination}`):

1. Restart the development server
2. Check database connection settings
3. Ensure the database is accessible

### Results

The cleanup process successfully:

- Reduced Unknown Companies from 33 to 3 (90% reduction)
- Properly mapped tools to their correct companies
- Cleaned up database inconsistencies
- Maintained data integrity by reassigning tools before deleting companies
