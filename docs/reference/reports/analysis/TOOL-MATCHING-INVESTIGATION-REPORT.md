# Tool Matching Investigation Report

**Date**: October 1, 2025
**Issue**: Article analysis only matches 5 baseline tools instead of all 54 tools
**Status**: ROOT CAUSE IDENTIFIED ✅

---

## Executive Summary

**Problem**: When articles are analyzed, the AI can only match against 5 tools (the baseline rankings) instead of the 54 tools currently in the database. This means 49 tools (90%!) cannot be detected or scored from articles.

**Root Cause**: The `calculateRankingChanges()` function receives data from `getCurrentRankings()`, which returns only tools that exist in the rankings snapshot. Since the snapshot contains just 5 baseline tools, tool matching is limited to those 5.

**Impact**:
- Articles mentioning tools like "Claude Code", "Devin", "Cline", etc. are not being matched
- Only tools in the baseline snapshot (Cursor, Windsurf, GitHub Copilot, Claude Dev, Aider) can be matched
- 90% of the tool database is invisible to article analysis

---

## Investigation Findings

### 1. Data Source Analysis

#### Tools Table (Complete Set)
- **Count**: 54 tools
- **Contents**: All current AI coding tools
- **Fields**:
  - `id`, `name`, `slug`, `category`
  - `baselineScore`, `deltaScore`, `currentScore` (all JSONB)
  - Full tool data in `data` field
- **Examples**: Cline, Magic, Aider, Claude Code, Devin, ChatGPT Canvas, etc.

#### Rankings Snapshot (Baseline Only)
- **Count**: 5 tools
- **Period**: 2025-09
- **Contents**: Baseline rankings established in September 2025
- **Tools in snapshot**:
  1. Cursor (rank 1, score 95)
  2. Windsurf (rank 2, score 92)
  3. GitHub Copilot (rank 3, score 88)
  4. Claude Dev (rank 4, score 85)
  5. Aider (rank 5, score 82)

#### Missing Tools (49 tools)
Tools NOT in rankings snapshot include:
- Claude Code
- Devin
- Cline
- ChatGPT Canvas
- OpenHands
- SWE-agent
- Greptile
- Qodo Gen
- And 41 others...

### 2. Code Flow Analysis

#### Current Flow (INCORRECT)

```
Article Analysis
    ↓
getCurrentRankings()  ← Returns only 5 baseline tools
    ↓
calculateRankingChanges(analysis, currentRankings)
    ↓
Tool Matching Loop:
    - Loops through tool_mentions from AI
    - Tries to find each tool in currentRankings
    - Only 5 tools can be matched!
    ↓
Returns changes (max 5 tools)
```

#### Where getCurrentRankings() is Called

Located in `/lib/services/article-db-service.ts`:

1. **Line 120** - `processArticle()` during ingestion
2. **Line 425** - Another processing flow
3. **Line 565** - Article preview/dry-run
4. **Line 926** - Additional processing

All these call sites pass the result to `calculateRankingChanges()`.

#### getCurrentRankings() Implementation

**File**: `/lib/services/article-db-service.ts` (lines 744-811)

```typescript
private async getCurrentRankings(): Promise<CurrentRanking[]> {
  if (this.db) {
    try {
      // Get the most recent rankings snapshot
      const [latestRanking] = await this.db
        .select()
        .from(rankings)
        .where(eq(rankings.isCurrent, true))
        .limit(1);

      if (latestRanking?.data) {
        const dataObj = latestRanking.data as { rankings: any[] };
        const rankingArray = dataObj.rankings || []; // Only 5 items!

        // Fetch tool names from database
        const toolIds = rankingArray.map((r) => r.tool_id).filter(Boolean);

        const toolsData = await this.db!
          .select()
          .from(tools)
          .where(inArray(tools.id, toolIds));

        const toolMap = new Map(toolsData.map((t) => [t.id, t.name]));

        // Map the 5 rankings to CurrentRanking format
        return rankingArray.map((item, index) => ({
          id: String(item.tool_id),
          tool_id: String(item.tool_id),
          tool_name: toolMap.get(item.tool_id) || "Unknown Tool",
          name: toolMap.get(item.tool_id) || "Unknown Tool",
          rank: item.position || index + 1,
          score: item.score || 0,
          metrics: item.factor_scores || {},
        }));
      }
    } catch (error) {
      console.warn("Database query failed:", error);
    }
  }
  return [];
}
```

**Problem**: Returns only tools from `rankingArray`, which has 5 items from the snapshot.

### 3. calculateRankingChanges() Analysis

**File**: `/lib/services/article-ingestion.service.ts` (lines 667-880)

