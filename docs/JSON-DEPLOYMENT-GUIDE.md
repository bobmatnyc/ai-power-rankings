# JSON System Deployment Guide

## Pre-Deployment Checklist

### 1. Code Quality Checks

```bash
# Run all quality checks
npm run ci:local

# Individual checks
npm run lint
npm run type-check
npm run test
```

### 2. Data Preparation

```bash
# Validate all JSON data
npm run validate:all

# Create fresh backup
npm run backup:create

# Optimize JSON files
npm run optimize:json

# Generate cache files
npm run cache:generate
```

### 3. Environment Configuration

#### Required Environment Variables

```bash
# Data Collection APIs
GITHUB_TOKEN=your-github-token
PERPLEXITY_API_KEY=your-perplexity-key
GOOGLE_API_KEY=your-google-key
GOOGLE_DRIVE_FOLDER_ID=your-folder-id

# Features
RESEND_API_KEY=your-resend-key
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your-analytics-id

# Performance
USE_CACHE_FALLBACK=true
NODE_ENV=production
```

#### Vercel Environment Setup

```bash
# Set environment variables
vercel env add GITHUB_TOKEN production
vercel env add PERPLEXITY_API_KEY production
vercel env add GOOGLE_API_KEY production
vercel env add GOOGLE_DRIVE_FOLDER_ID production
vercel env add RESEND_API_KEY production
```

## Deployment Steps

### 1. Update vercel.json

Create or update `vercel.json`:

```json
{
  "buildCommand": "npm run build && npm run cache:generate && npm run optimize:json",
  "outputDirectory": ".next",
  "functions": {
    "app/api/*.js": {
      "maxDuration": 10,
      "includeFiles": "data/json/**"
    }
  },
  "headers": [
    {
      "source": "/data/cache/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=43200"
        },
        {
          "key": "CDN-Cache-Control",
          "value": "max-age=86400"
        }
      ]
    },
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, s-maxage=3600, stale-while-revalidate=1800"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/data/:path*.json",
      "destination": "/api/static/:path*"
    }
  ]
}
```

### 2. Update package.json Build Script

```json
{
  "scripts": {
    "build": "next build",
    "vercel-build": "npm run build && npm run post-build",
    "post-build": "npm run cache:generate && npm run optimize:json && npm run validate:all"
  }
}
```

### 3. Create .vercelignore

```
# Development files
.env.local
.env.development

# Backup files
data/backups/
*.backup

# Uncompressed files (keep only optimized versions)
data/json/*.json.original

# Development cache
.next/cache/

# Test files
**/*.test.ts
**/*.spec.ts
__tests__/
```

### 4. Deploy to Vercel

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Or using Git
git push origin main
```

## Post-Deployment Verification

### 1. Health Checks

```bash
# Check API health
curl https://your-domain.vercel.app/api/health

# Verify cache statistics
curl https://your-domain.vercel.app/api/cache/stats

# Test data endpoints
curl https://your-domain.vercel.app/api/tools
curl https://your-domain.vercel.app/api/rankings
curl https://your-domain.vercel.app/api/news
```

### 2. Performance Verification

```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://your-domain.vercel.app/api/rankings

# Verify compression
curl -H "Accept-Encoding: gzip" -I https://your-domain.vercel.app/data/cache/tools-cache.json

# Check cache headers
curl -I https://your-domain.vercel.app/api/tools
```

### 3. Data Integrity

```bash
# Compare data counts
curl https://your-domain.vercel.app/api/tools | jq '.tools | length'
curl https://your-domain.vercel.app/api/rankings | jq '.rankings | length'

# Verify data freshness
curl https://your-domain.vercel.app/api/rankings | jq '._period'
```

## Monitoring Setup

### 1. Vercel Analytics

Monitor key metrics:
- **Response times**: p50, p95, p99
- **Error rates**: 4xx, 5xx errors
- **Traffic patterns**: Peak usage times
- **Edge cache hit rate**: CDN effectiveness

### 2. Custom Monitoring

Create monitoring endpoints:

```typescript
// app/api/monitoring/health/route.ts
export async function GET() {
  const checks = {
    dataFiles: await checkDataFiles(),
    cacheStatus: await checkCacheStatus(),
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  };
  
  return NextResponse.json(checks);
}
```

### 3. Alerts

Set up alerts for:
- Response time > 200ms (p95)
- Error rate > 1%
- Memory usage > 80%
- Cache hit rate < 80%

## Rollback Procedures

### 1. Quick Rollback

```bash
# Revert to previous deployment
vercel rollback

