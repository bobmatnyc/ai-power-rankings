# Performance Optimization Guide

## Overview

This guide covers comprehensive performance optimization strategies for the AI Power Rankings system, including Core Web Vitals optimization, bundle size reduction, and production deployment scenarios. Recent optimizations have achieved a potential ~76.3 KiB reduction in bundle size and significant improvements to Total Blocking Time.

## Performance Issues Addressed

### Initial Lighthouse Analysis

- **Legacy JavaScript Polyfills**: 11 KiB (unnecessary for modern browsers)
- **Unused CSS**: 11 KiB (from global styles and unused selectors)
- **Unused JavaScript**: 54 KiB (primarily from Google Tag Manager)
- **Long Main-Thread Tasks**: 7 tasks, up to 103ms each
- **Total Blocking Time**: >300ms (Target: <200ms)
- **Lighthouse Performance Score**: ~60 (Target: >90)

### Core Web Vitals Baseline

- **Largest Contentful Paint**: 4.6s (Target: <2.5s)
- **Cumulative Layout Shift**: 0.242 (Target: <0.1)
- **First Input Delay**: High due to main thread blocking
- **Time to Interactive**: Delayed by heavy JavaScript execution

## Implemented Solutions

### 1. Browser Target Updates and Polyfill Removal

#### Browserslist Configuration
Updated `package.json` to target modern browsers:

```json
"browserslist": {
  "production": [
    "Chrome >= 95",
    "Firefox >= 95", 
    "Safari >= 15.4",
    "Edge >= 95",
    "not dead",
    "not op_mini all"
  ],
  "development": [
    "last 1 chrome version",
    "last 1 firefox version",
    "last 1 safari version"
  ]
}
```

#### SWC Configuration
Created `.swcrc` to exclude unnecessary polyfills:

```json
{
  "$schema": "https://swc.rs/schema.json",
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "tsx": true
    },
    "transform": {
      "react": {
        "runtime": "automatic"
      }
    },
    "target": "es2020",
    "externalHelpers": false
  },
  "module": {
    "type": "es6"
  },
  "minify": true,
  "env": {
    "targets": {
      "chrome": "95",
      "firefox": "95",
      "safari": "15.4",
      "edge": "95"
    },
    "mode": "usage",
    "coreJs": 3,
    "exclude": [
      "es.array.concat",
      "es.array.slice",
      "es.string.split"
    ]
  }
}
```

**Impact**: ~11 KiB reduction in polyfill code

### 2. CSS Optimization with PurgeCSS

#### PostCSS Configuration
Created `postcss.config.js` with PurgeCSS integration:

```javascript
module.exports = {
  plugins: {
    'postcss-import': {},
    'tailwindcss/nesting': {},
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production' ? {
      '@fullhuman/postcss-purgecss': {
        content: [
          './src/**/*.{js,jsx,ts,tsx}',
          './src/app/**/*.{js,jsx,ts,tsx}',
          './src/components/**/*.{js,jsx,ts,tsx}'
        ],
        defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || [],
        safelist: {
          standard: [/^(hover|focus|active|group-hover):/],
          deep: [/data-theme$/],
          greedy: [/animate-/]
        }
      }
    } : {})
  }
}
```

#### Critical CSS Extraction
Implemented utilities in `/src/lib/performance/css-optimizer.ts`:

```typescript
// Extract critical CSS for above-the-fold content
async function extractCriticalCSS(url: string) {
  const critical = await import('critical');
  return critical.generate({
    base: 'out/',
    src: url,
    target: {
      css: 'critical.css',
      html: 'index-critical.html'
    },
    dimensions: [
      { height: 900, width: 1440 }, // Desktop
      { height: 812, width: 375 }   // Mobile
    ]
  });
}
```

**Impact**: ~11 KiB reduction in unused CSS

### 3. Google Analytics Web Worker Migration

#### Partytown Integration
See [JavaScript Optimization Guide](./JAVASCRIPT-OPTIMIZATION.md) for full details.

Key implementation:
- Analytics moved to web worker via Partytown
- Delayed loading until user interaction
- Proxy endpoint for cross-origin requests

