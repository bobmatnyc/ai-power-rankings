# Authentication Fix - Admin API Routes

## Problem Solved

The article management UI was failing to load articles because the API was returning an HTML sign-in page instead of JSON error responses when authentication failed. This has been fixed.

## What Was Changed

### 1. Middleware Fix (`src/middleware.ts`)

**Before:** API routes would redirect to sign-in page when authentication failed (causing HTML response)
**After:** API routes now return proper JSON error responses with appropriate HTTP status codes

Key changes:
- API routes check authentication without redirecting using `authFunc()` instead of `authFunc.protect()`
- Returns JSON with proper error structure: `{ error, message, code, help }`
- Status 401 for unauthenticated users
- Status 403 for authenticated users without admin privileges

### 2. API Route Enhancement (`src/app/api/admin/articles/route.ts`)

**Before:** Used generic `isAuthenticated()` check
**After:** Directly checks user and admin status with detailed error messages

Key improvements:
- Uses `currentUser()` to get user details
- Checks `publicMetadata.isAdmin` for admin privileges
- Returns helpful error messages with instructions
- Always returns JSON with proper Content-Type headers

### 3. Frontend Error Handling (`src/components/admin/article-management.tsx`)

**Before:** Assumed all responses were JSON
**After:** Checks Content-Type header and handles both JSON and HTML responses gracefully

Key improvements:
- Detects when API returns HTML (misconfiguration indicator)
- Shows specific error messages for 401 and 403 status codes
- Provides actionable help text for users

## How to Use

### For Development (No Authentication)

Add to `.env.local`:
```env
NEXT_PUBLIC_DISABLE_AUTH=true
```

This disables all authentication checks for local development.

### For Production (With Clerk Authentication)

1. **Configure Clerk:**
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
   CLERK_SECRET_KEY=your_secret_key
   ```

2. **Verify Admin Configuration:**
   ```bash
   # Check authentication setup
   pnpm tsx scripts/verify-admin-auth.ts

   # Grant admin to a specific user
   pnpm tsx scripts/verify-admin-auth.ts user@example.com grant
   ```

3. **Test API Authentication:**
   ```bash
   # Run comprehensive authentication tests
   pnpm tsx scripts/test-admin-auth-api.ts
   ```

## Testing Scripts

### `scripts/verify-admin-auth.ts`
- Checks Clerk environment variables
- Lists all admin users
- Can grant admin privileges to specific users
- Tests Clerk connection

### `scripts/test-admin-auth-api.ts`
- Tests if API returns JSON (not HTML) for auth failures
- Verifies proper error response structure
- Checks if dev server is running
- Provides recommendations for fixing issues

## Common Issues and Solutions

### Issue: API returns HTML instead of JSON
**Solution:** The middleware fix ensures this won't happen. Restart your dev server after pulling these changes.

### Issue: "Admin access required" error
**Solution:** Grant admin privileges to your user:
```bash
pnpm tsx scripts/verify-admin-auth.ts your.email@example.com grant
```

### Issue: "Authentication required" error
**Solution:** Either:
1. Sign in at `/sign-in`
2. Or disable auth for development: `NEXT_PUBLIC_DISABLE_AUTH=true`

## Error Response Format

All API authentication errors now follow this structure:

```json
{
  "error": "Unauthorized|Forbidden",
  "message": "Human-readable error message",
  "code": "AUTH_REQUIRED|ADMIN_REQUIRED",
  "help": "Instructions for fixing the issue (optional)",
  "userId": "user_id (only for 403 errors)"
}
```

## Summary

The authentication system now properly handles API requests:
- ✅ Always returns JSON for API routes (never HTML redirects)
- ✅ Provides clear error messages with actionable help text
- ✅ Supports both authenticated production and auth-disabled development
- ✅ Includes testing and verification scripts
- ✅ Frontend gracefully handles all error scenarios