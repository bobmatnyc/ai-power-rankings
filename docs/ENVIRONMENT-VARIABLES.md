# Environment Variables Configuration

## Overview

This document outlines all environment variables used in the AI Power Rankings application, organized by category and deployment environment. The application uses different variable sets for development, staging, and production environments.

## 🔴 Critical Database Variables (Production)

### PostgreSQL Configuration

```bash
# Primary database connection (pooled)
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"

# Direct connection for migrations (unpooled)
DATABASE_URL_UNPOOLED="postgresql://username:password@host:port/database?sslmode=require"

# Database feature toggle
USE_DATABASE="true"  # "true" for PostgreSQL, "false" for JSON fallback

# Migration mode
DATABASE_MIGRATION_MODE="migrate"  # "dry-run", "migrate", "sync"
```

**Production Values (Vercel Environment):**
- Provider: Neon PostgreSQL
- Encryption: Variables marked as "Sensitive" in Vercel Dashboard
- Host: `ep-wispy-fog-ad8d4skz-pooler.c-2.us-east-1.aws.neon.tech` (pooled)
- Host: `ep-wispy-fog-ad8d4skz.c-2.us-east-1.aws.neon.tech` (unpooled)
- Database: `neondb`
- User: `neondb_owner`

## 🟡 Core Application Variables

### Next.js Configuration

```bash
# Application environment
NODE_ENV="production"          # "development", "production"
NEXT_PUBLIC_SITE_URL="https://aipowerranking.com"

# Build configuration
TURBO_TEAM=""                 # Turbo team identifier (optional)
VERCEL_URL=""                 # Auto-populated by Vercel
```

### Authentication & Security

```bash
# NextAuth configuration
NEXTAUTH_SECRET="[32-character-random-string]"
NEXTAUTH_URL="https://aipowerranking.com"

# OAuth providers
GOOGLE_CLIENT_ID="[google-oauth-client-id]"
GOOGLE_CLIENT_SECRET="[google-oauth-client-secret]"
GITHUB_CLIENT_ID="[github-oauth-client-id]"
GITHUB_CLIENT_SECRET="[github-oauth-client-secret]"

# Admin access control
AUTHORIZED_EMAILS="admin@aipowerranking.com,owner@company.com"
```

## 🟢 Data Collection APIs

### GitHub Integration

```bash
# GitHub API for tool metrics
GITHUB_TOKEN="ghp_[github-personal-access-token]"

# Required permissions:
# - public_repo (for public repository data)
# - read:org (for organization information)
```

### Google Services

```bash
# Google Drive for news ingestion
GOOGLE_API_KEY="[google-cloud-api-key]"
GOOGLE_DRIVE_FOLDER_ID="[drive-folder-id]"

# Google Search Console (optional)
GOOGLE_SEARCH_CONSOLE_SITE_URL="https://aipowerranking.com"
```

### AI Services

```bash
# OpenAI for content analysis
OPENAI_API_KEY="sk-[openai-api-key]"

# Perplexity for news research
PERPLEXITY_API_KEY="pplx-[perplexity-api-key]"

# OpenRouter for news article analysis (admin panel)
OPENROUTER_API_KEY="sk-or-v1-[openrouter-api-key]"
```

## 🔵 Communication & Monitoring

### Email Services

```bash
# Resend for transactional emails
RESEND_API_KEY="re_[resend-api-key]"
CONTACT_EMAIL="contact@aipowerranking.com"
EMAIL_FROM="noreply@aipowerranking.com"

# SMTP (alternative to Resend)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="[email-address]"
SMTP_PASS="[app-password]"
```

### Analytics & Performance

```bash
# Vercel Analytics
NEXT_PUBLIC_VERCEL_ANALYTICS_ID="[vercel-analytics-id]"

# Google Analytics
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID="G-[google-analytics-id]"

# Performance monitoring
NEXT_PUBLIC_SPEED_INSIGHTS="true"
```

## ⚪ Optional & Development Variables

### API Security

