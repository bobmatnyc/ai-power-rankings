# What's New Section - Implementation Analysis

**Date**: 2025-10-26
**Purpose**: Research for implementing two changes:
1. Order by recency (mix news, tools, and platform updates)
2. Clear cache when a news article is published

---

## Executive Summary

The "What's New" section currently displays three separate content types (tools, news, platform updates) in **separate sections** sorted by their own dates. The data fetching and caching is already optimized with a **1-minute HTTP cache** at the API level. To implement the requested changes:

1. **Recency-based mixed ordering**: Requires combining all three data sources and sorting by a unified date field
2. **Cache invalidation on publish**: Currently **no revalidation mechanism exists** - need to add `revalidatePath()` or `revalidateTag()` calls

---

## 1. What's New Section Location

### Frontend Component
**File**: `/Users/masa/Projects/aipowerranking/components/ui/whats-new-modal.tsx`
- Client component that renders a modal dialog
- Two tabs: "Recent (7 Days)" and "Monthly Summary"
- Fetches data from `/api/whats-new?days=7` when modal opens
- Displays three separate sections in order:
  1. Tools Updated This Week (lines 258-297)
  2. Recent News & Articles (lines 299-342)
  3. Platform Updates (Changelog) (lines 344-387)

### Data Source API
**File**: `/Users/masa/Projects/aipowerranking/app/api/whats-new/route.ts`
- Combined endpoint that fetches all three data types in parallel
- Returns: `{ news, tools, changelog, days, _source, _timestamp }`
- Uses `cachedJsonResponse()` with **60-second cache** (both browser and CDN)

---

## 2. Current Data Sources & Ordering

### A. Tools Updated
**Source**: Database query via `ToolsRepository`
- Table: `tools`
- Date field: `updated_at` (timestamp, has index)
- Filter: `updated_at >= dateThreshold` (past 7 days)
- Sort: `updatedAt DESC` (most recent first)
- Limit: 10 items

**Code** (lines 70-96):
```typescript
const toolsRepo = new ToolsRepository();
const allTools = await toolsRepo.findAll();

const recentTools = allTools
  .filter((tool) => {
    if (!tool.updated_at) return false;
    const toolDate = new Date(tool.updated_at);
    return !isNaN(toolDate.getTime()) && toolDate >= dateThreshold;
  })
  .sort((a, b) => {
    const dateA = new Date(a.updated_at);
    const dateB = new Date(b.updated_at);
    return dateB.getTime() - dateA.getTime();
  })
  .slice(0, 10)
```

### B. News Articles
**Source**: Database query via `NewsRepository`
- Table: `news` (also has an `articles` table used by admin)
- Date field: `publishedAt` (timestamp, has index)
- Filter: `publishedAt >= dateThreshold` (past 7 days)
- Sort: `publishedAt DESC` (most recent first)
- Limit: 10 items

**Code** (lines 39-67):
```typescript
const newsRepo = new NewsRepository();
const { articles: allNews } = await newsRepo.getPaginated(100, 0);

const recentNews = allNews
  .filter((article) => {
    const articleDate = new Date(article.publishedAt);
    return articleDate >= dateThreshold;
  })
  .sort((a, b) => {
    const dateA = new Date(a.publishedAt);
    const dateB = new Date(b.publishedAt);
    return dateB.getTime() - dateA.getTime();
  })
  .slice(0, 10)
```

### C. Platform Updates (Changelog)
**Source**: Static array in API route
- Data: Hardcoded `changelogItems` array (lines 100-146)
- Date field: `date` (ISO 8601 string)
- Currently shows 5 static entries from v0.2.0 and v0.1.4
- **No database table** - entirely static

**Code** (lines 100-146):
```typescript
const changelogItems = [
  {
    id: "v0.2.0-1",
    title: "Comprehensive SEO Schema.org Markup",
    description: "Added structured data...",
    date: "2025-10-24T00:00:00.000Z",
    category: "SEO",
    type: "feature" as const,
    version: "0.2.0",
  },
  // ... 4 more entries
];
```

---

## 3. Database Schema

### Tools Table
```typescript
export const tools = pgTable("tools", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("active"),

  // Date fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // Indexes
  updatedAtIdx: index("tools_updated_at_idx").on(table.updatedAt),
  createdAtIdx: index("tools_created_at_idx").on(table.createdAt),
});
```