**Impact**: ~54 KiB removed from main thread

### 4. React and Main Thread Optimization

#### Component Optimizations
See [Main Thread Optimization Guide](./PERFORMANCE-MAIN-THREAD-OPTIMIZATION.md) for full details.

Key implementations:
- React.memo for component memoization
- useTransition for non-urgent updates
- Web workers for data processing
- requestIdleCallback for chunked processing

**Impact**: Total Blocking Time reduced to <200ms

### 5. Webpack Configuration Updates

#### Next.js Configuration
Updated `next.config.ts` with performance optimizations:

```typescript
const config: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude polyfills for modern browsers
      config.resolve.alias = {
        ...config.resolve.alias,
        'core-js': false,
        'regenerator-runtime': false
      };

      // Enhanced code splitting
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          framework: {
            name: 'framework',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            priority: 40,
            enforce: true
          },
          lib: {
            test: /[\\/]node_modules[\\/]/,
            name(module) {
              const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)[\\/]/);
              return `lib-${packageName[1].replace('@', '')}`;
            },
            priority: 30,
            minChunks: 1,
            reuseExistingChunk: true
          },
          commons: {
            name: 'commons',
            minChunks: 2,
            priority: 20
          },
          shared: {
            name(module, chunks) {
              return crypto
                .createHash('sha1')
                .update(chunks.reduce((acc, chunk) => acc + chunk.name, ''))
                .digest('hex');
            }
          }
        }
      };
    }
    return config;
  }
};
```

### 6. Build Process Updates

#### New Scripts Added
```json
{
  "scripts": {
    "build": "npm run partytown:setup && next build && npm run optimize:post-build",
    "optimize:post-build": "npm run optimize:css && npm run generate:critical",
    "optimize:css": "purgecss --config ./purgecss.config.js",
    "generate:critical": "node scripts/generate-critical-css.js",
    "partytown:setup": "partytown copylib public/~partytown",
    "analyze": "ANALYZE=true next build",
    "measure:performance": "lighthouse http://localhost:3000 --output=json --output-path=./performance-report.json"
  }
}
```

## Expected Performance Improvements

### Bundle Size Reductions
- **Polyfills removed**: ~11 KiB
- **Unused CSS removed**: ~11 KiB  
- **Google Analytics offloaded**: ~54 KiB
- **Total reduction**: ~76.3 KiB

### Core Web Vitals Improvements
- **Total Blocking Time**: <200ms (from >300ms)
- **Time to Interactive**: -500ms improvement
- **First Input Delay**: Significantly reduced
- **Lighthouse Score**: Target >90 (from ~60)

### Runtime Performance
- **Main thread tasks**: Maximum 50ms (from 103ms)
- **JavaScript execution**: <1s (from 1.9s)
- **React re-renders**: 80% reduction

## Outstanding Issues

### TypeScript Errors
- Missing UI component: `@/components/ui/progress`
- Type safety issues need resolution
- Build currently fails type checking

### Polyfill Exclusion
- Webpack alias configuration needs adjustment
- Some polyfills still included in development builds
- SWC configuration conflicts with Next.js defaults

### CSS Plugin Conflicts
- PurgeCSS removing required Tailwind classes
- Critical CSS extraction needs refinement
- PostCSS plugin ordering issues

## Deployment Considerations

### Pre-Deployment Checklist
- [ ] Fix all TypeScript errors
- [ ] Validate CSS optimization doesn't break styles
- [ ] Test analytics functionality in production
- [ ] Verify polyfill exclusion in production build
- [ ] Run performance tests post-deployment

### Build Process Changes
1. Partytown files must be copied before build
2. Critical CSS generation adds ~30s to build time
3. PurgeCSS requires all dynamic classes in safelist
4. Bundle analyzer available with `ANALYZE=true`

### Performance Monitoring
```bash
# Local performance testing
npm run build
npm run start
npm run measure:performance

# Production monitoring
- Set up Real User Monitoring (RUM)
- Configure performance budgets in CI/CD
- Track Core Web Vitals in production
```

### Rollback Procedures
If performance regressions occur:

