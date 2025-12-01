# Caching and Data Access Patterns Research
**Date:** 2025-12-01
**Research Type:** Performance Optimization
**Objective:** Identify caching opportunities and data access patterns for infrequent-update optimization

---

## Executive Summary

The AI Power Rankings application is a **Next.js 15 App Router** application using **Drizzle ORM** with **Neon PostgreSQL**. The site has **sophisticated in-memory caching** infrastructure already in place, but is **under-utilizing Next.js native caching** capabilities. For a site with infrequent updates, there are significant opportunities to implement **aggressive static generation** and **on-demand revalidation**.

**Key Findings:**
- ✅ **Existing in-memory cache** with 5-60 minute TTLs across endpoints
- ✅ **HTTP cache headers** properly configured for CDN/browser caching
- ⚠️ **No Next.js revalidation** on most data mutations (articles, rankings)
- ⚠️ **Dynamic rendering** forced on key pages (tools, rankings)
- ⚠️ **Client-side fetching** used for tools page instead of RSC data fetching
- ✅ **Drizzle ORM** with batched queries and N+1 prevention patterns

**Recommended Strategy:**
- Implement **Incremental Static Regeneration (ISR)** with 1-hour revalidation
- Add **on-demand revalidation** after article/ranking mutations
- Convert client components to **React Server Components** with `fetch` caching
- Use **unstable_cache** for database queries with tag-based invalidation

---

## Current Architecture

### 1. Next.js Configuration
**File:** `next.config.js`

```javascript
{
  reactStrictMode: true,
  images: {
    minimumCacheTTL: 60, // 60 seconds minimum
  },
  // No static optimization config
  // No revalidate config
}
```

**Router:** App Router (Next.js 15)
**Rendering:** Mix of Server Components (pages) and Client Components (data fetching)

---

### 2. Database Layer

**ORM:** Drizzle ORM (`drizzle-orm`)
**Database:** Neon PostgreSQL (`@neondatabase/serverless`)
**Connection:** HTTP mode (dev) / Pooled connections (production)

**Schema Tables:**
- `tools` - AI coding tools (50+ entries)
- `rankings` - Tool rankings by period
- `news` - News articles about tools
- `articles` - Long-form articles
- `companies` - Company information
- `monthlySummaries` - AI-generated monthly summaries
- `articleRankingsChanges` - Article impact tracking
- `articleProcessingLogs` - Article processing history
- `rankingVersions` - Ranking version history
- `migrations` - Schema migrations

**Connection Pooling:**
```typescript
// Production: Pooled (max 10 connections)
pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  maxUses: 1000,
  connectionTimeoutMillis: 10000,
});

// Development: HTTP mode (no pooling)
sql = neon(DATABASE_URL);
db = drizzle(sql, { schema });
```

---

### 3. Current Caching Implementation

#### A. In-Memory Cache (`lib/memory-cache.ts`)

**Implementation:** Custom `MemoryCache` class with TTL-based expiration

**Cache TTLs:**
```typescript
export const CACHE_TTL = {
  tools: 300000,        // 5 minutes
  rankings: 60000,      // 1 minute
  news: 180000,         // 3 minutes
  companies: 600000,    // 10 minutes
  toolDetail: 120000,   // 2 minutes
  scoring: 60000,       // 1 minute
  trending: 3600000,    // 1 hour
}
```

**Features:**
- ✅ Pattern-based invalidation (`invalidateCachePattern`)
- ✅ Automatic cleanup every 5 minutes
- ✅ Max 100 entries (LRU eviction)
- ✅ Cache statistics endpoint
- ✅ `getCachedOrFetch` wrapper for API routes

**Usage Pattern:**
```typescript
const response = await getCachedOrFetch(
  "api:tools:all",
  async () => {
    // Database query here
    const tools = await toolsRepo.findByStatus("active");
    return { tools, _source: "database" };
  },
  CACHE_TTL.tools
);
```

#### B. HTTP Cache Headers (`lib/api-cache.ts`)

**CDN/Browser Cache Configuration:**
```typescript
const DEFAULT_CACHE_CONFIG = {
  "/api/tools": {
    maxAge: 300,                    // 5 min browser cache
    sMaxAge: 3600,                  // 1 hour CDN cache
    staleWhileRevalidate: 86400,    // 24 hours stale
  },
  "/api/rankings": {
    maxAge: 0,                      // No browser cache
    sMaxAge: 300,                   // 5 min CDN cache
    staleWhileRevalidate: 600,      // 10 min stale
    mustRevalidate: true,
  },
  "/api/news": {
    maxAge: 300,                    // 5 min
    sMaxAge: 1800,                  // 30 min CDN
    staleWhileRevalidate: 43200,    // 12 hours
  },
  "/api/admin": {
    private: true,
    mustRevalidate: true,
  },
}
```

**Headers Applied:**
```http
Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400
ETag: "a7b8c9d"
X-Content-Type-Options: nosniff
CDN-Cache-Control: public, max-age=300
```