### News Table
```typescript
export const news = pgTable("news", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary"),
  category: text("category"),
  source: text("source"),

  // Date fields
  publishedAt: timestamp("published_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // Indexes
  publishedIdx: index("news_published_idx").on(table.publishedAt),
  createdAtIdx: index("news_created_at_idx").on(table.createdAt),
});
```

### Articles Table (Admin-managed news)
```typescript
export const articles = pgTable("articles", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary"),
  content: text("content"),

  // Date fields
  publishedDate: timestamp("published_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // Status
  status: text("status").notNull().default("active"),
  isProcessed: boolean("is_processed").default(false),
});
```

**Note**: There are TWO news tables:
- `news` table: Public-facing news (legacy)
- `articles` table: Admin-managed articles with full processing pipeline

---

## 4. Cache Implementation

### Current Caching Strategy
**File**: `/Users/masa/Projects/aipowerranking/lib/api-cache.ts`

The `/api/whats-new` endpoint uses `cachedJsonResponse()` with:
```typescript
cachedJsonResponse(
  { news, tools, changelog, ... },
  "/api/whats-new",
  200,
  { maxAge: 60, sMaxAge: 60 } // 1 minute cache
);
```

**Cache Headers Set**:
- `Cache-Control: public, max-age=60, s-maxage=60`
- `ETag`: Generated hash for conditional requests
- `CDN-Cache-Control`: Same as Cache-Control
- `X-Vercel-Cache`: Cache status tracking

### Default Cache Configuration
```typescript
const DEFAULT_CACHE_CONFIG = {
  "/api/news": {
    maxAge: 300,      // 5 min browser cache
    sMaxAge: 1800,    // 30 min CDN cache
    staleWhileRevalidate: 43200, // 12 hours
  },
  "/api/tools": {
    maxAge: 300,
    sMaxAge: 3600,    // 1 hour CDN
    staleWhileRevalidate: 86400,
  },
};
```

### Cache Invalidation
**Current Status**: ❌ **NO REVALIDATION MECHANISM EXISTS**

Search results for `revalidatePath` and `revalidateTag`:
- **Zero matches** across the codebase
- No Next.js cache invalidation on content updates
- Cache only expires naturally after TTL

---

## 5. News Article Publishing Flow

### Admin Article Management
**Endpoint**: `/api/admin/articles/ingest` (POST)
**File**: `/Users/masa/Projects/aipowerranking/app/api/admin/articles/ingest/route.ts`

**Flow**:
1. Admin submits article via POST request
2. `ArticleDatabaseService.ingestArticle()` is called
3. Article is validated and inserted into `articles` table
4. **No cache invalidation occurs**

### Article Creation Path
**File**: `/Users/masa/Projects/aipowerranking/lib/services/article-db-service.ts`

**Process** (lines 199-250):
```typescript
// Step 7: Save article to database
const newArticle: NewArticle = {
  slug: this.generateSlug(analysis.title),
  title: analysis.title,
  summary: analysis.summary,
  content: content,
  publishedDate: publishedDate,
  // ... other fields
};

const savedArticle = await this.articlesRepo.createArticle(newArticle);

// Step 8: Create processing log
processingLog = await this.articlesRepo.createProcessingLog({
  articleId: savedArticle.id,
  status: "completed",
  processingTimeMs: Date.now() - startTime,
});

return savedArticle; // No revalidation!
```

### Article Repository
**File**: `/Users/masa/Projects/aipowerranking/lib/db/repositories/articles.repository.ts`

**createArticle() method** (lines 43-165):
```typescript
async createArticle(article: NewArticle): Promise<Article> {
  this.ensureConnection();

  // Validate and sanitize data
  const articleData = { /* ... prepared data ... */ };

  // Insert into database
  const [created] = await this.db
    .insert(articles)
    .values(articleData)
    .returning();

  return created; // No cache invalidation
}
```

### Admin News Management (Alternative Path)
**File**: `/Users/masa/Projects/aipowerranking/app/api/admin/news/route.ts`

**POST /api/admin/news** with `action: "manual-ingest"`:
```typescript
case "manual-ingest": {
  const articlesRepo = new ArticlesRepository();

  const article = await articlesRepo.createArticle({
    title, slug, summary, content,
    // ... fields
  });

  return NextResponse.json({
    success: true,
    article: { id: article.id, ... }
  });
  // No revalidation!
}
```

