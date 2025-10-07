# Tool Matching - Code Locations Reference

Quick reference for implementing the fix to enable matching against all 54 tools.

---

## Current Problematic Code

### 1. getCurrentRankings() - Returns Only 5 Tools

**File**: `/lib/services/article-db-service.ts`
**Lines**: 744-811
**Issue**: Returns only tools from rankings snapshot (5 tools)

```typescript
private async getCurrentRankings(): Promise<CurrentRanking[]> {
  // Gets rankings snapshot with only 5 baseline tools
  const [latestRanking] = await this.db
    .select()
    .from(rankings)
    .where(eq(rankings.isCurrent, true))
    .limit(1);

  const rankingArray = dataObj.rankings || []; // Only 5 items!
  // ... maps to CurrentRanking format
  return mappedRankings; // Returns 5 tools
}
```

### 2. calculateRankingChanges() - Limited to 5 Tools

**File**: `/lib/services/article-ingestion.service.ts`
**Lines**: 667-880
**Issue**: Can only match against tools in currentRankings parameter (5 tools)

```typescript
calculateRankingChanges(
  analysis: AIAnalysisResult,
  currentRankings: any[] // ← Only 5 tools passed in!
): DryRunResult["predictedChanges"] {
  // ...
  for (const mention of analysis.tool_mentions) {
    const normalizedName = ToolMapper.normalizeTool(mention.tool);

    // Tries to find in currentRankings (only 5 tools!)
    const currentTool = rankingData.find((r: any) =>
      r.tool_name === normalizedName ||
      r.tool_name === mention.tool ||
      r.name === normalizedName
    );

    if (currentTool) {
      // Only 5 tools can match!
    } else {
      // 49 tools end up here!
    }
  }
}
```

### 3. Call Sites - Pass Limited Data

**File**: `/lib/services/article-db-service.ts`
**Lines**: 120, 425, 565, 926
**Issue**: All call sites pass getCurrentRankings() result

```typescript
// Line 120 - processArticle()
const currentRankings = await this.getCurrentRankings(); // 5 tools
predictedChanges = this.rankingsCalculator.calculateRankingChanges(
  analysis,
  currentRankings // ← 5 tools
);

// Line 565 - Article preview
const currentRankings = await this.getCurrentRankings(); // 5 tools
const predictedChanges = this.rankingsCalculator.calculateRankingChanges(
  analysis,
  currentRankings // ← 5 tools
);
```

---

## Required Changes

### Change 1: Add getAllTools() Method

**File**: `/lib/services/article-db-service.ts`
**Location**: Add after getCurrentRankings() (after line 811)

```typescript
/**
 * Get all active tools from database for matching
 * Returns complete tool set (54 tools), not just ranked tools
 */
private async getAllTools(): Promise<ToolInfo[]> {
  if (!this.db) {
    console.warn("[ArticleDatabaseService] Database not available");
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

    console.log(`[ArticleDatabaseService] Found ${allTools.length} active tools`);
    return allTools;
  } catch (error) {
    console.error("[ArticleDatabaseService] Failed to fetch tools:", error);
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

### Change 2: Modify calculateRankingChanges() Signature

**File**: `/lib/services/article-ingestion.service.ts`
**Lines**: 667-880
**Change**: Update method signature and matching logic

```typescript
/**
 * Calculate predicted ranking changes based on article analysis
 * @param analysis - AI analysis results with tool mentions
 * @param allTools - Complete tool set for matching (all 54 tools)
 * @param currentRankings - Current rankings for score/rank lookup (5 baseline tools)
 */
