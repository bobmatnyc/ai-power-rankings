# Authentication Configuration Guide

## Overview

The AI Power Ranking application uses Clerk for authentication. Authentication can be enabled or disabled based on your development needs.

## Configuration States

### 1. Authentication ENABLED (Production/Default Mode)

This is the default and recommended configuration for production environments.

**Configuration:**
```env
# In .env.local - Authentication is ENABLED when this line is commented out or removed:
# NEXT_PUBLIC_DISABLE_AUTH=true
```

**Or explicitly set to false:**
```env
NEXT_PUBLIC_DISABLE_AUTH=false
```

**What happens:**
- Users must sign in via Clerk to access the application
- Admin features require users with admin privileges
- All authentication middleware is active
- Secure session management via Clerk

### 2. Authentication DISABLED (Development Mode)

Use this configuration for local development when you don't need authentication.

**Configuration:**
```env
# In .env.local - Uncomment this line to DISABLE authentication:
NEXT_PUBLIC_DISABLE_AUTH=true
```

**What happens:**
- No login required
- Automatic mock user with admin privileges
- All features accessible without authentication
- Useful for rapid development and testing

## Current Status

To check the current authentication status:

1. Check `.env.local` file:
   - If `NEXT_PUBLIC_DISABLE_AUTH=true` is present and uncommented → Auth is DISABLED
   - If `NEXT_PUBLIC_DISABLE_AUTH` is commented out or missing → Auth is ENABLED

2. Look for the comment in `.env.local`:
   ```env
   # Enable Clerk authentication (remove this to disable auth in development)
   # NEXT_PUBLIC_DISABLE_AUTH=true
   ```

## Clerk Configuration

When authentication is enabled, you need valid Clerk keys:

```env
# Clerk Authentication Keys (required when auth is enabled)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key

# Clerk Redirect URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/en/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/en/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/en/admin
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/en/admin
```

## Common Scenarios

### For Local Development Without Auth

1. Edit `.env.local`
2. Uncomment the line: `NEXT_PUBLIC_DISABLE_AUTH=true`
3. Restart the development server
4. Access the application without signing in

### For Production or Testing With Auth

1. Edit `.env.local`
2. Comment out or remove: `# NEXT_PUBLIC_DISABLE_AUTH=true`
3. Ensure Clerk keys are properly configured
4. Restart the server
5. Users will be required to sign in

### Switching Between Modes

To toggle authentication:

**Disable Auth (for development):**
```bash
# Edit .env.local and uncomment:
NEXT_PUBLIC_DISABLE_AUTH=true
```

**Enable Auth (for production):**
```bash
# Edit .env.local and comment out or remove:
# NEXT_PUBLIC_DISABLE_AUTH=true
```

## Admin Access

### With Authentication Enabled
- Admin access is controlled via Clerk user metadata
- Set `isAdmin: true` in user's `publicMetadata` in Clerk Dashboard

### With Authentication Disabled
- Mock user automatically has admin privileges
- All admin features are accessible

## Troubleshooting

### Issue: "Authentication should be disabled but still seeing login"
- Ensure `NEXT_PUBLIC_DISABLE_AUTH=true` is uncommented in `.env.local`
- Restart the Next.js development server after changing `.env.local`
- Clear browser cache and cookies

### Issue: "Authentication should be enabled but not working"
- Ensure `NEXT_PUBLIC_DISABLE_AUTH` is commented out or set to `false`
- Verify Clerk keys are correct and active
- Check Clerk Dashboard for any configuration issues
- Ensure redirect URLs match your application routes

### Issue: "Getting redirect loops"
- Check that all Clerk redirect URLs are properly configured
- Verify middleware configuration in `middleware.ts`
- Ensure protected routes are correctly defined

## Related Files

- `/lib/auth-helper.ts` - Main authentication helper functions
- `/middleware.ts` - Clerk middleware configuration
- `/.env.local` - Environment variables including auth settings
- `/components/auth/` - Authentication UI components

## Security Notes

- **Never commit `.env.local` to version control**
- **Always enable authentication in production environments**
- **Use development mode (auth disabled) only for local development**
- **Keep Clerk API keys secure and rotate them regularly**