```typescript
calculateRankingChanges(
  analysis: AIAnalysisResult,
  currentRankings: any[] // ← Gets only 5 tools!
): DryRunResult["predictedChanges"] {
  const changes: DryRunResult["predictedChanges"] = [];

  // Process each tool mention from AI analysis
  for (const mention of analysis.tool_mentions) {
    // Extract ranking data
    let rankingData: any[];
    if (currentRankings.length > 0 && currentRankings[0].data) {
      rankingData = currentRankings[0].data;
    } else {
      rankingData = currentRankings;
    }

    // Normalize tool name
    const normalizedToolName = ToolMapper.normalizeTool(mention.tool);

    // Try to find tool in rankings
    const currentTool = rankingData.find((r: any) =>
      r.tool_name === normalizedToolName ||
      r.tool_name === mention.tool ||
      r.name === normalizedToolName
    );

    if (currentTool) {
      // Calculate score changes
      // ... (scoring logic)
      changes.push({
        toolId: currentTool.tool_id,
        toolName: normalizedToolName,
        currentRank: currentTool.rank,
        predictedRank: /* calculated */,
        scoreChange: /* calculated */,
      });
    } else {
      // Tool not found - skipped!
      console.log(`Tool "${mention.tool}" not found in rankings`);
    }
  }

  return changes;
}
```

**Problem**: `currentTool` is only found if the tool exists in `rankingData`, which has only 5 tools. All other tools fail the match and are skipped.

---

## Recommended Solution

### Option 1: Use Tools Table for Matching (RECOMMENDED)

**Approach**: Query all tools from the database for matching, use rankings only for existing rank/score data.

#### Implementation Steps

1. **Add getAllTools() method** to `article-db-service.ts`:

```typescript
private async getAllTools(): Promise<ToolInfo[]> {
  if (!this.db) {
    return [];
  }

  try {
    const allTools = await this.db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        category: tools.category,
        baselineScore: tools.baselineScore,
        deltaScore: tools.deltaScore,
        currentScore: tools.currentScore,
      })
      .from(tools)
      .where(eq(tools.status, 'active'));

    return allTools;
  } catch (error) {
    console.error("Failed to fetch tools:", error);
    return [];
  }
}

interface ToolInfo {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  baselineScore: any;
  deltaScore: any;
  currentScore: any;
}
```

2. **Modify calculateRankingChanges()** to accept both tools and rankings:

```typescript
calculateRankingChanges(
  analysis: AIAnalysisResult,
  allTools: ToolInfo[], // ← All 54 tools for matching
  currentRankings: any[] // ← Only for rank/score lookup
): DryRunResult["predictedChanges"] {
  const changes: DryRunResult["predictedChanges"] = [];

  // Create lookup maps
  const toolsByName = new Map(allTools.map(t => [t.name.toLowerCase(), t]));
  const rankingsByToolId = new Map(
    currentRankings.map(r => [r.tool_id, r])
  );

  for (const mention of analysis.tool_mentions) {
    const normalizedName = ToolMapper.normalizeTool(mention.tool);

    // Find tool in complete tool set
    const tool = toolsByName.get(normalizedName.toLowerCase());

    if (tool) {
      // Check if tool has existing ranking
      const existingRanking = rankingsByToolId.get(tool.id);

      let currentRank: number;
      let currentScore: number;

      if (existingRanking) {
        // Tool is ranked - use existing rank/score
        currentRank = existingRanking.rank || existingRanking.position;
        currentScore = existingRanking.score;
      } else {
        // Tool NOT in rankings - calculate from baseline + delta
        currentRank = allTools.length + 1; // Estimate: bottom rank
        const baseline = tool.baselineScore?.overall || 0;
        const delta = tool.deltaScore?.overall || 0;
        currentScore = baseline + delta;
      }

      // Calculate predicted changes
      const scoreChange = /* calculate based on sentiment/relevance */;
      const predictedScore = currentScore + scoreChange;
      const rankChange = /* estimate rank movement */;

      changes.push({
        toolId: tool.id,
        toolName: tool.name,
        currentRank,
        predictedRank: currentRank + rankChange,
        currentScore,
        predictedScore,
        scoreChange,
        isNewToRankings: !existingRanking, // Flag for new entries
      });
    } else {
      // Tool not in database at all - truly unknown
      console.warn(`Unknown tool: ${mention.tool}`);
    }
  }

  return changes;
}
```

3. **Update call sites** in `article-db-service.ts`:

```typescript
// Line 120 and others
const currentRankings = await this.getCurrentRankings();
const allTools = await this.getAllTools(); // ← Add this

predictedChanges = this.rankingsCalculator.calculateRankingChanges(
  analysis,
  allTools, // ← Pass all tools
  currentRankings // ← Keep rankings for score lookup
);
```

### Option 2: Expand Rankings Snapshot (NOT RECOMMENDED)

**Approach**: Add all 54 tools to the rankings snapshot.

**Why NOT Recommended**:
- Rankings snapshot represents official published rankings
- Not all tools should be "ranked" yet
- Baseline system is designed to start with curated set
- Would require manual ranking of 49 new tools
- Defeats purpose of incremental system

---

## Implementation Impact

### Files to Modify