calculateRankingChanges(
  analysis: AIAnalysisResult,
  allTools: ToolInfo[], // ← NEW: All 54 tools for matching
  currentRankings: any[] // ← Keep for rank/score lookup
): DryRunResult["predictedChanges"] {
  const changes: DryRunResult["predictedChanges"] = [];

  console.log(`[RankingsCalculator] Processing ${analysis.tool_mentions.length} tool mentions`);
  console.log(`[RankingsCalculator] Available tools: ${allTools.length}`);
  console.log(`[RankingsCalculator] Ranked tools: ${currentRankings.length}`);

  // Create lookup maps for efficient matching
  const toolsByName = new Map<string, ToolInfo>();
  allTools.forEach(tool => {
    toolsByName.set(tool.name.toLowerCase(), tool);
    // Also map by slug for alternative matching
    toolsByName.set(tool.slug.toLowerCase(), tool);
  });

  // Create rankings lookup by tool ID
  let rankingData: any[];
  if (currentRankings.length > 0 && currentRankings[0].data) {
    rankingData = currentRankings[0].data as any[];
  } else {
    rankingData = currentRankings;
  }
  const rankingsByToolId = new Map(
    rankingData.map(r => [r.tool_id, r])
  );

  // Process each tool mention
  for (const mention of analysis.tool_mentions) {
    const normalizedName = ToolMapper.normalizeTool(mention.tool);
    console.log(`[RankingsCalculator] Looking for: "${mention.tool}" → normalized: "${normalizedName}"`);

    // Try to find tool in complete tool set
    const tool = toolsByName.get(normalizedName.toLowerCase());

    if (!tool) {
      console.warn(`[RankingsCalculator] Unknown tool: ${mention.tool} (not in database)`);
      continue;
    }

    console.log(`[RankingsCalculator] Found tool: ${tool.name} (${tool.id})`);

    // Check if tool has existing ranking
    const existingRanking = rankingsByToolId.get(tool.id);

    let currentRank: number;
    let currentScore: number;
    let isNewToRankings = false;

    if (existingRanking) {
      // Tool is already ranked - use existing data
      currentRank = existingRanking.rank || existingRanking.position || 0;
      currentScore = existingRanking.score || 0;
      console.log(`[RankingsCalculator] Tool in rankings: rank ${currentRank}, score ${currentScore}`);
    } else {
      // Tool NOT in rankings - calculate from baseline + delta
      isNewToRankings = true;
      currentRank = allTools.length; // Estimate: bottom rank

      // Extract scores from JSONB
      const baseline = tool.baselineScore?.overall || 0;
      const delta = tool.deltaScore?.overall || 0;
      currentScore = baseline + delta;

      console.log(`[RankingsCalculator] Tool not ranked: baseline ${baseline} + delta ${delta} = ${currentScore}`);
    }

    // Calculate impact based on sentiment and relevance
    // (Keep existing scoring logic from lines 737-842)
    const basePoints = mention.relevance * 3;
    let scoreChangePoints = basePoints * mention.sentiment;

    // ... (rest of scoring logic stays the same)

    // Estimate rank change
    let rankChange = 0;
    if (Math.abs(scoreChangePoints) >= 0.5) {
      if (scoreChangePoints > 0) {
        rankChange = -Math.max(1, Math.round(Math.abs(scoreChangePoints) / 2));
      } else {
        rankChange = Math.max(1, Math.round(Math.abs(scoreChangePoints) / 2));
      }
    }

    changes.push({
      toolId: tool.id,
      toolName: tool.name,
      currentRank: currentRank,
      predictedRank: Math.max(1, currentRank + rankChange),
      rankChange: rankChange,
      currentScore: currentScore,
      predictedScore: Math.max(0, Math.min(100, currentScore + scoreChangePoints)),
      scoreChange: scoreChangePoints,
      isNewToRankings: isNewToRankings, // Flag for UI display
      metrics: {
        sentiment: { old: 0, new: mention.sentiment, change: mention.sentiment },
        relevance: { old: 0, new: mention.relevance, change: mention.relevance },
      },
    });
  }

  console.log(`[RankingsCalculator] Generated ${changes.length} predicted changes`);
  return changes;
}
```

### Change 3: Update Call Sites (4 locations)

**File**: `/lib/services/article-db-service.ts`

#### Location 1: Line 120 (processArticle)

```typescript
// Before:
const currentRankings = await this.getCurrentRankings();
predictedChanges = this.rankingsCalculator.calculateRankingChanges(
  analysis,
  currentRankings
);

// After:
const currentRankings = await this.getCurrentRankings();
const allTools = await this.getAllTools(); // ← ADD THIS
predictedChanges = this.rankingsCalculator.calculateRankingChanges(
  analysis,
  allTools, // ← ADD THIS
  currentRankings
);
```

#### Location 2: Line 425

```typescript
// Before:
const currentRankings = await this.getCurrentRankings();
// ... later ...
this.rankingsCalculator.calculateRankingChanges(analysis, currentRankings);