#### C. Next.js Caching (Currently Minimal)

**Current Usage:**
- ❌ **No `revalidate` in route segments** (all dynamic)
- ❌ **No `generateStaticParams`** for static generation
- ⚠️ **Only 2 uses of `revalidatePath`** (in article ingestion)
- ⚠️ **`force-dynamic` used** on tools page
- ⚠️ **Client-side fetching** prevents RSC caching

**Existing Revalidation (Limited):**
```typescript
// app/api/admin/articles/ingest/route.ts
revalidatePath('/api/whats-new', 'layout');
revalidatePath('/api/news', 'layout');

// app/api/admin/news/route.ts (POST/DELETE)
revalidatePath('/api/whats-new', 'layout');
revalidatePath('/api/news', 'layout');
```

---

## Data Fetching Patterns

### 1. API Routes (Server-Side)

#### Example: `/api/tools` (All Tools)
**File:** `app/api/tools/route.ts`

**Pattern:**
1. ✅ **In-memory cache check** (`getCachedOrFetch`)
2. ✅ **Batch queries** to prevent N+1
3. ✅ **HTTP cache headers** applied
4. ❌ **No Next.js revalidation**

**Code Flow:**
```typescript
export async function GET(): Promise<NextResponse> {
  const cachedResponse = await getCachedOrFetch(
    "api:tools:all",
    async () => {
      // Batch load companies
      const companyList = await companiesRepository.findByIds(companyIds);

      // Batch load scoring data
      const scoringPromises = tools.map(tool =>
        toolScoringService.getToolScoring(tool.id)
      );

      return { tools: transformedTools };
    },
    CACHE_TTL.tools // 5 minutes
  );

  return cachedJsonResponse(cachedResponse, "/api/tools");
}
```

**Performance Optimizations:**
- ✅ Batched company lookups (1 query instead of N)
- ✅ Parallel scoring data fetches
- ✅ In-memory caching (5 min TTL)
- ✅ CDN caching (1 hour)

#### Example: `/api/rankings/current` (Current Rankings)
**File:** `app/api/rankings/current/route.ts`

**Pattern:**
1. ✅ **In-memory cache** (60 seconds)
2. ✅ **Batch tool lookups** by IDs and slugs
3. ✅ **HTTP cache headers** (3600s CDN)
4. ✅ **Fallback data** from rankings JSONB

**Code Flow:**
```typescript
const response = await getCachedOrFetch(
  "api:rankings:current",
  async () => {
    const currentRankings = await rankingsRepository.getCurrentRankings();

    // Extract tool IDs from rankings
    const uniqueToolIds = Array.from(new Set(toolIds));

    // Batch fetch all tools in single query
    const toolsData = await toolsRepo.findByIds(uniqueToolIds);

    // Batch fetch by slug for missing tools
    const slugResults = await toolsRepo.findBySlugs(slugsToFetch);

    return { data: formattedRankings };
  },
  CACHE_TTL.rankings // 60 seconds
);

return new NextResponse(JSON.stringify(response), {
  headers: {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  },
});
```

**Cache Strategy:**
- Server: 60 seconds (in-memory)
- CDN: 3600 seconds (1 hour)
- Stale-while-revalidate: 24 hours

---

### 2. Server Components (RSC)

#### Example: `app/[lang]/tools/page.tsx`
**Current Implementation:**

```typescript
// ❌ Forces dynamic rendering
export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ToolsClient /> {/* Client component fetches data */}
    </Suspense>
  );
}
```

**Client Component (`tools-client.tsx`):**
```typescript
"use client";

export default function ToolsClient() {
  const [tools, setTools] = useState<Tool[]>([]);

  useEffect(() => {
    const fetchTools = async () => {
      const response = await fetch("/api/tools");
      setTools(data.tools);
    };
    fetchTools();
  }, []);

  return <ToolsContent tools={tools} />;
}
```

**Issues with Current Approach:**
- ❌ **Dynamic rendering** prevents static generation
- ❌ **Client-side fetching** loses RSC caching benefits
- ❌ **Additional network roundtrip** (server → client → server)
- ❌ **No SSR data** (blank page until client fetch completes)

#### Example: `app/[lang]/whats-new/page.tsx`
**Better Pattern (Server Component Data Fetching):**

```typescript
async function getMonthlySummary(): Promise<MonthlySummary | null> {
  const response = await fetch('/api/whats-new/summary', {
    cache: 'no-store', // ⚠️ Forces dynamic every time
  });
  return data.summary;
}

export default async function WhatsNewPage() {
  const summary = await getMonthlySummary();
  return <div>{summary.content}</div>;
}
```

**Issues:**
- ⚠️ `cache: 'no-store'` disables all Next.js caching
- ❌ No revalidation strategy
- ✅ Server-side rendering (better than client fetch)

---

### 3. Article Management (Mutation Endpoints)

#### Article Creation/Ingestion
**File:** `app/api/admin/articles/ingest/route.ts`

