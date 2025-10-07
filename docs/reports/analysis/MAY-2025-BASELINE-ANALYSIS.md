# May 2025 Baseline Snapshot Analysis

**Date:** October 1, 2025
**Purpose:** Prepare for creating a May 2025 baseline snapshot
**Analysis Tool:** `scripts/analyze-baseline-state.ts`

---

## Executive Summary

**Current State:**
- ✅ 54 active tools in database
- ❌ 0 tools have baseline scores initialized
- ✅ 79 active articles in database
- ⚠️ 11 articles from May 2025 or earlier
- ✅ 68 articles from June 2025 onwards
- ❌ ranking_versions table does not exist (needs migration)
- ✅ Scoring columns exist in tools table

**Critical Finding:** The baseline scoring infrastructure exists (columns in database), but **no baseline scores have been initialized yet**. This presents an opportunity to establish a clean May 2025 baseline from scratch.

---

## 1. Current Tool Scores State

### Database Status
```
Total Active Tools: 54
Tools with baseline score: 0
Tools with delta score: 0
Tools with current score: 0
```

### Scoring Column Structure
✅ All required scoring columns exist in `tools` table:
- `baseline_score` (JSONB)
- `delta_score` (JSONB)
- `current_score` (JSONB)
- `score_updated_at` (TIMESTAMP)

### Sample Tools (All Uninitialized)
1. Devin - Baseline: {}, Delta: {}, Current: {}
2. Claude Code - Baseline: {}, Delta: {}, Current: {}
3. Bolt.new - Baseline: {}, Delta: {}, Current: {}
4. Cline - Baseline: {}, Delta: {}, Current: {}
5. Continue - Baseline: {}, Delta: {}, Current: {}

### Score Ranges
All scores are currently 0.00 (uninitialized):
- Baseline: min=0.00, max=0.00, avg=0.00
- Delta: min=0.00, max=0.00, avg=0.00
- Current: min=0.00, max=0.00, avg=0.00

---

## 2. Article History Analysis

### Overall Statistics
```
Total Active Articles: 79
Articles May 2025 or earlier: 11 (14%)
Articles June 2025 or later: 68 (86%)
Articles without date: 0
Date Range: 2023-04-15 to 2025-10-01
```

### Articles by Month
```
2023-04: 9 articles
2024-08: 2 articles
2025-08: 2 articles
2025-09: 65 articles
2025-10: 1 article
```

### Article Timeline Breakdown

**May 2025 or Earlier (11 articles):**
- 2023-04: 9 articles
- 2024-08: 2 articles

**June 2025 or Later (68 articles):**
- 2025-08: 2 articles
- 2025-09: 65 articles
- 2025-10: 1 article

### Sample Recent Articles
Most recent articles are from September-October 2025:
1. "OpenAI announces major GPT-4 improvements..." (2025-10-01)
2. "Cache Test Article: AI Tools Performance Study" (2025-09-18)
3. "Revolutionary AI Update: Advanced Coding Tools..." (2025-09-18)
4. "AI Coding Tools Market Intelligence Report..." (2025-09-18)
5. "AI Tools Global Analysis" (2025-09-17)

### Tool Mentions Analysis
Many articles have 0 tool mentions in the current data, suggesting:
- Tool extraction may need to be rerun
- Articles were ingested but not fully processed
- Tool mention detection needs improvement

---

## 3. Baseline Infrastructure Status

### Missing Components

❌ **ranking_versions Table Does Not Exist**
- Table is defined in `article-schema.ts`
- Migration file exists but may not have been applied
- Required for versioned baseline snapshots
- **Action Required:** Create and apply migration

### Existing Components

✅ **Scoring Columns in Tools Table**
- All 4 required columns present
- Migration `0003_add_scoring_columns.sql` applied successfully

✅ **Article Processing Infrastructure**
- `articles` table exists
- `article_rankings_changes` table exists
- `article_processing_logs` table exists

---

## 4. Data Quality Issues

### Critical Issues
1. **No Baseline Scores Initialized**
   - Impact: Cannot calculate baseline + delta
   - Severity: HIGH
   - Fix: Run `initialize-baseline-scores.ts`

2. **Missing ranking_versions Table**
   - Impact: Cannot create versioned snapshots
   - Severity: HIGH
   - Fix: Generate and apply migration

### Minor Issues
1. **Old Articles from 2023-2024**
   - 11 articles from before May 2025
   - May need special handling for baseline

2. **Tool Mentions Not Extracted**
   - Many articles show 0 tool mentions
   - May need reprocessing

