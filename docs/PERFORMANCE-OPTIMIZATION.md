# Performance Optimization Guide

## Overview

This guide covers performance optimization strategies for the JSON-based AI Power Rankings system, focusing on production deployment scenarios.

## Optimization Strategies

### 1. JSON File Optimization

#### Minification
Remove all unnecessary whitespace from JSON files:

```bash
# Run optimization script
npm run optimize:json

# This will:
# - Minify all JSON files
# - Create indexed versions for large arrays
# - Generate compressed versions (.gz, .br)
```

#### File Size Targets
- **tools.json**: < 500KB
- **companies.json**: < 200KB
- **rankings/*.json**: < 100KB each
- **news/articles.json**: Split if > 500KB

### 2. In-Memory Caching

#### Cache Strategy Implementation

The system uses a multi-tier caching approach:

```typescript
// Repository-level cache (automatic)
const toolsRepo = getToolsRepo();
const tools = await toolsRepo.getAll(); // Cached in memory

// Application-level cache
import { toolsCache } from '@/lib/json-db/cache-strategy';
const cachedTool = toolsCache.get('tool-id');
```

#### Cache Configuration

| Data Type | TTL | Max Size | Priority |
|-----------|-----|----------|----------|
| Tools | 1 hour | 500 items | High |
| Companies | 1 hour | 200 items | Medium |
| Rankings | 30 min | 50 items | High |
| News | 15 min | 1000 items | Low |

### 3. CDN Configuration

#### Vercel Edge Network

Configure caching headers in API routes:

```typescript
// API route example
export async function GET() {
  const response = NextResponse.json(data);
  
  // Production caching
  response.headers.set(
    'Cache-Control',
    'public, s-maxage=3600, stale-while-revalidate=1800'
  );
  
  return response;
}
```

#### Static File Serving

Place pre-generated cache files in public directory:

```
/public/
  /data/
    /cache/
      rankings-cache.json
      tools-cache.json
      news-cache.json
```

### 4. Compression

#### Automatic Compression

The optimization script creates compressed versions:

```bash
# Files generated:
tools.json       # Original minified
tools.json.gz    # Gzip compressed
tools.json.br    # Brotli compressed
```

#### Serving Compressed Files

Configure Next.js to serve compressed versions:

```javascript
// next.config.js
module.exports = {
  compress: true,
  async headers() {
    return [
      {
        source: '/data/:path*.json',
        headers: [
          {
            key: 'Content-Encoding',
            value: 'gzip'
          }
        ]
      }
    ];
  }
};
```

### 5. Data Chunking

#### Large File Splitting

For files > 500KB, automatic chunking is applied:

```
news/
  articles-chunk-0.json  # First 1000 articles
  articles-chunk-1.json  # Next 1000 articles
  articles-manifest.json # Chunk metadata
```

#### Loading Chunks

```typescript
// Load chunks progressively
async function loadNewsArticles() {
  const manifest = await fetch('/data/news/articles-manifest.json');
  const { chunks, files } = await manifest.json();
  
  // Load first chunk immediately
  const firstChunk = await fetch(`/data/news/${files[0]}`);
  
  // Load remaining chunks in background
  for (let i = 1; i < chunks; i++) {
    requestIdleCallback(() => {
      fetch(`/data/news/${files[i]}`);
    });
  }
}
```

### 6. Indexing for Fast Lookups

#### Indexed Data Structure

Large arrays are automatically indexed:

```json
{
  "_indexed": true,
  "_indexField": "id",
  "data": [...],
  "index": {
    "tool-1": 0,
    "tool-2": 1,
    ...
  }
}
```

#### Using Indexed Data

```typescript
// O(1) lookup instead of O(n)
function getToolById(toolsData, id) {
  if (toolsData._indexed) {
    const index = toolsData.index[id];
    return toolsData.data[index];
  }
  // Fallback to linear search
  return toolsData.find(t => t.id === id);
}
```

### 7. Build-Time Optimization

#### Cache Pre-generation

Add to build process:

```json
// package.json
{
  "scripts": {
    "build": "next build && npm run post-build",
    "post-build": "npm run cache:generate && npm run optimize:json"
  }
}
```

#### Vercel Build Configuration

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "functions": {
    "app/api/*.js": {
      "maxDuration": 10
    }
  },
  "headers": [
    {
      "source": "/data/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600, immutable"
        }
      ]
    }
  ]
}
```

### 8. Performance Monitoring

#### Key Metrics to Track

1. **API Response Times**
   - Target: < 100ms for cached responses
   - Monitor: p50, p95, p99 latencies

2. **Cache Hit Rates**
   - Target: > 90% for tools and rankings
   - Monitor: Cache statistics endpoint

3. **File Load Times**
   - Target: < 50ms for JSON files
   - Monitor: Resource timing API

#### Monitoring Implementation

```typescript
// Cache statistics endpoint
export async function GET() {
  const stats = {
    tools: toolsCache.getStats(),
    rankings: rankingsCache.getStats(),
    news: newsCache.getStats()
  };
  
  return NextResponse.json(stats);
}
```

### 9. Client-Side Optimization

#### Progressive Loading

```typescript
// Load critical data first
const criticalData = await Promise.all([
  fetch('/api/rankings').then(r => r.json()),
  fetch('/api/tools?limit=10').then(r => r.json())
]);

// Load remaining data
requestIdleCallback(() => {
  fetch('/api/tools?offset=10').then(r => r.json());
  fetch('/api/news').then(r => r.json());
});
```

#### Local Storage Caching

```typescript
// Cache in localStorage with TTL
function cacheData(key: string, data: any, ttl: number = 3600000) {
  localStorage.setItem(key, JSON.stringify({
    data,
    expires: Date.now() + ttl
  }));
}

function getCachedData(key: string) {
  const cached = localStorage.getItem(key);
  if (!cached) return null;
  
  const { data, expires } = JSON.parse(cached);
  if (Date.now() > expires) {
    localStorage.removeItem(key);
    return null;
  }
  
  return data;
}
```

### 10. Production Checklist

Before deploying to production:

- [ ] Run `npm run optimize:json` to minify all JSON files
- [ ] Verify compressed versions (.gz, .br) are generated
- [ ] Check large files are properly chunked
- [ ] Confirm cache headers are set correctly
- [ ] Test cache warming on server start
- [ ] Monitor initial load performance
- [ ] Verify CDN is caching static assets
- [ ] Check memory usage is within limits

## Performance Targets

### Load Time Goals
- **Initial page load**: < 2s
- **Subsequent navigation**: < 500ms
- **API responses**: < 100ms (cached)
- **JSON file loads**: < 50ms

### Resource Budgets
- **JavaScript bundle**: < 200KB gzipped
- **JSON data per request**: < 500KB
- **Total memory usage**: < 512MB
- **Cache size**: < 100MB

## Troubleshooting

### High Memory Usage
1. Check cache sizes: `GET /api/cache/stats`
2. Reduce cache TTL or max size
3. Enable more aggressive LRU eviction

### Slow API Responses
1. Verify caching is enabled
2. Check file sizes are optimized
3. Monitor disk I/O performance
4. Consider increasing cache TTL

### Cache Misses
1. Check cache warming is working
2. Verify TTL settings are appropriate
3. Monitor eviction patterns
4. Consider increasing cache size

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run optimize:json` | Optimize all JSON files |
| `npm run cache:generate` | Generate cache files |
| `npm run cache:stats` | Show cache statistics |
| `npm run perf:test` | Run performance tests |

## Next Steps

1. **Implement monitoring** - Set up performance tracking
2. **A/B test optimizations** - Measure impact of changes
3. **Consider edge functions** - Move computation closer to users
4. **Explore WebAssembly** - For compute-intensive operations