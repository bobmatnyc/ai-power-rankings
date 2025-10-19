# Clerk Authentication Quick Start Guide

**For**: New Developers
**Time Required**: 10-15 minutes
**Difficulty**: Beginner

---

## Overview

Get Clerk authentication up and running in your local development environment quickly. This guide covers the essential steps to set up, configure, and test authentication.

---

## Prerequisites

- ✅ Git repository cloned
- ✅ Node.js installed (v18 or higher)
- ✅ npm or yarn installed
- ✅ Text editor (VS Code recommended)

---

## Quick Setup (5 Steps)

### Step 1: Install Dependencies

```bash
cd /path/to/aipowerranking
npm install
```

**Expected Output**:
```bash
added 1247 packages in 45s
```

---

### Step 2: Copy Environment Template

```bash
cp .env.local.example .env.local
```

**What This Does**:
- Creates your local environment configuration file
- Pre-configured with all required variable names
- You just need to add your Clerk keys

---

### Step 3: Get Clerk API Keys

#### Option A: Use Existing Test Keys (Fastest)

If you have access to the shared Clerk test instance:

```env
# .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_ZWFzeS1zYWxtb24tMzAuY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_SECRET_KEY=sk_test_[ASK_TEAM_FOR_SECRET_KEY]
```

**Get the secret key from**:
- Team lead or senior developer
- Internal documentation
- 1Password/LastPass shared vault

#### Option B: Create Your Own Clerk Account (Recommended for Long-Term)

