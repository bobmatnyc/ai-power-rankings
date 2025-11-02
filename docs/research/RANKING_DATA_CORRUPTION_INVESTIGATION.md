# Ranking Data Corruption Investigation Report

**Date:** October 31, 2025
**Period Affected:** October 2025 (2025-10)
**Algorithm Version:** v7.2
**Severity:** CRITICAL - 72.5% of tools affected

---

## Executive Summary

A critical data quality issue has been discovered in the October 2025 production rankings. **37 out of 51 tools (72.5%) have identical scores**, grouped into 12 duplicate score clusters. This is not a database corruption issue but rather a **systematic algorithm failure** caused by insufficient discriminating metrics.

### Critical Impact

- **Google Jules, Refact.ai, and Devin** all share identical scores (60.0) and rank #1, #2, #3
- **11 additional duplicate groups** affect ranks throughout the entire ranking
- Rankings are essentially **arbitrary** within each duplicate group
- User trust in ranking accuracy is **severely compromised**

---

## Root Cause Analysis

### 1. Missing Metrics Data

**Data Availability Statistics:**
- Only **7.8%** of tools have any metrics data
- **0%** of tools have SWE-bench scores (primary agentic capability metric)
- **0%** of tools have news mentions data
- **0%** of tools have GitHub stars/activity data

**What This Means:**
The ranking algorithm v7.2 was designed to use rich quantitative metrics, but these metrics are **completely absent** from the production database.

### 2. Algorithm Relies on Defaults

With no metrics available, the algorithm falls back to:

1. **Category bonuses** - Fixed points based on tool category
2. **Feature count** - Number of features listed (limited variation)
3. **Base scores** - Default values when no data exists

**Example: The Three Top-Ranked Tools**

All three tools (Google Jules, Refact.ai, Devin) have:
- Category: `autonomous-agent` → +20 agentic bonus → 70 score
- Features: 18 features → 30 + (18 × 5) = 120, capped at 100
- No metrics: All factors use defaults
- **Result: Identical 60.0 overall score**

### 3. Low Data Diversity

**Feature Count Distribution:**
- 10 unique feature counts across 51 tools
- 7 tools have exactly 18 features
- 9 tools have exactly 14 features
- Many tools cluster at same feature counts

**Category Distribution:**
- 11 tools in `ide-assistant` (21.6%)
- 10 tools in `autonomous-agent` (19.6%)
- Tools in same category + same feature count → **identical scores**

---

## Affected Tools Analysis

### Duplicate Group #1: Top 3 Tools (Score: 60.0)
- **google-jules** (Google Jules) - Rank #1
- **refact-ai** (Refact.ai) - Rank #2
- **devin** (Devin) - Rank #3

**Why identical:**
- All in `autonomous-agent` category
- All have 18 features
- None have metrics data
- Algorithm cannot differentiate

### Duplicate Group #2: Claude Code & Warp (Score: 59.0)
- **claude-code** - Rank #4
- **warp** - Rank #5

### Duplicate Group #3: Cursor & Windsurf (Score: 56.3)
- **cursor** - Rank #8
- **windsurf** - Rank #9

### Duplicate Group #4: Replit, Amazon Q, GitHub Copilot (Score: 55.3)
- **replit-agent** - Rank #11
- **amazon-q-developer** - Rank #12
- **github-copilot** - Rank #13

**[Additional 8 groups documented in investigation output]**

---

## Investigation Scripts Created

The following diagnostic scripts were created during investigation:

1. **`scripts/investigate-duplicate-scores.ts`**
   - Checks specific tools for duplicate scores in database
   - Confirms data corruption extent

2. **`scripts/check-source-data.ts`**
   - Examines raw tool data structure
   - Identifies missing metrics fields

3. **`scripts/test-ranking-calculation.ts`**
   - Reproduces scoring for affected tools
   - Demonstrates algorithm behavior with missing data

4. **`scripts/find-all-duplicate-scores.ts`**
   - Scans entire October rankings for duplicates
   - Identified 12 duplicate groups affecting 37 tools

