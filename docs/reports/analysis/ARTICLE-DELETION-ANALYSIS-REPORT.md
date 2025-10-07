# Article Deletion Analysis Report

**Date:** 2025-10-03
**Database:** Development (ep-dark-firefly-adp1p3v8)
**Purpose:** Identify all articles to be deleted (0 tool mentions + test articles)

---

## Executive Summary

- **Total Articles:** 296
- **Articles with 0 Tool Mentions:** 69 (23.3%)
- **Test Articles by Patterns:** ~2
- **Recommended Deletion Count:** **69 articles**
- **Impact:** No ranking changes to cascade delete (0 dependent records)
- **Remaining After Deletion:** 227 articles (76.7% retention)

---

## 1. Articles with 0 Tool Mentions

### Query to Identify

```sql
SELECT id, slug, title, author, published_date, source_name
FROM articles
WHERE tool_mentions = '[]'::jsonb OR tool_mentions IS NULL;
```

### Count

**69 articles** have empty tool_mentions arrays.

### Sample Articles (First 5)

1. **"AI prompt engineering in 2025: What works and what doesn't"**
   - Slug: `ai-prompt-engineering-in-2025-what-works-and-what-doesn-t`
   - Author: Unknown
   - Source: Lenny's Newsletter
   - Published: 2025-06-19
   - ID: `eafa6455-f454-45d9-a2aa-fb2ccc754cdb`

2. **"Why I Built My Own Multi-Agent Framework"**
   - Slug: `why-i-built-my-own-multi-agent-framework`
   - Author: Unknown
   - Source: HyperDev by Masa Matsuoka
   - Published: 2025-07-21
   - ID: `b3552424-bd24-4b3d-9d4b-2a45b23b6fb9`

3. **"Claude's Growing Pains"**
   - Slug: `claude-s-growing-pains`
   - Author: Unknown
   - Source: hyperdev.substack.com
   - Published: 2025-07-19
   - ID: `37b9860a-347f-4c08-9344-2c04a3f6d385`

4. **"Bolt rolls out Family ride feature in Nigeria"**
   - Slug: `bolt-rolls-out-family-ride-feature-in-nigeria`
   - Author: Unknown
   - Source: Techpoint Africa
   - Published: 2025-07-18
   - ID: `bce724a2-5b9a-4cd1-9e78-6d0785e5ba94`

5. **"How bolttech boosted sales efficiency and revenue with AI"**
   - Slug: `how-bolttech-boosted-sales-efficiency-and-revenue-with-ai`
   - Author: Unknown
   - Source: bolttech
   - Published: 2025-07-18
   - ID: `c4ea9f2d-a936-4cab-b17b-d378bffaf006`

### Why Delete These?

Articles with 0 tool mentions:
- Provide no value for AI tool ranking calculations
- Do not contribute to any tool's score
- Are irrelevant to the core purpose of AI Power Ranking
- Examples: Articles about ride-sharing apps, fashion AI, generic AI discussions

---

## 2. Test Articles Detection

### Detection Methods

#### 2.1 Test Author Names
**Query:**
```sql
SELECT COUNT(*) FROM articles
WHERE LOWER(author) LIKE ANY(ARRAY[
  '%field length test%',
  '%qa tester%',
  '%test reporter%',
  '%ai reporter%',
  '%john doe%',
  '%jane doe%',
  '%test author%',
  '%demo author%'
]);
```

**Result:** 0 articles (no test authors found)

#### 2.2 Test Title Patterns
**Query:**
```sql
SELECT COUNT(*) FROM articles
WHERE title ~* '^(No article|Generic AI|Pre-analyzed|Test Article|Breaking News: Claude Code|GitHub Copilot revolutionizes|Multiple AI Tools|AI Code Assistant|Sample Article|Demo:|\[TEST\]|\[DEMO\])';
```

**Result:** 2 articles

#### 2.3 Short Content (<500 chars)
**Query:**
```sql
SELECT COUNT(*) FROM articles
WHERE LENGTH(content) < 500;
```

**Result:** 267 articles (includes many legitimate articles)

#### 2.4 Known Test IDs
Test article IDs from previous cleanup attempts:
```typescript
const knownTestIds = [
  '3b1d9f14-b95f-435e-ac67-f11b13033281',
  '550c2646-b1f5-4e2a-aedb-a9d978746827',
  'dc2f72a3-0232-407d-917e-c3c7a9fef3bd',
  '6574a193-cfc1-421e-b1ce-f67f327ff5c4',
];
```

**Result:** 0 articles (already deleted in previous cleanup)

#### 2.5 Duplicate Titles
**Query:**
```sql
SELECT LOWER(TRIM(title)) as title_key, COUNT(*) as cnt
FROM articles
GROUP BY LOWER(TRIM(title))
HAVING COUNT(*) > 1;
```

**Result:** 0 duplicate groups

---

## 3. Overlap Analysis

### Empty Tool Mentions + Test Patterns

| Combination | Count |
|------------|-------|
| Empty tool_mentions + Test authors | 0 |
| Empty tool_mentions + Short content | 60 |

**Insight:** 60 out of 69 empty articles also have short content, suggesting they may be low-quality or incomplete ingestions.