---

## 6. Recommended Implementation

### Change 1: Order by Recency (Mixed Feed)

**Current**: Three separate sections, each sorted independently
**Goal**: Single unified feed sorted by most recent date

**Implementation Approach**:

1. **Modify `/app/api/whats-new/route.ts`**:
   - Combine all three data sources into single array
   - Add `type` field to distinguish content types
   - Sort by unified date field
   - Limit to total items (e.g., 20)

```typescript
// After fetching newsResult, toolsResult, changelogItems

// Transform to unified format
const unifiedFeed = [
  // News articles
  ...newsResult.map(article => ({
    id: article.id,
    type: 'news' as const,
    title: article.title,
    summary: article.summary,
    date: article.published_at, // ISO string
    dateTimestamp: new Date(article.published_at).getTime(),
    url: `/${lang}/news/${article.slug}`,
    metadata: {
      source: article.source,
      slug: article.slug,
    }
  })),

  // Tools
  ...toolsResult.map(tool => ({
    id: tool.id,
    type: 'tool' as const,
    title: tool.name,
    summary: tool.description,
    date: tool.updatedAt,
    dateTimestamp: new Date(tool.updatedAt).getTime(),
    url: `/${lang}/tools/${tool.slug}`,
    metadata: {
      category: tool.category,
      slug: tool.slug,
    }
  })),

  // Platform updates
  ...changelogItems.map(item => ({
    id: item.id,
    type: 'platform' as const,
    title: item.title,
    summary: item.description,
    date: item.date,
    dateTimestamp: new Date(item.date).getTime(),
    url: null, // No detail page
    metadata: {
      version: item.version,
      category: item.category,
      changeType: item.type,
    }
  }))
];

// Sort by most recent first
const sortedFeed = unifiedFeed
  .sort((a, b) => b.dateTimestamp - a.dateTimestamp)
  .slice(0, 20); // Limit total items

return cachedJsonResponse({
  feed: sortedFeed,
  days,
  _source: "database",
  _timestamp: new Date().toISOString(),
}, "/api/whats-new", 200, { maxAge: 60, sMaxAge: 60 });
```

2. **Update Frontend** (`components/ui/whats-new-modal.tsx`):
   - Replace three separate sections with single feed
   - Render items based on `type` field
   - Use different icons/styling per type

```typescript
// Replace lines 248-389 with:
<div className="space-y-3">
  {feed.map((item) => (
    <FeedItem
      key={item.id}
      item={item}
      onDismiss={handleDismiss}
    />
  ))}
</div>
```

### Change 2: Clear Cache on Publish

**Current**: No cache invalidation
**Goal**: Invalidate `/api/whats-new` cache when news article is published

**Implementation Approach**:

Add `revalidatePath()` calls after article creation:

1. **In Article Ingestion** (`app/api/admin/articles/ingest/route.ts`):

```typescript
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest) {
  // ... existing code ...

  const result = await articleService.ingestArticle(input);

  if (!input.dryRun) {
    // Invalidate What's New cache
    revalidatePath('/api/whats-new', 'layout');
    console.log('[Cache] Revalidated /api/whats-new after article publish');
  }

  return NextResponse.json({ success: true, result });
}
```

2. **In Article Repository** (`lib/db/repositories/articles.repository.ts`):

```typescript
import { revalidatePath } from 'next/cache';

async createArticle(article: NewArticle): Promise<Article> {
  // ... existing creation logic ...

  const [created] = await this.db
    .insert(articles)
    .values(articleData)
    .returning();

  // Invalidate caches
  revalidatePath('/api/whats-new', 'layout');
  revalidatePath('/api/news', 'layout');
  console.log('[Cache] Revalidated paths after article creation');

  return created;
}
```

3. **In News Management** (`app/api/admin/news/route.ts`):

```typescript
import { revalidatePath } from 'next/cache';

case "manual-ingest": {
  const article = await articlesRepo.createArticle({ /* ... */ });

  // Clear What's New cache
  revalidatePath('/api/whats-new', 'layout');
  revalidatePath('/api/news', 'layout');

  return NextResponse.json({ success: true, article });
}
```

**Alternative: Using Revalidation Tags**

