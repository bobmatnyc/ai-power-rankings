# Next.js 15.5.6 Upgrade Test Report

**Date:** 2025-10-30
**Previous Version:** Next.js 15.5.4
**Upgraded To:** Next.js 15.5.6
**React Version:** 19.2.0 (upgraded from previous)

---

## Executive Summary

### Verdict: BUG STILL EXISTS IN NEXT.JS 15.5.6

The CSS script tag bug is **NOT FIXED** in Next.js 15.5.6. The issue persists regardless of the `optimizeCss` experimental flag setting.

### Critical Finding

**The bug is NOT related to `optimizeCss` flag!** The problematic CSS script tags appear in the build output whether `optimizeCss` is `true` or `false`.

---

## Test Results

### 1. Package Upgrades ✅

```bash
npm install next@15.5.6 react@latest react-dom@latest
```

**Installed Versions:**
- next: ^15.5.6
- react: ^19.2.0
- react-dom: ^19.2.0

### 2. Build Test with `optimizeCss: true` ❌

**Configuration:**
```javascript
experimental: {
  optimizeCss: true, // Re-enabled after upgrading to Next.js 15.5.6
}
```

**Result:** Build succeeded, but CSS script tags detected:

```bash
grep -r '<script.*\.css' .next/server/app/
```

**Found:**
```html
<script src="/_next/static/css/f0040164afec31cc.css" async=""></script>
```

### 3. Build Test with `optimizeCss: false` ❌

**Configuration:**
```javascript
experimental: {
  optimizeCss: false, // Still broken in Next.js 15.5.6
}
```

**Result:** Build succeeded, but **CSS script tags STILL present**:

```html
<script src="/_next/static/css/f0040164afec31cc.css" async=""></script>
```

### 4. Production Server Test ❌

```bash
npm start
curl http://localhost:3000/en | grep '<script.*\.css'
```

**Result:** CSS script tags found in rendered output:
```html
<script src="/_next/static/css/f0040164afec31cc.css"
```

---

## Key Discoveries

### The Bug is NOT Related to `optimizeCss`

Initial assumptions were incorrect. The problematic CSS script tags appear in the HTML output regardless of the `optimizeCss` experimental flag setting:

1. **With `optimizeCss: true`** → CSS script tags present
2. **With `optimizeCss: false`** → CSS script tags present

### CSS Script Tags Location

The CSS script tags appear in:
- `/Users/masa/Projects/aipowerranking/.next/server/app/_not-found.html`
- Rendered pages served by the production server (`/en`, etc.)

### Expected vs Actual Behavior

**Expected:**
```html
<link rel="stylesheet" href="/_next/static/css/f0040164afec31cc.css" data-precedence="next"/>
```

**Actual (Buggy):**
```html
<link rel="stylesheet" href="/_next/static/css/f0040164afec31cc.css" data-precedence="next"/>
<script src="/_next/static/css/f0040164afec31cc.css" async=""></script>
```

Both tags are present, but the `<script>` tag will cause JavaScript syntax errors when the browser attempts to execute CSS as JavaScript.

---

## Root Cause Analysis

The bug appears to be a **core Next.js 15.x rendering issue** unrelated to the experimental CSS optimization feature. The framework is incorrectly generating both:

1. Correct `<link rel="stylesheet">` tags
2. Incorrect `<script src="...css">` tags

This suggests a bug in Next.js's HTML generation or React Server Components hydration logic.

---

## Recommendation

### Action Taken

**Reverted `optimizeCss` to `false`** with updated comment in `/Users/masa/Projects/aipowerranking/next.config.js`:

```javascript
experimental: {
  optimizeCss: false, // Still broken in Next.js 15.5.6 - CSS loads as script tags causing SyntaxError
}
```

**Note:** While this reversion doesn't fix the bug, it maintains consistency with our previous workaround documentation.

### Next Steps

1. **Monitor Next.js releases** for fixes to this core rendering bug
2. **Report to Next.js team** if not already tracked (check Next.js GitHub issues)
3. **Test again with Next.js 15.6.x** or 16.x when available
4. **Consider downgrading to Next.js 14.x** if the bug causes production issues

### Upstream Issue Tracking

This appears to be a critical bug in Next.js 15.x that should be reported:
- **Repository:** https://github.com/vercel/next.js
- **Issue Type:** Bug - CSS files incorrectly loaded as script tags
- **Affects:** Next.js 15.5.4, 15.5.6 (and likely all 15.x versions)

---

## Build Evidence

### Build Output (with optimizeCss: false)

```
   ▲ Next.js 15.5.6
   - Environments: .env.production.local, .env.local
   - Experiments (use with caution):
     · optimizePackageImports

   Creating an optimized production build ...
 ✓ Compiled successfully in 14.4s
```

### Grep Results

```bash
grep -r '<script.*\.css' .next/server/app/
```

**Output:** CSS script tags found in `_not-found.html` and rendered pages

---

## Conclusion

**The CSS script tag bug persists in Next.js 15.5.6 regardless of configuration settings.** This is a core framework bug that requires a fix from the Next.js team. The upgrade to 15.5.6 is **NOT recommended** for fixing this issue.

**Current Workaround:** Keep `optimizeCss: false` (though it doesn't prevent the bug) and monitor for Next.js updates.

**Status:** ❌ **BUG NOT FIXED - UPGRADE DOES NOT RESOLVE ISSUE**
