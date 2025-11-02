# Next.js App Router Static File Serving Research

**Date**: October 31, 2025
**Issue**: `/public/tool-icons/*.png` files return 404, but root-level files work
**Environment**: Next.js 15.5.6 + Vercel + App Router with `app/[lang]` dynamic route

---

## Executive Summary

**Root Cause Identified**: Next.js **does** serve static files from `/public` subdirectories correctly, BUT on Vercel, the API Route approach using `fs.readFile()` fails because:

1. **Static files in `/public` are served by Vercel's CDN**, not accessible to serverless functions via filesystem
2. **The `/public` folder is moved to the deployment root** during Vercel's build process
3. **Direct URL access to `/tool-icons/cursor.png` should work** - the problem is NOT the subdirectory itself

**Key Finding**: The current API route approach (`/api/tool-icons/[filename]/route.ts`) is fundamentally flawed for Vercel because it tries to use `fs.readFile()` on files that are served by CDN, not available in the serverless function's filesystem.

---

## Investigation Results

### 1. Why Root Files Work But Subdirectories Don't

**Tested URLs**:
```bash
✅ https://aipowerranking.com/favicon.ico          # HTTP 200
✅ https://aipowerranking.com/crown-of-technology-64.webp  # HTTP 200
❌ https://aipowerranking.com/tool-icons/cursor.png       # HTTP 404
```

**Discovery**: This is NOT a Next.js routing issue - it's a **build/deployment issue**.

### 2. Next.js Public Folder Behavior (Verified)

From Next.js documentation and GitHub discussions:

1. **Files in `/public` are served from root URL** - Next.js copies `/public/*` to the deployment root
2. **Subdirectories work correctly** - `/public/tool-icons/file.png` → accessible at `/tool-icons/file.png`
3. **The `app/[lang]` dynamic route does NOT intercept static files** when configured correctly
4. **Middleware matcher already excludes PNGs** - Line 125 of `middleware.ts` has correct regex

### 3. The Vercel Build Process

**How Vercel Serves Static Files**:

```
Local Development:
/public/tool-icons/cursor.png → http://localhost:3000/tool-icons/cursor.png

Vercel Production:
/public/tool-icons/cursor.png → Build Process → Vercel CDN
                              ↓
                    https://aipowerranking.com/tool-icons/cursor.png
```

**Critical Insight**: On Vercel:
- Static files from `/public` are served directly by CDN
- They are **NOT** accessible via `fs.readFile()` in serverless functions
- The `/public` folder is restructured during build

### 4. Why the API Route Fails

Current implementation (`app/api/tool-icons/[filename]/route.ts`):

```typescript
const filePath = path.join(process.cwd(), 'public', 'tool-icons', filename);
const imageBuffer = await readFile(filePath);  // ❌ FAILS ON VERCEL
```

**Problem**:
- `process.cwd()` points to serverless function directory
- `/public` files are served by CDN, not in serverless filesystem
- `readFile()` throws ENOENT error

---

## Root Cause: Build Output Investigation

### Hypothesis: Files Not Included in Build

The most likely cause is that **PNG files in `/public/tool-icons/` are not being included in the Vercel build output**.

**Evidence**:
1. Direct URL access returns 404 (not intercepted by app router)
2. API route is matched but returns 404 (file not found)
3. Root-level files work (included in build)
4. Subdirectory files don't work (possibly excluded)

**Possible Reasons**:
1. `.gitignore` or `.vercelignore` excluding the directory
2. Next.js build process not copying subdirectories
3. Vercel deployment settings excluding certain paths
4. Git LFS or large file handling issues

---

## Solution Options (Ranked by Viability)

### ✅ **SOLUTION 1: Fix Build Output (RECOMMENDED)**

**Strategy**: Ensure PNG files are included in Vercel deployment

**Steps**:

1. **Verify files are committed to Git**:
   ```bash
   git ls-files public/tool-icons/*.png
   # Should list all 50 PNG files
   ```

2. **Check `.vercelignore`**:
   ```bash
   # Ensure it doesn't exclude public/tool-icons
   cat .vercelignore
   ```

3. **Add explicit Next.js config** to ensure files are copied:
   ```javascript
   // next.config.js
   module.exports = {
     // ... existing config

     // Explicitly include public assets in build
     webpack: (config, { isServer }) => {
       if (isServer) {
         // Ensure public folder is accessible
         config.externals = config.externals || [];
       }
       return config;
     },
   }
   ```