// After:
const currentRankings = await this.getCurrentRankings();
const allTools = await this.getAllTools(); // ← ADD THIS
// ... later ...
this.rankingsCalculator.calculateRankingChanges(analysis, allTools, currentRankings);
```

#### Location 3: Line 565 (Preview/Dry-run)

```typescript
// Before:
const currentRankings = await this.getCurrentRankings();
const predictedChanges = this.rankingsCalculator.calculateRankingChanges(
  analysis,
  currentRankings
);

// After:
const currentRankings = await this.getCurrentRankings();
const allTools = await this.getAllTools(); // ← ADD THIS
const predictedChanges = this.rankingsCalculator.calculateRankingChanges(
  analysis,
  allTools, // ← ADD THIS
  currentRankings
);
```

#### Location 4: Line 926

```typescript
// Before:
const currentRankings = await this.getCurrentRankings();
// ... later ...
this.rankingsCalculator.calculateRankingChanges(analysis, currentRankings);

// After:
const currentRankings = await this.getCurrentRankings();
const allTools = await this.getAllTools(); // ← ADD THIS
// ... later ...
this.rankingsCalculator.calculateRankingChanges(analysis, allTools, currentRankings);
```

### Change 4: Update Interface (if needed)

**File**: `/lib/services/article-ingestion.service.ts`
**Location**: Top of file (around line 20)

```typescript
// Add interface for tool info
interface ToolInfo {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  baselineScore: any;
  deltaScore: any;
  currentScore: any;
}

// Update PredictedChange interface to include new flag
interface PredictedChange {
  toolId: string;
  toolName: string;
  currentRank: number;
  predictedRank: number;
  rankChange: number;
  currentScore: number;
  predictedScore: number;
  scoreChange: number;
  isNewToRankings?: boolean; // ← ADD THIS
  metrics: {
    sentiment: { old: number; new: number; change: number };
    relevance: { old: number; new: number; change: number };
  };
}
```

---

## Testing After Changes

### Test Script

Create `/scripts/test-improved-matching.ts`:

```typescript
import { ArticleDatabaseService } from "@/lib/services/article-db-service";
import { getDb, closeDb } from "@/lib/db/connection";

async function testToolMatching() {
  const db = getDb();
  const service = new ArticleDatabaseService(db);

  const testArticle = {
    title: "AI Coding Tools Update",
    content: `
      Cursor announced new features this week.
      Claude Code released version 2.0.
      Devin AI secured major funding.
      Windsurf improved collaboration.
      ChatGPT Canvas added new capabilities.
    `,
    url: "https://example.com/test",
    published_date: "2025-10-01",
  };

  // This should now match ALL mentioned tools
  const result = await service.previewArticleIngestion(testArticle);

  console.log(`Tools detected: ${result.predictedChanges.length}`);
  result.predictedChanges.forEach(change => {
    console.log(`  - ${change.toolName} (isNew: ${change.isNewToRankings})`);
  });

  await closeDb();
}
```

Expected output:
```
Tools detected: 5
  - Cursor (isNew: false)         ← In rankings
  - Claude Code (isNew: true)     ← In DB, not ranked
  - Devin (isNew: true)           ← In DB, not ranked
  - Windsurf (isNew: false)       ← In rankings
  - ChatGPT Canvas (isNew: true)  ← In DB, not ranked
```

---

## Summary Checklist

- [ ] Add `getAllTools()` method to article-db-service.ts
- [ ] Add `ToolInfo` interface to article-db-service.ts
- [ ] Update `calculateRankingChanges()` signature in article-ingestion.service.ts
- [ ] Update matching logic to use `allTools` parameter
- [ ] Add `isNewToRankings` flag to results
- [ ] Update call site at line 120
- [ ] Update call site at line 425
- [ ] Update call site at line 565
- [ ] Update call site at line 926
- [ ] Create and run test script
- [ ] Verify 54 tools are matchable instead of 5

---

## Impact

**Before**: 5 tools matchable (9%)
**After**: 54 tools matchable (100%)

**Result**: Complete tool coverage in article analysis ✅
