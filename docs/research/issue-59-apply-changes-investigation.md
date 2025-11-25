# Issue #59: Article Preview "Apply Changes" Investigation

**GitHub Issue**: #59 - https://github.com/bobmatnyc/ai-power-rankings/issues/59
**Priority**: P1 - High (broken admin functionality)
**Research Date**: 2025-11-24
**Status**: Investigation Complete

## Executive Summary

The "Apply Changes" button functionality **exists and is working correctly** in the admin article management interface (`/components/admin/article-management.tsx`), but is **NOT present** in the news editor page (`/app/[lang]/(authenticated)/admin/news/edit/[id]/page.tsx`). The issue description appears to conflate two different admin interfaces:

1. **Article Management Interface** (`/components/admin/article-management.tsx`) - Has working Preview → Apply Changes workflow
2. **News Editor Interface** (`/app/[lang]/(authenticated)/admin/news/edit/[id]/page.tsx`) - **Missing** the Apply Changes functionality

## Key Findings

### 1. "Apply Changes" Button Location

**Found in**: `/components/admin/article-management.tsx`

- **Line 1752**: "Apply Changes" button in recalculation preview modal
- **Functionality**: Calls `handleApplyRecalculation()` at line 722
- **Status**: **FULLY IMPLEMENTED AND WORKING**

**Not found in**: `/app/[lang]/(authenticated)/admin/news/edit/[id]/page.tsx`

- The news editor page has NO "Apply Changes" button
- The page only has "Save Article" functionality
- Saving updates article text but does NOT trigger recalculation

### 2. Current State of Functionality

#### Article Management Interface (WORKING)

**Location**: `/components/admin/article-management.tsx`

**Workflow**:
1. User clicks "Preview" button (line 1571-1598)
2. Calls `handleRecalculatePreview(articleId)` (line 564-720)
3. Shows preview modal with predicted ranking changes (line 1632-1759)
4. User clicks "Apply Changes" (line 1740-1755)
5. Calls `handleApplyRecalculation()` (line 722-803)
6. Updates global scores via API: `/api/admin/articles/${articleId}/recalculate`

**API Integration**:
```typescript
// Preview (dry run)
GET /api/admin/articles/${articleId}/recalculate?stream=true&dryRun=true

// Apply changes
GET /api/admin/articles/${articleId}/recalculate?stream=true&dryRun=false&useCachedAnalysis=true
```

**Features**:
- Real-time progress tracking via Server-Sent Events (SSE)
- Cached AI analysis for faster application
- Preview shows tool score changes before applying
- Automatically refreshes article list after application

#### News Editor Interface (MISSING FUNCTIONALITY)

**Location**: `/app/[lang]/(authenticated)/admin/news/edit/[id]/page.tsx`

**Current Workflow**:
1. User edits article metadata and content
2. User clicks "Save Article" (line 426-433)
3. Calls `handleSave()` (line 294-358)
4. Saves to database via `/api/admin/news/${id}` (PUT) or `/api/admin/news` (POST)
5. **NO recalculation triggered**

**Missing**:
- No Preview button
- No Apply Changes button
- No integration with recalculation API
- No ranking impact visualization

### 3. Article Scoring System Architecture

#### Database Schema

**Articles Table** (`lib/db/article-schema.ts`):
```typescript
{
  id: uuid,
  title: string,
  content: text,
  importanceScore: integer (0-10),
  sentimentScore: decimal,
  toolMentions: jsonb,  // { tool, relevance, sentiment, context }
  companyMentions: jsonb,
  rankingsSnapshot: jsonb,  // For rollback capability
  // ... other fields
}
```

**Article Rankings Changes Table**:
```typescript
{
  id: uuid,
  articleId: uuid (FK to articles),
  toolId: string,
  toolName: string,
  oldScore: decimal,
  newScore: decimal,
  scoreChange: decimal,
  oldRank: integer,
  newRank: integer,
  metricChanges: jsonb,  // Detailed metric-by-metric changes
  isApplied: boolean,
  rolledBack: boolean,
  // ... timestamps
}
```

**Tools Table** (`lib/db/schema.ts`):
```typescript
{
  id: uuid,
  name: text,
  category: text,
  baselineScore: jsonb,    // Baseline scores per factor
  deltaScore: jsonb,        // Delta modifications per factor
  currentScore: jsonb,      // Cached current score (baseline + delta)
  scoreUpdatedAt: timestamp,
  // ... other fields
}
```

