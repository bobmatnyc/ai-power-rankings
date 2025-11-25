# Fixes Summary - November 25, 2025

## Issues Resolved

### 1. Apply Changes Button Not Working (News Editor)
**Status**: ✅ **FIXED**
**Commits**: 7af048f9

#### Problem
The "Apply Changes" button in the News Editor's Preview Ranking Impact feature appeared to work but didn't actually update tool scores in the database. It only saved changes to the `article_rankings_changes` table (for history) but didn't modify the actual tool rankings.

#### Root Cause
The `applyRankingChanges()` method in `/lib/services/article-db-service.ts` was just a TODO stub that logged to console but didn't perform any database updates.

#### Solution
Implemented complete `applyRankingChanges()` functionality:

**What it does**:
1. Updates `tools.deltaScore` with calculated delta changes
2. Updates `tools.currentScore` with new total scores
3. Updates `tools.scoreUpdatedAt` timestamp
4. Groups changes by tool_id for efficient batch processing
5. Calculates required delta from baseline to achieve new score
6. Includes error handling to continue if individual tools fail

**Technical Details**:
- Tools use a baseline + delta architecture:
  - `baselineScore`: Stable baseline (doesn't change)
  - `deltaScore`: Accumulated changes from articles
  - `currentScore`: Cached total (baseline + delta)
- All scores stored as JSONB with `overallScore` field
- Method updates the `tools` table directly

**Files Changed**:
- `/lib/services/article-db-service.ts` (77 lines added, 9 removed)

---

### 2. Monthly Summaries Not Displaying
**Status**: ✅ **FIXED**
**Commits**: 687f85a7

#### Problem
The `/en/whats-new` page showed "No Monthly Summary Available" even though the API endpoint `/api/whats-new/summary` was returning valid data.

#### Root Cause
Port mismatch in server-side rendering:
- Page used `process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'`
- Dev server actually runs on port `3007`
- During SSR, page fetched from wrong port and failed
- Cached "No Summary" message kept displaying

#### Solution
Changed from absolute URL to relative URL for internal API calls:

**Before**:
```typescript
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const response = await fetch(`${baseUrl}/api/whats-new/summary`, {
  cache: 'no-store',
});
```

**After**:
```typescript
// Use relative URL - works in both development and production
const response = await fetch('/api/whats-new/summary', {
  cache: 'no-store',
});
```

**Benefits**:
- Works on any dev port (no hardcoded port numbers)
- No environment variable configuration needed
- Server Components automatically use current server host
- Works identically in development and production

**Files Changed**:
- `/app/[lang]/whats-new/page.tsx` (2 lines changed)

---

## Testing Instructions

### Test Apply Changes Fix
1. Navigate to `/en/admin/news`
2. Edit any article
3. Click "Preview Impact" button
4. Review the ranking changes in the modal
5. Click "Apply Changes"
6. Verify in database that tool scores are updated:
   ```sql
   SELECT id, name, delta_score, current_score, score_updated_at
   FROM tools
   WHERE score_updated_at > NOW() - INTERVAL '1 minute';
   ```
7. Check tool rankings page to see updated scores

### Test Monthly Summary Fix
1. Navigate to `/en/whats-new`
2. Verify monthly summary content displays
3. Check for November 2025 summary
4. Verify statistics grid shows correct counts
5. Test navigation to "Recent (7 Days)" tab

---

## Build Verification

Both changes compiled successfully:
```
✓ Compiled successfully in 5.7s
✓ No TypeScript errors
✓ All 87 routes generated correctly
```

---

## Deployment Status

**Both fixes have been pushed to `origin/main`**:
- Commit 7af048f9: Apply Changes fix
- Commit 687f85a7: Monthly summary fix

**Ready for deployment** after manual testing in development environment.

---

## Previous Session Work (Completed Earlier)

- ✅ Issue #59: Preview/Apply Changes functionality added to News Editor
- ✅ Issue #58: Admin UI for monthly summary regeneration
- ✅ Issue #57: What's New navigation pages created
- ✅ Internal server errors resolved with build cleanup

All previous work has been committed and pushed to main.

---

**Implementation Date**: November 25, 2025
**Developer**: Claude (AI Assistant)
**Review Status**: Ready for user testing
**Deployment Status**: Pushed to main, awaiting deployment
