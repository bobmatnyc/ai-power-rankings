# Error Logging Changes for Vercel Debugging

## Summary
Added comprehensive error logging throughout the application to help diagnose why the main page returns 500 on Vercel staging but works locally.

## Changes Made

### 1. Layout Component (`src/app/[lang]/layout.tsx`)
- Added try-catch blocks around `generateMetadata` and `RootLayout` functions
- Added detailed console logging for:
  - Parameter resolution
  - Language detection
  - Dictionary loading
  - Environment variables (NODE_ENV, VERCEL_ENV)
  - Base URL generation
- Added fallback error UI that displays error details

### 2. Page Component (`src/app/[lang]/page.tsx`)
- Wrapped entire Home component in try-catch
- Added logging for:
  - Environment variables check
  - Parameter resolution
  - Language and dictionary loading
  - Base URL retrieval
- Added error page with detailed stack traces in development/staging

### 3. Middleware (`src/middleware.ts`)
- Added try-catch wrapper around middleware handler
- Added logging for:
  - Request path processing
  - Environment check (NODE_ENV, VERCEL_ENV, AUTH settings)
  - Authentication status
- Added error recovery with basic response on failure

### 4. URL Helper (`src/lib/get-url.ts`)
- Added detailed logging for URL source detection
- Logs which environment variables are available
- Warns when no URL source is found

### 5. Dictionary Loader (`src/i18n/get-dictionary.ts`)
- Added error handling with fallback to English dictionary
- Logs dictionary loading process and failures
- Provides graceful degradation on translation errors

### 6. Error Boundary Component (`src/components/error-boundary.tsx`)
- Enhanced existing error boundary with more detailed logging
- Shows error details in development/staging environments
- Logs environment information when errors are caught

### 7. Client Layout (`src/components/layout/client-layout.tsx`)
- Wrapped layout in ErrorBoundary component
- Provides client-side error catching and logging

### 8. Debug Endpoints Created

#### `/api/debug/env` - Environment Variable Checker
- Lists all available environment variable keys (not values for security)
- Categorizes variables by type (Next.js, Vercel, Database, Auth, etc.)
- Checks for critical variables and reports issues
- Shows runtime information (Node version, platform, memory usage)

#### `/api/test-error` - Error Testing Endpoint
- Tests error logging functionality
- Reports environment variables and URL computation
- Can intentionally throw errors for testing

## How to Use for Debugging

1. **Deploy to Vercel staging** with these changes

2. **Check the debug endpoint**:
   ```
   https://your-staging-url.vercel.app/api/debug/env
   ```
   This will show which environment variables are available and identify missing critical variables.

3. **Check Vercel Function Logs**:
   - Go to Vercel Dashboard → Functions tab
   - Look for console logs with these prefixes:
     - `[Layout]` - Layout component logs
     - `[Page]` - Page component logs
     - `[Middleware]` - Middleware logs
     - `[getUrl]` - URL resolution logs
     - `[getDictionary]` - Translation loading logs
     - `[ErrorBoundary]` - Client-side error logs
     - `[Debug API]` - Debug endpoint logs

4. **Check the test error endpoint**:
   ```
   https://your-staging-url.vercel.app/api/test-error
   ```
   This verifies that error logging is working correctly.

5. **If the main page fails**, the error page will show:
   - Error message and stack trace (in staging/development)
   - Environment information
   - Fallback UI to prevent complete failure

## Most Likely Issues

Based on the logging, common issues that cause staging failures include:

1. **Missing Environment Variables**:
   - `NEXT_PUBLIC_BASE_URL` or `VERCEL_URL` not set
   - Database connection string missing
   - Clerk authentication keys missing (if auth is enabled)

2. **URL Resolution Failures**:
   - The `getUrl()` function returns empty string when no URL source is found
   - This can break API calls that need absolute URLs

3. **Dictionary Loading Issues**:
   - Translation files might not be included in the build
   - File path issues between local and Vercel environments

4. **Database Connection**:
   - Different connection strings between local and staging
   - Missing database URL in environment

## Next Steps

1. Deploy these changes to staging
2. Access the debug endpoint to check environment
3. Review Vercel Function logs for error details
4. Fix identified issues based on the logs
5. Remove or disable verbose logging once issues are resolved

## Cleanup

Once the issue is diagnosed and fixed, consider:
- Removing the test endpoints (`/api/debug/env`, `/api/test-error`)
- Reducing console.log statements to only critical errors
- Keeping error boundaries and try-catch blocks for production stability