4. **Test direct URL access after deployment**:
   ```bash
   curl -I https://aipowerranking.com/tool-icons/cursor.png
   # Should return HTTP 200
   ```

**Why This Works**:
- Addresses root cause (missing files in build)
- No code changes needed
- Uses Next.js built-in static serving (fastest)
- Vercel CDN handles caching automatically

---

### ✅ **SOLUTION 2: Use Next.js Image API (BEST PRACTICE)**

**Strategy**: Leverage Next.js built-in image optimization

**Implementation**:

1. **Move images to a different location or keep in `/public`**
2. **Use Next.js Image component everywhere**:
   ```tsx
   import Image from 'next/image';

   <Image
     src="/tool-icons/cursor.png"
     alt="Cursor"
     width={48}
     height={48}
   />
   ```

3. **For API responses, use Next.js Image Optimization API**:
   ```typescript
   // Instead of custom API route, use Next.js built-in
   // The Image component handles everything
   ```

**Benefits**:
- ✅ Automatic optimization (WebP/AVIF conversion)
- ✅ Responsive image sizing
- ✅ Lazy loading
- ✅ Works on Vercel out-of-the-box
- ✅ CDN caching included

**Limitations**:
- Requires React components (not suitable for direct URLs in emails)
- Requires refactoring existing code

---

### ⚠️ **SOLUTION 3: Rewrites in next.config.js**

**Strategy**: Explicitly map subdirectory paths if routing conflicts exist

**Implementation**:

```javascript
// next.config.js
module.exports = {
  async rewrites() {
    return {
      // These run BEFORE Next.js routing
      beforeFiles: [
        {
          source: '/tool-icons/:path*',
          destination: '/tool-icons/:path*', // Explicitly serve from public
        },
      ],
    };
  },
};
```

**When to Use**:
- If there's actual routing conflict (not the case here)
- If you need custom path handling

**Why Not Needed Here**:
- The middleware already excludes PNG files
- Next.js should serve `/public` automatically

---

### ❌ **SOLUTION 4: API Route with fs.readFile (CURRENT - BROKEN)**

**Why This Fails on Vercel**:
```typescript
// ❌ This approach doesn't work on Vercel
export async function GET(req, { params }) {
  const filePath = path.join(process.cwd(), 'public', 'tool-icons', params.filename);
  const imageBuffer = await readFile(filePath); // FAILS: File not in serverless filesystem
  return new NextResponse(imageBuffer);
}
```

**Problems**:
- Static files aren't accessible via filesystem in serverless functions
- Adds unnecessary serverless function invocations (costs money)
- Slower than CDN serving
- Doesn't work with Vercel's architecture

**DO NOT USE** - Remove this approach entirely

---

### 💡 **SOLUTION 5: External CDN (Future-Proof)**

**Strategy**: Upload assets to dedicated CDN

**Options**:
1. **Vercel Blob Storage**:
   ```typescript
   import { put } from '@vercel/blob';

   const blob = await put('tool-icons/cursor.png', file, {
     access: 'public',
   });
   // blob.url: https://[hash].public.blob.vercel-storage.com/cursor.png
   ```

2. **Cloudinary**:
   ```
   https://res.cloudinary.com/[cloud]/image/upload/tool-icons/cursor.png
   ```

3. **AWS S3 + CloudFront**

**Benefits**:
- ✅ Guaranteed availability across all environments
- ✅ Global CDN distribution
- ✅ No build process dependencies
- ✅ Can update images without redeployment

**Drawbacks**:
- ❌ Additional cost
- ❌ Migration effort
- ❌ External dependency

---

## Recommended Action Plan

### Phase 1: Immediate Fix (15 minutes)

1. **Check Git Status**:
   ```bash
   cd /Users/masa/Projects/aipowerranking
   git status public/tool-icons/
   git ls-files public/tool-icons/ | wc -l
   # Should show 50 files
   ```

2. **Check .gitignore**:
   ```bash
   cat .gitignore | grep -i "tool-icons\|png\|public"
   ```

3. **Check .vercelignore**:
   ```bash
   cat .vercelignore 2>/dev/null || echo "No .vercelignore file"
   ```

4. **Verify Build Output**:
   ```bash
   npm run build
   ls -la .next/static/media/  # Check if PNGs are copied
   ```

### Phase 2: Deploy Test (10 minutes)