1. `/lib/services/article-db-service.ts`
   - Add `getAllTools()` method
   - Update `processArticle()` to fetch all tools
   - Pass both tools and rankings to calculator

2. `/lib/services/article-ingestion.service.ts`
   - Modify `calculateRankingChanges()` signature
   - Update matching logic to use all tools
   - Handle tools without existing rankings
   - Add `isNewToRankings` flag to results

### Breaking Changes

**Method Signature Change**:
```typescript
// Before
calculateRankingChanges(analysis, currentRankings)

// After
calculateRankingChanges(analysis, allTools, currentRankings)
```

**All call sites must be updated** (4 locations in article-db-service.ts).

### New Behavior

1. **Tools with Rankings**: Use existing rank/score, calculate changes
2. **Tools without Rankings**:
   - Calculate score from `baselineScore + deltaScore`
   - Assign estimated rank (e.g., bottom of list)
   - Flag as `isNewToRankings: true`
   - Can be promoted to rankings if score increases significantly

3. **Unknown Tools**: Tools mentioned but not in database
   - Log as warnings
   - Could trigger admin review
   - May need to be added to database first

---

## Testing Plan

### Test Cases

1. **Existing Ranked Tool** (e.g., Cursor)
   - Should match ✅
   - Should use existing rank/score ✅
   - Should calculate changes ✅

2. **Database Tool Not Ranked** (e.g., Claude Code)
   - Should match ✅
   - Should calculate score from baseline + delta ✅
   - Should flag as new to rankings ✅

3. **Unknown Tool** (not in database)
   - Should log warning ✅
   - Should skip or flag for review ✅

4. **Multiple Tools in Article**
   - Should process all mentioned tools ✅
   - Should handle mix of ranked/unranked ✅

### Verification Script

Create `scripts/test-improved-tool-matching.ts`:

```typescript
import { ArticleDatabaseService } from "@/lib/services/article-db-service";

// Test article mentioning various tools
const testArticle = {
  title: "AI Tool Market Update",
  content: `
    Cursor continues to lead the market with new features.
    Claude Code released version 2.0 with improved performance.
    Devin AI announced $500M funding round.
    Windsurf added new collaboration features.
  `,
  url: "https://example.com/test",
  published_date: "2025-10-01",
};

// Expected results:
// - Cursor: Should match (in rankings)
// - Claude Code: Should match (in DB, not ranked)
// - Devin: Should match (in DB, not ranked)
// - Windsurf: Should match (in rankings)
```

---

## Migration Path

### Phase 1: Implementation (1-2 hours)
1. Add `getAllTools()` method
2. Modify `calculateRankingChanges()` signature
3. Update all call sites
4. Add handling for unranked tools

### Phase 2: Testing (30 minutes)
1. Run verification script
2. Test with real articles
3. Verify all 54 tools can be matched

### Phase 3: Monitoring (ongoing)
1. Monitor tool match rates
2. Track new tools entering rankings
3. Review unknown tool warnings

---

## Expected Outcomes

### Before Fix
- Tools matchable: 5 (9%)
- Tools missed: 49 (91%)
- Example: Article about "Claude Code" → No match

### After Fix
- Tools matchable: 54 (100%)
- Tools missed: 0 (only truly unknown tools)
- Example: Article about "Claude Code" → Matched, scored, tracked

### Business Impact
- Complete tool coverage in article analysis
- Accurate tracking of emerging tools
- Better ranking accuracy
- No manual intervention needed for new tools

---

## Appendix: Data Structures

### CurrentRanking Interface
```typescript
interface CurrentRanking {
  id: string;
  tool_id: string;
  tool_name: string;
  name: string;
  rank: number;
  score: number;
  metrics: Record<string, unknown>;
}
```

### ToolInfo Interface (New)
```typescript
interface ToolInfo {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  baselineScore: any; // JSONB: { overall: number, factors: {...} }
  deltaScore: any;    // JSONB: { overall: number, factors: {...} }
  currentScore: any;  // JSONB: { overall: number, factors: {...} }
}
```

### PredictedChange Interface (Updated)
```typescript
interface PredictedChange {
  toolId: string;
  toolName: string;
  currentRank: number;
  predictedRank: number;
  rankChange: number;
  currentScore: number;
  predictedScore: number;
  scoreChange: number;
  metrics: {
    sentiment: { old: number; new: number; change: number };
    relevance: { old: number; new: number; change: number };
  };
  isNewToRankings?: boolean; // ← NEW FLAG
}
```

---

## Conclusion

The root cause is clear: `getCurrentRankings()` returns only the 5 baseline tools from the rankings snapshot, limiting tool matching to those 5 tools. The solution is to query the tools table directly for matching, while still using rankings for rank/score lookups.

This fix will enable complete tool coverage (54 tools instead of 5), allowing the system to properly track all tools mentioned in articles without manual intervention.

**Recommendation**: Implement Option 1 (Use Tools Table for Matching) immediately to unlock full tool coverage.
