# Sitemap HTML Issue Investigation

**Date:** 2025-12-02
**Issue:** Google Search Console reports "Sitemap is HTML" error
**Severity:** High - Prevents proper indexing by search engines
**Status:** Root cause identified

## Executive Summary

The sitemap at `https://aipowerranking.com/sitemap.xml` is returning HTML instead of XML because:

1. **Missing sitemap.ts file** - There is NO `sitemap.ts` or `sitemap.xml/route.ts` file in the project
2. **Incorrect route matching** - The URL is being matched by the `[lang]` dynamic route
3. **Redirecting to wrong page** - The request is serving the home page instead of a sitemap

## Investigation Findings

### 1. No Sitemap File Exists

**Searched locations:**
- ❌ `app/sitemap.ts` - Does not exist
- ❌ `app/sitemap.tsx` - Does not exist
- ❌ `app/sitemap.xml/route.ts` - Does not exist
- ❌ `public/sitemap.xml` - Does not exist
- ✅ `app/robots.ts` - Exists and references `/sitemap.xml`

**Found files:**
```
app/robots.ts                                    # References sitemap.xml
scripts/debug-sitemap-connectivity.ts            # Testing script
scripts/check-sitemap-and-submit.ts              # Submission script
lib/seo/submit-sitemap.ts                        # Submission utility
```

### 2. Current Response Analysis

**HTTP Headers:**
```
HTTP/2 200
content-type: text/html; charset=utf-8
x-matched-path: /[lang]
```

**Key observations:**
- Content-Type is `text/html` (should be `application/xml`)
- Matched path is `/[lang]` - the dynamic locale route
- Serving the homepage HTML with all navigation

**HTML content shows:**
```html
<!DOCTYPE html><html lang="en">
<a class="flex items-center gap-3 mb-6" href="/sitemap.xml">
```

All navigation links are prefixed with `/sitemap.xml/` (e.g., `/sitemap.xml/rankings`), confirming the route is being treated as a language slug.

### 3. Routing Structure Analysis

**Current structure:**
```
app/
├── page.tsx                 # Root - redirects to /en
├── [lang]/                  # Dynamic locale route
│   ├── page.tsx            # Homepage for each locale
│   ├── tools/              # Tools page
│   └── ...
├── robots.ts               # ✅ Exists - references sitemap.xml
└── sitemap.ts              # ❌ MISSING - Should be here
```

**The problem:**
1. User requests `/sitemap.xml`
2. Next.js routing sees no `sitemap.ts` file
3. Falls through to dynamic route matcher
4. `/sitemap.xml` matches `[lang]` parameter (lang="sitemap.xml")
5. Serves homepage HTML with "sitemap.xml" as the language

### 4. Middleware Analysis

**File:** `/Users/masa/Projects/aipowerranking/middleware.ts`

**Relevant configuration:**
```typescript
export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

**Issue:** The matcher excludes static file extensions but NOT `.xml` files, so:
- Middleware runs for `/sitemap.xml`
- No special handling for sitemap
- Request continues to route matching
- Gets matched by `[lang]` dynamic route

### 5. robots.ts Configuration

**File:** `/Users/masa/Projects/aipowerranking/app/robots.ts`

```typescript
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerranking.com";

  return {
    rules: [...],
    sitemap: `${baseUrl}/sitemap.xml`,  // ❌ References non-existent sitemap
  };
}
```

The `robots.ts` file correctly references the sitemap, but the sitemap doesn't exist!

### 6. Expected URLs for Sitemap

Based on the current site structure, the sitemap should include:

**Core pages:**
- `https://aipowerranking.com/` (or `/en/`)
- `https://aipowerranking.com/en/rankings`
- `https://aipowerranking.com/en/tools`
- `https://aipowerranking.com/en/news`
- `https://aipowerranking.com/en/methodology`
- `https://aipowerranking.com/en/about`
- `https://aipowerranking.com/en/privacy`
- `https://aipowerranking.com/en/terms`
- `https://aipowerranking.com/en/contact`

**Category pages:**
- `https://aipowerranking.com/en/best-ai-coding-tools`
- `https://aipowerranking.com/en/best-ai-code-editors`
- `https://aipowerranking.com/en/best-autonomous-agents`
- `https://aipowerranking.com/en/best-code-review-tools`
- `https://aipowerranking.com/en/best-testing-tools`
- `https://aipowerranking.com/en/best-devops-assistants`
- `https://aipowerranking.com/en/best-ide-assistants`
- `https://aipowerranking.com/en/best-open-source-frameworks`
- `https://aipowerranking.com/en/best-ai-app-builders`