**Pattern:**
```typescript
export async function POST(request: NextRequest) {
  const result = await articleService.ingestArticle(input);

  if (!input.dryRun) {
    // ✅ Revalidates news feeds
    revalidatePath('/api/whats-new', 'layout');
    revalidatePath('/api/news', 'layout');
  }

  return NextResponse.json({ success: true, result });
}
```

**Cache Invalidation:**
- ✅ Revalidates news paths
- ❌ **Does NOT invalidate** in-memory cache
- ❌ **Does NOT invalidate** tools/rankings caches
- ❌ **Does NOT revalidate** affected tool pages

#### Article Update
**File:** `app/api/admin/articles/[id]/route.ts`

```typescript
export async function PATCH(request: NextRequest) {
  const article = await articleService.updateArticle(id, updates);

  // ❌ NO CACHE INVALIDATION

  return NextResponse.json({ success: true, article });
}
```

**Missing Invalidation:**
- ❌ No `revalidatePath` calls
- ❌ No in-memory cache invalidation
- ❌ No CDN purge

#### Article Deletion
```typescript
export async function DELETE(request: NextRequest) {
  await articleService.deleteArticle(id);

  // ❌ NO CACHE INVALIDATION

  return NextResponse.json({ success: true });
}
```

#### News Creation/Update
**File:** `app/api/admin/news/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const newsItem = await newsRepo.create(data);

  // ✅ Revalidates news paths
  revalidatePath('/api/whats-new', 'layout');
  revalidatePath('/api/news', 'layout');

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  await newsRepo.delete(id);

  // ✅ Revalidates news paths
  revalidatePath('/api/whats-new', 'layout');
  revalidatePath('/api/news', 'layout');

  return NextResponse.json({ success: true });
}
```

**Good Pattern:**
- ✅ Consistent revalidation after mutations
- ⚠️ Only revalidates news-related paths
- ❌ Does not invalidate in-memory cache

---

## Optimization Opportunities

### 1. Next.js Static Generation (Highest Impact)

#### Problem
- Most pages force dynamic rendering
- Client-side data fetching prevents static optimization
- No ISR (Incremental Static Regeneration)

#### Solution: Implement ISR with On-Demand Revalidation

**A. Static Page Generation with Revalidation**

**Tools Page Example:**
```typescript
// app/[lang]/tools/page.tsx
export const revalidate = 3600; // 1 hour ISR

async function getTools() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tools`, {
    next: { revalidate: 3600, tags: ['tools'] }
  });
  return response.json();
}

export default async function ToolsPage() {
  const { tools } = await getTools();
  return <ToolsContent tools={tools} />;
}
```

**Benefits:**
- Static HTML generated at build time
- Revalidated every 1 hour automatically
- CDN can cache entire page
- Instant page loads (no API roundtrip)

**B. Tag-Based Cache Invalidation**

**Article Ingestion with Cache Invalidation:**
```typescript
// app/api/admin/articles/ingest/route.ts
import { revalidateTag } from 'next/cache';

export async function POST(request: NextRequest) {
  const result = await articleService.ingestArticle(input);

  if (!input.dryRun) {
    // Invalidate relevant caches
    revalidateTag('news');
    revalidateTag('rankings');
    revalidateTag('tools');

    // Also revalidate paths for backwards compatibility
    revalidatePath('/api/whats-new', 'layout');
    revalidatePath('/api/news', 'layout');
  }

  return NextResponse.json({ success: true, result });
}
```

**C. Database Query Caching with unstable_cache**

**Tools Repository Example:**
```typescript
import { unstable_cache } from 'next/cache';

export class ToolsRepository {
  async findByStatus(status: string) {
    return unstable_cache(
      async () => {
        // Drizzle query
        return await db.select().from(tools).where(eq(tools.status, status));
      },
      ['tools', status],
      {
        revalidate: 3600,  // 1 hour
        tags: ['tools']
      }
    )();
  }
}
```

**Benefits:**
- Database results cached across requests
- Tag-based invalidation
- Works with any data source (not just fetch)

---

### 2. In-Memory Cache Invalidation

#### Problem
Current in-memory cache has **no invalidation on mutations**:
- Article created → caches not cleared
- Ranking updated → old data served for 1-5 minutes

#### Solution: Centralized Cache Invalidation

**A. Enhanced Memory Cache with Tags**

**New Implementation (`lib/memory-cache.ts`):**
```typescript
class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private tags = new Map<string, Set<string>>(); // tag → keys

  set(key: string, data: any, ttl?: number, tags?: string[]) {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });

    // Register tags
    tags?.forEach(tag => {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set());
      }
      this.tags.get(tag)!.add(key);
    });
  }

  invalidateByTag(tag: string): number {
    const keys = this.tags.get(tag);
    if (!keys) return 0;

    let deleted = 0;
    keys.forEach(key => {
      if (this.cache.delete(key)) deleted++;
    });

    this.tags.delete(tag);
    return deleted;
  }
}