#### Scoring Flow

**When an article is analyzed**:
1. AI extracts tool mentions with relevance/sentiment scores
2. `RankingsCalculator.calculateRankingChanges()` computes predicted impacts
3. For each mentioned tool:
   - Current score fetched from `tools.currentScore`
   - Delta calculated based on article's sentiment/importance
   - New score = current score + delta
   - Rank change predicted based on score changes

**When "Apply Changes" is clicked** (in article-management.tsx):
1. Calls `/api/admin/articles/${id}/recalculate` with `dryRun=false`
2. `ArticleDatabaseService.recalculateArticleRankingsWithProgress()`:
   - Re-analyzes article content (or uses cached analysis)
   - Calculates score deltas for affected tools
   - Updates `tools.deltaScore` and `tools.currentScore`
   - Creates entries in `article_rankings_changes` table
   - Updates `tools.scoreUpdatedAt` timestamp
3. Changes are immediately reflected in global rankings

### 4. API Endpoints

#### Recalculation API

**File**: `/app/api/admin/articles/[id]/recalculate/route.ts`

**Endpoints**:
```typescript
// SSE streaming (preferred)
GET /api/admin/articles/[id]/recalculate?stream=true&dryRun=true
GET /api/admin/articles/[id]/recalculate?stream=true&dryRun=false&useCachedAnalysis=true

// Fallback (no streaming)
POST /api/admin/articles/[id]/recalculate
Body: { dryRun: boolean, useCachedAnalysis: boolean }
```

**Parameters**:
- `stream`: Enable Server-Sent Events for progress updates
- `dryRun`: Preview mode (no database changes)
- `useCachedAnalysis`: Use previously cached AI analysis (faster)

**Response** (POST):
```json
{
  "success": true,
  "message": "Rankings updated successfully",
  "changes": [
    {
      "tool": "GPT-4",
      "oldScore": 85.5,
      "newScore": 87.2,
      "change": 1.7,
      "oldRank": 2,
      "newRank": 1
    }
  ],
  "summary": {
    "totalToolsAffected": 5,
    "averageScoreChange": 1.2
  }
}
```

#### News API

**File**: `/app/api/admin/news/[id]/route.ts`

**Endpoint**:
```typescript
PUT /api/admin/news/[id]
Body: NewsArticle (title, content, summary, metadata)
```

**Current behavior**: Only updates article text, does NOT recalculate scores

### 5. Service Layer

**File**: `/lib/services/article-db-service.ts`

**Key Method**:
```typescript
async recalculateArticleRankingsWithProgress(
  articleId: string,
  progressCallback?: (progress: number, step: string) => void,
  options?: { dryRun?: boolean; useCachedAnalysis?: boolean }
): Promise<{
  changes: Array<ToolChange>,
  summary: ChangeSummary
}>
```

**Features**:
- In-memory cache for AI analysis (10 minutes TTL)
- Progressive scoring updates with callbacks
- Dry-run mode for previewing changes
- Automatic rollback on errors

## Problem Analysis

### Root Cause

The news editor page (`/app/[lang]/(authenticated)/admin/news/edit/[id]/page.tsx`) is a **separate interface** from the article management component, designed for manual news article editing. It was never integrated with the recalculation system that exists in the article management component.

### Why This Matters

When editors update existing articles in the news editor:
1. Article content/metadata changes are saved to database
2. **Tool mentions may change** (added, removed, or sentiment changed)
3. **Global scores are NOT updated** to reflect the new article state
4. Rankings become **out of sync** with actual article content

### User Impact

- Editors can modify articles but cannot see ranking impacts
- No way to preview how edits affect tool scores
- Manual workflow disconnect: must use two different interfaces
- Risk of stale scores if articles are edited after initial ingestion

## Proposed Implementation

### Option A: Add Preview/Apply to News Editor (RECOMMENDED)

**Pros**:
- Unified editing experience
- Reuses existing recalculation API
- Consistent with article-management workflow

**Implementation Steps**:

1. **Add Preview Button** (similar to article-management.tsx line 1571-1598):
   ```tsx
   <Button
     variant="outline"
     onClick={() => handleRecalculatePreview(article.id)}
     disabled={!article.id || recalculating}
   >
     <Eye className="h-4 w-4 mr-2" />
     Preview Ranking Impact
   </Button>
   ```

