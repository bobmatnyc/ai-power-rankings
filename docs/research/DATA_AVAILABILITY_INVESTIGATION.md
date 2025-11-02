# Data Availability Investigation Report

**Date:** 2025-11-01
**Issue:** Algorithm v7.4 reports 2-8% data availability despite 92.5% metrics collection
**Status:** Root cause identified ✅

---

## Executive Summary

**ROOT CAUSE IDENTIFIED:** Data path mismatch between collection scripts and algorithm v7.4.

- **Collected data stored at:** `data.metrics.{source}.{fields}`
- **Algorithm v7.4 expects:** `data.info.metrics.{fields}` or `data.info.{source}_stats.{fields}`

**Impact:** 92.5% of collected metrics are invisible to the algorithm, causing incorrect data completeness scores.

---

## Detailed Findings

### 1. How Data is Actually Stored

Collection scripts store metrics at the **top-level `metrics` object**:

```typescript
// Collection scripts pattern (ALL 4 collectors)
const updatedData = {
  ...currentData,
  metrics: {
    ...(currentData.metrics || {}),
    vscode: { /* VS Code metrics */ },     // or
    github: { /* GitHub metrics */ },       // or
    npm: { /* npm metrics */ },             // or
    pypi: { /* PyPI metrics */ }
  }
}
```

**Actual database structure:**
```json
{
  "data": {
    "metrics": {
      "vscode": {
        "extension_id": "GitHub.copilot",
        "installs": 50000000,
        "rating": 4.5,
        "ratings_count": 12000
      },
      "github": {
        "stars": 45000,
        "forks": 2000,
        "watchers": 1500
      },
      "npm": {
        "downloads_last_month": 1000000,
        "package_name": "@continuedev/continue"
      },
      "pypi": {
        "downloads_last_month": 50000,
        "package_name": "aider-chat"
      }
    },
    "info": {
      // Original tool info (features, description, etc.)
    }
  }
}
```

### 2. What Algorithm v7.4 Expects

From `/lib/ranking-algorithm-v74.ts` lines 143-211:

```typescript
function calculateDataCompleteness(metrics: ToolMetricsV74): number {
  const dataPoints = {
    // GitHub stars - EXPECTS: metrics.info?.metrics?.github_stars
    hasGitHubStars: hasValue(metrics.info?.metrics?.github_stars) ||
                     hasValue(metrics.info?.github_stats?.stars),

    // VS Code installs - EXPECTS: metrics.info?.vscode_installs
    hasVSCodeInstalls: hasValue(metrics.info?.vscode_installs),

    // npm downloads - EXPECTS: metrics.info?.npm_downloads
    hasnpmDownloads: hasValue(metrics.info?.npm_downloads),

    // User count - EXPECTS: metrics.info?.metrics?.users
    hasUserCount: hasValue(metrics.info?.metrics?.users) ||
                  hasValue(metrics.info?.user_count),

    // Revenue - EXPECTS: metrics.info?.metrics?.monthly_arr
    hasRevenue: hasValue(metrics.info?.metrics?.monthly_arr) ||
                hasValue(metrics.info?.metrics?.annual_recurring_revenue),

    // SWE-bench - EXPECTS: metrics.info?.metrics?.swe_bench?.verified
    hasSWEBench: hasValue(metrics.info?.metrics?.swe_bench?.verified) ||
                 hasValue(metrics.info?.technical?.swe_bench_score)
  }
}
```

**Algorithm v7.4 expects:**
```json
{
  "info": {
    "vscode_installs": 50000000,           // FLAT at info level
    "npm_downloads": 1000000,               // FLAT at info level
    "github_stats": {                       // NESTED under info
      "stars": 45000
    },
    "metrics": {                            // NESTED under info
      "github_stars": 45000,
      "users": 1000000,
      "monthly_arr": 10000000,
      "swe_bench": {
        "verified": 40.5,
        "lite": 35.0
      }
    }
  }
}
```

### 3. The Mismatch

| Metric Type | Collected Path | v7.4 Expected Path | Match? |
|-------------|---------------|-------------------|--------|
| GitHub stars | `data.metrics.github.stars` | `data.info.metrics.github_stars` or `data.info.github_stats.stars` | ❌ |
| VS Code installs | `data.metrics.vscode.installs` | `data.info.vscode_installs` | ❌ |
| npm downloads | `data.metrics.npm.downloads_last_month` | `data.info.npm_downloads` | ❌ |
| User count | N/A (not collected) | `data.info.metrics.users` or `data.info.user_count` | ❌ |
| Revenue | N/A (not collected) | `data.info.metrics.monthly_arr` | ❌ |
| SWE-bench | N/A (not in metrics) | `data.info.metrics.swe_bench.verified` | ❌ |

**Result:** Algorithm sees NONE of the collected metrics → reports 2-8% availability

---

## Coverage Analysis

### Actual Data Collected (Previous Session)

