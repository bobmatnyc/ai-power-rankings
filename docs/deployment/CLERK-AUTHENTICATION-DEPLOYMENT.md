# Clerk Authentication Production Deployment Checklist

**For**: DevOps, Release Engineers
**Environment**: Production (Vercel)
**Risk Level**: Medium (Authentication-Critical)

---

## Overview

Comprehensive checklist for deploying Clerk authentication to production. This guide ensures all security controls are in place and authentication works correctly in production.

**Estimated Time**: 45-60 minutes (first deployment)

---

## Pre-Deployment Verification

### 1. Code Quality Checks

#### TypeScript Compilation

```bash
npx tsc --noEmit
```

**Expected Result**:
- ✅ Zero errors in application code (`app/`, `lib/`, `components/`)
- ⚠️ Test file errors acceptable (non-blocking)

**If errors found**:
- Fix all application code errors before deployment
- Test file errors can be addressed in next sprint

---

#### Production Build

```bash
npm run build
```

**Expected Output**:
```bash
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (122/122)
✓ Finalizing page optimization
```

**Critical**: Build MUST succeed without errors

---

#### Linting Check

```bash
npm run lint
```

**Expected Result**:
- ✅ No errors
- ⚠️ Warnings acceptable (review and address if critical)

---

### 2. Security Verification

#### Check for Hardcoded Credentials

```bash
# Verify no hardcoded keys in code
grep -r "pk_test_" app/ lib/ components/ --exclude-dir=node_modules
grep -r "sk_test_" app/ lib/ components/ --exclude-dir=node_modules
grep -r "pk_live_" app/ lib/ components/ --exclude-dir=node_modules
grep -r "sk_live_" app/ lib/ components/ --exclude-dir=node_modules
```

**Expected Result**: No matches (keys should only be in environment variables)

**If matches found**: Remove hardcoded keys, use environment variables

---

#### Verify Admin Metadata Migration

```bash
# Check for insecure publicMetadata usage
grep -r "publicMetadata?.isAdmin" app/ lib/ --exclude-dir=node_modules

# Should return: 0 results ✅

# Check for secure privateMetadata usage
grep -r "privateMetadata?.isAdmin" app/ lib/ --exclude-dir=node_modules

# Should return: Multiple results ✅
```

**Expected**:
- ✅ Zero `publicMetadata.isAdmin` usage
- ✅ Multiple `privateMetadata.isAdmin` usage

---

#### Verify Security Guards

**Check Production Auth Bypass Guard** (`middleware.ts`):
```typescript
// Should contain:
if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "true") {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    return NextResponse.json(
      { error: "Security violation: Authentication cannot be disabled in production" },
      { status: 403 }
    );
  }
}
```

**Check Open Redirect Prevention** (`middleware.ts`):
```typescript
// Should contain:
const isInternalPath = pathname.startsWith('/') &&
                      !pathname.startsWith('//') &&
                      !pathname.startsWith('/\\');
const safeRedirect = isInternalPath ? pathname : `/${locale}/admin`;
```

---

### 3. Environment Configuration Review

#### Development Environment (`.env.local`)

```bash
# View current development config (sanitized)
cat .env.local | grep CLERK | sed 's/=.*/=***HIDDEN***/'
```

**Verify**:
- ✅ Uses `pk_test_` keys (development)
- ✅ Has all required Clerk variables
- ✅ `NEXT_PUBLIC_DISABLE_AUTH` is commented or `false`

---

#### Production Environment (Prepare)

Create/verify `.env.production.local` (NOT committed to git):

```env
# ==============================================
# PRODUCTION Clerk Keys
# ==============================================

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_PRODUCTION_KEY
CLERK_SECRET_KEY=sk_live_YOUR_PRODUCTION_SECRET

# ==============================================
# Clerk URLs (same as dev)
# ==============================================

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/en/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/en/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/en/admin
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/en/admin

# ==============================================
# SECURITY: Explicitly disable auth bypass
# ==============================================

NEXT_PUBLIC_DISABLE_AUTH=false
```

**Critical**:
- ✅ Must use `pk_live_` and `sk_live_` keys
- ✅ Must set `NEXT_PUBLIC_DISABLE_AUTH=false`
- ✅ Never commit this file to git

---

### 4. Clerk Dashboard Configuration

#### Production Application Setup

**In Clerk Dashboard**:

1. **Navigate to Production Instance**:
   - Ensure you're in PRODUCTION environment (not Development)
   - Verify at top of dashboard: "Production" badge

2. **Verify Paths Configuration**:
   - Settings → Paths
   - Sign-in URL: `/en/sign-in` ✅
   - Sign-up URL: `/en/sign-up` ✅
   - After sign-in URL: `/en/admin` ✅
   - After sign-up URL: `/en/admin` ✅

