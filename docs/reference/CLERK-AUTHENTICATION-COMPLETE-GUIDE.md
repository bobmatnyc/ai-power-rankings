# Clerk Authentication Complete Guide

**Version**: 0.1.3+
**Last Updated**: 2025-10-17
**Status**: Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Current Implementation Status](#current-implementation-status)
3. [Environment Configuration](#environment-configuration)
4. [Architecture](#architecture)
5. [Security Features](#security-features)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### What Clerk Authentication Provides

Clerk is a complete user authentication and management platform that provides:

- **User Authentication**: Email/password, social logins, passwordless authentication
- **Session Management**: Secure, httpOnly session cookies with automatic refresh
- **User Management**: Built-in user profiles, metadata, and role management
- **Security**: Built-in CSRF protection, secure defaults, and compliance features
- **Developer Experience**: Pre-built UI components, middleware integration, and comprehensive APIs

### Why Clerk?

The AI Power Ranking application uses Clerk because it:

- Provides enterprise-grade security with minimal configuration
- Integrates seamlessly with Next.js 15 and App Router
- Handles complex authentication flows automatically
- Offers flexible metadata for role-based access control
- Scales from development to production effortlessly

---

## Current Implementation Status

**Version**: v0.1.3+
**Security Posture**: Hardened (as of 2025-10-17)

### ✅ Implemented Features

- **Middleware Authentication**: Automatic route protection via Clerk middleware
- **API Route Protection**: Server-side authentication utilities (`requireAuth`, `requireAdmin`)
- **Admin Authorization**: Role-based access using `privateMetadata.isAdmin`
- **Open Redirect Prevention**: Input validation to prevent phishing attacks
- **Production Auth Bypass Guard**: Prevents authentication bypass in production
- **Explicit Configuration**: ClerkProvider with explicit URL props for security
- **Modal Sign-In**: Seamless modal-based authentication flow
- **Multi-language Support**: Authentication pages for all supported locales

### ✅ Security Hardening Completed

| Security Issue | Severity | Status | Date Fixed |
|---------------|----------|--------|-----------|
| Admin metadata in publicMetadata | MEDIUM (CVSS 6.5) | ✅ FIXED | 2025-10-17 |
| Hardcoded test keys | HIGH (CVSS 7.5) | ✅ FIXED | 2025-10-17 |
| Open redirect vulnerability | MEDIUM (CVSS 5.4) | ✅ FIXED | 2025-10-17 |
| Production auth bypass | HIGH (CVSS 8.2) | ✅ FIXED | 2025-10-17 |
| File permissions | LOW | 📋 DOCUMENTED | 2025-10-17 |

---

## Environment Configuration

### Local Development Setup

**File**: `.env.local`

```env
# Clerk Authentication Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZWFzeS1zYWxtb24tMzAuY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_SECRET_KEY=sk_test_your_secret_key_here

# Clerk Redirect URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/en/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/en/sign-up

# Clerk Core 2 Fallback Redirects (recommended)
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/en/admin
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/en/admin

# Authentication Toggle (development only)
# NEXT_PUBLIC_DISABLE_AUTH=true  # Uncomment to disable auth in development
```

### Production Setup

**File**: `.env.production` (or Vercel Environment Variables)

```env
# Clerk Production Keys (pk_live_ prefix required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your_production_key
CLERK_SECRET_KEY=sk_live_your_production_secret

# Same redirect URLs as development
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/en/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/en/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/en/admin
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/en/admin

# SECURITY: Explicitly disable auth bypass (CRITICAL)
NEXT_PUBLIC_DISABLE_AUTH=false
```

### Environment Variables Explained

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ Yes | Clerk publishable key (public) | `pk_test_...` or `pk_live_...` |
| `CLERK_SECRET_KEY` | ✅ Yes | Clerk secret key (server-side only) | `sk_test_...` or `sk_live_...` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | ✅ Yes | Sign-in page route | `/en/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | ✅ Yes | Sign-up page route | `/en/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | ✅ Yes | Post-sign-in redirect | `/en/admin` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | ✅ Yes | Post-sign-up redirect | `/en/admin` |
| `NEXT_PUBLIC_DISABLE_AUTH` | ⚠️ Dev Only | Disable auth for testing | `true` (dev only) |

### Getting Clerk Keys

1. **Sign up for Clerk**: Visit [clerk.com](https://clerk.com) and create an account
2. **Create an application**: Set up a new application in Clerk Dashboard
3. **Get API keys**: Navigate to "API Keys" in your Clerk dashboard
4. **Copy keys**:
   - Development: Use keys from "Development" tab (`pk_test_...`, `sk_test_...`)
   - Production: Use keys from "Production" tab (`pk_live_...`, `sk_live_...`)
5. **Configure environment**: Add keys to `.env.local` (dev) or Vercel (production)

---

## Architecture

### ClerkProvider Integration

**File**: `app/[lang]/layout.tsx`

The root layout wraps the entire application with ClerkProvider:

```tsx
import ClerkProviderClient from "@/components/auth/clerk-provider-client";

export default function RootLayout({ children, params }) {
  return (
    <html lang={params.lang}>
      <body>
        <ClerkProviderClient>
          {children}
        </ClerkProviderClient>
      </body>
    </html>
  );
}
```

**File**: `components/auth/clerk-provider-client.tsx`

Client-side provider with explicit security configuration:

```tsx
"use client";

import { ClerkProvider } from "@clerk/nextjs";

export default function ClerkProviderClient({ children }) {
  return (
    <ClerkProvider
      publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
      appearance={{
        variables: { colorPrimary: "#000000" },
      }}
      // Explicit security configuration (defense-in-depth)
      signInUrl={process.env["NEXT_PUBLIC_CLERK_SIGN_IN_URL"]}
      signUpUrl={process.env["NEXT_PUBLIC_CLERK_SIGN_UP_URL"]}
      signInFallbackRedirectUrl={process.env["NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL"]}
      signUpFallbackRedirectUrl={process.env["NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL"]}
    >
      {children}
    </ClerkProvider>
  );
}
```

### Middleware Authentication Flow

**File**: `middleware.ts`

Clerk middleware runs on EVERY request to protected routes:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define public routes (no auth required)
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/(.*)/sign-in(.*)",
  "/(.*)/sign-up(.*)",
  "/api/public(.*)",
  "/api/rankings(.*)",
  // ... more public routes
]);

// Define protected routes (auth required)
const isProtectedRoute = createRouteMatcher([
  "/(.*)/admin(.*)",
  "/(.*)/dashboard(.*)",
  "/api/admin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // SECURITY: Prevent auth bypass in production
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "true") {
    if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
      return NextResponse.json(
        { error: "Security violation: Authentication cannot be disabled in production" },
        { status: 403 }
      );
    }
    return NextResponse.next(); // Allow bypass in development
  }

  const pathname = req.nextUrl.pathname;

  // Allow public routes without auth check
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Check authentication for protected routes
  const { userId } = await auth();

  if (isProtectedRoute(req) && !userId) {
    const locale = pathname.split("/")[1] || "en";
    const signInUrl = new URL(`/${locale}/sign-in`, req.url);

    // SECURITY: Validate redirect URL (prevent open redirect)
    const isInternalPath = pathname.startsWith('/') &&
                          !pathname.startsWith('//') &&
                          !pathname.startsWith('/\\');
    const safeRedirect = isInternalPath ? pathname : `/${locale}/admin`;

    signInUrl.searchParams.set("redirect_url", safeRedirect);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});
```

**Authentication Flow**:

1. Request arrives at server
2. Middleware checks if auth bypass is attempted in production → **BLOCK**
3. Check if route is public → **ALLOW**
4. Check if route is protected → **REQUIRE AUTH**
5. If authenticated → **ALLOW**
6. If not authenticated → **REDIRECT TO SIGN-IN**

### Protected Routes Configuration

**Public Routes** (no authentication required):
- `/` - Homepage
- `/[lang]/rankings` - Rankings pages
- `/[lang]/news` - News pages
- `/[lang]/tools` - Tools pages
- `/[lang]/about` - About pages
- `/[lang]/methodology` - Methodology pages
- `/api/rankings/*` - Public API endpoints
- `/api/news/*` - Public news API
- `/api/tools/*` - Public tools API

**Protected Routes** (authentication required):
- `/[lang]/admin/*` - Admin pages
- `/[lang]/dashboard/*` - User dashboard
- `/api/admin/*` - Admin API endpoints

### API Route Authentication

**File**: `lib/api-auth.ts`

Server-side authentication utilities for API routes:

#### `requireAuth()` - Basic Authentication

```typescript
export async function requireAuth() {
  const { userId, error } = await requireAuth();

  if (error) {
    return error; // NextResponse with 401 Unauthorized
  }

  // userId is available, user is authenticated
  return { userId };
}
```

**Usage Example**:

```typescript
// app/api/protected/route.ts
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { userId, error } = await requireAuth();
  if (error) return error;

  // User is authenticated, proceed with logic
  return NextResponse.json({ userId, data: "protected data" });
}
```

#### `requireAdmin()` - Admin Authorization

```typescript
export async function requireAdmin() {
  const { userId, user, error } = await requireAdmin();

  if (error) {
    return error; // NextResponse with 401/403
  }

  // User is authenticated AND has admin privileges
  return { userId, user };
}
```

**Usage Example**:

```typescript
// app/api/admin/tools/route.ts
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: Request) {
  const { userId, user, error } = await requireAdmin();
  if (error) return error;

  // User is admin, proceed with admin operations
  return NextResponse.json({ success: true });
}
```

#### `optionalAuth()` - Optional Authentication

```typescript
export async function optionalAuth() {
  const { userId } = await optionalAuth();

  // userId may be null if not authenticated
  // Never returns error response
}
```

**Usage Example**:

```typescript
// app/api/public/route.ts
import { optionalAuth } from "@/lib/api-auth";

export async function GET() {
  const { userId } = await optionalAuth();

  // Customize response based on authentication state
  if (userId) {
    return NextResponse.json({ message: "Welcome back!", userId });
  } else {
    return NextResponse.json({ message: "Welcome, guest!" });
  }
}
```

---

## Security Features

### 1. Admin Authorization Using privateMetadata

**Security Issue**: Admin status stored in `publicMetadata` (client-accessible)
**Fix**: Migrated to `privateMetadata` (server-only access)

**Setting Admin Status** (Clerk Dashboard):

1. Navigate to Clerk Dashboard → Users
2. Select user → Metadata tab
3. Add to **Private Metadata** (NOT Public Metadata):
   ```json
   {
     "isAdmin": true
   }
   ```

**Checking Admin Status** (Server-Side Only):

```typescript
import { requireAdmin } from "@/lib/api-auth";

const { userId, user, error } = await requireAdmin();
// user.privateMetadata.isAdmin === true (guaranteed)
```

**Why privateMetadata?**
- ✅ Only accessible server-side
- ✅ Never exposed to client JavaScript
- ✅ Cannot be tampered with by users
- ✅ Complies with security best practices

### 2. Open Redirect Prevention

**Security Issue**: Redirect URLs not validated, allowing phishing attacks
**Fix**: Input validation blocks external redirects

**Attack Scenarios Blocked**:

```bash
# Protocol-relative URL
/admin?redirect_url=//evil.com → BLOCKED → /en/admin

# Absolute external URL
/admin?redirect_url=https://evil.com → BLOCKED → /en/admin

# Backslash bypass
/admin?redirect_url=/\evil.com → BLOCKED → /en/admin
```

**Validation Logic** (middleware.ts lines 98-104):

```typescript
// Only allow internal paths starting with /
const isInternalPath = pathname.startsWith('/') &&
                      !pathname.startsWith('//') &&  // Block //evil.com
                      !pathname.startsWith('/\\');   // Block /\evil.com

const safeRedirect = isInternalPath ? pathname : `/${locale}/admin`;
```

### 3. Production Auth Bypass Guard

**Security Issue**: `NEXT_PUBLIC_DISABLE_AUTH=true` could bypass auth in production
**Fix**: Environment check blocks auth bypass in production

**Protection Logic** (middleware.ts lines 41-49):

```typescript
if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "true") {
  // SECURITY: Prevent auth bypass in production
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    console.error("[SECURITY] Auth bypass attempted in production - BLOCKING");
    return NextResponse.json(
      { error: "Security violation: Authentication cannot be disabled in production" },
      { status: 403 }
    );
  }
  // Allow in development
  return NextResponse.next();
}
```

**Result**:
- ✅ Development: Auth can be disabled for testing
- ✅ Production: Auth bypass returns HTTP 403 Forbidden
- ✅ Security logs: Attempted bypasses logged for monitoring

### 4. File Permissions Security

**Security Issue**: Environment files world-readable (644 permissions)
**Fix**: Restrict to owner-only (600 permissions)

**Apply Fix**:

```bash
chmod 600 .env.local
chmod 600 .env.production
chmod 600 .env.production.local
```

**Verify**:

```bash
ls -la .env* | grep -E '\.(local|production)'
# Should show: -rw------- (600)
```

See: [File Permissions Fix Guide](../security/FIX-ENV-PERMISSIONS.md)

---

## Testing

### Manual Testing Checklist

#### Local Development Testing

**1. Test Public Routes** (no auth required):
```bash
# Start development server
npm run dev

# Access public routes
curl -I http://localhost:3000/en
curl -I http://localhost:3000/en/rankings
curl -I http://localhost:3000/en/news

# Expected: HTTP 200 OK, no redirect
```

**2. Test Protected Routes** (auth required):
```bash
# Access protected routes without auth
curl -I http://localhost:3000/en/admin

# Expected: HTTP 307 Redirect to /en/sign-in?redirect_url=%2Fen%2Fadmin
```

**3. Test Sign-In Page**:
```bash
# Visit sign-in page in browser
open http://localhost:3000/en/sign-in

# Verify:
# - Clerk modal/page loads
# - No console errors
# - Sign-in form displays correctly
```

**4. Test Open Redirect Prevention**:
```bash
# Try external redirect
curl -I "http://localhost:3000/en/admin?redirect_url=//evil.com"

# Expected: Redirects to /en/sign-in?redirect_url=%2Fen%2Fadmin
# NOT to evil.com
```

**5. Test API Routes**:
```bash
# Test protected API without auth
curl -X GET http://localhost:3000/api/admin/tools

# Expected: HTTP 401 Unauthorized
# Response: {"error": "Unauthorized", "message": "Authentication required"}
```

#### Authentication Flow Testing

1. **Sign In Flow**:
   - Navigate to homepage
   - Click "Sign In" button
   - Complete authentication
   - Verify redirect to fallback URL (`/en/admin`)
   - Verify user session persists

2. **Sign Out Flow**:
   - Click user menu → Sign Out
   - Verify redirect to homepage
   - Verify session cleared
   - Verify protected routes redirect to sign-in

3. **Admin Access**:
   - Sign in as admin user
   - Access `/en/admin`
   - Verify admin UI displays
   - Sign in as non-admin
   - Access `/en/admin`
   - Verify access granted (route is protected, but admin UI shows different content)

### Production Testing

**Pre-Deployment**:

```bash
# Build production version
npm run build

# Start production server locally
npm start

# Test authentication flows
# Verify no auth bypass possible
```

**Post-Deployment** (Vercel):

1. **Verify Environment Variables**:
   - Check Vercel Dashboard → Settings → Environment Variables
   - Verify `NEXT_PUBLIC_DISABLE_AUTH` is `false` or not set
   - Verify production Clerk keys (`pk_live_`, `sk_live_`)

2. **Test Production Auth**:
   ```bash
   # Try auth bypass in production
   curl -I https://yourdomain.com/en/admin?NEXT_PUBLIC_DISABLE_AUTH=true

   # Expected: HTTP 403 Forbidden (if bypass attempted)
   # Or: HTTP 307 Redirect to sign-in (normal flow)
   ```

3. **Monitor Logs**:
   - Vercel Dashboard → Deployments → [Latest] → Logs
   - Watch for `[SECURITY]` log entries
   - Monitor for authentication errors

### Expected Behaviors

**Public Routes**:
- ✅ HTTP 200 OK
- ✅ `x-clerk-auth-status: signed-out` header
- ✅ No authentication required

**Protected Routes (Unauthenticated)**:
- ✅ HTTP 307 Temporary Redirect
- ✅ Redirect to `/[lang]/sign-in?redirect_url=...`
- ✅ Safe redirect URL validation

**Protected Routes (Authenticated)**:
- ✅ HTTP 200 OK
- ✅ `x-clerk-auth-status: signed-in` header
- ✅ Page content displays

**API Routes (Protected)**:
- ✅ Unauthenticated: HTTP 401 Unauthorized
- ✅ Authenticated: HTTP 200 OK with data
- ✅ Admin-only: HTTP 403 Forbidden (non-admin users)

---

## Troubleshooting

### Issue: Sign-In Modal Doesn't Open

**Symptoms**:
- Clicking "Sign In" button does nothing
- No Clerk modal appears
- Browser console shows errors

**Possible Causes**:
1. ClerkProvider not wrapping component
2. Clerk JavaScript not loaded
3. Invalid publishable key
4. Browser blocks third-party cookies

**Solutions**:

1. **Check ClerkProvider**:
   ```tsx
   // Verify in app/[lang]/layout.tsx
   <ClerkProviderClient>
     {children}
   </ClerkProviderClient>
   ```

2. **Check Browser Console**:
   ```javascript
   // In browser console, verify:
   window.Clerk  // Should be defined
   ```

3. **Verify Environment Variables**:
   ```bash
   # Check .env.local
   echo $NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   # Should output: pk_test_...
   ```

4. **Check Network Tab**:
   - Open DevTools → Network
   - Look for Clerk script loading
   - Verify no CORS errors

### Issue: Redirect Loop After Sign-In

**Symptoms**:
- After signing in, page keeps redirecting
- URL keeps changing between `/sign-in` and `/admin`
- Browser shows "Too many redirects" error

**Possible Causes**:
1. Middleware misconfiguration
2. Conflicting redirect URLs
3. Session not persisting

**Solutions**:

1. **Check Middleware Route Matchers**:
   ```typescript
   // Verify /admin is in isProtectedRoute
   const isProtectedRoute = createRouteMatcher([
     "/(.*)/admin(.*)",  // ← Should be present
   ]);
   ```

2. **Clear Browser Data**:
   ```bash
   # Clear cookies and cache
   # Chrome: Settings → Privacy → Clear browsing data
   # Select: Cookies and cached files
   ```

3. **Verify Fallback URLs**:
   ```env
   # .env.local
   NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/en/admin  # ← Check this
   ```

4. **Check Clerk Dashboard**:
   - Clerk Dashboard → Paths
   - Verify redirect URLs match environment variables

### Issue: "Unauthorized" on Admin API Routes

**Symptoms**:
- API returns HTTP 401 Unauthorized
- User is signed in
- API route requires admin privileges

**Possible Causes**:
1. User not marked as admin
2. Admin check using wrong metadata
3. Session not sent with API request

**Solutions**:

1. **Verify Admin Status** (Clerk Dashboard):
   ```json
   // User → Metadata → Private Metadata
   {
     "isAdmin": true  // ← Must be in PRIVATE metadata
   }
   ```

2. **Check API Route**:
   ```typescript
   // Verify using requireAdmin()
   const { userId, user, error } = await requireAdmin();
   if (error) return error;

   // Check user object
   console.log(user.privateMetadata); // Should show { isAdmin: true }
   ```

3. **Verify Session Cookie**:
   - DevTools → Application → Cookies
   - Look for `__session` cookie
   - Verify `HttpOnly`, `Secure`, `SameSite` flags

### Issue: Auth Bypass Not Working in Development

**Symptoms**:
- Set `NEXT_PUBLIC_DISABLE_AUTH=true`
- Still being redirected to sign-in
- Authentication still required

**Solutions**:

1. **Restart Development Server**:
   ```bash
   # Kill server (Ctrl+C)
   # Restart
   npm run dev
   ```

2. **Verify Environment Variable**:
   ```bash
   # .env.local (MUST be uncommented)
   NEXT_PUBLIC_DISABLE_AUTH=true  # ← No # in front
   ```

3. **Check Environment Loading**:
   ```javascript
   // In browser console:
   console.log(process.env.NEXT_PUBLIC_DISABLE_AUTH);
   // Should output: "true"
   ```

4. **Verify Not in Production**:
   ```bash
   # Check NODE_ENV
   echo $NODE_ENV  # Should be: development
   ```

### Issue: Production Auth Bypass Guard Not Working

**Symptoms**:
- Can disable auth in production
- No HTTP 403 response
- Security guard not triggering

**Solutions**:

1. **Verify Environment Variables** (Vercel):
   - Vercel Dashboard → Settings → Environment Variables
   - Ensure `NEXT_PUBLIC_DISABLE_AUTH=false` (or not set)
   - Ensure `NODE_ENV=production` (set automatically)

2. **Check Middleware Code**:
   ```typescript
   // middleware.ts should have:
   if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "true") {
     if (process.env.NODE_ENV === "production" ||
         process.env.VERCEL_ENV === "production") {
       return NextResponse.json({ error: "..." }, { status: 403 });
     }
   }
   ```

3. **Monitor Logs**:
   ```bash
   # Vercel logs should show:
   [SECURITY] Auth bypass attempted in production environment - BLOCKING
   ```

### Issue: Clerk Keys Not Working

**Symptoms**:
- Authentication fails
- "Invalid publishable key" error
- Clerk SDK not initializing

**Solutions**:

1. **Verify Key Format**:
   ```env
   # Development (test keys)
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...

   # Production (live keys)
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   ```

2. **Check Key Validity** (Clerk Dashboard):
   - Clerk Dashboard → API Keys
   - Verify keys are active
   - Regenerate if necessary

3. **Verify Environment**:
   ```bash
   # Development uses test keys
   # Production uses live keys
   # NEVER mix test and live keys
   ```

### Getting Help

If issues persist:

1. **Check Logs**:
   - Browser console (F12)
   - Server logs (`npm run dev` output)
   - Vercel logs (production)

2. **Review Documentation**:
   - [Clerk Documentation](https://clerk.com/docs)
   - [Security Hardening Report](../security/CLERK-SECURITY-HARDENING.md)
   - [QA Test Report](../reference/reports/test-reports/CLERK-AUTH-SECURITY-QA-REPORT.md)

3. **Common Issues**:
   - [Authentication Fix](../../troubleshooting/CLERK-AUTHENTICATION-FIX.md)
   - [Authentication Summary](../../troubleshooting/AUTHENTICATION-FINAL-SUMMARY.md)

---

## Related Documentation

- [Security Hardening Report](../security/CLERK-SECURITY-HARDENING.md) - Critical security fixes
- [Security QA Report](reports/test-reports/CLERK-AUTH-SECURITY-QA-REPORT.md) - Comprehensive testing
- [Quick Start Guide](../../development/CLERK-AUTHENTICATION-QUICKSTART.md) - Fast setup
- [Deployment Checklist](../../deployment/CLERK-AUTHENTICATION-DEPLOYMENT.md) - Production deployment
- [API Documentation](API-AUTHENTICATION.md) - API route authentication

---

**Last Updated**: 2025-10-17
**Maintained By**: Development Team
**Review Status**: Production Ready
