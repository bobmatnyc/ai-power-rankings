# Data Path Mismatch - Visual Diagram

## The Problem: Algorithm v7.4 Can't See Collected Metrics

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TOOLS TABLE (PostgreSQL)                         │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Tool: GitHub Copilot                                           │    │
│  │  Slug: github-copilot                                           │    │
│  │                                                                  │    │
│  │  data (JSONB):                                                   │    │
│  │  {                                                               │    │
│  │    "metrics": {           ◄─── ✅ ACTUAL STORAGE LOCATION       │    │
│  │      "vscode": {                                                 │    │
│  │        "extension_id": "GitHub.copilot",                         │    │
│  │        "installs": 50000000,                                     │    │
│  │        "rating": 4.5,                                            │    │
│  │        "ratings_count": 12000                                    │    │
│  │      },                                                          │    │
│  │      "github": {                                                 │    │
│  │        "stars": 45000,                                           │    │
│  │        "forks": 2000                                             │    │
│  │      },                                                          │    │
│  │      "npm": {                                                    │    │
│  │        "downloads_last_month": 1000000                           │    │
│  │      }                                                           │    │
│  │    },                                                            │    │
│  │    "info": {              ◄─── ❌ WHERE v7.4 LOOKS (EMPTY!)     │    │
│  │      "description": "...",                                       │    │
│  │      "features": [...],                                          │    │
│  │      "company": "GitHub/Microsoft"                               │    │
│  │      // NO metrics here!                                         │    │
│  │    }                                                             │    │
│  │  }                                                               │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │
                    ┌───────────────┴────────────────┐
                    │                                │
                    ▼                                ▼
        ┌──────────────────────┐      ┌──────────────────────────┐
        │  COLLECTION SCRIPTS  │      │   ALGORITHM v7.4         │
        │   (What writes)      │      │   (What reads)           │
        └──────────────────────┘      └──────────────────────────┘
                    │                                │
                    │                                │
        ┌───────────▼──────────┐      ┌────────────▼─────────────┐
        │                      │      │                          │
        │  Writes to:          │      │  Reads from:             │
        │                      │      │                          │
        │  data.metrics.vscode │      │  data.info.vscode_installs│
        │  data.metrics.github │      │  data.info.github_stats  │
        │  data.metrics.npm    │      │  data.info.npm_downloads │
        │  data.metrics.pypi   │      │  data.info.metrics.*     │
        │                      │      │                          │
        └──────────────────────┘      └──────────────────────────┘
                    │                                │
                    │                                │
                    ▼                                ▼
        ┌───────────────────────┐      ┌─────────────────────────┐
        │  ✅ SUCCESS            │      │  ❌ FINDS NOTHING       │
        │  92.5% coverage        │      │  Reports 2-8% only      │
        │  Data stored!          │      │  Can't see the data!    │
        └───────────────────────┘      └─────────────────────────┘
```

## The Disconnect

### Collection Scripts Store At:

```typescript
// scripts/collect-vscode-metrics.ts (line 530)
// scripts/collect-github-metrics.ts (line 391)
// scripts/collect-npm-metrics.ts (line 457)
// scripts/collect-pypi-metrics.ts (line 400)

const updatedData = {
  ...currentData,
  metrics: {                          // ◄─── TOP LEVEL
    ...(currentData.metrics || {}),
    vscode: { /* VS Code metrics */ },
    github: { /* GitHub metrics */ },
    npm: { /* npm metrics */ },
    pypi: { /* PyPI metrics */ }
  }
}
```

### Algorithm v7.4 Reads From:

```typescript
// lib/ranking-algorithm-v74.ts (lines 143-211)

function calculateDataCompleteness(metrics: ToolMetricsV74): number {
  const dataPoints = {
    // Looking at WRONG path!
    hasGitHubStars:
      hasValue(metrics.info?.metrics?.github_stars) ||    // ◄─── data.info.metrics.*
      hasValue(metrics.info?.github_stats?.stars),        // ◄─── data.info.github_stats.*

    hasVSCodeInstalls:
      hasValue(metrics.info?.vscode_installs),            // ◄─── data.info.*

    hasnpmDownloads:
      hasValue(metrics.info?.npm_downloads),              // ◄─── data.info.*
  }
}
```

## The Impact

| Metric Source | Tools Collected | v7.4 Can See | Lost Coverage |
|---------------|-----------------|--------------|---------------|
| VS Code Marketplace | 39 tools (73.6%) | 0 tools (0%) | -73.6% |
| npm Registry | 42 tools (79.2%) | 0 tools (0%) | -79.2% |
| PyPI | 6 tools (11.3%) | 0 tools (0%) | -11.3% |
| GitHub | 4 tools (9.0%) | 0 tools (0%) | -9.0% |
| **TOTAL** | **92.5%** | **~5%** | **-87.5%** |

## What v7.4 Actually Sees

Since it can't find the high-value metrics, it falls back to low-value signals:

```typescript
// Low-value metrics (10 points each)
✅ hasDescription: (info.description.length > 100)     // Most tools have
✅ hasFeatures: (info.features.length > 5)             // Many tools have
✅ hasCompanyInfo: (info.company exists)               // Some tools have
✅ hasPricing: (info.business.pricing_model exists)    // Some tools have

// Result: Tools get 30-50 points instead of 70-100 points
// Confidence multiplier: 0.73-0.85 instead of 0.92-1.0
```

## The Fix

### Option A: Fix Algorithm (RECOMMENDED)

Update `lib/ranking-algorithm-v74.ts` to check BOTH paths:

```typescript
const dataPoints = {
  hasGitHubStars:
    // NEW: Check actual location first
    hasValue(metrics.metrics?.github?.stars) ||
    // OLD: Keep for backward compatibility
    hasValue(metrics.info?.metrics?.github_stars) ||
    hasValue(metrics.info?.github_stats?.stars),

  hasVSCodeInstalls:
    // NEW: Check actual location first
    hasValue(metrics.metrics?.vscode?.installs) ||
    // OLD: Keep for backward compatibility
    hasValue(metrics.info?.vscode_installs),

  hasnpmDownloads:
    // NEW: Check actual location first
    hasValue(metrics.metrics?.npm?.downloads_last_month) ||
    // OLD: Keep for backward compatibility
    hasValue(metrics.info?.npm_downloads)
}
```

**Result:** Instantly recognizes 92.5% of collected metrics!

### Option B: Migrate Data (NOT RECOMMENDED)

- Move all `data.metrics.*` to `data.info.metrics.*`
- Update all collection scripts
- Risk of data loss
- More complex rollout

## Verification

Run these commands to verify the mismatch:

```bash
# TypeScript verification script
npx tsx scripts/verify-data-paths.ts

# SQL verification (if you have psql access)
psql $DATABASE_URL -f scripts/verify-metrics-storage.sql
```

Expected output should confirm:
- ✅ 92.5% of tools have metrics at `data.metrics.*`
- ❌ 0% of tools have metrics at `data.info.*` (where v7.4 looks)
- 📊 Diagnosis: MISMATCH CONFIRMED