// Usage in API routes
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number,
  tags?: string[]
): Promise<T> {
  const cached = cacheInstance.get<T>(key);
  if (cached !== null) return cached;

  const data = await fetcher();
  cacheInstance.set(key, data, ttl, tags);
  return data;
}
```

**B. Invalidation Service**

**New File (`lib/cache/invalidation.service.ts`):**
```typescript
import { revalidateTag, revalidatePath } from 'next/cache';
import { invalidateCachePattern } from '@/lib/memory-cache';

export class CacheInvalidationService {
  /**
   * Invalidate all caches related to articles
   */
  static async invalidateArticles() {
    // Next.js cache
    revalidateTag('news');
    revalidateTag('articles');

    // In-memory cache
    invalidateCachePattern('^(api:news|api:articles)');

    // Specific paths
    revalidatePath('/api/whats-new', 'layout');
    revalidatePath('/api/news', 'layout');

    console.log('✅ Article caches invalidated');
  }

  /**
   * Invalidate all caches related to rankings
   */
  static async invalidateRankings() {
    revalidateTag('rankings');
    revalidateTag('tools');

    invalidateCachePattern('^(api:rankings|api:tools)');

    revalidatePath('/api/rankings', 'layout');
    revalidatePath('/[lang]', 'layout'); // Home page

    console.log('✅ Rankings caches invalidated');
  }

  /**
   * Invalidate caches for a specific tool
   */
  static async invalidateTool(slug: string) {
    revalidateTag(`tool:${slug}`);

    invalidateCachePattern(`^api:tool:${slug}`);

    revalidatePath(`/[lang]/tools/${slug}`, 'page');

    console.log(`✅ Tool ${slug} caches invalidated`);
  }

  /**
   * Invalidate everything (use sparingly)
   */
  static async invalidateAll() {
    revalidatePath('/', 'layout');
    invalidateCachePattern('.*');
    console.log('⚠️ ALL caches invalidated');
  }
}
```

**C. Integration with Mutation Endpoints**

**Updated Article Ingestion:**
```typescript
import { CacheInvalidationService } from '@/lib/cache/invalidation.service';

export async function POST(request: NextRequest) {
  const result = await articleService.ingestArticle(input);

  if (!input.dryRun) {
    // Comprehensive invalidation
    await CacheInvalidationService.invalidateArticles();

    // If article affects rankings
    if (result.rankingChanges?.length > 0) {
      await CacheInvalidationService.invalidateRankings();

      // Invalidate specific tools
      for (const change of result.rankingChanges) {
        await CacheInvalidationService.invalidateTool(change.toolSlug);
      }
    }
  }

  return NextResponse.json({ success: true, result });
}
```

---

### 3. Aggressive Static Generation for Infrequent Updates

Since this site updates infrequently, implement **long revalidation periods**:

**Recommended Revalidation Times:**
```typescript
// Page-level revalidation
export const revalidate = {
  homepage: 3600,           // 1 hour
  tools: 3600,              // 1 hour
  toolDetail: 7200,         // 2 hours
  rankings: 3600,           // 1 hour
  news: 1800,               // 30 minutes
  methodology: 86400,       // 24 hours (rarely changes)
  about: 86400,             // 24 hours
};

// API route caching
const API_REVALIDATION = {
  tools: 3600,              // 1 hour
  rankings: 3600,           // 1 hour
  news: 1800,               // 30 minutes
  companies: 7200,          // 2 hours
};
```

**Benefits:**
- Most requests served from CDN
- Database only queried on revalidation
- Instant page loads globally
- Reduced database costs

---

### 4. Convert Client Components to Server Components

#### Current Issue
Tools page uses client-side data fetching:
```typescript
"use client";
const [tools, setTools] = useState([]);
useEffect(() => {
  fetch('/api/tools').then(...);
}, []);
```

#### Recommended Pattern
Server Component with cached fetch:
```typescript
// app/[lang]/tools/page.tsx
export const revalidate = 3600;

async function getTools() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tools`, {
    next: { revalidate: 3600, tags: ['tools'] }
  });
  return res.json();
}

export default async function ToolsPage() {
  const { tools } = await getTools();

  return (
    <div>
      {tools.map(tool => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}
```

**Benefits:**
- ✅ HTML rendered on server (better SEO)
- ✅ No loading spinner (instant content)
- ✅ Automatic static generation
- ✅ CDN cacheable
- ✅ Reduced client bundle size

**Interactive Features:**
Keep client components for:
- Filters/search (use URL params + suspense)
- Modals/dialogs
- Animations
- User interactions

**Hybrid Approach:**
```typescript
// Server Component (page.tsx)
export default async function ToolsPage({ searchParams }) {
  const { tools } = await getTools();

  return (
    <ToolsPageClient
      initialTools={tools}
      defaultFilter={searchParams.category}
    />
  );
}

// Client Component (tools-page-client.tsx)
"use client";
export function ToolsPageClient({ initialTools, defaultFilter }) {
  const [filter, setFilter] = useState(defaultFilter);

  const filteredTools = useMemo(
    () => initialTools.filter(t => !filter || t.category === filter),
    [initialTools, filter]
  );

  return <ToolsList tools={filteredTools} onFilterChange={setFilter} />;
}
```