---

## 5. Recommended Approach

### Option A: Clean Slate Baseline (RECOMMENDED)

This approach takes advantage of the fact that no baseline scores exist yet.

**Steps:**
1. **Initialize Tools from JSON Data**
   - Load current tool data from `/data/json/tools/`
   - Extract existing scores from tool JSON files
   - Set these as baseline scores (May 2025 baseline)

2. **Create Ranking Versions Table**
   - Generate migration for `ranking_versions`
   - Apply migration to database

3. **Create May 2025 Baseline Snapshot**
   - Version: "baseline-may-2025"
   - Date: 2025-05-31
   - Store complete snapshot of all tool scores
   - Mark as baseline version

4. **Reset Delta Scores**
   - Set all delta scores to empty `{}`
   - Clear any temporary modifications

5. **Re-process Articles by Date**
   - Articles before June 2025: Incorporate into baseline (optional)
   - Articles June 2025+: Apply as delta modifications
   - Track changes in `article_rankings_changes`

**Advantages:**
- Clean separation of baseline vs delta
- Clear audit trail of when baseline was set
- Easy to rollback or recreate

**Timeline:** 2-3 hours implementation

---

### Option B: Snapshot Current State

Simpler approach if current tool data represents May 2025 state.

**Steps:**
1. Run `initialize-baseline-scores.ts` to populate from tool data
2. Create ranking_versions migration
3. Snapshot current baseline as "baseline-may-2025"
4. Future articles add delta modifications

**Advantages:**
- Faster implementation
- Assumes current data is correct

**Disadvantages:**
- No separation of pre-June and post-June articles
- May include unintended modifications in baseline

**Timeline:** 1-2 hours implementation

---

## 6. Implementation Plan

### Phase 1: Infrastructure Setup (30 minutes)

1. **Create ranking_versions migration**
   ```bash
   npm run db:generate
   # Review generated migration
   npm run db:migrate
   ```

2. **Verify table creation**
   ```bash
   npx tsx scripts/check-article-tables.ts
   ```

### Phase 2: Initialize Baseline Scores (30 minutes)

1. **Understand current tool data structure**
   - Check `/data/json/tools/` for score format
   - Verify `factorScores` and `score` fields exist

2. **Run initialization script**
   ```bash
   npx tsx scripts/initialize-baseline-scores.ts
   ```

3. **Verify initialization**
   ```bash
   npx tsx scripts/analyze-baseline-state.ts
   ```
   Expected: 54 tools with baseline scores

### Phase 3: Create May 2025 Baseline Snapshot (1 hour)

1. **Create snapshot script**: `scripts/create-baseline-snapshot.ts`
   - Query all tools with their baseline scores
   - Create ranking_versions entry: "baseline-may-2025"
   - Store complete rankings snapshot
   - Set date: 2025-05-31

2. **Run snapshot creation**
   ```bash
   npx tsx scripts/create-baseline-snapshot.ts
   ```

3. **Verify snapshot**
   - Check ranking_versions table has new entry
   - Verify snapshot contains all 54 tools
   - Confirm baseline scores match tool data

### Phase 4: Incremental Updates (1 hour)

1. **Identify June+ articles**
   - Query articles with publishedDate >= 2025-06-01
   - Should be 68 articles

2. **Apply articles as delta modifications**
   - For each June+ article:
     - Extract tool mentions
     - Calculate impact on scores
     - Update delta scores (not baseline)
     - Record in article_rankings_changes

3. **Recalculate current scores**
   - For each tool: current = baseline + delta
   - Update score_updated_at timestamps

---

## 7. Next Steps

### Immediate Actions

1. ✅ **Run Analysis Script** (COMPLETED)
   ```bash
   npx tsx scripts/analyze-baseline-state.ts
   ```

2. **Create ranking_versions Migration**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

3. **Initialize Baseline Scores**
   ```bash
   npx tsx scripts/initialize-baseline-scores.ts
   ```

4. **Create Baseline Snapshot Script**
   - File: `scripts/create-baseline-snapshot.ts`
   - Version: "baseline-may-2025"
   - Date: 2025-05-31

5. **Test Snapshot Creation**
   - Verify ranking_versions entry created
   - Verify snapshot data is complete

### Follow-up Actions

1. **Document Baseline Methodology**
   - When baseline was created
   - What data was included
   - How to recreate if needed

2. **Implement Article Reprocessing**
   - Script to apply June+ articles as deltas
   - Verification of score calculations