1. **Sign up**: Visit [clerk.com](https://clerk.com) → "Get Started"
2. **Create application**:
   - Name: "AI Power Ranking (Dev)"
   - Select: Email/Password authentication
3. **Get API keys**:
   - Navigate to: Developers → API Keys
   - Copy **Publishable Key** (starts with `pk_test_`)
   - Copy **Secret Key** (starts with `sk_test_`)

---

### Step 4: Configure Environment Variables

Edit `.env.local`:

```env
# ==============================================
# REQUIRED: Clerk Authentication Keys
# ==============================================

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
CLERK_SECRET_KEY=sk_test_YOUR_SECRET_HERE

# ==============================================
# REQUIRED: Clerk Redirect URLs
# ==============================================

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/en/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/en/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/en/admin
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/en/admin

# ==============================================
# OPTIONAL: Disable Auth for Development
# ==============================================

# Uncomment to disable authentication (no login required)
# NEXT_PUBLIC_DISABLE_AUTH=true

# ==============================================
# Database Configuration (Optional for Auth Testing)
# ==============================================

DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

**Pro Tips**:
- ✅ **Never commit** `.env.local` to git (it's already in `.gitignore`)
- ✅ Keep `NEXT_PUBLIC_DISABLE_AUTH` commented if you want to test authentication
- ✅ Uncomment `NEXT_PUBLIC_DISABLE_AUTH=true` if you just want to develop features

---

### Step 5: Start Development Server

```bash
npm run dev
```

**Expected Output**:
```bash
  ▲ Next.js 15.5.4
  - Local:        http://localhost:3000
  - Environments: .env.local

 ✓ Ready in 2.3s
```

---

## Testing Authentication (3 Minutes)

### Test 1: Verify Homepage Loads

```bash
# Open browser
open http://localhost:3000
```

**Expected**:
- ✅ Homepage loads without errors
- ✅ No authentication required for public pages

---

### Test 2: Access Sign-In Page

```bash
open http://localhost:3000/en/sign-in
```

**Expected**:
- ✅ Clerk sign-in form appears
- ✅ No console errors (F12 → Console)
- ✅ Clerk logo visible

**If you see a blank page**:
- Wait 2-3 seconds (Clerk SDK loading)
- Check console for errors
- Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is correct

---

### Test 3: Create Test Account

1. **On sign-in page**: Click "Sign up" link
2. **Enter email**: `yourname+test@example.com`
3. **Enter password**: Create a strong password
4. **Verify email**: Check inbox for verification email
5. **Complete signup**: Click verification link

**Expected**:
- ✅ Account created successfully
- ✅ Redirected to `/en/admin` (fallback URL)
- ✅ User button appears in header

---

### Test 4: Test Protected Route

```bash
# Access protected admin route
open http://localhost:3000/en/admin
```

**If NOT signed in**:
- ✅ Redirects to `/en/sign-in?redirect_url=%2Fen%2Fadmin`
- ✅ After sign-in, redirects back to `/en/admin`

**If signed in**:
- ✅ Admin page loads directly
- ✅ User button visible in header

---

## Development Modes

### Mode 1: Authentication ENABLED (Default)

**Configuration**: `.env.local`
```env
# NEXT_PUBLIC_DISABLE_AUTH is commented or removed
```

**Behavior**:
- ✅ Login required for protected routes
- ✅ Admin features require admin privileges
- ✅ Full Clerk authentication active
- ✅ **Use this mode** when testing auth flows

**When to Use**:
- Testing authentication features
- Testing protected routes
- Testing admin access control
- Preparing for production

---

### Mode 2: Authentication DISABLED (Development)

**Configuration**: `.env.local`
```env
# Uncomment this line:
NEXT_PUBLIC_DISABLE_AUTH=true
```

**Behavior**:
- ✅ No login required
- ✅ Mock user with admin privileges
- ✅ All features accessible
- ✅ **Use this mode** for rapid feature development

**When to Use**:
- Developing new features
- UI/UX development
- Frontend testing without auth
- Rapid prototyping

**To Switch Modes**:
```bash
# 1. Edit .env.local (comment/uncomment NEXT_PUBLIC_DISABLE_AUTH)
# 2. Restart dev server (Ctrl+C, then npm run dev)
# 3. Refresh browser
```

---

## Common Development Tasks

### Task 1: Add a New Protected Route

**File**: `middleware.ts`

```typescript
// Add your route to the protected matcher
const isProtectedRoute = createRouteMatcher([
  "/(.*)/admin(.*)",
  "/(.*)/dashboard(.*)",
  "/(.*)/your-new-route(.*)",  // ← Add here
  "/api/admin(.*)",
]);
```

**Test**:
```bash
# Access route without auth (should redirect)
curl -I http://localhost:3000/en/your-new-route

# Expected: HTTP 307 Redirect to /en/sign-in
```

---

### Task 2: Add a New Admin API Endpoint

**File**: `app/api/admin/your-endpoint/route.ts`

```typescript
import { requireAdmin } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export async function GET() {
  // Require admin privileges
  const { userId, user, error } = await requireAdmin();
  if (error) return error;

  // Admin-only logic here
  return NextResponse.json({
    message: "Admin access granted",
    userId,
  });
}
```

**Test**:
```bash
# Without auth (should fail)
curl http://localhost:3000/api/admin/your-endpoint
# Expected: {"error": "Unauthorized"}

# With auth (sign in via browser first)
# Expected: {"message": "Admin access granted", "userId": "..."}
```

---

### Task 3: Make a User Admin

**In Clerk Dashboard**:

1. Navigate to: Users → Select user
2. Click: "Metadata" tab
3. Add to **Private Metadata** (important!):
   ```json
   {
     "isAdmin": true
   }
   ```
4. Click: "Save"

**Verify**:
```bash
# Sign in as that user
# Access admin route
open http://localhost:3000/en/admin

# Should show admin interface
```

---

### Task 4: Debug Authentication Issues

**Check 1: Environment Variables Loaded**

```javascript
// In browser console (F12)
console.log({
  hasPublishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  authDisabled: process.env.NEXT_PUBLIC_DISABLE_AUTH === "true"
});
```

**Check 2: Clerk SDK Loaded**

```javascript
// In browser console
console.log(window.Clerk); // Should be an object, not undefined
```

**Check 3: Server Logs**

```bash
# In terminal where npm run dev is running
# Look for:
[middleware] Processing request: /en/admin
[middleware] Auth data: { userId: "user_..." }
```

**Check 4: Network Requests**

- DevTools → Network tab
- Look for requests to `clerk.aipowerranking.com` or `clerk.com`
- Verify no CORS errors or 404s

---

## Troubleshooting

### Issue: "Clerk not defined"

**Symptoms**: White screen, console error: `window.Clerk is not defined`

**Solution**:
1. Clear browser cache
2. Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
3. Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set
4. Restart dev server

---

### Issue: Sign-In Modal Doesn't Open

**Symptoms**: Clicking "Sign In" does nothing

**Solution**:
1. Check browser console for errors
2. Verify ClerkProvider is in component tree
3. Check that button is inside `<ClerkProviderClient>`
4. Try modal mode: `<SignInButton mode="modal">`

---

### Issue: Infinite Redirect Loop

**Symptoms**: Browser keeps redirecting between pages

**Solution**:
1. Clear browser cookies (especially `__session`)
2. Check middleware route matchers (public vs protected)
3. Verify fallback URLs match actual routes
4. Check Clerk Dashboard → Paths configuration

---

### Issue: "Unauthorized" Even When Signed In

**Symptoms**: API returns 401 despite being logged in

**Solutions**:

**Check 1: Session Cookie**
- DevTools → Application → Cookies
- Verify `__session` cookie exists
- Verify `HttpOnly`, `Secure` flags

**Check 2: API Route**
```typescript
// Make sure using requireAuth() or requireAdmin()
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { userId, error } = await requireAuth();
  if (error) return error;
  // ...
}
```

**Check 3: Middleware**
- Verify API route is NOT in public routes
- Verify API route is in protected routes (if needed)

---

### Issue: Can't Disable Auth in Development

**Symptoms**: Still seeing sign-in page despite `NEXT_PUBLIC_DISABLE_AUTH=true`

**Solution**:
1. Verify `.env.local` has: `NEXT_PUBLIC_DISABLE_AUTH=true` (uncommented)
2. Restart dev server (`Ctrl+C`, then `npm run dev`)
3. Hard refresh browser
4. Check server logs for: `[middleware] Auth disabled in development`

---

## Next Steps

### After Setup

- ✅ Read: [Complete Authentication Guide](../reference/CLERK-AUTHENTICATION-COMPLETE-GUIDE.md)
- ✅ Review: [Security Best Practices](../security/CLERK-SECURITY-HARDENING-2025-10-17.md)
- ✅ Understand: [API Authentication](../reference/API-AUTHENTICATION.md)

### Before Production

- ✅ Enable authentication: Remove `NEXT_PUBLIC_DISABLE_AUTH=true`
- ✅ Test all auth flows: Sign in, sign out, protected routes
- ✅ Review: [Deployment Checklist](../deployment/CLERK-AUTHENTICATION-DEPLOYMENT.md)

---

## Quick Reference

### Environment Variables

| Variable | Required | Value |
|----------|----------|-------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ Yes | `pk_test_...` |
| `CLERK_SECRET_KEY` | ✅ Yes | `sk_test_...` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | ✅ Yes | `/en/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | ✅ Yes | `/en/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | ✅ Yes | `/en/admin` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | ✅ Yes | `/en/admin` |
| `NEXT_PUBLIC_DISABLE_AUTH` | ⚠️ Dev only | `true` (commented by default) |

### Common Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint
```

### Useful URLs

- **Homepage**: http://localhost:3000
- **Sign In**: http://localhost:3000/en/sign-in
- **Sign Up**: http://localhost:3000/en/sign-up
- **Admin**: http://localhost:3000/en/admin
- **Clerk Dashboard**: https://dashboard.clerk.com

---

## Getting Help

### Documentation

- 📖 [Complete Guide](../reference/CLERK-AUTHENTICATION-COMPLETE-GUIDE.md) - Full implementation details
- 🔒 [Security Guide](../security/CLERK-SECURITY-HARDENING-2025-10-17.md) - Security features
- 🚢 [Deployment Guide](../deployment/CLERK-AUTHENTICATION-DEPLOYMENT.md) - Production deployment
- 🔧 [API Reference](../reference/API-AUTHENTICATION.md) - API authentication

### External Resources

- [Clerk Documentation](https://clerk.com/docs) - Official docs
- [Next.js 15 Docs](https://nextjs.org/docs) - Next.js reference
- [CLAUDE.md](../../CLAUDE.md) - Project guide

---

**Last Updated**: 2025-10-17
**Maintained By**: Development Team
**Difficulty**: Beginner-Friendly
