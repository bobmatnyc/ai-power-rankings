# Release Notes - v0.3.2

**Release Date:** October 30, 2025
**Release Type:** Patch Release (Production Hotfix)

## Overview

This patch release addresses critical production issues discovered in v0.3.1 that caused JavaScript syntax errors and HTML validation warnings in production environments.

## Critical Fixes

### 1. CSS Script Tag Bug (Uncaught SyntaxError)
- **Issue:** Next.js 15.5.4's `optimizeCss` feature was generating invalid `<script>` tags for CSS content
- **Impact:** Production builds threw "Uncaught SyntaxError: Unexpected token '<'" errors
- **Fix:** Disabled `optimizeCss` in `next.config.js` until Next.js resolves the bug
- **Commit:** [7d91ea4](https://github.com/bobmatnyc/ai-power-rankings/commit/7d91ea4f)

### 2. Webpack Chunk Naming
- **Issue:** Framework chunks were using dots instead of hyphens (`framework.next`)
- **Impact:** Potential routing conflicts and non-standard webpack naming
- **Fix:** Updated to use hyphens (`framework-next`) following webpack best practices
- **Commit:** [7d91ea4](https://github.com/bobmatnyc/ai-power-rankings/commit/7d91ea4f)

### 3. Invalid HTML Preload Attributes
- **Issue:** Next.js auto-generated invalid `imageSrcSet` and `imageSizes` attributes on link preload tags
- **Impact:** HTML validation errors and console warnings
- **Fix:** Eliminated auto-generated preload tags using custom preload implementation
- **Commit:** [e132ea7](https://github.com/bobmatnyc/ai-power-rankings/commit/e132ea76)

### 4. Next.js Image Component Issues
- **Issue:** Next.js Image component generating invalid HTML attributes
- **Impact:** HTML validation errors with `decoding` and `loading` attributes
- **Fix:** Replaced Next.js Image with native `<img>` tags for crown icons
- **Commit:** [d6c0e3f](https://github.com/bobmatnyc/ai-power-rankings/commit/d6c0e3f5)

## Technical Details

### Next.js Configuration Changes

```javascript
// next.config.js
module.exports = {
  experimental: {
    optimizeCss: false, // Disabled due to Next.js 15.5.4 bug
    webpackBuildWorker: true,
  },
  webpack: (config) => {
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        framework: {
          name: 'framework-next', // Changed from 'framework.next'
          // ... other config
        }
      }
    }
  }
}
```

### Impact on Performance

While disabling `optimizeCss` slightly increases CSS bundle size, it eliminates critical runtime errors:

- **Before:** Runtime crashes due to CSS script tag bug
- **After:** Stable production builds with slightly larger CSS (acceptable tradeoff)

### Browser Compatibility

All fixes maintain broad browser compatibility:
- Native `<img>` tags work in all browsers
- Standard webpack naming improves compatibility
- Proper HTML attributes improve accessibility

## Known Issues

### Next.js 15.5.4 optimizeCss Bug
- **Status:** Upstream bug in Next.js 15.5.4
- **Tracking:** [Next.js Issue](https://github.com/vercel/next.js/issues/)
- **Workaround:** Disabled in this release
- **Future:** Will re-enable when Next.js fixes the bug

## Upgrade Path

### From v0.3.1
```bash
git pull origin main
npm install
npm run build
```

No database migrations or configuration changes required.

### Breaking Changes
None - this is a backwards-compatible patch release.

## Testing Performed

1. **Production Build Verification**
   - ✅ Build completes without errors
   - ✅ No runtime syntax errors
   - ✅ No HTML validation warnings

2. **Functionality Testing**
   - ✅ All pages load correctly
   - ✅ Images render properly
   - ✅ CSS styles apply correctly

3. **Performance Testing**
   - ✅ Page load times within acceptable range
   - ✅ Bundle sizes slightly larger but acceptable

## Deployment Notes

### Pre-deployment Checklist
- [x] Production build tested locally
- [x] No breaking changes
- [x] HTML validation passed
- [x] Browser console clean (no errors)

### Deployment Steps
1. Deploy to staging environment
2. Verify no syntax errors in browser console
3. Validate HTML output
4. Deploy to production
5. Monitor error tracking for any issues

### Rollback Plan
If issues occur, rollback to v0.3.1:
```bash
git checkout v0.3.1
npm install
npm run build
```

## Credits

**Fixed by:** Version Control Agent
**Tested by:** Production Environment
**Reported by:** Browser Console Monitoring

## References

- [Commit History](https://github.com/bobmatnyc/ai-power-rankings/compare/v0.3.1...v0.3.2)
- [Next.js 15.5.4 Release Notes](https://github.com/vercel/next.js/releases/tag/v15.5.4)
- [Webpack Bundle Naming Best Practices](https://webpack.js.org/guides/caching/)

## Next Steps

- Monitor production for any remaining issues
- Re-evaluate `optimizeCss` with future Next.js releases
- Consider migrating more components away from Next.js Image if issues persist