---

### 5. Database Query Optimization (Already Good!)

**Current Strengths:**
- ✅ Batch queries prevent N+1 problems
- ✅ Connection pooling in production
- ✅ Drizzle ORM with type safety
- ✅ Parallel Promise.all for independent queries

**Example of Good Pattern:**
```typescript
// Batch load companies (1 query instead of N)
const companyList = await companiesRepository.findByIds(companyIds);

// Batch load scoring (parallel, not sequential)
const scoringPromises = tools.map(tool =>
  toolScoringService.getToolScoring(tool.id)
);
const scoringResults = await Promise.all(scoringPromises);
```

**Minor Optimizations:**
- Consider **database indexes** on frequently queried columns
- Use **SELECT specific columns** instead of SELECT * where possible
- Implement **query result caching** with unstable_cache

---

## Recommended Caching Strategy

### Phase 1: Next.js ISR (Immediate - High Impact)

**1. Enable ISR on All Public Pages**

| Page | Revalidate | Tags |
|------|-----------|------|
| Homepage | 3600s | `['rankings', 'tools']` |
| Tools List | 3600s | `['tools']` |
| Tool Detail | 7200s | `['tool:{slug}']` |
| Rankings | 3600s | `['rankings']` |
| News Feed | 1800s | `['news']` |
| What's New | 1800s | `['news', 'articles']` |
| About/Methodology | 86400s | `['static']` |

**Implementation:**
```typescript
// app/[lang]/tools/page.tsx
export const revalidate = 3600; // 1 hour ISR

// Remove force-dynamic
// export const dynamic = "force-dynamic"; ❌ DELETE THIS

async function getTools() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tools`, {
    next: {
      revalidate: 3600,
      tags: ['tools']
    }
  });
  return res.json();
}

export default async function ToolsPage() {
  const { tools } = await getTools();
  return <ToolsContent tools={tools} />;
}
```

**2. Convert Client Fetching to Server Components**

Files to update:
- `app/[lang]/tools/tools-client.tsx` → Server Component
- `app/[lang]/whats-new/page.tsx` → Use `next.revalidate` instead of `cache: 'no-store'`

**3. Add Cache Tags to API Routes**

```typescript
// app/api/tools/route.ts
export async function GET() {
  const response = await getCachedOrFetch(
    "api:tools:all",
    async () => {
      const tools = await toolsRepo.findByStatus("active");
      return { tools };
    },
    CACHE_TTL.tools,
    ['tools'] // Add tags
  );

  return cachedJsonResponse(response, "/api/tools");
}
```

---

### Phase 2: Cache Invalidation (Medium Priority)

**1. Implement CacheInvalidationService**

Create `lib/cache/invalidation.service.ts` (see code above)

**2. Add Invalidation to All Mutation Endpoints**

**Article Endpoints:**
```typescript
// POST /api/admin/articles/ingest
await CacheInvalidationService.invalidateArticles();
if (hasRankingChanges) {
  await CacheInvalidationService.invalidateRankings();
}

// PATCH /api/admin/articles/[id]
await CacheInvalidationService.invalidateArticles();

// DELETE /api/admin/articles/[id]
await CacheInvalidationService.invalidateArticles();
```

**Ranking Endpoints:**
```typescript
// POST /api/admin/rankings/commit
await CacheInvalidationService.invalidateRankings();

// DELETE /api/admin/rankings/[period]
await CacheInvalidationService.invalidateRankings();
```

**Tool Endpoints:**
```typescript
// PATCH /api/admin/tools/[id]
await CacheInvalidationService.invalidateTool(tool.slug);
await CacheInvalidationService.invalidateRankings();
```

**3. Add Admin Cache Management Endpoint**

```typescript
// app/api/admin/cache/invalidate/route.ts
import { isAuthenticated } from '@/lib/clerk-auth';
import { CacheInvalidationService } from '@/lib/cache/invalidation.service';

