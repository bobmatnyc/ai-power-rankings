# Operations Guide (OPS.md)

## 🔴 CRITICAL: Deployment Rules

**PRODUCTION DEPLOYMENT RULE**:
### ⚠️ ONLY the `main` branch is deployed to production. NEVER deploy staging or feature branches to production.

---

## 📋 Branch Strategy

| Branch | Environment | Purpose | URL |
|--------|------------|---------|-----|
| **main** | Production | Stable, tested code only | https://aipowerranking.com |
| **staging** | Staging | Integration testing | https://staging-ai-power-ranking.vercel.app |
| **feature/*** | Preview | Feature development | Auto-generated preview URLs |

## 🚀 Deployment Procedures

### Production Deployment (main branch ONLY)
```bash
# 1. Ensure you're on main branch
git checkout main
git pull origin main

# 2. Run pre-deployment checks
pnpm run ci:local
pnpm run pre-deploy

# 3. Deploy to production
vercel --prod

# 4. Verify deployment
curl -I https://aipowerranking.com
```

### Staging Deployment
```bash
# 1. Ensure you're on staging branch
git checkout staging
git pull origin staging

# 2. Deploy to staging
vercel --target preview

# 3. Alias to staging URL if needed
vercel alias [deployment-url] staging-ai-power-ranking.vercel.app
```

## 🔐 Authentication Configuration (Clerk)

### Required Environment Variables

All environments MUST have these Clerk variables configured:

```bash
# Core Clerk Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_[live|test]_*****
CLERK_SECRET_KEY=sk_[live|test]_*****

# Clerk Routing Configuration
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

### Environment-Specific Settings

| Environment | Key Type | Domain Configuration |
|------------|----------|---------------------|
| Production | `pk_live_*`, `sk_live_*` | aipowerranking.com |
| Staging | `pk_test_*`, `sk_test_*` | staging-ai-power-ranking.vercel.app |
| Development | `pk_test_*`, `sk_test_*` | localhost:3001 |

### Verifying Authentication

```bash
# Check if Clerk variables are set
vercel env ls | grep CLERK

# Test authentication endpoints
curl https://[domain]/api/admin/auth
curl https://[domain]/sign-in
```

## 💾 Database Configuration

### Environment Database Mapping

| Environment | Database | Endpoint Pattern |
|------------|----------|-----------------|
| Production | Production DB | ep-wispy-fog-* |
| Staging | Production DB | ep-wispy-fog-* (shared) |
| Development | Development DB | ep-bold-sunset-* |

### Required Database Variables

```bash
DATABASE_URL=postgresql://[connection-string]
USE_DATABASE=true
NEXT_PUBLIC_USE_DATABASE=true
```

## 🛠️ Common Operations

### Check Current Deployments
```bash
vercel list
```

### Rollback Production
```bash
# List recent deployments
vercel list

# Promote previous deployment
vercel alias [previous-deployment-url] aipowerranking.com
```

### Environment Variable Management
```bash
# Add variable (use printf to avoid newlines)
printf "value" | vercel env add VARIABLE_NAME production

# Remove variable
vercel env rm VARIABLE_NAME production

# Pull variables locally
vercel env pull .env.production.local --environment=production
```

## ⚠️ Critical Warnings

1. **NEVER deploy staging branch to production**
2. **ALWAYS run pre-deploy checks before production deployment**
3. **NEVER commit sensitive credentials to the repository**
4. **ALWAYS verify authentication after deployment**
5. **NEVER use development/test Clerk keys in production**

## 📊 Monitoring Checklist

After any deployment, verify:

- [ ] Site loads without errors
- [ ] Authentication works (`/sign-in` accessible)
- [ ] Admin routes are protected (`/admin` requires auth)
- [ ] Database connection shows correct environment
- [ ] No console errors in browser
- [ ] API endpoints respond correctly

## 🔗 Related Documentation

- [CLAUDE.md](/CLAUDE.md) - Main configuration and development guide
- [DEPLOYMENT-GUIDE.md](/docs/DEPLOYMENT-GUIDE.md) - Detailed deployment procedures
- [DATABASE.md](/docs/DATABASE.md) - Database architecture and management
- [TROUBLESHOOTING.md](/docs/TROUBLESHOOTING.md) - Common issues and solutions

---

**Last Updated**: 2025-09-23
**Critical Rule**: Only `main` branch goes to production!