# Cache Quick Reference Guide

**For Developers:** Quick reference for working with the caching system

## When to Invalidate Cache

### Article Operations
```typescript
import { invalidateArticleCache } from '@/lib/cache/invalidation.service';

// After creating, updating, or deleting articles
await articleService.createArticle(data);
invalidateArticleCache().catch(console.error);
```

### Ranking Operations
```typescript
import { invalidateRankingsCache } from '@/lib/cache/invalidation.service';

// After updating rankings or scores
await rankingService.commitRankings(data);
invalidateRankingsCache().catch(console.error);
```

### Custom Operations
```typescript
import { invalidateCache, CACHE_PATHS, CACHE_TAGS } from '@/lib/cache/invalidation.service';

// Invalidate specific paths and tags
await invalidateCache(
  [CACHE_PATHS.TOOLS],           // Paths to revalidate
  [CACHE_TAGS.TOOLS],            // Tags to revalidate
  ['^tools:']                    // Memory cache patterns
);
```

## ISR Configuration

### Add ISR to a Page
```typescript
// In your page.tsx file
export const revalidate = 3600; // 1 hour in seconds

// Choose appropriate period:
// - High-frequency: 300 (5 min)
// - Medium-frequency: 1800 (30 min)
// - Low-frequency: 3600 (1 hour)
```

### Add ISR to Fetch
```typescript
const data = await fetch('/api/data', {
  next: {
    revalidate: 1800,           // 30 minutes
    tags: ['data', 'articles']  // Cache tags
  }
});
```

## Cache Invalidation Pattern

### Standard Pattern (Non-Blocking)
```typescript
// ✅ CORRECT - Don't block API response
try {
  await performMutation();

  // Async cache invalidation (non-blocking)
  invalidateArticleCache().catch(error => {
    console.error('[API] Cache invalidation failed:', error);
  });

  return NextResponse.json({ success: true });
} catch (error) {
  return NextResponse.json({ error }, { status: 500 });
}
```

### Anti-Pattern (Blocking)
```typescript
// ❌ WRONG - Blocks API response
try {
  await performMutation();

  // User waits for cache invalidation
  await invalidateArticleCache();

  return NextResponse.json({ success: true });
} catch (error) {
  return NextResponse.json({ error }, { status: 500 });
}
```

## Cache Tags & Paths

### Available Tags
```typescript
import { CACHE_TAGS } from '@/lib/cache/invalidation.service';

CACHE_TAGS.TOOLS       // 'tools'
CACHE_TAGS.RANKINGS    // 'rankings'
CACHE_TAGS.NEWS        // 'news'
CACHE_TAGS.ARTICLES    // 'articles'
CACHE_TAGS.WHATS_NEW   // 'whats-new'
```

### Available Paths
```typescript
import { CACHE_PATHS } from '@/lib/cache/invalidation.service';

CACHE_PATHS.HOME        // '/'
CACHE_PATHS.TOOLS       // '/tools'
CACHE_PATHS.RANKINGS    // '/rankings'
CACHE_PATHS.NEWS        // '/news'
CACHE_PATHS.WHATS_NEW   // '/whats-new'
```

## In-Memory Cache

### Direct Usage (Rare)
```typescript
import { getCachedOrFetch, CACHE_TTL } from '@/lib/memory-cache';

const data = await getCachedOrFetch(
  'cache:key',                    // Unique cache key
  async () => await fetchData(),  // Fetch function
  CACHE_TTL.tools                 // TTL (5 minutes)
);
```

### Cache Patterns
```typescript
// Memory cache keys use patterns like:
'^articles:'     // All article caches
'^tools:'        // All tool caches
'^rankings:'     // All ranking caches
```

## Debugging Cache Issues

### Check Cache Invalidation Logs
```bash
# Search logs for invalidation events
grep "Cache Invalidation" logs

# Check for errors
grep "Failed to invalidate cache" logs
```

### Manual Cache Clear (Emergency)
```typescript
import { invalidateAllCaches } from '@/lib/cache/invalidation.service';

// Nuclear option - clears everything
await invalidateAllCaches();
```

### Verify ISR is Working
```typescript
// Check response headers
const response = await fetch('/en/tools');
const cacheHeader = response.headers.get('x-nextjs-cache');
// Values: HIT, MISS, STALE
```

## Common Scenarios

### Scenario 1: Adding New Mutation Endpoint
```typescript
import { invalidateArticleCache } from '@/lib/cache/invalidation.service';

export async function POST(request: NextRequest) {
  // Your mutation logic
  await performMutation();

  // Invalidate cache
  invalidateArticleCache().catch(console.error);

  return NextResponse.json({ success: true });
}
```

### Scenario 2: New Feature Affecting Multiple Pages
```typescript
import { invalidateCache, CACHE_PATHS, CACHE_TAGS } from '@/lib/cache/invalidation.service';

// Invalidate specific pages and tags
await invalidateCache(
  [CACHE_PATHS.HOME, CACHE_PATHS.TOOLS],
  [CACHE_TAGS.TOOLS, CACHE_TAGS.RANKINGS],
  ['^tools:', '^rankings:']
);
```

### Scenario 3: Conditional Cache Invalidation
```typescript
// Only invalidate if not a dry run
if (!dryRun) {
  invalidateArticleCache().catch(console.error);
}
```

## Performance Tips

### Do ✅
- Use ISR for infrequently updated pages
- Invalidate cache on-demand after mutations
- Use appropriate TTL periods
- Tag caches for fine-grained invalidation
- Make cache invalidation non-blocking

### Don't ❌
- Block API responses on cache invalidation
- Use `force-dynamic` when ISR would work
- Set ISR period too short (<5 minutes)
- Forget to invalidate cache after mutations
- Use `invalidateAllCaches()` unless necessary

## ISR Period Guidelines

| Update Frequency | ISR Period | Example Pages |
|------------------|------------|---------------|
| Very High | 300s (5 min) | Homepage, news feed |
| High | 900s (15 min) | Recent updates |
| Medium | 1800s (30 min) | What's new, summaries |
| Low | 3600s (1 hour) | Tools, rankings |
| Very Low | 86400s (24 hours) | Methodology, about |

## Troubleshooting

### Problem: Changes not showing
**Solution:**
1. Check cache invalidation was called
2. Check for errors in logs
3. Hard refresh browser (Cmd+Shift+R)
4. Verify ISR period hasn't expired yet

### Problem: Cache invalidation errors
**Solution:**
1. Check import path is correct
2. Verify function is being called
3. Check logs for specific error
4. Ensure async/await handling

### Problem: Stale data persists
**Solution:**
1. Check memory cache patterns match
2. Verify tags are correct
3. Check browser cache headers
4. Manual cache clear if needed

## References

- **Architecture:** `/docs/architecture/CACHING_STRATEGY.md`
- **Implementation:** `/docs/development/CACHE_IMPLEMENTATION_SUMMARY.md`
- **Service Code:** `/lib/cache/invalidation.service.ts`
- **Verification:** `./scripts/verify-cache-implementation.sh`

---

**Last Updated:** 2025-12-01
**Maintainer:** Development Team