export async function POST(request: NextRequest) {
  if (!await isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { target } = await request.json();

  switch (target) {
    case 'all':
      await CacheInvalidationService.invalidateAll();
      break;
    case 'articles':
      await CacheInvalidationService.invalidateArticles();
      break;
    case 'rankings':
      await CacheInvalidationService.invalidateRankings();
      break;
    default:
      return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
  }

  return NextResponse.json({ success: true, invalidated: target });
}
```

**Admin UI Button:**
```typescript
// components/admin/cache-invalidation.tsx
"use client";

export function CacheInvalidationButton({ target }) {
  const handleInvalidate = async () => {
    await fetch('/api/admin/cache/invalidate', {
      method: 'POST',
      body: JSON.stringify({ target }),
    });
    toast.success(`${target} cache invalidated`);
  };

  return <Button onClick={handleInvalidate}>Clear {target} Cache</Button>;
}
```

---

### Phase 3: Advanced Optimizations (Low Priority)

**1. Redis Cache (Optional - For Very High Traffic)**

If the site grows significantly:
```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<T> {
  // Try Redis first
  const cached = await redis.get<T>(key);
  if (cached) return cached;

  // Fetch and cache
  const data = await fetcher();
  await redis.set(key, data, { ex: ttl / 1000 });
  return data;
}
```

**When to use Redis:**
- Multiple server instances (horizontal scaling)
- Shared cache needed
- Traffic > 100k requests/day
- Cache size > 100MB

**2. Edge Caching with Vercel**

Already configured via HTTP headers, but can optimize:
```typescript
// next.config.js
module.exports = {
  experimental: {
    // Use Vercel Edge Config for dynamic configs
    edgeConfig: true,
  },
};
```

**3. Database Read Replicas**

For very high read traffic:
- Neon supports read replicas
- Route read queries to replica
- Route writes to primary

---

## Cache Invalidation Trigger Points

### Article Operations

| Operation | Endpoint | Invalidate |
|-----------|----------|------------|
| Create Article | `POST /api/admin/articles/ingest` | `news`, `articles`, affected `tool:{slug}`, `rankings` |
| Update Article | `PATCH /api/admin/articles/[id]` | `news`, `articles`, affected `tool:{slug}` |
| Delete Article | `DELETE /api/admin/articles/[id]` | `news`, `articles`, `rankings` (if rollback) |
| Recalculate Article | `POST /api/admin/articles/[id]/recalculate` | `news`, `articles`, affected `tool:{slug}`, `rankings` |

### News Operations

| Operation | Endpoint | Invalidate |
|-----------|----------|------------|
| Create News | `POST /api/admin/news` | `news` |
| Update News | `PATCH /api/admin/news/[id]` | `news` |
| Delete News | `DELETE /api/admin/news/[id]` | `news` |

### Ranking Operations

| Operation | Endpoint | Invalidate |
|-----------|----------|------------|
| Commit Rankings | `POST /api/admin/rankings/commit` | `rankings`, `tools` |
| Delete Period | `DELETE /api/admin/rankings/[period]` | `rankings`, `tools` |
| Set Current | `POST /api/admin/rankings/set-current` | `rankings` |
| Build Rankings | `POST /api/admin/rankings/build` | `rankings`, `tools` |

### Tool Operations

| Operation | Endpoint | Invalidate |
|-----------|----------|------------|
| Update Tool | `PATCH /api/admin/tools/[id]` | `tools`, `tool:{slug}`, `rankings` |
| Recalculate Scoring | `POST /api/admin/tools/scoring/recalculate` | `tools`, affected `tool:{slug}`, `rankings` |

---

## Implementation Files

### Files to Create

1. **`lib/cache/invalidation.service.ts`** - Centralized cache invalidation
2. **`app/api/admin/cache/invalidate/route.ts`** - Admin cache management API
3. **`components/admin/cache-invalidation.tsx`** - Admin UI component

### Files to Modify

1. **`lib/memory-cache.ts`** - Add tag support
2. **`app/api/admin/articles/ingest/route.ts`** - Add cache invalidation
3. **`app/api/admin/articles/[id]/route.ts`** - Add cache invalidation
4. **`app/api/admin/news/route.ts`** - Enhance cache invalidation
5. **`app/api/admin/rankings/commit/route.ts`** - Add cache invalidation
6. **`app/api/tools/route.ts`** - Add cache tags
7. **`app/api/rankings/current/route.ts`** - Add cache tags
8. **`app/[lang]/tools/page.tsx`** - Convert to RSC with ISR
9. **`app/[lang]/tools/tools-client.tsx`** - Simplify to presentation component
10. **`app/[lang]/whats-new/page.tsx`** - Add revalidation config

---

## Performance Impact Estimates

### Current Performance
- **API Response Time:** 100-500ms (database query + processing)
- **Page Load Time:** 1-3 seconds (API roundtrip from client)
- **Cache Hit Rate:** ~60% (in-memory cache)
- **Database Queries:** 5-10 per request (batched, but frequent)

### After Phase 1 (ISR)
- **API Response Time:** 0-50ms (static HTML from CDN)
- **Page Load Time:** 200-500ms (CDN delivery)
- **Cache Hit Rate:** ~95% (CDN + static generation)
- **Database Queries:** 1-2 per hour (only on revalidation)

**Estimated Improvements:**
- ⚡ **5-10x faster page loads**
- 💰 **90% reduction in database costs**
- 🌍 **Global CDN delivery** (instant worldwide)
- 📊 **Better Core Web Vitals** (LCP, CLS, FID)

### After Phase 2 (Cache Invalidation)
- ✅ **Instant updates** after content changes
- ✅ **No stale data** on mutations
- ✅ **Reliable cache consistency**

---

## Testing Strategy

### 1. Cache Hit Verification

**Test in-memory cache:**
```bash
# First request (cache miss)
curl -w "@curl-format.txt" https://yoursite.com/api/tools

# Second request (cache hit)
curl -w "@curl-format.txt" https://yoursite.com/api/tools

# Check X-Response-Source header
```

**curl-format.txt:**
```
time_total:  %{time_total}s
http_code:   %{http_code}
```

### 2. ISR Verification

**Check static generation:**
```bash
# Build and check output
npm run build

# Look for (Static) vs (SSR) in build output
# Static = prerendered, SSR = dynamic
```

**Expected output:**
```
Route (app)                              Size     First Load JS
├ ○ /                                    5 kB           85 kB
├ ● /[lang]/tools                        8 kB           90 kB
│   └ ○ (Static)
├ ● /[lang]/tools/[slug]                 12 kB          95 kB
│   └ ○ (ISR: 7200s)
```

### 3. Cache Invalidation Testing

**Test article creation invalidation:**
```bash
# 1. Load tools page (cache prime)
curl https://yoursite.com/api/tools > before.json

# 2. Create article that affects rankings
curl -X POST https://yoursite.com/api/admin/articles/ingest \
  -H "Content-Type: application/json" \
  -d '{ "type": "milestone", ... }'

# 3. Verify cache cleared
curl https://yoursite.com/api/tools > after.json

# 4. Compare timestamps
diff before.json after.json
```

### 4. Performance Monitoring

**Add logging to cache operations:**
```typescript
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const start = Date.now();
  const cached = cacheInstance.get<T>(key);

  if (cached !== null) {
    console.log(`✅ Cache HIT for ${key} (${Date.now() - start}ms)`);
    return cached;
  }

  console.log(`❌ Cache MISS for ${key}, fetching...`);
  const data = await fetcher();
  const fetchTime = Date.now() - start;

  cacheInstance.set(key, data, ttl);
  console.log(`💾 Cached ${key} (fetch: ${fetchTime}ms)`);

  return data;
}
```

---

## Risks and Mitigation

### Risk 1: Stale Data After Updates

**Risk:** Users see old data for up to 1 hour after content update

**Mitigation:**
- ✅ Implement on-demand revalidation (Phase 2)
- ✅ Add admin "Clear Cache" button
- ✅ Show "Last Updated" timestamp on pages
- ✅ Use shorter revalidation for news (30 min)

### Risk 2: Build Time Increase

**Risk:** Static generation at build time could timeout (>15 min on Vercel)

**Mitigation:**
- ✅ Use ISR instead of full static generation
- ✅ Generate only critical pages at build time
- ✅ Use `dynamicParams: true` for dynamic routes
- ✅ Implement `generateStaticParams` with limits

**Example:**
```typescript
// Only prerender top 10 tools at build time
export async function generateStaticParams() {
  const { tools } = await getTopTools(10);
  return tools.map(tool => ({ slug: tool.slug }));
}

