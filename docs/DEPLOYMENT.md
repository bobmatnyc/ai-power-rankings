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
# Supabase - CRITICAL: Use transaction pooler for Vercel
SUPABASE_DATABASE_URL=postgresql://[user]:[password]@[host]:6543/postgres?pgbouncer=true&connection_limit=1
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_KEY=[service-key]

# Payload CMS
PAYLOAD_SECRET=[strong-random-secret]
NEXT_PUBLIC_PAYLOAD_URL=https://aipowerrankings.com

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

# Feature Flags
NODE_ENV=production
```

### 3. Database Configuration

**CRITICAL**: For Vercel deployment, you MUST use:

- Supabase Transaction Pooler (port 6543)
- Connection limit = 1
- Pool max = 1 in payload.config.ts

Update `payload.config.ts`:

```typescript
db: postgresAdapter({
  pool: {
    connectionString: process.env["SUPABASE_DATABASE_URL"] || "",
    max: 1, // REQUIRED for Vercel
    min: 0,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 30000,
  },
  schemaName: "payload",
  push: false, // Disable auto schema push in production
}),
```

### 4. Vercel Configuration

Ensure `vercel.json` includes:

```json
{
  "regions": ["iad1"], // Co-locate with Supabase US East
  "functions": {
    "src/app/api/admin/*/route.ts": {
      "maxDuration": 60
    },
    "src/app/api/cron/*/route.ts": {
      "maxDuration": 300
    }
  }
}
```

### 5. Pre-Deployment Scripts

```bash
# 1. Install dependencies
npm ci

# 2. Build locally to test
npm run build

# 3. Run production build checks
npm run pre-deploy

# 4. Update algorithm version if needed
# Edit src/globals/SiteSettings.ts and src/collections/Rankings.ts
```

## Deployment Steps

### Option 1: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod
```

### Option 2: Git Push (Recommended)

```bash
# 1. Commit all changes
git add .
git commit -m "feat: payload cms migration with v6.0 algorithm"

# 2. Push to main branch
git push origin main

# Vercel will automatically deploy
```

### Option 3: Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project
3. Click "Redeploy" or push to connected Git branch

## Post-Deployment Verification

### 1. Check Application Health

```bash
# Check main site
curl -I https://aipowerrankings.com

# Check API
curl https://aipowerrankings.com/api/tools?limit=1

# Check admin panel
curl -I https://aipowerrankings.com/admin
```

### 2. Verify Database Connection

```bash
# Test rankings API
curl https://aipowerrankings.com/api/rankings?period=2025-06&limit=5
```

### 3. Check Logs

- Vercel Dashboard > Functions > Logs
- Look for database connection errors
- Monitor response times

### 4. Run Post-Deployment Scripts

```bash
# Update site settings to v6.0
curl -X POST https://aipowerrankings.com/api/admin/update-site-settings \
  -H "Authorization: Bearer $CRON_SECRET"

# Refresh tool display fields if needed
curl -X POST https://aipowerrankings.com/api/admin/refresh-tool-display \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Rollback Procedure

If issues occur:

1. **Vercel Dashboard**:

   - Go to Deployments
   - Find previous working deployment
   - Click "..." menu > "Promote to Production"

2. **Git Revert**:
   ```bash
   git revert HEAD
   git push origin main
   ```

## Common Issues

### 1. Database Connection Timeouts

**Symptom**: `{:shutdown, :db_termination}` errors

**Solution**:

- Ensure using transaction pooler (port 6543)
- Set connection_limit=1 in connection string
- Use pool max=1 in payload config

### 2. Schema Migration Prompts

**Symptom**: Deployment hangs on schema questions

**Solution**:

- Set `push: false` in payload.config.ts
- Run migrations manually if needed

### 3. Authentication Issues

**Symptom**: Can't log into admin panel

**Solution**:

- Verify OAuth credentials are set
- Check NEXTAUTH_URL matches production URL
- Ensure user exists in database

### 4. Performance Issues

**Symptom**: Slow API responses

**Solution**:

- Check Vercel function logs
- Verify region configuration
- Consider increasing function timeout

## Monitoring

1. **Vercel Analytics**:

   - Web Vitals
   - Function execution times
   - Error rates

2. **Database Monitoring**:

   - Supabase Dashboard > Database
   - Connection pool usage
   - Query performance

3. **Error Tracking**:
   - Set up Sentry or similar
   - Monitor console errors
   - Track API failures

## Security Checklist

- [ ] All secrets are in environment variables
- [ ] No hardcoded API keys in code
- [ ] OAuth redirect URLs updated for production
- [ ] CORS settings configured properly
- [ ] Rate limiting enabled on APIs
- [ ] Admin routes protected by authentication

## Support

- Vercel Support: https://vercel.com/support
- Supabase Support: https://supabase.com/support
- Payload CMS Docs: https://payloadcms.com/docs