**Dynamic routes (require database query):**
- Individual tool pages
- Individual news articles
- Monthly ranking pages

**Multi-language support:**
- Same pages for other locales (ja, zh, es, fr, de, ko, pt)

## Root Cause

**Primary cause:** Missing `app/sitemap.ts` file

**Secondary cause:** Dynamic route `[lang]` incorrectly matching `/sitemap.xml`

**Why it happens:**
1. Next.js 13+ App Router expects sitemap at `app/sitemap.ts`
2. When no sitemap file exists, request falls through to route matching
3. Dynamic route `[lang]` matches any path segment
4. `/sitemap.xml` is treated as a language code
5. Homepage is rendered with "sitemap.xml" as the locale parameter

## Verification Commands

```bash
# Check current response
curl -I https://aipowerranking.com/sitemap.xml

# Check robots.txt (working correctly)
curl https://aipowerranking.com/robots.txt

# Verify HTML being returned
curl -s https://aipowerranking.com/sitemap.xml | head -50
```

## Recommended Solution

### Option 1: Create app/sitemap.ts (Recommended)

Create a new file at `app/sitemap.ts`:

```typescript
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://aipowerranking.com'

  // Static routes
  const staticRoutes = [
    '',
    '/en',
    '/en/rankings',
    '/en/tools',
    '/en/news',
    '/en/methodology',
    '/en/about',
    '/en/privacy',
    '/en/terms',
    '/en/contact',
    // Category pages
    '/en/best-ai-coding-tools',
    '/en/best-ai-code-editors',
    '/en/best-autonomous-agents',
    // ... add all static routes
  ].map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }))

  // TODO: Add dynamic routes from database
  // - Individual tool pages
  // - News articles
  // - Monthly rankings

  return staticRoutes
}
```

**Pros:**
- Native Next.js solution
- Automatic XML generation
- Type-safe with MetadataRoute.Sitemap
- Automatically sets correct Content-Type headers

**Cons:**
- Need to query database for dynamic routes
- More complex for multi-language support

### Option 2: Create app/sitemap.xml/route.ts

Create a route handler at `app/sitemap.xml/route.ts`:

```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://aipowerranking.com'

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/en</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- Add more URLs -->
</urlset>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}
```

**Pros:**
- Full control over XML output
- Easy to add dynamic routes
- Can set custom headers

**Cons:**
- Manual XML generation
- No type safety
- More boilerplate code

### Option 3: Middleware Fix (Temporary)

Add sitemap exclusion to middleware:

```typescript
export const config = {
  matcher: [
    '/((?!_next|sitemap\\.xml|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

**Note:** This alone won't fix the issue - you still need to create the sitemap file.

## Next Steps

1. **Create sitemap.ts** - Implement Option 1 (recommended)
2. **Add static routes** - Include all known pages
3. **Query database** - Add dynamic tool/news/ranking pages
4. **Support multi-language** - Generate URLs for all locales
5. **Test locally** - Verify XML output before deployment
6. **Deploy and verify** - Check production sitemap
7. **Resubmit to GSC** - Submit updated sitemap to Google

## Files to Create/Modify

**Create:**
- `app/sitemap.ts` - Main sitemap generation logic

**Optional:**
- `lib/seo/generate-sitemap-urls.ts` - Helper to query database for dynamic routes

**Verify after fix:**
- `app/robots.ts` - Already correctly references `/sitemap.xml`

## Testing Checklist

After implementation:

- [ ] Local: Visit `http://localhost:3000/sitemap.xml`
- [ ] Local: Verify Content-Type is `application/xml`
- [ ] Local: Verify XML structure is valid
- [ ] Local: Count URLs to ensure all pages included
- [ ] Production: Visit `https://aipowerranking.com/sitemap.xml`
- [ ] Production: Verify Content-Type is `application/xml`
- [ ] Production: Verify no HTML is returned
- [ ] GSC: Resubmit sitemap
- [ ] GSC: Wait for crawl and verify success

## Additional Resources

- [Next.js Sitemap Documentation](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
- [Google Sitemap Protocol](https://www.sitemaps.org/protocol.html)
- [MetadataRoute.Sitemap Type Reference](https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps)

## Related Scripts

The following scripts exist but cannot function without a sitemap:

- `scripts/check-sitemap-and-submit.ts` - Tests sitemap and submits to GSC
- `scripts/debug-sitemap-connectivity.ts` - Debug sitemap connectivity
- `scripts/monitor-and-submit-sitemap.ts` - Automated monitoring
- `lib/seo/submit-sitemap.ts` - Submission utility

These scripts should work correctly once the sitemap is created.
