# Comprehensive Deployment Guide

> **Status**: ✅ **PostgreSQL Migration Completed** - Production deployed with Neon database
> 
> **Live Site**: https://aipowerranking.com (31 tools, 313 news articles migrated)
>
> **Note**: This deployment process includes PostgreSQL database integration and automatic cache clearing.

## Pre-Deployment Checklist

### 1. Code Quality

```bash
# Run all quality checks
npm run pre-deploy

# Individual checks if needed
npm run lint
npm run type-check
npm run test
npm run ci:local
```

### 2. Database & Data Preparation

```bash
# Test database connection
npm run db:test

# Validate all data (works with both JSON and PostgreSQL)
npm run validate:all

# Create fresh backup
npm run backup:create

# Generate cache files
npm run cache:generate

# Optimize JSON files for production (fallback data)
npm run optimize:json
```

#### Database-Specific Pre-deployment

```bash
# Verify PostgreSQL schema is current
npm run db:push

# Test data migration (dry-run)
DATABASE_MIGRATION_MODE="dry-run" npm run db:migrate:json

# Check database performance
npm run db:benchmark
```

### 3. Environment Variables

#### Required Environment Variables (PostgreSQL Production)

```env
# Database Configuration (CRITICAL)
DATABASE_URL="postgresql://neondb_owner:[password]@ep-wispy-fog-ad8d4skz-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://neondb_owner:[password]@ep-wispy-fog-ad8d4skz.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
USE_DATABASE="true"
DATABASE_MIGRATION_MODE="migrate"

# Authentication
NEXTAUTH_SECRET=[strong-random-secret]
NEXTAUTH_URL=https://aipowerranking.com
GOOGLE_CLIENT_ID=[google-oauth-id]
GOOGLE_CLIENT_SECRET=[google-oauth-secret]
GITHUB_CLIENT_ID=[github-oauth-id]
GITHUB_CLIENT_SECRET=[github-oauth-secret]

# Data Collection APIs
GITHUB_TOKEN=[github-token]
PERPLEXITY_API_KEY=[perplexity-key]
GOOGLE_API_KEY=[google-key]
GOOGLE_DRIVE_FOLDER_ID=[folder-id]

# Email Services
RESEND_API_KEY=[resend-key]
CONTACT_EMAIL=contact@aipowerranking.com
EMAIL_FROM=noreply@aipowerranking.com

# API Keys
CRON_SECRET=[strong-random-secret]
OPENAI_API_KEY=[openai-key]

# Analytics
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=[analytics-id]

# Performance & Environment
USE_CACHE_FALLBACK=true
NODE_ENV=production
```

> **Note**: Database credentials are encrypted as "Sensitive" variables in Vercel Dashboard.
> See [ENVIRONMENT-VARIABLES.md](./ENVIRONMENT-VARIABLES.md) for complete variable documentation.

#### Vercel Environment Setup

```bash
# Database environment variables (CRITICAL - mark as Sensitive)
vercel env add DATABASE_URL production
vercel env add DATABASE_URL_UNPOOLED production
vercel env add USE_DATABASE production

# Authentication & API keys
vercel env add NEXTAUTH_SECRET production
vercel env add GITHUB_TOKEN production
vercel env add PERPLEXITY_API_KEY production
vercel env add GOOGLE_API_KEY production
vercel env add OPENAI_API_KEY production
vercel env add RESEND_API_KEY production
```

## Deployment Configuration

### 1. Update vercel.json

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build && npm run post-build",
  "outputDirectory": ".next",
  "installCommand": "pnpm install",
  "regions": ["iad1", "sfo1", "lhr1"],
  "functions": {
    "app/api/admin/build-rankings/route.ts": {
      "maxDuration": 60
    },
    "app/api/tools/route.js": {
      "maxDuration": 10,
      "memory": 1024,
      "includeFiles": "data/json/**"
    },
    "app/api/rankings/route.js": {
      "maxDuration": 10,
      "memory": 512,
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
    },
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
  ],
  "rewrites": [
    {
      "source": "/data/:path*.json",
      "destination": "/api/static/:path*"
    }
  ]
}
```

### 2. Update package.json

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

# Uncompressed files
data/json/*.json.original

# Development cache
.next/cache/

# Test files
**/*.test.ts
**/*.spec.ts
__tests__/
```

## Deployment Steps

### 1. Prepare Build

```bash
# Install dependencies
pnpm install

# Run pre-deployment checks
npm run pre-deploy

# Generate optimized data
npm run cache:generate
npm run optimize:json

# Create backup
npm run backup:create
```

### 2. Deploy to Vercel

```bash
# Deploy to preview with automatic cache clearing
npm run deploy

# Deploy to production with automatic cache clearing
npm run deploy:prod

# Or use GitHub integration (includes cache clearing via vercel.json)
git push origin main

# Legacy commands (use deployment scripts instead)
# vercel
# vercel --prod
```

