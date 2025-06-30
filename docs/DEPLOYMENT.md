# Production Deployment Guide

## Pre-Deployment Checklist

### 1. Code Quality

- [ ] Run `npm run pre-deploy` to check:
  - ESLint errors
  - TypeScript compilation
  - Code formatting
  - Tests pass
- [ ] Fix critical errors (warnings can be addressed later)

### 2. Environment Variables

Required environment variables for production:

```env
# Authentication
NEXTAUTH_SECRET=[strong-random-secret]
NEXTAUTH_URL=https://aipowerrankings.com
GOOGLE_CLIENT_ID=[google-oauth-id]
GOOGLE_CLIENT_SECRET=[google-oauth-secret]
GITHUB_CLIENT_ID=[github-oauth-id]
GITHUB_CLIENT_SECRET=[github-oauth-secret]

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=[email]
SMTP_PASS=[app-password]
EMAIL_FROM=noreply@aipowerrankings.com

# API Keys
CRON_SECRET=[strong-random-secret]
VERCEL_TOKEN=[vercel-api-token]

# OpenAI (for embeddings)
OPENAI_API_KEY=[openai-key]

# Google Analytics
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
```

### 3. Data Validation

- [ ] Run `npm run validate:all` to check JSON data integrity
- [ ] Create backup: `npm run backup:create`
- [ ] Verify cache generation: `npm run cache:generate`

## Deployment Steps

### 1. Prepare Build

```bash
# Install dependencies
pnpm install

# Run pre-deployment checks
npm run pre-deploy

# Generate cache files
npm run cache:generate

# Create data backup
npm run backup:create
```

### 2. Deploy to Vercel

```bash
# Deploy to production
vercel --prod

# Or use GitHub integration for automatic deployments
```

### 3. Post-Deployment Verification

1. **Check Application Health**
   ```bash
   curl https://aipowerrankings.com/api/health
   ```

2. **Verify Data Loading**
   - Tools: https://aipowerrankings.com/api/tools
   - Rankings: https://aipowerrankings.com/api/rankings
   - News: https://aipowerrankings.com/api/news

3. **Test Critical Paths**
   - [ ] Homepage loads with rankings
   - [ ] Tool detail pages work
   - [ ] News section displays articles
   - [ ] Admin dashboard accessible (authenticated)

## Environment Configuration

### Vercel Settings

```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "pnpm install",
  "regions": ["iad1"], // US East
  "functions": {
    "app/api/admin/build-rankings/route.ts": {
      "maxDuration": 60
    }
  }
}
```

### Performance Optimization

1. **Cache Headers**
   - Static assets: 1 year
   - API responses: 5 minutes
   - JSON data: 1 hour

2. **Edge Functions**
   - Use for read-only endpoints
   - Reduces latency globally

3. **Image Optimization**
   - Use Next.js Image component
   - Configure remote patterns

## Monitoring

### 1. Application Monitoring

- **Vercel Analytics**: Built-in performance metrics
- **Error Tracking**: Check Vercel Functions logs
- **Uptime Monitoring**: Set up external monitoring

### 2. Data Integrity

```bash
# Check data health
npm run health:check

# Validate JSON files
npm run validate:all

# Monitor backup status
ls -la data/backups/
```

### 3. Performance Metrics

- Core Web Vitals < 2.5s
- API response time < 200ms
- Cache hit rate > 90%

## Rollback Procedures

### Quick Rollback

1. **Vercel Dashboard**
   - Go to Deployments
   - Find previous working deployment
   - Click "Promote to Production"

2. **Data Rollback**
   ```bash
   # List available backups
   npm run backup:restore

   # Restore specific backup
   npm run backup:restore --backup=backup-2025-06-29-220000
   ```

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check TypeScript errors: `npm run type-check`
   - Verify environment variables
   - Clear cache: `rm -rf .next`

2. **Data Not Loading**
   - Check JSON file validity
   - Verify file permissions
   - Check API routes

3. **Performance Issues**
   - Regenerate cache files
   - Check JSON file sizes
   - Monitor API response times

### Debug Commands

```bash
# Check build locally
npm run build

# Test production build
npm run start

# Validate all systems
npm run health:check
```

## Security Checklist

- [ ] Environment variables set correctly
- [ ] Authentication configured
- [ ] CORS headers appropriate
- [ ] Rate limiting enabled
- [ ] No sensitive data in logs

## Support Resources

- Vercel Documentation: https://vercel.com/docs
- Next.js Deployment: https://nextjs.org/docs/deployment
- GitHub Issues: https://github.com/yourusername/ai-power-rankings/issues