# Next.js Image Component Invalid Preload Tags Fix

## Problem Identified

**Issue**: "Uncaught SyntaxError: Invalid or unexpected token" caused by Next.js auto-generating invalid HTML preload tags.

**Root Cause**: Next.js 15.5.4 `<Image>` component with `priority={true}` generates preload `<link>` tags with **invalid HTML attributes**:
- `imageSrcSet` (React camelCase prop) instead of `imagesrcset` (lowercase HTML attribute)
- `imageSizes` (React camelCase prop) instead of `imagesizes` (lowercase HTML attribute)

## Invalid HTML Generated (Before Fix)

```html
<link rel="preload" as="image" imageSrcSet="/_next/image?url=%2Fcrown-of-technology-36.webp&amp;w=48&amp;q=90 1x, /_next/image?url=%2Fcrown-of-technology-36.webp&amp;w=96&amp;q=90 2x"/>
<link rel="preload" as="image" imageSrcSet="/_next/image?url=%2Fcrown-of-technology-64.webp&amp;w=64&amp;q=90 1x, /_next/image?url=%2Fcrown-of-technology-64.webp&amp;w=128&amp;q=90 2x" fetchPriority="high"/>
```

**Problem**: `imageSrcSet` and `imageSizes` are React props (camelCase), not valid HTML attributes (should be lowercase).

## Solution Implemented

### Strategy: Replace Next.js `<Image>` with Native `<img>` for Crown Icons

Since the crown icons are static assets that don't need Next.js optimization features, we replaced `<Image>` with native `<img>` tags to prevent auto-generation of invalid preload tags.

### Files Modified

1. **`/components/ui/crown-icon-server.tsx`**
   - Changed from `Image` component to native `<img>`
   - Removed `import Image from "next/image"`
   - Kept manual preload in `/app/layout.tsx`

2. **`/components/ui/optimized-image.tsx`**
   - Updated `ResponsiveCrownIcon` to use native `<img>`
   - Kept other components using Next.js `<Image>` (no priority prop)

3. **`/components/layout/app-sidebar.tsx`**
   - Changed sidebar crown icon from `<Image>` to `<img>`
   - Removed `import Image from "next/image"`

### Valid HTML Generated (After Fix)

```html
<link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/runtime.js?v=1761848324229"/>
<link rel="preload" as="image" type="image/webp" href="/crown-of-technology-64.webp" fetchpriority="high"/>
```

**Result**: No `imageSrcSet` or `imageSizes` attributes - only valid HTML attributes.

## Code Changes

### Before (Invalid)
```tsx
<Image
  src="/crown-of-technology-64.webp"
  alt="AI Power Ranking Icon"
  width={64}
  height={64}
  className="object-contain w-full h-full"
  priority={true}  // ← Causes Next.js to generate invalid preload tags
  quality={90}
/>
```

### After (Valid)
```tsx
<img
  src="/crown-of-technology-64.webp"
  alt="AI Power Ranking Icon"
  width={64}
  height={64}
  className="object-contain w-full h-full"
  loading="eager"
  fetchpriority="high"
/>
```

## Why This Works

1. **No Auto-Preload**: Native `<img>` doesn't trigger Next.js preload generation
2. **Manual Preload**: We already have correct preload in `/app/layout.tsx`:
   ```tsx
   <link
     rel="preload"
     as="image"
     type="image/webp"
     href="/crown-of-technology-64.webp"
     fetchpriority="high"
   />
   ```
3. **Performance Maintained**:
   - `loading="eager"` ensures immediate loading
   - `fetchpriority="high"` prioritizes LCP image
   - Static WebP variants (36px, 48px, 64px, 128px) already optimized

## Verification Results

### ✅ Local Development Test
```bash
curl -s http://localhost:3007/en | grep -i "imageSrcSet\|imageSizes"
# Result: No matches (SUCCESS)
```

### ✅ Production Build Test
```bash
npm run build
# Result: Build completed successfully
# No errors, all 86 pages generated
```

### ✅ Browser Console Test
- **Before**: `Uncaught SyntaxError: Invalid or unexpected token`
- **After**: No syntax errors

## Trade-offs & Considerations

### What We Lose
- ❌ Next.js automatic image optimization for crown icons
- ❌ Automatic responsive srcset generation

### What We Keep
- ✅ Manual preload for LCP optimization
- ✅ Static WebP variants for different sizes
- ✅ Server-side rendering (no client JS)
- ✅ Valid HTML (no syntax errors)
- ✅ Same visual appearance

### Why It's Acceptable
1. Crown icons are **small static assets** (590B - 1.8KB)
2. Already optimized as **WebP format**
3. Already have **multiple size variants** (36px, 48px, 64px, 128px)
4. **Manual preload** ensures high priority loading
5. No need for responsive srcset (single size per usage)

## Next.js Bug Report Reference

This appears to be a bug in **Next.js 15.5.4** where the Image component's auto-generated preload tags use React prop names (camelCase) instead of HTML attribute names (lowercase).

**Expected**: `imagesrcset` and `imagesizes` (lowercase)
**Actual**: `imageSrcSet` and `imageSizes` (camelCase)

## Recommendation

Once Next.js fixes this bug (likely in future versions), we can consider reverting to `<Image>` components with `priority={true}`. Monitor Next.js release notes for fixes related to preload tag generation.

## Summary

**Problem**: Next.js generates invalid HTML attributes in preload tags
**Solution**: Use native `<img>` for crown icons to bypass Next.js preload generation
**Result**: No syntax errors, valid HTML, maintained performance
**Status**: ✅ Fixed and verified