## Post-Deployment Verification

### 1. Health Checks

```bash
# Check application health
curl https://aipowerranking.com/api/health

# Verify cache statistics
curl https://aipowerranking.com/api/cache/stats

# Test critical data endpoints
curl https://aipowerranking.com/api/tools
curl https://aipowerranking.com/api/rankings
curl https://aipowerranking.com/api/news
```

### 2. Performance Verification

```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://aipowerranking.com/api/rankings

# Verify compression
curl -H "Accept-Encoding: gzip" -I https://aipowerranking.com/data/cache/tools-cache.json

# Check cache headers
curl -I https://aipowerranking.com/api/tools
```

### 3. Critical Path Testing

- [ ] Homepage loads with rankings
- [ ] Tool detail pages work
- [ ] News section displays articles
- [ ] Admin dashboard accessible (authenticated)
- [ ] API endpoints return expected data structure
- [ ] Cache hit rates > 80%

### 4. Data Integrity

```bash
# Compare data counts
curl https://aipowerranking.com/api/tools | jq '.tools | length'
curl https://aipowerranking.com/api/rankings | jq '.rankings | length'

# Verify data freshness
curl https://aipowerranking.com/api/rankings | jq '._period'
```

## JSON-Specific Optimizations

### 1. Edge Caching Configuration

```typescript
// Optimal cache configuration for JSON endpoints
export const config = {
  runtime: "edge",
};

export async function GET() {
  const response = NextResponse.json(data);

  // Edge cache for 24 hours
  response.headers.set("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=43200");

  return response;
}
```

### 2. Memory Optimization

- Reduce cache sizes in production environment
- Enable file chunking for large datasets
- Monitor function memory allocation
- Use streaming for large JSON responses

### 3. Data Processing

```bash
# Regular data optimization workflow
npm run optimize:json    # Compress and optimize JSON files
npm run cache:generate   # Generate cached responses
npm run validate:all     # Ensure data integrity
```

## Monitoring

### 1. Application Monitoring

- **Vercel Analytics**: Performance metrics, Core Web Vitals
- **Error Tracking**: Function logs and error rates
- **Uptime Monitoring**: External monitoring service

### 2. Performance Metrics

- API response time < 200ms (p95)
- Cache hit rate > 90%
- Core Web Vitals < 2.5s
- Memory usage < 512MB

### 3. Custom Monitoring Endpoints

```typescript
// app/api/monitoring/health/route.ts
export async function GET() {
  const checks = {
    dataFiles: await checkDataFiles(),
    cacheStatus: await checkCacheStatus(),
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
  };

  return NextResponse.json(checks);
}
```

### 4. Alert Thresholds

- Response time > 200ms (p95)
- Error rate > 1%
- Memory usage > 80%
- Cache hit rate < 80%

## Rollback Procedures

### 1. Quick Application Rollback

```bash
# Vercel CLI rollback (preserves database)
vercel rollback

# Or via Vercel Dashboard:
# Deployments → Select previous deployment → Promote to Production
```

### 2. Database Rollback Options

#### Option A: Switch to JSON Fallback (Fastest)

```bash
# 1. Set environment variable in Vercel Dashboard
USE_DATABASE="false"

# 2. Redeploy (uses JSON files as data source)
vercel --prod

# 3. Monitor logs to confirm JSON mode active
vercel logs --prod
```

#### Option B: Database Point-in-Time Recovery

```bash
# 1. Access Neon Dashboard
# https://console.neon.tech

# 2. Navigate to your database
# Select "Restore" → Choose restore point

# 3. Update connection strings if needed
vercel env add DATABASE_URL production
```

#### Option C: Data Restoration from Backup

```bash
# 1. List available JSON backups
npm run backup:restore

# 2. Restore specific backup to database
npm run backup:restore --backup=backup-2025-09-11-150000
DATABASE_MIGRATION_MODE="migrate" npm run db:migrate:json

# 3. Verify data integrity
npm run validate:all
npm run db:test
```

### 3. Emergency Procedures

#### Critical System Failure

1. **Immediate Response** (< 2 minutes)
   ```bash
   # Switch to JSON fallback immediately
   vercel env add USE_DATABASE false production
   vercel --prod --force
   ```

2. **Investigate & Fix** (< 15 minutes)
   ```bash
   # Check database connectivity
   npm run db:test
   
   # Check recent deployments
   vercel ls
   
   # Review error logs
   vercel logs --prod -n 100
   ```

3. **Recovery Actions**
   ```bash
   # Option 1: Fix database issue and re-enable
   USE_DATABASE="true" vercel --prod
   
   # Option 2: Restore from backup
   npm run backup:restore:latest
   npm run db:migrate:json
   
   # Option 3: Rollback to last working deployment
   vercel rollback
   ```