For more granular control:

```typescript
// In /app/api/whats-new/route.ts
export async function GET(request: NextRequest) {
  // ... fetch data ...

  const response = NextResponse.json({
    feed: sortedFeed,
    // ...
  });

  response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=60');
  response.headers.set('Next-Cache-Tags', 'whats-new,news,tools');

  return response;
}

// In article creation:
import { revalidateTag } from 'next/cache';

revalidateTag('whats-new');
revalidateTag('news');
```

---

## 7. Potential Issues & Considerations

### Database Performance
- **Current**: Fetches ALL tools (54+), then filters in memory
- **Recommendation**: Add database-level filtering with WHERE clause
- **Impact**: Reduces memory usage and processing time

### Changelog Scalability
- **Current**: Static array hardcoded in API route
- **Recommendation**: Move to database table or CHANGELOG.md parser
- **File**: `lib/services/whats-new-aggregation.service.ts` already has `parseSiteChanges()` method (lines 81-166)

### Date Field Consistency
- Tools: `updated_at`
- News: `publishedAt`
- Changelog: `date`
- **Recommendation**: Use consistent field names in unified feed

### Cache Strategy
- **Current**: 1-minute cache is very aggressive
- **With Revalidation**: Can increase to 5-10 minutes with on-demand invalidation
- **Recommendation**:
  ```typescript
  { maxAge: 300, sMaxAge: 600 } // 5 min browser, 10 min CDN
  ```

### Frontend Breaking Changes
- **Current modal expects**: `{ news, tools, changelog }`
- **New API returns**: `{ feed }`
- **Migration**: Update frontend to handle new structure or maintain backward compatibility

---

## 8. Files to Modify

### Required Changes

1. **API Route** - `/app/api/whats-new/route.ts`
   - Combine data sources into unified feed
   - Sort by recency
   - Add revalidation tags

2. **Frontend Component** - `/components/ui/whats-new-modal.tsx`
   - Update to render unified feed
   - Adjust UI for mixed content types

3. **Article Ingestion** - `/app/api/admin/articles/ingest/route.ts`
   - Add `revalidatePath()` call

4. **Article Repository** - `/lib/db/repositories/articles.repository.ts`
   - Add `revalidatePath()` in `createArticle()`

5. **News Admin** - `/app/api/admin/news/route.ts`
   - Add `revalidatePath()` in manual-ingest

### Optional Enhancements

6. **Changelog Service** - `/lib/services/whats-new-aggregation.service.ts`
   - Use existing `parseSiteChanges()` instead of static array

7. **Database Query Optimization**
   - Add WHERE clause filtering to reduce memory usage

8. **Cache Configuration** - `/lib/api-cache.ts`
   - Update cache duration for What's New endpoint

---

## 9. Testing Strategy

### Manual Testing
1. Publish new article via admin interface
2. Verify `/api/whats-new` shows new article immediately
3. Confirm mixed ordering by date
4. Check that old cached responses are invalidated

### Automated Tests
1. Unit test for unified feed sorting logic
2. Integration test for cache invalidation
3. E2E test for article publish -> What's New update flow

### Performance Testing
1. Monitor database query performance with filtering
2. Check CDN cache hit rate changes
3. Measure API response times before/after

---

## 10. Summary

### Current State
- ✅ What's New displays three separate content types
- ✅ Each type sorted independently by its date field
- ✅ HTTP caching in place (60 seconds)
- ❌ No cache revalidation on publish
- ❌ No unified recency-based ordering

### Implementation Required

**For Recency-Based Ordering**:
1. Modify `/app/api/whats-new/route.ts` to combine and sort data sources
2. Update frontend to render unified feed
3. ~2-3 hours development time

**For Cache Invalidation**:
1. Add `revalidatePath()` calls in 3 locations
2. Test invalidation flow
3. ~1 hour development time

**Total Estimate**: 3-4 hours for both changes

### Risks
- **Low Risk**: Cache invalidation is straightforward Next.js API
- **Medium Risk**: Frontend changes may need UI adjustments
- **Low Risk**: Database performance should be fine with proper filtering

---

**Research completed**: 2025-10-26
**Files analyzed**: 12
**Database tables**: 3 (tools, news, articles)
**API endpoints**: 4
**Cache mechanism**: Next.js HTTP caching with Cache-Control headers