---

## 4. Database Schema

### Articles Table Structure

```sql
-- Key columns for test detection
id               uuid        NOT NULL  DEFAULT gen_random_uuid()
tool_mentions    jsonb       NULL      DEFAULT '[]'::jsonb
status           varchar     NULL      DEFAULT 'active'::varchar
is_processed     boolean     NULL      DEFAULT false
```

### Test-Related Columns

**Result:** No test-related flag columns found (no `isTest`, `testFlag`, etc.)

**Implication:** Test articles must be identified by content patterns, not database flags.

---

## 5. Foreign Key Dependencies

### article_rankings_changes Table

**Foreign Key Constraint:**
```sql
FOREIGN KEY (article_id)
REFERENCES articles(id)
ON DELETE CASCADE
```

**Impact Analysis:**
```sql
SELECT COUNT(*) FROM article_rankings_changes
WHERE article_id IN (
  SELECT id FROM articles
  WHERE tool_mentions = '[]'::jsonb OR tool_mentions IS NULL
);
```

**Result:** 0 ranking changes

**Conclusion:** Deleting the 69 articles will NOT affect any ranking data (no cascade deletions needed).

---

## 6. Existing Cleanup Scripts

### Available Scripts

1. **`scripts/cleanup-test-articles.ts`**
   - Pattern-based test article detection
   - Uses known test IDs, title patterns, tool mentions
   - Supports `--dry-run` and `--auto-confirm` flags
   - Already used in previous cleanup (test articles removed)

2. **`scripts/cleanup-remaining-test-articles.ts`**
   - Enhanced test detection with author patterns
   - Duplicate detection by title
   - Placeholder content detection
   - Creates audit log

3. **`scripts/check-empty-tool-mentions.ts`**
   - Queries articles with empty tool_mentions
   - Limited to 10 samples
   - Checks backup file for comparison

### Script Usage Patterns

```typescript
// Pattern matching from cleanup-test-articles.ts
const TEST_PATTERNS = {
  titles: [
    /test/i,
    /demo/i,
    /sample/i,
    /placeholder/i,
    /Show HN:/i,
    /Octofriend/i,
  ],
  toolMentions: ['test-tool', 'demo-tool', 'sample-tool'],
  slugs: [/^news-test/i, /^news-demo/i],
};
```

### Reusability

**Can we reuse existing scripts?**
- ❌ `cleanup-test-articles.ts` - Already used, test articles removed
- ❌ `cleanup-remaining-test-articles.ts` - Focuses on test patterns, not empty tool_mentions
- ⚠️  `check-empty-tool-mentions.ts` - Only checks, doesn't delete

**Recommendation:** Create new deletion script specifically for empty tool_mentions.

---

## 7. SQL Queries for Deletion

### 7.1 Identify Articles to Delete

```sql
-- Get all articles with empty tool_mentions
SELECT
  id,
  slug,
  title,
  author,
  source_name,
  published_date,
  LENGTH(content) as content_length,
  jsonb_array_length(tool_mentions) as tool_count
FROM articles
WHERE tool_mentions = '[]'::jsonb OR tool_mentions IS NULL
ORDER BY published_date DESC;
```

### 7.2 Delete Query (Production)

```sql
-- Delete articles with empty tool_mentions
DELETE FROM articles
WHERE tool_mentions = '[]'::jsonb OR tool_mentions IS NULL
RETURNING id, slug, title;
```

### 7.3 Safe Deletion with Transaction

```sql
BEGIN;

-- Create backup of articles to be deleted
CREATE TEMP TABLE deleted_articles_backup AS
SELECT * FROM articles
WHERE tool_mentions = '[]'::jsonb OR tool_mentions IS NULL;

-- Perform deletion
DELETE FROM articles
WHERE tool_mentions = '[]'::jsonb OR tool_mentions IS NULL;

-- Verify count
SELECT
  (SELECT COUNT(*) FROM deleted_articles_backup) as deleted_count,
  (SELECT COUNT(*) FROM articles) as remaining_count;

-- If satisfied, commit. Otherwise, ROLLBACK
COMMIT;
-- ROLLBACK;
```

---

## 8. Recommended Deletion Approach

### Step-by-Step Process

#### Phase 1: Preparation
1. **Backup database** (if not already done)
2. **Run analysis script** to verify counts:
   ```bash
   tsx scripts/analyze-articles-to-delete.ts
   ```
3. **Export deletion list** for audit trail

#### Phase 2: Dry Run
1. Create deletion script with `--dry-run` flag
2. Review list of articles to be deleted
3. Verify no critical articles in deletion list

#### Phase 3: Execution
1. **Run deletion in transaction**
2. **Verify counts** before committing
3. **Create audit log** with deleted article IDs
4. **Commit transaction** if verified

#### Phase 4: Verification
1. Check remaining article count (should be 227)
2. Verify no broken references
3. Test article listing API
4. Verify ranking calculations still work

### Recommended Script Structure