3. **Verify Authentication Methods**:
   - User & Authentication → Email, Phone, Username
   - Ensure desired methods enabled (e.g., Email + Password)

4. **Get Production API Keys**:
   - Developers → API Keys
   - Copy **Publishable Key** (`pk_live_...`)
   - Copy **Secret Key** (`sk_live_...`)
   - Store securely (you'll add to Vercel next)

5. **Configure Allowed Origins**:
   - Settings → Allowed Origins
   - Add production domain: `https://yourdomain.com`
   - Add Vercel preview domains: `https://*.vercel.app` (if needed)

---

## Deployment to Vercel

### 1. Configure Vercel Environment Variables

**In Vercel Dashboard**:

1. **Navigate to Project Settings**:
   - Your Project → Settings → Environment Variables

2. **Add Production Variables**:

   | Name | Value | Environment |
   |------|-------|-------------|
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_YOUR_KEY` | Production |
   | `CLERK_SECRET_KEY` | `sk_live_YOUR_SECRET` | Production (Sensitive) |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/en/sign-in` | Production |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/en/sign-up` | Production |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/en/admin` | Production |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/en/admin` | Production |
   | `NEXT_PUBLIC_DISABLE_AUTH` | `false` | Production |

3. **Mark Secrets as Sensitive**:
   - ✅ `CLERK_SECRET_KEY` → Check "Sensitive" (hidden in UI)

4. **Save Changes**

---

### 2. Deploy to Preview Environment First

**Create Preview Deployment**:

```bash
# Option A: Push to feature branch
git checkout -b deploy/auth-production
git push origin deploy/auth-production

# Option B: Use Vercel CLI
vercel deploy --env-file=.env.production.local
```

**Vercel automatically creates preview deployment**

---

### 3. Test Preview Environment

**Get Preview URL**: Vercel dashboard → Deployments → Latest Preview → Visit

#### Test 1: Public Pages Load

```bash
# Replace with your preview URL
curl -I https://your-app-preview.vercel.app/en

# Expected: HTTP 200 OK
```

---

#### Test 2: Protected Routes Redirect

```bash
curl -I https://your-app-preview.vercel.app/en/admin

# Expected: HTTP 307 Redirect to /en/sign-in?redirect_url=...
```

---

#### Test 3: Sign-In Page Loads

```bash
# Open in browser
open https://your-app-preview.vercel.app/en/sign-in
```

**Verify**:
- ✅ Clerk sign-in form appears
- ✅ No console errors (F12)
- ✅ Correct Clerk branding
- ✅ Form is interactive

---

#### Test 4: Complete Authentication Flow

**Manual Test** (in browser):

1. **Navigate to preview URL**
2. **Click "Sign In" or access protected route**
3. **Sign in with test account** (create if needed)
4. **Verify redirect to `/en/admin`**
5. **Check user button appears**
6. **Access admin route directly** (should work while signed in)
7. **Sign out**
8. **Verify redirect to homepage**
9. **Try accessing admin route** (should redirect to sign-in)

**All steps must pass** ✅

---

#### Test 5: API Authentication

```bash
# Test protected API (should fail without auth)
curl https://your-app-preview.vercel.app/api/admin/tools

# Expected: HTTP 401 Unauthorized
# Response: {"error": "Unauthorized", "message": "Authentication required"}
```

---

#### Test 6: Security Controls

**Test Auth Bypass Guard** (should be blocked):
```bash
# Try to bypass auth in production
curl https://your-app-preview.vercel.app/en/admin?NEXT_PUBLIC_DISABLE_AUTH=true

# Expected: Should NOT bypass authentication
# Either: HTTP 307 Redirect (not signed in)
# Or: HTTP 200 OK (if signed in via browser session)
```

**Test Open Redirect Prevention**:
```bash
# Try external redirect
curl -I "https://your-app-preview.vercel.app/en/admin?redirect_url=//evil.com"

# Expected: Redirect URL should be sanitized to /en/admin
# Location header should NOT contain evil.com
```

---

### 4. Deploy to Production

**If Preview Tests Pass**:

```bash
# Option A: Merge to main branch
git checkout main
git merge deploy/auth-production
git push origin main

# Option B: Vercel CLI
vercel deploy --prod
```

**Vercel automatically deploys to production**

---

## Post-Deployment Verification

### 1. Immediate Production Tests (First 5 Minutes)

#### Test 1: Production Homepage

```bash
curl -I https://yourdomain.com/en

# Expected: HTTP 200 OK
```

---

#### Test 2: Production Sign-In

**Open in browser**:
```bash
open https://yourdomain.com/en/sign-in
```

**Verify**:
- ✅ Page loads without errors
- ✅ Clerk form appears
- ✅ Production keys being used (check DevTools → Network)

---

#### Test 3: Complete Auth Flow

**Manual Test**:
1. Sign in with production account
2. Verify redirect works
3. Access admin route
4. Sign out
5. Verify sign-out works

**All steps must work** ✅

---

### 2. Monitor Vercel Logs (First 30 Minutes)

**In Vercel Dashboard**:

1. **Navigate to Logs**:
   - Deployments → Production → Logs

2. **Watch for Issues**:
   ```bash
   # Good signs:
   [middleware] Processing request: /en/admin
   [middleware] Protected route with valid userId

   # Bad signs (should NOT appear):
   [SECURITY] Auth bypass attempted
   [middleware] Clerk SDK error
   Error: Clerk publishable key invalid
   ```

3. **Filter for Errors**:
   - Filter: "error" or "ERROR"
   - Should see minimal/no errors

---

### 3. Security Monitoring Setup

#### Enable Vercel Alerts

**In Vercel Dashboard**:

1. **Project Settings → Alerts**
2. **Enable**:
   - ✅ Deployment failed
   - ✅ Build errors
   - ✅ High error rate (>5%)
3. **Configure Notification Channel**: Slack/Email

---

#### Monitor for Security Events

**Create Log Monitoring** (manual or automated):

```bash
# Search Vercel logs for security events
# Look for:
[SECURITY] Auth bypass attempted
401 Unauthorized
403 Forbidden
redirect_url=//
redirect_url=/\
```

**Frequency**: Daily for first week, then weekly

---

### 4. User Metadata Migration (CRITICAL)

**For Each Admin User**:

1. **Access Clerk Production Dashboard**:
   - Clerk Dashboard → Production → Users

2. **For Each Admin**:
   - Click user → Metadata tab
   - **Remove** `isAdmin` from **Public Metadata**
   - **Add** `isAdmin` to **Private Metadata**:
     ```json
     {
       "isAdmin": true
     }
     ```
   - Save

3. **Verify Migration**:
   - Sign in as admin user
   - Access: `https://yourdomain.com/en/admin`
   - Should show admin interface ✅

4. **Test Admin API**:
   ```bash
   # Sign in via browser first, then:
   curl https://yourdomain.com/api/admin/tools \
     -H "Cookie: __session=YOUR_SESSION_COOKIE"

   # Expected: HTTP 200 OK (authorized)
   ```

**Repeat for ALL admin users**

---

### 5. Clerk API Key Rotation (If Needed)

**If hardcoded keys were used previously**:

1. **Generate New Keys** (Clerk Dashboard):
   - Production → API Keys → Regenerate

2. **Update Vercel Environment Variables**:
   - Immediately update production keys
   - Trigger redeployment (Vercel does this automatically)

3. **Verify New Keys Work**:
   - Test authentication flow
   - Check logs for errors

4. **Delete Old Keys** (Clerk Dashboard):
   - After verifying new keys work
   - Delete old keys to prevent unauthorized use

---

## Rollback Procedure

**If authentication fails in production**:

### Option 1: Quick Fix (Environment Variables)

1. **Identify Issue**:
   - Check Vercel logs
   - Verify environment variables

2. **Fix Configuration**:
   - Vercel Dashboard → Settings → Environment Variables
   - Correct any misconfiguration
   - Vercel auto-redeploys

3. **Verify Fix**:
   - Test authentication
   - Monitor logs

---

### Option 2: Code Rollback (Git)

```bash
# Find last working deployment
git log --oneline

# Rollback to previous commit
git revert HEAD  # Or specific commit
git push origin main

# Vercel auto-deploys previous version
```

---

### Option 3: Vercel Instant Rollback

1. **Vercel Dashboard → Deployments**
2. **Find last working deployment**
3. **Click "..." → Promote to Production**
4. **Instant rollback** (no git needed)

---

## Success Criteria

### Technical Validation

- ✅ Production build successful
- ✅ Zero TypeScript errors (application code)
- ✅ All security guards in place
- ✅ Environment variables configured correctly
- ✅ Clerk production keys active

### Functional Validation

- ✅ Public pages load without authentication
- ✅ Protected routes redirect to sign-in
- ✅ Sign-in flow completes successfully
- ✅ Sign-out works correctly
- ✅ Admin access restricted to admin users
- ✅ API routes protected appropriately

### Security Validation

- ✅ Admin metadata in privateMetadata (not public)
- ✅ No hardcoded keys in codebase
- ✅ Open redirect prevention working
- ✅ Auth bypass blocked in production
- ✅ Production uses live keys (pk_live_, sk_live_)

### Operational Validation

- ✅ Zero authentication errors in logs (first hour)
- ✅ Monitoring/alerts configured
- ✅ Rollback procedure tested/ready
- ✅ Admin users can access admin features

---

## Monitoring & Maintenance

### Daily (First Week)

- ✅ Check Vercel logs for errors
- ✅ Monitor authentication success rate
- ✅ Review security event logs
- ✅ Test sign-in flow manually

### Weekly (Ongoing)

- ✅ Review Clerk analytics (sign-ins, users)
- ✅ Check for unusual patterns
- ✅ Verify no degradation in auth performance
- ✅ Update documentation if changes made

### Monthly

- ✅ Security audit of authentication
- ✅ Review and rotate API keys (if needed)
- ✅ Test rollback procedure
- ✅ Update dependencies (@clerk/nextjs)

---

## Troubleshooting Production Issues

### Issue: Users Can't Sign In

**Symptoms**: Sign-in form submits but fails

**Check**:
1. **Vercel Environment Variables**:
   - Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is `pk_live_`
   - Verify `CLERK_SECRET_KEY` is `sk_live_`

2. **Clerk Dashboard**:
   - Check production keys are active
   - Verify allowed origins include production domain

3. **Logs**:
   ```bash
   # Look for:
   Clerk publishable key invalid
   CORS error
   401 Unauthorized from Clerk API
   ```

---

### Issue: Admin Users Getting "Forbidden"

**Symptoms**: Admin users can't access admin routes/APIs

**Check**:
1. **User Metadata** (Clerk Dashboard):
   - User → Metadata → **Private Metadata**
   - Should have: `{ "isAdmin": true }`

2. **Code** (lib/api-auth.ts):
   - Verify checking `privateMetadata` (not `publicMetadata`)

3. **Test**:
   ```bash
   # In browser console (while signed in as admin):
   fetch('/api/admin/tools').then(r => r.json()).then(console.log)

   # Should NOT return 403
   ```

---

### Issue: Redirect Loops

**Symptoms**: Browser keeps redirecting between pages

**Check**:
1. **Middleware Route Matchers**:
   - Verify admin routes in `isProtectedRoute`
   - Verify sign-in/up routes in `isPublicRoute`

2. **Fallback URLs**:
   - Check `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`
   - Ensure it matches an actual route

3. **Clerk Dashboard → Paths**:
   - Verify matches environment variables

4. **Clear Cookies**:
   ```bash
   # Have user clear cookies for your domain
   # Try incognito/private browsing
   ```

---

### Issue: Security Violations in Logs

**Symptoms**: `[SECURITY] Auth bypass attempted` in logs

**Check**:
1. **Environment Variables**:
   - Verify `NEXT_PUBLIC_DISABLE_AUTH` is `false` (or not set)
   - Ensure not accidentally set in Vercel

2. **If Legitimate**:
   - Someone may be probing for vulnerabilities
   - Monitor for repeated attempts
   - Consider adding rate limiting

3. **If Accidental**:
   - Check if preview environment misconfigured
   - Verify production vs preview environment isolation

---

## Post-Deployment Checklist

### Immediate (Within 1 Hour)

- [ ] Production deployment succeeded
- [ ] Homepage loads correctly
- [ ] Sign-in page loads correctly
- [ ] Authentication flow works end-to-end
- [ ] Admin users can access admin routes
- [ ] No errors in Vercel logs
- [ ] Security guards active (no bypass possible)

### First 24 Hours

- [ ] All admin users' metadata migrated
- [ ] Zero authentication failures reported
- [ ] Monitoring alerts configured
- [ ] Team notified of successful deployment
- [ ] Documentation updated (if any changes)

### First Week

- [ ] Daily log reviews show no issues
- [ ] User feedback positive
- [ ] No security incidents
- [ ] Performance metrics normal
- [ ] Clerk analytics review

### Ongoing

- [ ] Monthly security audits
- [ ] Quarterly key rotation (if needed)
- [ ] Regular dependency updates
- [ ] Continuous monitoring

---

## Related Documentation

- [Complete Authentication Guide](../reference/CLERK-AUTHENTICATION-COMPLETE-GUIDE.md) - Implementation details
- [Security Hardening Report](../security/CLERK-SECURITY-HARDENING-2025-10-17.md) - Security fixes
- [Quick Start Guide](../development/CLERK-AUTHENTICATION-QUICKSTART.md) - Developer setup
- [QA Test Report](../reference/reports/test-reports/CLERK-AUTH-SECURITY-QA-REPORT.md) - Test results

---

**Last Updated**: 2025-10-17
**Maintained By**: DevOps Team
**Review Frequency**: Before each production deployment