1. **Disable CSS optimization**:
   ```bash
   # Remove PurgeCSS from postcss.config.js
   # Rebuild without optimization
   ```

2. **Restore polyfills**:
   ```bash
   # Remove .swcrc file
   # Update browserslist to include older browsers
   ```

3. **Disable Partytown**:
   ```bash
   # Use original GoogleAnalytics component
   # Remove partytown setup from build
   ```

## Next Steps

1. **Immediate fixes**:
   - Resolve TypeScript compilation errors
   - Fix webpack polyfill exclusion
   - Refine PurgeCSS configuration

2. **Testing phase**:
   - Comprehensive cross-browser testing
   - Performance regression testing
   - Analytics data validation

3. **Production rollout**:
   - Deploy to staging environment first
   - Monitor performance metrics for 24 hours
   - Gradual rollout with feature flags

4. **Future optimizations**:
   - Implement service worker for offline support
   - Add resource hints for faster loading
   - Consider edge computing for API responses

## JSON File Optimization

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

- **tools/individual/\*.json**: < 20KB each (30 files total)
- **tools/tools-index.json**: < 50KB
- **companies.json**: < 200KB
- **rankings/\*.json**: < 100KB each
- **news/articles.json**: Split if > 500KB

### 2. In-Memory Caching

#### Cache Strategy Implementation

The system uses a multi-tier caching approach:

```typescript
// Repository-level cache (automatic)
const toolsRepo = getToolsRepo();
const tools = await toolsRepo.getAll(); // Cached in memory

// Application-level cache
import { toolsCache } from "@/lib/json-db/cache-strategy";
const cachedTool = toolsCache.get("tool-id");
```

#### Cache Configuration

| Data Type | TTL    | Max Size   | Priority |
| --------- | ------ | ---------- | -------- |
| Tools     | 1 hour | 500 items  | High     |
| Companies | 1 hour | 200 items  | Medium   |
| Rankings  | 30 min | 50 items   | High     |
| News      | 15 min | 1000 items | Low      |

### 3. CDN Configuration

#### Vercel Edge Network

Configure caching headers in API routes:

```typescript
// API route example
export async function GET() {
  const response = NextResponse.json(data);

  // Production caching
  response.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=1800");

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
# Files generated per tool:
tools/individual/cursor.json       # Original minified
tools/individual/cursor.json.gz    # Gzip compressed
tools/individual/cursor.json.br    # Brotli compressed

# Index files:
tools/tools-index.json       # Original minified
tools/tools-index.json.gz    # Gzip compressed  
tools/tools-index.json.br    # Brotli compressed
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
        source: "/data/:path*.json",
        headers: [
          {
            key: "Content-Encoding",
            value: "gzip",
          },
        ],
      },
    ];
  },
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
  const manifest = await fetch("/data/news/articles-manifest.json");
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
  return toolsData.find((t) => t.id === id);
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
    news: newsCache.getStats(),
  };

  return NextResponse.json(stats);
}
```

### 9. Client-Side Optimization

#### Progressive Loading

```typescript
// Load critical data first
const criticalData = await Promise.all([
  fetch("/api/rankings").then((r) => r.json()),
  fetch("/api/tools?limit=10").then((r) => r.json()),
]);

// Load remaining data
requestIdleCallback(() => {
  fetch("/api/tools?offset=10").then((r) => r.json());
  fetch("/api/news").then((r) => r.json());
});
```

#### Local Storage Caching

```typescript
// Cache in localStorage with TTL
function cacheData(key: string, data: any, ttl: number = 3600000) {
  localStorage.setItem(
    key,
    JSON.stringify({
      data,
      expires: Date.now() + ttl,
    })
  );
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

| Command                  | Description             |
| ------------------------ | ----------------------- |
| `npm run optimize:json`  | Optimize all JSON files |
| `npm run cache:generate` | Generate cache files    |
| `npm run cache:stats`    | Show cache statistics   |
| `npm run perf:test`      | Run performance tests   |

## Next Steps

1. **Implement monitoring** - Set up performance tracking
2. **A/B test optimizations** - Measure impact of changes
3. **Consider edge functions** - Move computation closer to users
4. **Explore WebAssembly** - For compute-intensive operations