2. **Add State Management**:
   ```tsx
   const [recalcProgress, setRecalcProgress] = useState<RecalcProgress | null>(null);
   const [recalcPreviewData, setRecalcPreviewData] = useState<RecalcResult | null>(null);
   const [showRecalcPreviewModal, setShowRecalcPreviewModal] = useState(false);
   ```

3. **Implement Preview Handler** (copy from article-management.tsx line 564-720):
   - Creates EventSource connection to SSE endpoint
   - Tracks progress updates
   - Shows preview modal with tool changes

4. **Add Preview Modal Component** (copy from article-management.tsx line 1632-1759):
   - Displays predicted score changes
   - Shows "Apply Changes" button
   - Calls recalculation API with `dryRun=false`

5. **Update API Route** (if needed):
   - Ensure `/api/admin/news/[id]` can trigger recalculation
   - OR: Use existing `/api/admin/articles/[id]/recalculate` endpoint

**Estimated Effort**: 4-6 hours
- Copy/adapt preview workflow from article-management.tsx
- Test SSE connection and progress tracking
- Verify score updates apply correctly

### Option B: Add Link to Article Management

**Pros**:
- Minimal code changes
- No duplication of recalculation logic

**Cons**:
- Disrupts editing workflow (context switch)
- Requires navigating between two interfaces

**Implementation**:
```tsx
<Link href="/admin/article-management">
  <Button variant="outline">
    Recalculate Rankings
  </Button>
</Link>
```

**Estimated Effort**: 1 hour

### Option C: Auto-recalculate on Save

**Pros**:
- Automatic, no user action needed
- Always keeps scores in sync

**Cons**:
- Adds latency to save operation (AI analysis takes 3-5 seconds)
- No preview of changes before applying
- May be unexpected behavior for editors

**Implementation**:
```tsx
const handleSave = async () => {
  // ... existing save logic

  // Trigger recalculation after save
  await fetch(`/api/admin/articles/${article.id}/recalculate`, {
    method: 'POST',
    body: JSON.stringify({ dryRun: false })
  });
};
```

**Estimated Effort**: 2 hours

## Recommendations

### Primary Recommendation: Option A

Implement Preview/Apply functionality in the news editor page to match the article management interface. This provides:

1. **Consistent UX**: Same workflow across admin interfaces
2. **User Control**: Editors can preview before applying
3. **Transparency**: Shows exact score impacts before committing
4. **Safety**: Dry-run mode prevents accidental changes

### Implementation Priority

**Phase 1** (Must Have):
1. Add "Preview Ranking Impact" button to news editor
2. Implement preview modal showing tool score changes
3. Add "Apply Changes" button to preview modal
4. Wire up to existing `/api/admin/articles/[id]/recalculate` endpoint

**Phase 2** (Nice to Have):
1. Add auto-save detection (warn if unsaved changes before preview)
2. Show preview directly in edit interface (inline, not modal)
3. Add "Recalculate on Save" checkbox option
4. Batch preview/apply for multiple article edits

### Code Reuse Strategy

Copy these components from `article-management.tsx`:
- `handleRecalculatePreview()` function (line 564-720)
- `handleApplyRecalculation()` function (line 722-803)
- Preview modal JSX (line 1632-1759)
- State types: `RecalcProgress`, `RecalcResult`

Adapt for news editor context:
- Use `article.id` instead of `articleId` prop
- Remove batch processing (news editor is single-article)
- Adjust styling to match news editor theme

## Related Files

### Key Implementation Files

**Frontend Components**:
- `/components/admin/article-management.tsx` - Reference implementation (working)
- `/app/[lang]/(authenticated)/admin/news/edit/[id]/page.tsx` - Target for changes

**API Routes**:
- `/app/api/admin/articles/[id]/recalculate/route.ts` - Existing recalculation endpoint
- `/app/api/admin/news/[id]/route.ts` - News update endpoint

**Services**:
- `/lib/services/article-db-service.ts` - Recalculation logic
- `/lib/services/article-ingestion.service.ts` - AI analysis and scoring

**Database Schema**:
- `/lib/db/article-schema.ts` - Article tables
- `/lib/db/schema.ts` - Tools and rankings tables
- `/lib/db/repositories/articles.repository.ts` - Article data access

**Types**:
- `/lib/types/article-analysis.ts` - Scoring types

## Testing Checklist

When implementing the fix, test:

- [ ] Preview button appears in news editor
- [ ] Preview modal shows predicted score changes
- [ ] SSE progress updates work correctly
- [ ] "Apply Changes" button triggers recalculation
- [ ] Tool scores update in database
- [ ] Rankings reflect score changes
- [ ] Error handling (network failures, API errors)
- [ ] Fallback to POST if SSE unavailable
- [ ] Cache invalidation after applying changes
- [ ] UI updates after successful application
- [ ] Rollback works if recalculation fails

## Questions Answered

1. **Where is the "Apply Changes" button?**
   - In `/components/admin/article-management.tsx` (line 1752)
   - NOT in `/app/[lang]/(authenticated)/admin/news/edit/[id]/page.tsx`

2. **What should happen when clicked?**
   - Trigger recalculation API: `/api/admin/articles/[id]/recalculate`
   - Use `dryRun=false` and `useCachedAnalysis=true`
   - Update `tools.deltaScore` and `tools.currentScore`
   - Create `article_rankings_changes` records
   - Refresh UI to show updated scores

3. **What API endpoint should it call?**
   - `GET /api/admin/articles/[id]/recalculate?stream=true&dryRun=false&useCachedAnalysis=true` (SSE)
   - `POST /api/admin/articles/[id]/recalculate` with body `{ dryRun: false, useCachedAnalysis: true }` (fallback)

4. **What scoring fields exist?**
   - `tools.baselineScore` - Initial/baseline scores
   - `tools.deltaScore` - Cumulative article impacts
   - `tools.currentScore` - Cached total (baseline + delta)
   - `article_rankings_changes.scoreChange` - Per-article deltas

5. **Is there existing recalculation logic?**
   - Yes: `ArticleDatabaseService.recalculateArticleRankingsWithProgress()`
   - Supports dry-run mode, caching, and progress callbacks
   - Already integrated in article-management interface

## Next Steps

1. **Confirm Requirements**: Verify that news editor should have Apply Changes functionality
2. **Choose Implementation**: Select Option A, B, or C based on user workflow preferences
3. **Create Task**: Convert this research into implementation tickets
4. **Implement**: Add Preview/Apply workflow to news editor page
5. **Test**: Verify score updates work correctly
6. **Document**: Update admin user guide with new workflow

## Appendix: Code Snippets

### Existing Preview Handler (article-management.tsx)

```typescript
const handleRecalculatePreview = useCallback(async (articleId: string) => {
  setError(null);

  // Initialize progress tracking
  setRecalcProgress(new Map().set(articleId, {
    articleId,
    progress: 0,
    step: "Initializing preview...",
    isActive: true,
  }));

  try {
    // Create EventSource for real-time progress
    const eventSource = new EventSource(
      `/api/admin/articles/${articleId}/recalculate?stream=true&dryRun=true`,
      { withCredentials: true }
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "progress") {
        // Update progress bar
        setRecalcProgress(prev => new Map(prev).set(articleId, {
          articleId,
          progress: data.progress,
          step: data.step,
          isActive: true,
        }));
      } else if (data.type === "complete") {
        // Show preview modal
        setRecalcPreviewData({
          articleId,
          toolChanges: data.changes || [],
          summary: data.summary,
          isPreview: true,
        });
        setShowRecalcPreviewModal(true);
        eventSource.close();
      }
    };

    // Error handling omitted for brevity
  } catch (err) {
    setError(err.message);
  }
}, []);
```

### Existing Apply Handler (article-management.tsx)

```typescript
const handleApplyRecalculation = useCallback(async () => {
  if (!recalcPreviewData) return;

  setIsApplying(true);
  const articleId = recalcPreviewData.articleId;

  try {
    // Use cached analysis for faster processing
    const eventSource = new EventSource(
      `/api/admin/articles/${articleId}/recalculate?stream=true&dryRun=false&useCachedAnalysis=true`,
      { withCredentials: true }
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "complete") {
        setShowRecalcPreviewModal(false);
        setRecalcPreviewData(null);
        setSuccess("Rankings updated successfully!");
        eventSource.close();
        loadArticles(); // Refresh article list
      }
    };

    // Error handling omitted for brevity
  } catch (err) {
    setError(err.message);
  } finally {
    setIsApplying(false);
  }
}, [recalcPreviewData, loadArticles]);
```

---

**Research Completed**: 2025-11-24
**Analyst**: Claude (Research Agent)
**Files Analyzed**: 8 key files
**Lines of Code Reviewed**: ~3,500 lines