5. **`scripts/analyze-available-metrics.ts`**
   - Analyzes data availability across all tools
   - Reveals 0% metrics coverage

---

## Previous Jules Fix Context

This issue is **unrelated** to the previous Jules duplicate fix:

- **Jules Fix (Previous):** Removed duplicate tool entry in database
  - Old `jules` entry marked as redirect
  - New `google-jules` entry kept as canonical
  - Successfully resolved tool duplication

- **Current Issue (New):** Algorithm produces identical scores
  - No database duplication
  - Tools have unique IDs and data
  - Problem is in scoring logic with missing metrics

---

## Why Rankings Were Generated This Way

The October 2025 rankings were generated using `scripts/generate-v72-rankings.ts`, which:

1. Loads all active tools from database
2. Calculates scores using Algorithm v7.2
3. Sorts by score and assigns ranks
4. **Does not validate** score uniqueness
5. **Does not detect** insufficient data

The script completed successfully because:
- No errors occurred (algorithm has defaults)
- Scores were calculated (just not unique)
- Rankings were created (just not meaningful)

---

## Impact Assessment

### Ranking Accuracy
- **Severely Compromised**: 72.5% of tools have non-unique scores
- **Top Rankings Arbitrary**: #1, #2, #3 are essentially tied
- **User Trust Damaged**: Rankings appear random within groups

### Business Impact
- Rankings cannot be used for decision-making
- API responses contain misleading data
- Brand reputation risk if publicized

### Technical Debt
- Algorithm v7.2 requires complete metrics infrastructure
- Current data model insufficient for algorithm requirements
- Need either: (a) collect metrics or (b) redesign algorithm

---

## Recommended Solutions

### Option 1: Collect Required Metrics (RECOMMENDED)
**Effort:** High | **Timeline:** 2-3 weeks | **Impact:** Solves root cause

1. **Implement metrics collection pipeline:**
   - GitHub API integration (stars, commits, activity)
   - SWE-bench score lookup/calculation
   - News monitoring for mention counts
   - Website traffic estimation (if possible)

2. **Backfill metrics for all tools:**
   - Research and populate SWE-bench scores
   - Query GitHub data for open-source tools
   - Historical news mention counts
   - Manual research for key tools

3. **Regenerate rankings with real data:**
   - Run v7.2 algorithm with complete metrics
   - Validate score distribution and uniqueness
   - Deploy to production

**Pros:**
- Solves problem permanently
- Rankings become data-driven and defensible
- Algorithm v7.2 works as designed

**Cons:**
- Significant development effort
- Ongoing maintenance required
- Some data may be unavailable

---

### Option 2: Redesign Algorithm for Available Data
**Effort:** Medium | **Timeline:** 1 week | **Impact:** Workaround

1. **Create Algorithm v7.3 that works with current data:**
   - Remove dependencies on unavailable metrics
   - Use qualitative factors (pricing model, target audience, etc.)
   - Add randomization/tiebreaker for similar scores
   - Increase weight on available differentiators

2. **Enhance feature-based scoring:**
   - More granular feature categorization
   - Feature quality assessment (not just count)
   - Unique capability identification

3. **Add manual override capability:**
   - Allow editorial rankings for ties
   - Expert judgment for top tools
   - Documented reasoning for overrides

**Pros:**
- Fast deployment
- Works with existing data
- Can improve iteratively

**Cons:**
- Less rigorous/objective
- May still have some ties
- Requires ongoing manual work

---

### Option 3: Hybrid Approach (BEST BALANCE)
**Effort:** Medium-High | **Timeline:** 1-2 weeks | **Impact:** Practical solution

1. **Immediate: Deploy v7.3 with better defaults**
   - Add tiebreaker scoring (alphabetical, founding date, etc.)
   - Enhance category-based differentiation
   - Use pricing as a proxy for market validation

2. **Short-term: Collect high-impact metrics**
   - SWE-bench scores for top 20 tools (manually research)
   - GitHub stars for open-source tools (API call)
   - News mentions for autonomous agents (Google News API)

