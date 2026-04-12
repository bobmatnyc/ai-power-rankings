# Final QA Findings: Duplicate Articles Investigation

**Investigation Date:** March 28, 2026
**Status:** ✅ COMPLETED - Issue Confirmed and Root Cause Identified

## Investigation Summary

### User Report Verification
**CLAIM:** "The last 4 articles are duplicates"
**RESULT:** ✅ **CONFIRMED - ALL 4 of the most recent articles are duplicates that will be deleted during cleanup**

### Scope of Duplicate Issue
- **Total Database Articles:** 463
- **Articles to Delete:** 72 duplicates
- **Articles to Keep:** 15 originals
- **Database Bloat:** 72 unnecessary articles (15.5% waste)

## Root Cause Identified

### Primary Issue: Missing Duplicate Prevention in Database Layer
**File:** `lib/db/repositories/articles/articles-core.repository.ts`
**Method:** `createArticle()` (line 175)

```typescript
// PROBLEM: Direct insertion without duplicate check
const result = await this.db.insert(articles).values(articleData).returning();
```

**Impact:** The database layer accepts ANY article data without checking if the `sourceUrl` already exists.

### Secondary Issue: Race Condition in Backfill Process
**File:** `scripts/backfill-day.ts`
**Process:** Backfill script calls `checkDuplicates()` but ingestion service ignores results

**Evidence:** All duplicates created within 0.6-0.9 minutes of each other, indicating rapid parallel processing

### Tertiary Issue: Missing Database Constraints
**Table:** `articles`
**Missing:** `UNIQUE(source_url)` constraint allows database to accept duplicate URLs

## Specific Evidence

### Duplicate Pattern Analysis
| URL | Total Copies | Deletion Count | Time Spread |
|-----|--------------|----------------|-------------|
| deadline.com/another-world... | 8 | 7 | 0.8 min |
| insight.scmagazineuk.com... | 8 | 7 | 0.6 min |
| thenextweb.com/europes-top... | 8 | 7 | 0.9 min |
| benzinga.com/openai-to-almost... | 8 | 7 | 0.9 min |

### Recent Articles Impact
**All 4 most recent articles are duplicates:**
1. "European VC Focuses..." → ❌ DUPLICATE (will be deleted)
2. "Wayfound AI CEO..." → ❌ DUPLICATE (will be deleted)
3. "European VC Shifts..." → ❌ DUPLICATE (will be deleted)
4. "European VC Shifts..." → ❌ DUPLICATE (will be deleted)

## Technical Solution Required

### 1. Database Schema Fix
```sql
ALTER TABLE articles ADD CONSTRAINT unique_source_url UNIQUE(source_url);
```

### 2. Application Logic Fix
Add duplicate check in `createArticle()` before insertion:
```typescript
if (articleData.sourceUrl) {
  const existing = await this.db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.sourceUrl, articleData.sourceUrl))
    .limit(1);

  if (existing.length > 0) {
    throw new Error(`Duplicate URL: ${articleData.sourceUrl}`);
  }
}
```

### 3. Immediate Cleanup Required
```sql
-- Remove 72 duplicate articles (keep earliest per URL)
DELETE FROM articles WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY source_url ORDER BY created_at ASC) as rn
    FROM articles WHERE source_url IS NOT NULL
  ) ranked WHERE rn > 1
);
```

## Quality Impact Assessment

### User Experience Impact
- ✅ **CONFIRMED:** Users seeing duplicate articles in news feed
- ✅ **CONFIRMED:** Recent content showing multiple copies of same stories
- ❌ **HIGH IMPACT:** Poor content curation perception

### Database Performance Impact
- 72 unnecessary rows (15.5% bloat)
- Increased query processing time
- Reduced index efficiency

### Content Quality Impact
- Duplicate content diluting unique article discovery
- Skewed engagement metrics due to duplicate views
- Potential ranking algorithm confusion

## Recommended Actions

### IMMEDIATE (< 1 hour)
1. ✅ Database backup completed
2. ❌ **PENDING:** Execute duplicate cleanup script
3. ❌ **PENDING:** Add unique constraint to prevent future duplicates

### SHORT TERM (< 1 day)
1. ❌ **PENDING:** Fix `createArticle()` method duplicate checking
2. ❌ **PENDING:** Update backfill process error handling
3. ❌ **PENDING:** Add monitoring for duplicate detection

### LONG TERM (< 1 week)
1. ❌ **PENDING:** Implement content similarity checking
2. ❌ **PENDING:** Add automated duplicate monitoring alerts
3. ❌ **PENDING:** Review and strengthen ingestion pipeline

## Final Verification Commands

### Before Cleanup
```bash
# Should show 72 duplicates to delete
npx tsx verify-duplicate-cleanup.ts
```

### After Cleanup
```bash
# Should show 0 duplicates
npx tsx verify-duplicate-cleanup.ts
```

### Ongoing Monitoring
```sql
-- Daily check - should return 0
SELECT COUNT(*) FROM (
  SELECT source_url FROM articles
  WHERE source_url IS NOT NULL
  GROUP BY source_url HAVING COUNT(*) > 1
) duplicates;
```

## Conclusion

✅ **Investigation Complete:** User report confirmed - all recent articles are duplicates
🚨 **Severity:** HIGH - 72 duplicate articles affecting user experience
🔧 **Root Cause:** Missing duplicate prevention at database insertion level
⚡ **Action Required:** Immediate cleanup + application fixes to prevent recurrence

**QA Recommendation:** BLOCK production deployments until duplicate prevention is implemented and cleanup is completed.

---
**Signed:** QA Engineer
**Date:** March 28, 2026
**Status:** Investigation Complete - Ready for Remediation