```bash
# CRON job authentication
CRON_SECRET="[32-character-random-string]"

# Vercel API access
VERCEL_TOKEN="[vercel-api-token]"

# Rate limiting (if using Upstash)
UPSTASH_REDIS_REST_URL="[redis-url]"
UPSTASH_REDIS_REST_TOKEN="[redis-token]"
```

### Feature Flags

```bash
# Cache management
USE_CACHE_FALLBACK="true"         # Enable cache fallback
CACHE_STRATEGY="memory"           # "memory", "file", "redis"

# Development features
ENABLE_DEBUG_LOGS="false"         # Enable detailed logging
ENABLE_PREVIEW_MODE="false"       # Enable preview features
```

## 📁 Environment Files

### File Structure

```
.env.example              # Template with placeholder values
.env.local               # Development environment (gitignored)
.env.production          # Production template (passwords removed)
.env.production.local    # Production with credentials (gitignored)
.env.preview            # Preview/staging environment
```

### Development (.env.local)

```bash
# Use for local development
# Copy from .env.example and fill in actual values
DATABASE_URL="postgresql://username:password@localhost:5432/aipower_dev"
USE_DATABASE="false"  # Use JSON files for faster development
NODE_ENV="development"
```

### Production (Vercel Environment Variables)

Set these in Vercel Dashboard as "Sensitive" variables:
- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_TOKEN`
- `OPENAI_API_KEY`
- `PERPLEXITY_API_KEY`
- `RESEND_API_KEY`

## 🔒 Security Best Practices

### Variable Protection

1. **Never commit secrets**: Use `.env.*.local` files for actual credentials
2. **Environment-specific**: Different values for dev/staging/production
3. **Vercel encryption**: Mark sensitive variables as "Sensitive" in dashboard
4. **Minimal permissions**: Use least-privilege principle for API keys
5. **Regular rotation**: Rotate secrets periodically

### Access Patterns

```typescript
// ✅ CORRECT - Use bracket notation for production compatibility
const apiKey = process.env["OPENAI_API_KEY"];

// ❌ WRONG - Dot notation may not work in production
const apiKey = process.env.OPENAI_API_KEY;
```

### Validation

```typescript
// Environment validation example
const requiredEnvVars = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET", 
  "GITHUB_TOKEN"
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
```

## 🛠️ Setup Commands

### Vercel CLI Setup

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Add environment variables
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add GITHUB_TOKEN production
# ... add all required variables
```

### Local Development Setup

```bash
# 1. Copy template
cp .env.example .env.local

# 2. Edit with your values
nano .env.local

# 3. Test configuration
pnpm run db:test

# 4. Start development
pnpm run dev
```

## 🧪 Testing Configuration

### Verify Environment

```bash
# Test database connection
pnpm run db:test

# Verify all required variables
pnpm run env:check

# Test API integrations
pnpm run test:api:all
```

### Common Issues

1. **Database connection fails**: Check DATABASE_URL format and credentials
2. **OAuth errors**: Verify client IDs and secrets match provider settings
3. **API rate limits**: Check if API keys have sufficient quotas
4. **Vercel deployment fails**: Ensure all required variables are set as "Sensitive"

## 📊 Production Status

### Current Production Configuration

**Live Site**: https://aipowerranking.com

**Database Status**: ✅ PostgreSQL (Neon) with 31 tools, 313 news articles
**Environment**: ✅ All required variables configured in Vercel
**Performance**: ✅ Sub-100ms API response times
**Security**: ✅ All sensitive data encrypted in Vercel environment

### Migration Completed (September 11, 2025)

- ✅ Database migration from JSON to PostgreSQL completed
- ✅ Environment variables updated for production database
- ✅ Vercel deployment configured with encrypted secrets
- ✅ Performance verified and monitoring active

## 📚 Related Documentation

- [DATABASE-SETUP.md](./DATABASE-SETUP.md) - Database configuration details
- [DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md) - Complete deployment process
- [PRODUCTION-MIGRATION-CHECKLIST.md](./PRODUCTION-MIGRATION-CHECKLIST.md) - Migration steps
- [VERCEL-DATABASE-SETUP.md](./VERCEL-DATABASE-SETUP.md) - Vercel-specific setup