### 4. Database Migration Rollback

If a database migration causes issues:

```bash
# 1. Revert schema changes
npm run db:rollback --to=previous-migration

# 2. Or switch to JSON fallback temporarily
USE_DATABASE="false" vercel --prod

# 3. Fix migration scripts and retry
npm run db:generate  # Create new migration
npm run db:push      # Apply to database
USE_DATABASE="true" vercel --prod
```

### 5. Monitoring During Rollback

```bash
# Monitor API health during rollback
curl https://aipowerranking.com/api/health

# Check database connection status
curl https://aipowerranking.com/api/db/status

# Verify data integrity
curl https://aipowerranking.com/api/tools | jq 'length'
curl https://aipowerranking.com/api/rankings | jq '.rankings | length'
```

### 6. Post-Rollback Verification

- [ ] ✅ Homepage loads with correct data
- [ ] ✅ API endpoints return expected responses
- [ ] ✅ Database connection stable (if applicable)
- [ ] ✅ Performance metrics within acceptable range
- [ ] ✅ Error rates below 1%
- [ ] ✅ User authentication working
- [ ] ✅ Admin functions accessible

## Troubleshooting

### Common Issues

1. **Build Failures**

   - Check TypeScript errors: `npm run type-check`
   - Verify all environment variables are set in Vercel
   - Clear cache: `rm -rf .next`
   - Test database connection: `npm run db:test`

2. **Database Connection Failures**

   ```bash
   # Verify credentials in Vercel Dashboard
   vercel env ls
   
   # Test connection locally
   NODE_ENV=production npm run db:test
   
   # Check Neon database status
   # Visit: https://console.neon.tech
   
   # Switch to JSON fallback if needed
   vercel env add USE_DATABASE false production
   ```

3. **"Module not found" errors**

   - Ensure `data/json` files included in deployment (for fallback)
   - Check `.vercelignore` isn't excluding needed files
   - Verify `includeFiles` in `vercel.json`
   - Test data access: `curl https://aipowerranking.com/api/tools`

4. **Slow API responses (PostgreSQL specific)**

   - Check database connection pooling
   - Monitor JSONB query performance
   - Verify GIN indexes are active: `npm run db:studio`
   - Consider switching to JSON fallback temporarily

5. **Database Migration Errors**

   ```bash
   # Check migration status
   npm run db:studio
   
   # Retry failed migrations
   DATABASE_MIGRATION_MODE="migrate" npm run db:migrate:json
   
   # Validate migrated data
   npm run validate:all
   ```

6. **Data Inconsistency Issues**

   ```bash
   # Compare JSON vs Database counts
   curl https://aipowerranking.com/api/tools | jq 'length'
   
   # Check for missing indexes
   npm run db:analyze
   
   # Re-sync data if needed
   npm run db:migrate:json --force
   ```

7. **Performance Degradation**

   ```bash
   # Check database query times
   vercel logs --prod -n 50 | grep "Query took"
   
   # Monitor connection pool
   npm run db:pool-status
   
   # Switch to JSON mode for immediate relief
   USE_DATABASE="false" vercel --prod
   ```

### Debug Commands

```bash
# Local build test
npm run build
npm run start

# System validation
npm run health:check

# Data validation
npm run validate:all

# Cache status
npm run cache:stats
```

## Security

### 1. Environment Security

- [ ] All environment variables set correctly
- [ ] No sensitive data in logs or client-side code
- [ ] Authentication configured properly
- [ ] CORS headers appropriate for domain

### 2. API Security

- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] Secure headers configured
- [ ] No unauthorized admin access

### 3. Rate Limiting Example

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, "1 m"),
});
```

## Maintenance

### Daily Tasks

- Monitor error rates and response times
- Check cache hit rates
- Review function logs

### Weekly Tasks

- Validate data integrity: `npm run validate:all`
- Check backup health: `ls -la data/backups/`
- Review memory usage trends

### Monthly Tasks

- Optimize JSON files: `npm run optimize:json`
- Clean old backups
- Update dependencies and security patches

### Data Update Workflow

```bash
# 1. Pull latest changes
git pull origin main

# 2. Validate and prepare
npm run validate:all
npm run backup:create
npm run optimize:json

# 3. Deploy
vercel --prod
```

## Success Metrics

**Performance Targets:**

- API response time < 100ms (p95)
- Cache hit rate > 90%
- Zero downtime deployments
- Build time < 3 minutes

**Reliability Targets:**

- Error rate < 0.1%
- Uptime > 99.9%
- Successful backup rate: 100%

**Resource Efficiency:**

- Memory usage < 512MB
- Function cold start < 2s
- Deploy time < 1 minute

## Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Project Documentation](/docs/)
- [GitHub Issues](https://github.com/yourusername/ai-power-rankings/issues)