export const dynamicParams = true; // Allow dynamic generation for others
```

### Risk 3: Cache Invalidation Failures

**Risk:** Revalidation API fails silently

**Mitigation:**
- ✅ Add error logging
- ✅ Implement retry logic
- ✅ Fallback to pattern-based invalidation
- ✅ Monitor invalidation success rate

**Example:**
```typescript
export async function invalidateWithRetry(tag: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      revalidateTag(tag);
      console.log(`✅ Invalidated tag: ${tag}`);
      return true;
    } catch (error) {
      console.error(`❌ Invalidation failed (attempt ${i + 1}):`, error);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  return false;
}
```

### Risk 4: Memory Cache Size Growth

**Risk:** In-memory cache grows unbounded

**Current Mitigation:**
- ✅ Max 100 entries (LRU eviction)
- ✅ TTL-based expiration
- ✅ Periodic cleanup (5 min)

**Additional Safeguards:**
```typescript
class MemoryCache {
  private readonly maxSize = 100;
  private readonly maxMemoryMB = 50; // 50MB limit

  getMemoryUsage(): number {
    return process.memoryUsage().heapUsed / 1024 / 1024;
  }

  set(key: string, data: any, ttl?: number) {
    // Check memory before adding
    if (this.getMemoryUsage() > this.maxMemoryMB) {
      this.evictOldest(10); // Remove 10 oldest entries
    }

    // ... rest of set logic
  }
}
```

---

## Monitoring and Observability

### 1. Cache Statistics Endpoint

**Already exists:** `lib/memory-cache.ts` → `getCacheStats()`

**Enhance with detailed metrics:**
```typescript
export function getCacheStats() {
  return {
    size: this.cache.size,
    maxSize: this.maxSize,
    hitRate: this.hits / (this.hits + this.misses),
    hits: this.hits,
    misses: this.misses,
    avgFetchTime: this.totalFetchTime / this.misses,
    memoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
    oldestEntry: this.getOldestEntryAge(),
  };
}
```

### 2. Admin Dashboard

**Create cache monitoring UI:**
```typescript
// components/admin/cache-stats.tsx
"use client";