| Source | Tools | Coverage | Stored At |
|--------|-------|----------|-----------|
| VS Code Marketplace | 39 | 73.6% | `data.metrics.vscode.*` |
| npm Registry | 42 | 79.2% | `data.metrics.npm.*` |
| PyPI | 6 | 11.3% | `data.metrics.pypi.*` |
| GitHub | 4 | 9.0% | `data.metrics.github.*` |
| **Total** | **92.5%** | **Available but invisible** | ⚠️ Wrong path |

### What v7.4 Can Actually See

Since the paths don't match, v7.4 falls back to:
- Description quality (if `info.description.length > 100`)
- Feature count (if `info.features.length > 5`)
- Company info (if `info.company` exists)
- Pricing model (if `info.business.pricing_model` exists)

These are the "low-value metrics" (10 points each), giving most tools only 30-40% completeness.

---

## SQL Verification Script

```sql
-- Check actual vs expected data paths
SELECT
  t.slug,
  t.name,
  -- Check if metrics exist in ACTUAL location
  CASE WHEN t.data->'metrics'->'vscode' IS NOT NULL THEN 'YES' ELSE 'NO' END as has_vscode_metrics,
  CASE WHEN t.data->'metrics'->'github' IS NOT NULL THEN 'YES' ELSE 'NO' END as has_github_metrics,
  CASE WHEN t.data->'metrics'->'npm' IS NOT NULL THEN 'YES' ELSE 'NO' END as has_npm_metrics,
  CASE WHEN t.data->'metrics'->'pypi' IS NOT NULL THEN 'YES' ELSE 'NO' END as has_pypi_metrics,

  -- Check if metrics exist in EXPECTED location (v7.4)
  CASE WHEN t.data->'info'->'vscode_installs' IS NOT NULL THEN 'YES' ELSE 'NO' END as v74_sees_vscode,
  CASE WHEN t.data->'info'->'github_stats' IS NOT NULL THEN 'YES' ELSE 'NO' END as v74_sees_github,
  CASE WHEN t.data->'info'->'npm_downloads' IS NOT NULL THEN 'YES' ELSE 'NO' END as v74_sees_npm,

  -- Sample values
  (t.data->'metrics'->'vscode'->>'installs')::bigint as actual_vscode_installs,
  (t.data->'metrics'->'github'->>'stars')::int as actual_github_stars,
  (t.data->'info'->>'vscode_installs')::bigint as v74_vscode_installs,
  (t.data->'info'->'github_stats'->>'stars')::int as v74_github_stars
FROM tools t
WHERE
  t.data->'metrics' IS NOT NULL
ORDER BY
  (t.data->'metrics'->'vscode'->>'installs')::bigint DESC NULLS LAST
LIMIT 20;
```

---

## Recommended Fix Strategy

### Option A: Fix Algorithm (RECOMMENDED ✅)

**Pros:**
- Simpler, faster fix
- No data migration risk
- Preserves existing data structure
- Collection scripts don't need changes

**Cons:**
- Algorithm must support both paths for backward compatibility

**Implementation:**
Update `lib/ranking-algorithm-v74.ts` to check both paths:

```typescript
// Helper to check multiple possible paths
const getMetricValue = (metrics: ToolMetricsV74, ...paths: string[]): number => {
  for (const path of paths) {
    const value = getValueByPath(metrics, path);
    if (hasValue(value)) return value;
  }
  return 0;
};

const dataPoints = {
  // GitHub stars - check BOTH locations
  hasGitHubStars: hasValue(getMetricValue(metrics,
    'metrics.github.stars',           // NEW: Actual location
    'info.metrics.github_stars',      // OLD: Expected location
    'info.github_stats.stars'         // OLD: Alternative location
  )),

  // VS Code installs
  hasVSCodeInstalls: hasValue(getMetricValue(metrics,
    'metrics.vscode.installs',        // NEW: Actual location
    'info.vscode_installs'            // OLD: Expected location
  )),

  // npm downloads
  hasnpmDownloads: hasValue(getMetricValue(metrics,
    'metrics.npm.downloads_last_month', // NEW: Actual location
    'info.npm_downloads'               // OLD: Expected location
  ))
};
```

### Option B: Migrate Data Structure

**Pros:**
- Cleaner data model
- Algorithm stays as-is

**Cons:**
- Risk of data loss during migration
- Collection scripts need updating
- More complex rollout

**Not recommended** due to migration complexity.

---

## Action Items

1. ✅ **CONFIRMED:** Data mismatch identified
2. ⏭️ **FIX ALGORITHM:** Update v7.4 to read from `data.metrics.{source}.*` paths
3. ⏭️ **ADD TESTS:** Verify algorithm reads collected metrics correctly
4. ⏭️ **RUN VERIFICATION:** Re-test data completeness after fix
5. ⏭️ **EXPECTED RESULT:** Data completeness should jump to 70-90% for tools with metrics

---

## Conclusion

The 92.5% metrics collection was successful. The algorithm simply cannot see the data due to a path mismatch. Fixing the algorithm to read from the correct paths (`data.metrics.*`) will immediately resolve the issue and allow v7.4 to properly recognize the collected metrics.
