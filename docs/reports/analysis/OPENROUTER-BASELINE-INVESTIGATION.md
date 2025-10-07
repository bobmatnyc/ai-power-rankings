# OpenRouter API & Baseline Scoring Investigation Report

## Executive Summary

**OpenRouter API Status**: ✅ **WORKING** - API key is valid and successfully tested
**Baseline Scoring**: ✅ **IMPLEMENTED** - Architecture exists with baseline + delta design
**May 2025 Baseline**: ❌ **NOT FOUND** - No evidence of a specific May 2025 baseline snapshot
**Admin UI Access**: ✅ **AVAILABLE** - Authentication can be disabled for local development

---

## 1. OpenRouter API Integration Analysis

### Location
**Primary File**: `/Users/masa/Projects/managed/aipowerranking/app/api/admin/news/analyze/route.ts`

### Current Configuration
- **Model**: `anthropic/claude-sonnet-4` (line 150)
- **API Key**: Valid and working (verified via direct curl test)
- **Environment Variable**: `OPENROUTER_API_KEY` (correctly set in `.env.local`)
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`

### Request Format (Lines 263-283)
```typescript
const requestBody: OpenRouterRequest = {
  model: "anthropic/claude-sonnet-4",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ],
  temperature: 0.3,
  max_tokens: 4000
};

const requestHeaders = {
  Authorization: `Bearer ${openRouterKey}`,
  "Content-Type": "application/json",
  Referer: process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3000",
  "HTTP-Referer": process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3000",
  "X-Title": "AI Power Rankings Admin"
};
```

### API Test Results
✅ **Direct curl test successful**:
```bash
curl test returned HTTP 200 with valid response:
{
  "id": "gen-1759344750-GQ7B6W8cM6Adt8Z3dZ1R",
  "provider": "Google",
  "model": "anthropic/claude-sonnet-4",
  "choices": [{"message": {"content": "Hello! How are you..."}}]
}
```

### Error Handling (Lines 316-400)
Comprehensive error handling includes:
- **401 Errors**: Authentication failures with detailed troubleshooting
- **429 Errors**: Rate limiting with reset time information
- **402 Errors**: Insufficient credits
- **503 Errors**: Service unavailability
- **Verbose logging**: Available via `verbose: true` parameter

### Why QA Reported 400 Errors
**Likely Causes**:
1. **Environment variable not loaded**: API key may not be available in production/staging environment
2. **Request validation failure**: OpenRouter may be rejecting specific request parameters
3. **Model availability**: `anthropic/claude-sonnet-4` may have temporary availability issues
4. **Content length**: Article content exceeding token limits (8000 char limit at line 234)

**Recommendation**:
- Check that `OPENROUTER_API_KEY` is set in production environment
- Enable verbose logging (`verbose: true`) to capture exact error response
- Verify model name is still valid (check OpenRouter documentation)
- Consider adding fallback model options

---

## 2. Baseline Scoring Architecture

### Core Design Pattern
**Location**: `/Users/masa/Projects/managed/aipowerranking/lib/services/tool-scoring.service.ts`

### Score Components
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

### Three-Tier Scoring System
1. **Baseline Score** (`baselineScore`): Stable, fundamental score based on core metrics
2. **Delta Score** (`deltaScore`): Temporary modifications from news, events, trends
3. **Current Score** (`currentScore`): Calculated as `baseline + delta` (cached)

### Database Schema (schema.ts, lines 36-40)
```sql
baselineScore: jsonb("baseline_score").default("{}"),
deltaScore: jsonb("delta_score").default("{}"),
currentScore: jsonb("current_score").default("{}"),
scoreUpdatedAt: timestamp("score_updated_at")
```

### Calculation Logic (Lines 33-57)
```typescript
calculateCurrentScore(baseline: ToolScoreFactors, delta: ToolScoreFactors): ToolScoreFactors {
  const current: ToolScoreFactors = {};

  for (const factor of factors) {
    const baselineValue = baseline[factor] || 0;
    const deltaValue = delta[factor] || 0;
    current[factor] = baselineValue + deltaValue;
  }

  return current;
}
```

### Key Service Methods
- `updateBaselineScore()` (lines 104-140): Updates baseline, preserves delta, recalculates current
- `updateDeltaScore()` (lines 145-181): Updates delta, preserves baseline, recalculates current
- `initializeBaselinesFromCurrent()` (lines 187-236): One-time migration to populate baselines

---

## 3. Baseline Preservation Strategy

### ✅ Articles Modify Delta, NOT Baseline
**Confirmed**: The architecture ensures articles only affect delta scores:

1. **Article ingestion** calls `updateDeltaScore()` - NOT `updateBaselineScore()`
2. **Baseline updates** are intentionally separate operations requiring explicit admin action
3. **Current score** is always calculated as `baseline + delta`, ensuring baseline remains unchanged

### Baseline vs Delta Usage Pattern
```typescript
// Baseline updates (rare, manual, admin-only):
await toolScoringService.updateBaselineScore(toolId, {
  marketTraction: 75,  // New fundamental score
  overallScore: 77.5
});