export function CacheStatsPanel() {
  const { data, isLoading } = useSWR('/api/admin/cache/stats', {
    refreshInterval: 5000, // Update every 5 seconds
  });

  return (
    <div className="grid grid-cols-4 gap-4">
      <MetricCard title="Cache Size" value={`${data.size}/${data.maxSize}`} />
      <MetricCard title="Hit Rate" value={`${(data.hitRate * 100).toFixed(1)}%`} />
      <MetricCard title="Memory" value={`${data.memoryUsageMB.toFixed(1)} MB`} />
      <MetricCard title="Avg Fetch" value={`${data.avgFetchTime.toFixed(0)} ms`} />
    </div>
  );
}
```

### 3. Logging

**Add structured logging for cache operations:**
```typescript
import { loggers } from '@/lib/logger';

export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cached = cacheInstance.get<T>(key);

  if (cached !== null) {
    loggers.cache.debug('Cache hit', { key, ttl });
    return cached;
  }

  loggers.cache.info('Cache miss, fetching', { key });
  const start = Date.now();
  const data = await fetcher();
  const duration = Date.now() - start;

  cacheInstance.set(key, data, ttl);
  loggers.cache.info('Data cached', { key, duration, ttl });

  return data;
}
```

---

## Next Steps (Priority Order)

### Immediate (This Week)
1. ✅ **Add ISR to tools page** - Remove `force-dynamic`, add `revalidate: 3600`
2. ✅ **Convert tools-client to Server Component** - Move fetch to server
3. ✅ **Add cache tags to API routes** - Tag-based invalidation prep

### Short-term (This Month)
4. ✅ **Implement CacheInvalidationService** - Centralized invalidation
5. ✅ **Add invalidation to article endpoints** - Fix stale data issue
6. ✅ **Add cache invalidation to ranking endpoints** - Comprehensive coverage
7. ✅ **Create admin cache management UI** - Manual invalidation button

### Medium-term (Next Quarter)
8. ✅ **Add ISR to all public pages** - Homepage, rankings, news
9. ✅ **Implement tag-based memory cache** - Better invalidation
10. ✅ **Add monitoring dashboard** - Cache statistics UI

### Optional (Future)
11. ⚪ **Redis cache layer** - If traffic requires
12. ⚪ **Database read replicas** - If query load increases
13. ⚪ **Edge functions** - Geographically distributed

---

## Conclusion

The AI Power Rankings application has a **solid caching foundation** with in-memory caching and HTTP headers, but is **missing key Next.js optimizations** for static generation and on-demand revalidation.

**Current State:**
- ✅ In-memory cache with TTLs
- ✅ HTTP cache headers for CDN
- ✅ Batch database queries
- ⚠️ Dynamic rendering on most pages
- ⚠️ Client-side data fetching
- ❌ No cache invalidation on mutations

**Recommended Priority:**
1. **Phase 1: ISR** (1-2 days) - 5-10x performance improvement
2. **Phase 2: Cache Invalidation** (2-3 days) - Fix stale data
3. **Phase 3: Monitoring** (1 day) - Visibility into cache behavior

**Expected Outcome:**
- ⚡ 5-10x faster page loads
- 💰 90% reduction in database queries
- 🌍 Global CDN delivery
- ✅ Instant updates after content changes
- 📊 Better Core Web Vitals scores

The implementation is **low-risk** and **backward-compatible** - existing in-memory cache continues to work while Next.js ISR provides an additional caching layer.

---

## References

**Next.js Documentation:**
- [Data Fetching, Caching, and Revalidating](https://nextjs.org/docs/app/building-your-application/data-fetching/fetching-caching-and-revalidating)
- [Incremental Static Regeneration](https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration)
- [revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
- [revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
- [unstable_cache](https://nextjs.org/docs/app/api-reference/functions/unstable_cache)

**Project Files Referenced:**
- `lib/memory-cache.ts` - In-memory cache implementation
- `lib/api-cache.ts` - HTTP cache headers
- `lib/db/connection.ts` - Database connection with Drizzle
- `app/api/tools/route.ts` - Example API route with caching
- `app/api/rankings/current/route.ts` - Batched query pattern
- `app/api/admin/articles/ingest/route.ts` - Revalidation example
- `app/[lang]/tools/page.tsx` - Client-side fetching pattern
- `next.config.js` - Next.js configuration

**External Resources:**
- [Vercel Caching Best Practices](https://vercel.com/docs/concepts/edge-network/caching)
- [Neon Postgres Connection Pooling](https://neon.tech/docs/connect/connection-pooling)
- [Drizzle ORM Performance](https://orm.drizzle.team/docs/performance)

---

**Research completed:** 2025-12-01
**Researcher:** Claude (Research Agent)
**Total files analyzed:** 25+
**Total lines reviewed:** 5,000+