# Or using Vercel dashboard
# Go to Deployments → Select previous deployment → Promote to Production
```

### 2. Data Rollback

```bash
# If data issues occur
npm run backup:restore:latest

# Redeploy with restored data
vercel --prod
```

### 3. Emergency Procedures

If critical issues occur:

1. **Enable maintenance mode**
   ```typescript
   // app/api/route.ts
   export async function GET() {
     return NextResponse.json(
       { message: "Maintenance in progress" },
       { status: 503 }
     );
   }
   ```

2. **Restore from backup**
   ```bash
   npm run backup:restore
   npm run validate:all
   ```

3. **Redeploy**
   ```bash
   vercel --prod --force
   ```

## Performance Optimization

### 1. Edge Caching

Leverage Vercel Edge Network:

```typescript
// Optimal cache configuration
export const config = {
  runtime: 'edge',
};

export async function GET() {
  const response = NextResponse.json(data);
  
  // Edge cache for 24 hours
  response.headers.set(
    'Cache-Control',
    'public, s-maxage=86400, stale-while-revalidate=43200'
  );
  
  return response;
}
```

### 2. Regional Deployment

Configure regions in vercel.json:

```json
{
  "regions": ["iad1", "sfo1", "lhr1"],
  "functions": {
    "app/api/rankings/route.js": {
      "regions": ["iad1"]
    }
  }
}
```

### 3. Function Configuration

Optimize function settings:

```json
{
  "functions": {
    "app/api/tools/route.js": {
      "maxDuration": 10,
      "memory": 1024
    },
    "app/api/rankings/route.js": {
      "maxDuration": 10,
      "memory": 512
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **"Module not found" errors**
   - Ensure data/json files are included in deployment
   - Check .vercelignore isn't excluding needed files

2. **Slow API responses**
   - Verify cache is working: `GET /api/cache/stats`
   - Check if optimize:json ran during build
   - Monitor function cold starts

3. **Out of memory errors**
   - Reduce cache sizes in production
   - Enable file chunking for large datasets
   - Increase function memory allocation

4. **CORS issues**
   - Add CORS headers to API routes
   - Configure allowed origins in middleware

### Debug Mode

Enable debug logging:

```typescript
// lib/logger.ts
const debugEnabled = process.env.DEBUG === 'true';

export const loggers = {
  api: createLogger('api', debugEnabled),
  cache: createLogger('cache', debugEnabled),
  // ...
};
```

## Security Considerations

### 1. API Rate Limiting

Implement rate limiting:

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'),
});
```

### 2. Input Validation

Always validate inputs:

```typescript
// Validate query parameters
const schema = z.object({
  limit: z.number().min(1).max(100).default(10),
  offset: z.number().min(0).default(0)
});

const params = schema.parse(request.query);
```

### 3. Secure Headers

Add security headers:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ]
}
```

## Maintenance Procedures

### Regular Tasks

1. **Daily**
   - Monitor error rates
   - Check cache hit rates
   - Review response times

2. **Weekly**
   - Validate data integrity
   - Check backup health
   - Review memory usage trends

3. **Monthly**
   - Optimize JSON files
   - Clean old backups
   - Update dependencies

### Data Updates

For regular data updates:

```bash
# 1. Pull latest data
git pull origin main

# 2. Validate new data
npm run validate:all

# 3. Create backup
npm run backup:create

# 4. Optimize for production
npm run optimize:json

# 5. Deploy
vercel --prod
```

## Success Metrics

Track these KPIs post-deployment:

- **Performance**
  - API response time < 100ms (p95)
  - Cache hit rate > 90%
  - Zero downtime deployments

- **Reliability**
  - Error rate < 0.1%
  - Uptime > 99.9%
  - Successful backup rate: 100%

- **Efficiency**
  - Memory usage < 512MB
  - Build time < 3 minutes
  - Deploy time < 1 minute