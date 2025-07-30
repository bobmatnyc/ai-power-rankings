# Cache Clearing Documentation

## Overview

This document describes the automatic cache clearing mechanisms implemented in the AI Power Rankings deployment process to ensure fresh data on every deployment.

## Cache Types and Clearing Strategies

### 1. Next.js Build Cache

**Location**: `.next/` directory

**Clearing Strategy**:
- Automatically cleared before each build via `scripts/clear-next-cache.js`
- Integrated into the Vercel build command
- Ensures clean builds without stale compiled assets

### 2. Static JSON Cache Files

**Location**: `src/data/cache/` directory

**Clearing Strategy**:
- Regenerated during build process via `npm run cache:generate`
- Includes rankings, tools, and news cache files
- Ensures latest data is included in the deployment

### 3. Vercel CDN Cache

**Clearing Strategy**:
- Purged after deployment using Vercel API
- Cache tags: `rankings-data`, `tools-data`, `news-data`
- URL patterns: `/api/*`, `/data/cache/*`

### 4. Browser Cache

**Clearing Strategy**:
- Controlled via Cache-Control headers in `vercel.json`
- Stale-while-revalidate ensures users get fresh data
- CDN-Cache-Control for edge cache management

## Deployment Commands

### Standard Deployment with Cache Clearing

```bash
# Deploy to preview with automatic cache clearing
npm run deploy

# Deploy to production with automatic cache clearing
npm run deploy:prod
```

### Manual Cache Operations

```bash
# Clear Next.js cache only
node scripts/clear-next-cache.js

# Regenerate all cache files
npm run cache:generate

# Individual cache regeneration
npm run cache:rankings
npm run cache:tools
npm run cache:news
```

## Vercel Build Configuration

The `vercel.json` file is configured to automatically clear caches during build:

```json
{
  "buildCommand": "node scripts/clear-next-cache.js && npm run cache:generate && npm run build"
}
```

This ensures:
1. Next.js cache is cleared before building
2. Static cache files are regenerated with latest data
3. Build proceeds with fresh cache

## Environment Variables for Cache Purging

To enable CDN cache purging, set these environment variables:

```env
VERCEL_PROJECT_ID=your-project-id
VERCEL_TOKEN=your-vercel-api-token
```

Get these values from:
- Project ID: Vercel Dashboard → Project Settings → General
- API Token: Vercel Dashboard → Account Settings → Tokens

## Cache Headers Configuration

### API Endpoints

```javascript
// Rankings endpoint - 5 minute cache
response.headers.set(
  "Cache-Control", 
  "public, max-age=0, s-maxage=300, stale-while-revalidate=600, must-revalidate"
);
```

### Static Cache Files

```javascript
// Cache files - 24 hour cache with stale-while-revalidate
response.headers.set(
  "Cache-Control",
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=43200"
);
```

## Deployment Script Features

The `scripts/deployment-with-cache-clear.js` script provides:

1. **Local Cache Clearing**: Removes `.next` and `node_modules/.cache`
2. **Cache File Regeneration**: Runs `cache:generate` for fresh data
3. **Pre-deployment Checks**: Validates code quality
4. **Vercel Deployment**: Deploys to preview or production
5. **CDN Cache Purging**: Uses Vercel API to purge edge cache
6. **Health Verification**: Checks deployment endpoints

## Troubleshooting Cache Issues

### Symptoms of Stale Cache

- Old rankings data appearing after deployment
- News articles not updating
- Tool information outdated
- Build errors related to cached modules

### Solutions

1. **Force Clean Build**:
   ```bash
   rm -rf .next node_modules/.cache
   npm run build
   ```

2. **Manually Purge CDN**:
   ```bash
   curl -X POST https://api.vercel.com/v1/projects/[PROJECT_ID]/purge \
     -H "Authorization: Bearer [TOKEN]" \
     -H "Content-Type: application/json"
   ```

3. **Verify Cache Headers**:
   ```bash
   curl -I https://aipowerranking.com/api/rankings
   ```

4. **Check Cache Statistics**:
   ```bash
   curl https://aipowerranking.com/api/cache/stats
   ```

## Best Practices

1. **Always use deployment scripts** instead of direct `vercel` commands
2. **Monitor cache hit rates** after deployment
3. **Verify data freshness** using API endpoints
4. **Set up monitoring** for cache-related metrics
5. **Document any manual cache clearing** in deployment logs

## Monitoring Cache Performance

### Key Metrics

- Cache hit rate (target: >90%)
- Cache age distribution
- CDN cache purge success rate
- Build time with cache operations

### Verification Commands

```bash
# Check cache stats
npm run cache:stats

# Verify latest rankings
curl https://aipowerranking.com/api/rankings | jq '._period'

# Monitor cache headers
curl -I https://aipowerranking.com/api/tools | grep -i cache
```

## Future Improvements

1. **Incremental Cache Updates**: Only regenerate changed data
2. **Cache Warming**: Pre-populate cache after deployment
3. **Regional Cache Management**: Purge specific regions
4. **Cache Analytics**: Detailed cache performance metrics
5. **Automated Cache Testing**: Verify cache behavior in CI/CD