3. **Medium-term: Full metrics pipeline**
   - Automate data collection
   - Backfill historical data
   - Transition to fully data-driven rankings

**Pros:**
- Gets rankings functional quickly
- Incremental improvement path
- Balances effort and results

**Cons:**
- Requires multiple deployment cycles
- Some tools still under-differentiated initially
- Ongoing work needed

---

## Immediate Action Required

### 1. Acknowledge the Issue
Document this is a known limitation in release notes:
```markdown
Note: October 2025 rankings use Algorithm v7.2 which relies on
quantitative metrics not yet fully collected. Rankings are based
on category, feature set, and qualitative assessment. Metric
collection pipeline in development for November rankings.
```

### 2. Prevent New Rankings
Do not generate November rankings until solution is implemented.

### 3. API Warning
Consider adding a warning field to rankings API:
```json
{
  "warning": "Rankings include tied scores due to limited metrics data",
  "tied_tools": 37,
  "total_tools": 51
}
```

### 4. Choose Solution Path
Team decision needed on Option 1, 2, or 3 above.

---

## Technical Details

### Database State
- **Database:** Production (verified via `/api/admin/db-status`)
- **Rankings Table:** October 2025 record exists
- **is_current:** `true`
- **algorithm_version:** `"7.2"`
- **Data:** 51 tool rankings with duplicate scores

### Algorithm Behavior
**File:** `/lib/ranking-algorithm-v7.ts`

Key scoring functions and their behavior with missing data:

```typescript
// Agentic Capability (weight: 0.35)
calculateAgenticCapability(metrics: ToolMetricsV7): number {
  let score = 50; // Base score (no data)

  // SWE-bench check - ALWAYS FAILS (0% coverage)
  const sweBench = metrics.info?.metrics?.swe_bench;
  if (sweBench?.verified) {
    score = Math.min(100, (sweBench.verified / 70) * 100);
  }

  // Category bonus - ONLY DIFFERENTIATOR
  const categoryBonus = {
    "autonomous-agent": 20,  // → 70 score
    "code-editor": 15,       // → 65 score
    "ide-assistant": 10,     // → 60 score
    // ...
  };
  score += categoryBonus[metrics.category] || 0;

  return score;
}

// Innovation (weight: 0.10)
calculateInnovation(metrics: ToolMetricsV7): number {
  let score = 30; // Base score

  // Feature count - LIMITED VARIATION
  const featureCount = metrics.info?.features?.length || 0;
  if (featureCount > 0) {
    score = Math.min(80, 30 + featureCount * 5);
    // 18 features → 30 + 90 = 120 → capped at 80
  }

  // Keyword matching adds 0-100 bonus
  // Similar tools match similar keywords

  return score; // Often maxes at 100 for many tools
}
```

**Result:** Tools with same category + same feature count → identical scores

---

## Verification Commands

To reproduce the investigation:

```bash
# Check duplicate scores in database
npx tsx scripts/investigate-duplicate-scores.ts

# Find all duplicate groups
npx tsx scripts/find-all-duplicate-scores.ts

# Analyze data availability
npx tsx scripts/analyze-available-metrics.ts

# Test scoring for specific tools
npx tsx scripts/test-ranking-calculation.ts
```

---

## Conclusion

This is a **systematic algorithm failure**, not a data corruption bug. The ranking algorithm v7.2 requires rich quantitative metrics that are not present in the production database. The algorithm degrades to category + feature-count scoring, which lacks sufficient granularity to differentiate 51 tools.

**The rankings are mathematically correct but practically meaningless** - tools are ranked by arbitrary sort order within tied score groups.

**Recommendation:** Implement Option 3 (Hybrid Approach) to get functional rankings deployed quickly while building toward a fully data-driven system.

---

**Investigation conducted by:** Claude Code (Research Agent)
**Scripts location:** `/scripts/*-duplicate-*.ts`, `/scripts/analyze-available-metrics.ts`
**Documentation:** This file
