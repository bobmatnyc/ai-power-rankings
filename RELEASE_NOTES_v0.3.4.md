# Release Notes - v0.3.4

## 🎯 Major Improvements

### Jules Duplicate Fix ✅
- **Problem**: Google Jules appeared twice in rankings (#1 and #27)
- **Solution**: Merged entries, marked old one as redirect
- **Result**: Jules now correctly appears once at rank #1 (score 60.0)
- **Impact**: Eliminated ranking confusion between home and rankings pages

### Logo Collection System ✅
- **Collected**: 50 tool logos (98% coverage)
- **Method**: Automated collection via Clearbit + Google Favicon APIs
- **Storage**: Local PNG files in `/public/tools/`
- **Coverage**: Improved from 76.5% to 98.0% (+21.5%)

## 📊 Statistics

- **Tools with logos**: 50/51 (98%)
- **Scripts created**: 13 TypeScript files
- **Documentation**: 6 markdown reports
- **Logo files**: 50 PNG images (~324 KB total)
- **Lines added**: 3,028+

## 🔧 Technical Details

### Jules Fix Scripts
- fix-jules-duplicate.ts
- regenerate-october-rankings.ts
- set-october-current.ts
- query-jules.ts
- verify-jules-fix.ts

### Logo Collection Scripts
- collect-tool-logos.ts
- verify-logos.ts
- check-missing-logos.ts
- add-missing-website-urls.ts
- update-flint-logo.ts

## 🚀 Deployment

All changes committed to main branch and ready for production deployment.

## 📝 Documentation

Complete documentation available:
- JULES_DUPLICATE_FIX_REPORT.md
- LOGO_COLLECTION_SUMMARY.md
- LOGO_COLLECTION_EVIDENCE.md
- docs/research/JULES_RANKING_DISCREPANCY_REPORT.md

---

**Version**: 0.3.4
**Date**: 2025-10-31
**Commit**: cfc8ed7f
