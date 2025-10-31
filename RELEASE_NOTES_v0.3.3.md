# Release Notes - v0.3.3

**Release Date:** 2025-10-31
**Type:** Patch Release
**Focus:** Next.js & React Upgrade

---

## Overview

This patch release upgrades to the latest Next.js 15.5.6 and React 19.2.0, bringing security patches and bug fixes. Note that the known CSS script tag bug persists in Next.js 15.5.6 and is a framework-level issue requiring an upstream fix.

---

## Dependency Upgrades

### Framework Updates

- **Next.js**: 15.5.4 → **15.5.6**
- **React**: → **19.2.0**
- **React-DOM**: → **19.2.0**

### What's Included

- Latest security patches from Next.js team
- React 19.2.0 stability improvements
- Bug fixes in Next.js routing and rendering
- Performance optimizations

---

## Known Issues

### CSS Script Tag Bug (Unresolved)

The CSS script tag bug identified in previous versions **still persists** in Next.js 15.5.6:

**Issue:** Next.js incorrectly generates both `<link>` and `<script>` tags for CSS files:

```html
<!-- Correct -->
<link rel="stylesheet" href="/_next/static/css/f0040164afec31cc.css" data-precedence="next"/>

<!-- Incorrect (causes JavaScript syntax error) -->
<script src="/_next/static/css/f0040164afec31cc.css" async=""></script>
```

**Impact:**
- Console warnings about JavaScript syntax errors
- No functional impact on application behavior
- Cosmetic issue only

**Root Cause:**
- Core Next.js 15.x rendering bug
- Unrelated to `optimizeCss` experimental flag
- Requires fix from Next.js team

**Status:**
- ❌ **NOT FIXED** in Next.js 15.5.6
- Tracking upstream issue at https://github.com/vercel/next.js
- Will retest with Next.js 15.6.x or 16.x

**Current Workaround:**
- Keep `optimizeCss: false` in `next.config.js`
- Monitor Next.js releases for fix
- Issue does not affect production functionality

---

## Route Groups Migration (Completed in v0.3.3)

This release includes the completed route groups refactoring:

### Authentication Routes Reorganized

- Moved all authenticated pages to `(authenticated)` route group
- Consolidated authentication routing structure
- Improved code organization and maintainability

### Files Affected

- Dashboard pages relocated to `app/[lang]/(authenticated)/dashboard/`
- Admin pages relocated to `app/[lang]/(authenticated)/admin/`
- Auth pages relocated to `app/[lang]/(authenticated)/sign-in/`, etc.
- Middleware updated for new structure
- API routes updated for compatibility

---

## Testing & Verification

### Build Verification ✅

```bash
npm run build
```

- Build succeeds with Next.js 15.5.6
- No new compilation errors
- CSS script tag bug confirmed in output

### Production Server Test ✅

```bash
npm start
```

- Application runs successfully
- All routes functional
- CSS script tags present but non-blocking

### Automated Tests

- E2E tests passing
- API tests passing
- UI tests passing

---

## Upgrade Path

### From v0.3.2 → v0.3.3

```bash
git pull origin main
npm install
npm run build
npm start
```

No breaking changes. Direct upgrade recommended.

---

## Technical Details

### Commit History

**Main Commits:**
1. `ef6a9808` - Route groups migration and Next.js 15.5.6 upgrade
2. `4ec42c82` - Version bump to 0.3.3

### Git Tag

```bash
git checkout v0.3.3
```

### Deployment

Ready for production deployment via standard deployment process.

---

## Documentation

### Related Documents

- **Upgrade Report:** `NEXTJS_15.5.6_UPGRADE_REPORT.md`
- **Route Groups:** `PHASE_2_ROUTE_GROUPS_IMPLEMENTATION.md`
- **Previous Release:** `RELEASE_NOTES_v0.3.2.md`

---

## Next Steps

### Monitoring

- Watch for Next.js 15.6.x or 16.x releases
- Test CSS script tag bug with future versions
- Consider downgrade to Next.js 14.x if bug causes issues

### Planned for v0.3.4+

- Additional performance optimizations
- Further Next.js upgrades when bug is fixed
- Enhanced monitoring and observability

---

## Support

For issues or questions about this release:

1. Check `NEXTJS_15.5.6_UPGRADE_REPORT.md` for technical details
2. Review Known Issues section above
3. Report new issues to development team

---

**Release Prepared By:** Version Control Agent
**Build Status:** ✅ Passing
**Deployment Status:** Ready for Production