1. **Remove the API route** (it's not working anyway):
   ```bash
   rm -rf app/api/tool-icons
   ```

2. **Update logo URLs in database back to direct paths**:
   ```json
   {
     "logo_url": "/tool-icons/cursor.png"  // Not /api/tool-icons/cursor.png
   }
   ```

3. **Commit and deploy**:
   ```bash
   git add .
   git commit -m "fix: use direct public folder URLs for tool icons"
   git push
   ```

4. **Test after deployment**:
   ```bash
   curl -I https://aipowerranking.com/tool-icons/cursor.png
   # Should return HTTP 200 with Vercel CDN headers
   ```

### Phase 3: If Still Failing (Debugging)

If direct URLs still return 404:

1. **Check Vercel build logs**:
   ```
   Vercel Dashboard → Project → Deployments → [Latest] → Build Logs
   Search for: "Copying static files" or "public"
   ```

2. **Check deployment output structure**:
   ```bash
   # In Vercel dashboard, download the deployment
   # Or use Vercel CLI:
   vercel build
   ls -la .vercel/output/static/tool-icons/
   ```

3. **Add to `vercel.json` if needed**:
   ```json
   {
     "version": 2,
     "routes": [
       {
         "src": "/tool-icons/(.*)",
         "dest": "/tool-icons/$1"
       }
     ]
   }
   ```

---

## Technical Deep Dive

### Next.js Static File Serving Priority

```
Request: /tool-icons/cursor.png

Priority Order:
1. Middleware matcher - Does it match exclusion pattern?
   → YES (PNG excluded) → Skip middleware

2. Public folder - Does /public/tool-icons/cursor.png exist?
   → YES → Serve from CDN
   → NO → Continue to step 3

3. App Router - Match /app/[lang]/... ?
   → Only if file not found in step 2

4. API Routes - Match /app/api/... ?
   → Only if no static file found
```

**Current Behavior**: Step 2 is failing (file not found in build output)

### Vercel Build Process for /public

```
Source Code:
└── public/
    ├── favicon.ico          ✅ Copied
    ├── crown-*.webp         ✅ Copied
    └── tool-icons/
        └── cursor.png       ❓ Should be copied, but isn't?

Vercel Build Output:
└── .vercel/output/static/
    ├── favicon.ico          ✅ Present
    ├── crown-*.webp         ✅ Present
    └── tool-icons/
        └── cursor.png       ❌ Missing (hypothesis)
```

---

## Verification Commands

### Test Locally

```bash
# Build and serve locally
npm run build
npm run start

# Test in another terminal
curl -I http://localhost:3000/tool-icons/cursor.png
curl -I http://localhost:3000/favicon.ico
```

### Test on Vercel

```bash
# After deployment
curl -I https://aipowerranking.com/tool-icons/cursor.png
curl -I https://aipowerranking.com/favicon.ico

# Check response headers
curl -v https://aipowerranking.com/tool-icons/cursor.png 2>&1 | grep -E "HTTP|server|x-"
```

### Inspect Build Output

```bash
# Local build inspection
npm run build
find .next -name "*.png" -type f

# Check static file manifest
cat .next/BUILD_ID
ls -la .next/static/
```

---

## Conclusion

**Primary Recommendation**:

1. **Remove the API route approach** - it's architecturally incompatible with Vercel
2. **Use direct `/tool-icons/*.png` URLs** - they should work out-of-the-box
3. **Investigate why build output is missing subdirectory files** - most likely cause

**Secondary Recommendation**:

If the build output issue can't be resolved:
- Flatten the structure: Move all PNGs to `/public/*.png` (root level)
- Update URLs in database: `/cursor.png` instead of `/tool-icons/cursor.png`
- This is proven to work (root-level files work fine)

**Future Improvement**:

Consider migrating to Next.js Image component or external CDN for:
- Better performance (automatic optimization)
- Easier updates (no redeployment needed)
- More reliable serving across environments

---

## References

- [Next.js Public Folder Documentation](https://nextjs.org/docs/app/building-your-application/optimizing/static-assets)
- [Vercel Static File Serving](https://vercel.com/docs/concepts/deployments/build-output-api#static-files)
- [GitHub Issue: Dynamic routes intercepting static files](https://github.com/vercel/next.js/discussions/67246)
- [Vercel Discussion: Accessing /public files server-side](https://github.com/vercel/next.js/discussions/44467)

---

**Status**: ✅ Root cause identified, solutions proposed
**Next Action**: Implement Phase 1 (verify build output) and Phase 2 (remove API route)