```typescript
// scripts/delete-empty-tool-mention-articles.ts
async function deleteEmptyToolMentionArticles(options: {
  dryRun: boolean;
  autoConfirm: boolean;
}) {
  // 1. Query articles with empty tool_mentions
  const articlesToDelete = await db
    .select()
    .from(articles)
    .where(sql`${articles.toolMentions} = '[]'::jsonb OR ${articles.toolMentions} IS NULL`);

  console.log(`Found ${articlesToDelete.length} articles to delete`);

  // 2. Display sample for review
  articlesToDelete.slice(0, 10).forEach((article, i) => {
    console.log(`${i + 1}. ${article.title}`);
  });

  if (options.dryRun) {
    console.log("DRY RUN - No changes made");
    return;
  }

  // 3. Confirm deletion
  if (!options.autoConfirm) {
    const confirmed = await promptConfirmation("Delete these articles?");
    if (!confirmed) return;
  }

  // 4. Delete in transaction
  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(articles)
      .where(sql`${articles.toolMentions} = '[]'::jsonb OR ${articles.toolMentions} IS NULL`)
      .returning({ id: articles.id, title: articles.title });

    console.log(`Deleted ${deleted.length} articles`);
  });

  // 5. Verify
  const remaining = await db.select({ count: count() }).from(articles);
  console.log(`Remaining articles: ${remaining[0].count}`);
}
```

---

## 9. Constraints and Dependencies

### Foreign Key Constraints

| Table | Column | Constraint | Action |
|-------|--------|-----------|--------|
| article_rankings_changes | article_id | FOREIGN KEY → articles(id) | ON DELETE CASCADE |

**Impact:** No ranking changes reference the 69 empty articles, so CASCADE will have no effect.

### Index Considerations

Articles table has GIN index on `tool_mentions`:
```sql
CREATE INDEX idx_articles_tool_mentions ON articles USING gin (tool_mentions);
```

**Impact:** Deletion will update the index automatically (no manual intervention needed).

---

## 10. Risk Assessment

### Low Risk ✅
- **No ranking data affected** (0 cascade deletes)
- **Clear deletion criteria** (empty tool_mentions)
- **Significant reduction** (23.3% of articles)
- **High-quality retention** (articles with tool mentions remain)

### Medium Risk ⚠️
- **No backup verification** (articles already in backup with 0 tool_mentions)
- **Manual verification needed** for sample articles

### Mitigation Strategies
1. **Dry-run mode** first to review deletion list
2. **Transaction-based deletion** with rollback capability
3. **Audit log creation** before deletion
4. **Manual review** of 10-20 sample articles

---

## 11. Summary and Recommendation

### Deletion Target

**Primary:** 69 articles with empty tool_mentions arrays

### Method

1. Use existing pattern: Similar to `cleanup-test-articles.ts`
2. Create new script: `scripts/delete-empty-tool-mention-articles.ts`
3. Support dry-run and auto-confirm flags

### SQL Query

```sql
DELETE FROM articles
WHERE tool_mentions = '[]'::jsonb OR tool_mentions IS NULL;
```

### Expected Outcome

- **Before:** 296 articles
- **Deleted:** 69 articles (23.3%)
- **After:** 227 articles (76.7%)
- **Cascade deletes:** 0 ranking changes

### Next Steps

1. **Review this report** and approve deletion approach
2. **Run dry-run** with sample output for manual verification
3. **Execute deletion** in development environment first
4. **Verify results** before production deployment
5. **Update documentation** with deletion audit log

---

## Appendix A: Full SQL Queries

### A.1 Count Empty Tool Mentions
```sql
SELECT COUNT(*) as empty_articles
FROM articles
WHERE tool_mentions = '[]'::jsonb OR tool_mentions IS NULL;
```

### A.2 Sample Empty Articles
```sql
SELECT id, slug, title, author, source_name, published_date
FROM articles
WHERE tool_mentions = '[]'::jsonb OR tool_mentions IS NULL
ORDER BY published_date DESC
LIMIT 20;
```

### A.3 Verify No Dependencies
```sql
SELECT
  a.id,
  a.title,
  COUNT(arc.id) as ranking_changes_count
FROM articles a
LEFT JOIN article_rankings_changes arc ON a.id = arc.article_id
WHERE a.tool_mentions = '[]'::jsonb OR a.tool_mentions IS NULL
GROUP BY a.id, a.title
HAVING COUNT(arc.id) > 0;
```

### A.4 Delete with Audit
```sql
-- Create audit table
CREATE TABLE IF NOT EXISTS deleted_articles_audit (
  deleted_at timestamp DEFAULT now(),
  article_id uuid,
  slug text,
  title text,
  reason text
);

-- Insert into audit before deletion
INSERT INTO deleted_articles_audit (article_id, slug, title, reason)
SELECT id, slug, title, 'Empty tool_mentions array'
FROM articles
WHERE tool_mentions = '[]'::jsonb OR tool_mentions IS NULL;

-- Perform deletion
DELETE FROM articles
WHERE tool_mentions = '[]'::jsonb OR tool_mentions IS NULL;
```

---

**Report Generated:** 2025-10-03
**Script Used:** `scripts/analyze-articles-to-delete.ts`
**Database:** Development (ep-dark-firefly-adp1p3v8)