3. **Create Admin UI for Baseline Management**
   - View baseline versions
   - Compare baselines
   - Rollback to previous baseline

---

## 8. Risk Assessment

### High Risk Items
1. **No baseline means no ranking history** - CRITICAL
   - Mitigation: Create baseline ASAP
   - Impact: Cannot show ranking changes

2. **Article tool mentions may be incomplete**
   - Mitigation: Reprocess articles to extract mentions
   - Impact: Inaccurate scoring

### Medium Risk Items
1. **Old articles (2023-2024) handling unclear**
   - Mitigation: Decide if they should affect baseline
   - Impact: Baseline accuracy

2. **Migration may need schema adjustments**
   - Mitigation: Review generated migration before applying
   - Impact: Schema inconsistencies

### Low Risk Items
1. **Score calculation performance**
   - Mitigation: Use batch updates
   - Impact: Slower processing

---

## 9. Success Criteria

### Must Have
- ✅ ranking_versions table created
- ✅ All 54 tools have baseline scores initialized
- ✅ "baseline-may-2025" snapshot exists in ranking_versions
- ✅ Snapshot contains complete ranking data
- ✅ Delta scores reset to empty {}

### Should Have
- ✅ 68 June+ articles applied as delta modifications
- ✅ article_rankings_changes records created
- ✅ Current scores = baseline + delta for all tools
- ✅ Documentation of baseline methodology

### Nice to Have
- ⭕ Tool mentions reprocessed for all articles
- ⭕ Admin UI for baseline management
- ⭕ Automated tests for baseline + delta calculations

---

## 10. Files Created

1. **scripts/analyze-baseline-state.ts** - Analysis script (CREATED)
   - Queries current tool scores
   - Analyzes article history
   - Checks infrastructure
   - Provides recommendations

2. **MAY-2025-BASELINE-ANALYSIS.md** - This document (CREATED)
   - Comprehensive analysis report
   - Implementation plan
   - Risk assessment

### Files to Create

3. **scripts/create-baseline-snapshot.ts** - Snapshot creation
4. **scripts/apply-incremental-articles.ts** - Apply June+ articles
5. **docs/BASELINE-METHODOLOGY.md** - Documentation
6. **lib/db/migrations/0004_add_ranking_versions.sql** - Migration

---

## Appendix A: Database Schema Reference

### Tools Table Scoring Fields
```sql
baseline_score JSONB DEFAULT '{}'
delta_score JSONB DEFAULT '{}'
current_score JSONB DEFAULT '{}'
score_updated_at TIMESTAMP
```

### Ranking Versions Table (Defined but Not Migrated)
```typescript
{
  id: UUID
  version: VARCHAR(50) UNIQUE  // "baseline-may-2025"
  articleId: UUID (optional)
  rankingsSnapshot: JSONB
  changesSummary: TEXT
  newsItemsCount: INTEGER
  toolsAffected: INTEGER
  previousVersionId: UUID
  createdBy: VARCHAR(255)
  createdAt: TIMESTAMP
  isRollback: BOOLEAN
  rolledBackFromId: UUID
}
```

### Score Factor Structure
```typescript
interface ToolScoreFactors {
  marketTraction?: number;
  technicalCapability?: number;
  developerAdoption?: number;
  developmentVelocity?: number;
  platformResilience?: number;
  communitySentiment?: number;
  overallScore?: number;
}
```

---

## Appendix B: Key Services

### ToolScoringService
Located: `lib/services/tool-scoring.service.ts`

Key methods:
- `calculateCurrentScore(baseline, delta)` - Calculates current from baseline + delta
- `updateBaselineScore(toolId, baseline)` - Updates baseline only
- `updateDeltaScore(toolId, delta)` - Updates delta only (preserves baseline)
- `initializeBaselinesFromCurrent()` - One-time initialization
- `recalculateAllScores()` - Recalculate current = baseline + delta

### Article Ingestion Service
Located: `lib/services/article-ingestion.service.ts`

Handles:
- Article content extraction
- Tool mention detection
- Score impact calculation
- Delta modification (NOT baseline changes)

---

## Conclusion

The system is well-architected for baseline + delta scoring, but **no baseline has been initialized yet**. This is actually a good starting point because we can establish a clean May 2025 baseline without having to reverse-engineer or adjust existing scores.

**Recommended Next Action:** Create the `ranking_versions` migration, then initialize baseline scores from current tool data, marking this as the official "May 2025 Baseline".

**Estimated Total Time:** 3-4 hours for complete implementation.