// Delta updates (frequent, from articles/news):
await toolScoringService.updateDeltaScore(toolId, {
  communitySentiment: 15,  // Temporary boost from positive news
  marketTraction: 5,       // Event-driven increase
  overallScore: 8          // Overall temporary improvement
});
```

---

## 4. May 2025 Baseline Investigation

### Search Results
❌ **No May 2025 Baseline Found**

Searched for:
- "May 2025 baseline"
- "baseline snapshot"
- "version history"
- Timestamp-based baseline records

### Current Baseline State
The system has:
- ✅ Baseline scoring architecture (implemented)
- ✅ Delta scoring system (implemented)
- ✅ Migration script to initialize baselines (`scripts/initialize-baseline-scores.ts`)
- ❌ No versioned baseline snapshots
- ❌ No historical baseline tracking
- ❌ No "May 2025" specific baseline data

### Baseline Initialization
**Script**: `/Users/masa/Projects/managed/aipowerranking/scripts/initialize-baseline-scores.ts`

This script:
1. Takes **current tool scores** as the baseline
2. Sets delta to empty (`{}`)
3. Sets current score equal to baseline
4. Does NOT create dated snapshots

### Recommendation for May 2025 Baseline
To implement a "May 2025 baseline" system:

1. **Create Baseline Versioning Table**:
```sql
CREATE TABLE baseline_versions (
  id UUID PRIMARY KEY,
  version_name TEXT NOT NULL,  -- e.g., "May 2025 Baseline"
  version_date DATE NOT NULL,
  baseline_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

2. **Snapshot Current Baselines**:
```typescript
// Save current baselines as "May 2025 Baseline"
await db.insert(baseline_versions).values({
  version_name: "May 2025 Baseline",
  version_date: new Date("2025-05-01"),
  baseline_data: await getAllBaselineScores()
});
```

3. **Restore from Snapshot**:
```typescript
// Restore baselines to May 2025 state
const snapshot = await getBaselineVersion("May 2025 Baseline");
await restoreBaselines(snapshot.baseline_data);
```

---

## 5. Admin UI Access for Local Development

### Current Authentication Status
**File**: `.env.local` (line 18)
```bash
# NEXT_PUBLIC_DISABLE_AUTH=true  # Currently COMMENTED OUT
```

### To Access Admin UI on localhost:3012

**Option 1: Disable Authentication (Quickest)**
1. Edit `.env.local`
2. Uncomment line 18: `NEXT_PUBLIC_DISABLE_AUTH=true`
3. Restart dev server
4. Navigate to `http://localhost:3012/en/admin`
5. **Result**: Automatic admin access without login

**Option 2: Use Clerk Authentication**
1. Keep `NEXT_PUBLIC_DISABLE_AUTH` commented out
2. Navigate to `http://localhost:3012/en/admin`
3. **Result**: Redirects to sign-in page
4. Sign in with Clerk account
5. Admin access requires `isAdmin: true` in Clerk user metadata

### Setting Up Admin User in Clerk
1. Go to Clerk Dashboard
2. Select your user account
3. Add to **public metadata**:
```json
{
  "isAdmin": true
}
```

### Middleware Configuration
**File**: `/Users/masa/Projects/managed/aipowerranking/middleware.ts`

Protected routes (lines 26-30):
```typescript
const isProtectedRoute = createRouteMatcher([
  "/(.*)/admin(.*)",
  "/(.*)/dashboard(.*)",
  "/api/admin(.*)",
]);
```

---

## 6. OpenRouter API 400 Error Diagnosis

### Potential Causes (Ranked by Likelihood)

#### 1. Environment Variable Missing (HIGH)
**Symptom**: API key not available in production
**Check**: Verify `OPENROUTER_API_KEY` is set in production environment variables
**Fix**: Add to Vercel/Railway/hosting platform environment variables

#### 2. Model Name Changed (MEDIUM)
**Symptom**: OpenRouter rejects `anthropic/claude-sonnet-4`
**Check**: Visit https://openrouter.ai/docs/models
**Fix**: Update model name if deprecated (alternatives listed in code comments)

#### 3. Content Size Exceeds Limits (MEDIUM)
**Symptom**: Large articles cause 400 errors
**Current limit**: 8000 characters (line 234)
**Fix**: Add better truncation or chunking logic

#### 4. Request Validation Error (LOW)
**Symptom**: OpenRouter rejects request format
**Check**: Headers, message structure, temperature, max_tokens
**Fix**: Review OpenRouter API documentation for required fields

### Debugging Steps

**Step 1**: Enable verbose logging
```typescript
// In API call
const response = await fetch("/api/admin/news/analyze", {
  body: JSON.stringify({
    input: articleText,
    type: "text",
    verbose: true  // ADD THIS
  })
});
```

**Step 2**: Check server logs for detailed error
```bash
# Server console will show:
[News Analysis] OpenRouter API error: [exact error message]
[News Analysis] Troubleshooting steps: [...]
```

**Step 3**: Test API key in production
```bash
# SSH into production server or use Vercel CLI
curl -X POST https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -d '{"model": "anthropic/claude-sonnet-4", "messages": [{"role": "user", "content": "test"}]}'
```

---

## 7. Recommended Fixes

### For OpenRouter API 400 Errors

**Priority 1: Environment Variable**
```bash
# Verify in production
echo $OPENROUTER_API_KEY
# Should output: sk-or-v1-...

# If missing, add to environment:
# Vercel: Project Settings > Environment Variables
# Railway: Project > Variables
# Heroku: Config Vars
```

**Priority 2: Add Fallback Model**
```typescript
// In analyzeWithOpenRouter function (line 150)
const models = [
  "anthropic/claude-sonnet-4",
  "anthropic/claude-3.5-sonnet",  // Fallback
  "anthropic/claude-3-haiku"      // Budget fallback
];

let modelName = models[0];
// Try each model on failure
```

**Priority 3: Better Error Reporting**
```typescript
// Add to error response (line 792)
return NextResponse.json({
  error: errorMessage,
  ...errorDetails,
  request_preview: {  // ADD THIS
    content_length: content?.length,
    model: modelName,
    api_key_present: !!openRouterKey,
    api_key_format: openRouterKey?.startsWith('sk-or-')
  }
}, { status: statusCode });
```

### For Baseline Scoring

**Priority 1: Run Initialization Script**
```bash
npm run script:initialize-baseline-scores
```

**Priority 2: Verify Database Schema**
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'tools'
AND column_name IN ('baseline_score', 'delta_score', 'current_score');
```

**Priority 3: Implement Baseline Versioning**
- Create `baseline_versions` table
- Add snapshot/restore functionality
- Save "May 2025 Baseline" snapshot

---

## 8. Article Scoring Flow Verification

### How Articles Affect Scores (Confirmed)

**Step 1**: Article ingested with tool mentions
**Step 2**: AI analyzes sentiment and importance
**Step 3**: Delta scores calculated based on:
- Sentiment (-1 to 1)
- Importance score (0-10)
- Qualitative metrics (innovation, business sentiment, etc.)

**Step 4**: `updateDeltaScore()` called - **NOT** `updateBaselineScore()`
**Step 5**: Current score recalculated as `baseline + delta`
**Step 6**: Baseline remains **unchanged**

### Verification
```typescript
// From tool-scoring.service.ts (lines 145-181)
async updateDeltaScore(toolId: string, deltaScore: ToolScoreFactors) {
  // Get current BASELINE score (read-only)
  const current = await this.getToolScoring(toolId);
  const baselineScore = current?.baselineScore || {};  // PRESERVED

  // Calculate NEW current score
  const currentScore = this.calculateCurrentScore(baselineScore, deltaScore);

  // Update ONLY delta and current, NOT baseline
  await db.update(tools).set({
    deltaScore,        // ← UPDATED
    currentScore,      // ← RECALCULATED
    scoreUpdatedAt: new Date(),
    updatedAt: new Date()
  });
  // baselineScore NOT in SET clause = PRESERVED ✅
}
```

---

## 9. Summary of Findings

### OpenRouter API
- ✅ API key valid and working
- ✅ Request format correct
- ✅ Comprehensive error handling
- ⚠️ QA errors likely due to environment configuration, not code
- ⚠️ No fallback models configured

### Baseline Scoring
- ✅ Architecture correctly implements baseline + delta pattern
- ✅ Articles modify delta scores only
- ✅ Baseline is preserved across article ingestion
- ❌ No May 2025 baseline snapshot exists
- ❌ No baseline versioning system
- ⚠️ Initialization script exists but may not have been run

### Admin UI Access
- ✅ Can disable auth with `NEXT_PUBLIC_DISABLE_AUTH=true`
- ✅ Or use Clerk with `isAdmin: true` metadata
- ✅ Middleware properly protects admin routes

### Next Steps
1. Enable verbose logging in production to capture exact 400 error
2. Verify `OPENROUTER_API_KEY` environment variable in production
3. Run baseline initialization script if not already done
4. Consider implementing baseline versioning for "May 2025" snapshot
5. Add fallback model support for OpenRouter API resilience

---

## Files Analyzed

- `/Users/masa/Projects/managed/aipowerranking/app/api/admin/news/analyze/route.ts`
- `/Users/masa/Projects/managed/aipowerranking/lib/services/tool-scoring.service.ts`
- `/Users/masa/Projects/managed/aipowerranking/lib/db/schema.ts`
- `/Users/masa/Projects/managed/aipowerranking/middleware.ts`
- `/Users/masa/Projects/managed/aipowerranking/.env.local`
- `/Users/masa/Projects/managed/aipowerranking/scripts/initialize-baseline-scores.ts`
- `/Users/masa/Projects/managed/aipowerranking/docs/baseline-scoring-usage.md`
- `/Users/masa/Projects/managed/aipowerranking/docs/AUTHENTICATION-CONFIG.md`

## Investigation Date
2025-10-01

---
