# Quick Fix: Algorithm v7.4 Data Path Mismatch

**Problem:** v7.4 reports 2-8% data availability, but we have 92.5% metrics collected

**Cause:** Data stored at `data.metrics.*` but algorithm looks at `data.info.*`

---

## The One-Line Summary

Collection scripts write to `data.metrics.vscode.*` but v7.4 reads from `data.info.vscode_installs` → mismatch!

---

## Quick Fix (30 minutes)

**File:** `lib/ranking-algorithm-v74.ts`
**Function:** `calculateDataCompleteness()` (lines 143-211)

### Change This:

```typescript
// OLD - Looking at wrong path
hasGitHubStars: hasValue(metrics.info?.metrics?.github_stars) ||
                hasValue(metrics.info?.github_stats?.stars),

hasVSCodeInstalls: hasValue(metrics.info?.vscode_installs),

hasnpmDownloads: hasValue(metrics.info?.npm_downloads),
```

### To This:

```typescript
// NEW - Check actual path first, then fallback
hasGitHubStars: hasValue(metrics.metrics?.github?.stars) ||              // NEW
                hasValue(metrics.info?.metrics?.github_stars) ||         // OLD
                hasValue(metrics.info?.github_stats?.stars),             // OLD

hasVSCodeInstalls: hasValue(metrics.metrics?.vscode?.installs) ||        // NEW
                   hasValue(metrics.info?.vscode_installs),              // OLD

hasnpmDownloads: hasValue(metrics.metrics?.npm?.downloads_last_month) || // NEW
                 hasValue(metrics.info?.npm_downloads),                  // OLD
```

### Bonus - Add PyPI (we have this data too!):

```typescript
// Add after line 160
hasPyPIDownloads: hasValue(metrics.metrics?.pypi?.downloads_last_month),

// Add scoring for PyPI (after line 198)
if (dataPoints.hasPyPIDownloads) score += 15;  // Medium-value metric
```

---

## Expected Results

### Before Fix:
```
GitHub Copilot: 30% completeness (0.79 confidence)
Cursor: 30% completeness (0.79 confidence)
Continue: 40% completeness (0.82 confidence)
```

### After Fix:
```
GitHub Copilot: 85% completeness (0.955 confidence) +55%
Cursor: 75% completeness (0.925 confidence) +45%
Continue: 95% completeness (0.985 confidence) +55%
```

---

## Test the Fix

```bash
# After making changes
npx tsx scripts/verify-data-paths.ts

# Should show:
# ✅ v7.4 can now see 70-90% of metrics (was 5%)
```

---

## Why This Happens

**Collection Scripts** (all 4 of them):
```typescript
// scripts/collect-vscode-metrics.ts (line 530)
// scripts/collect-github-metrics.ts (line 391)
// scripts/collect-npm-metrics.ts (line 457)
// scripts/collect-pypi-metrics.ts (line 400)

updatedData = {
  ...currentData,
  metrics: {           // ◄─── They all write here
    vscode: { ... },
    github: { ... },
    npm: { ... },
    pypi: { ... }
  }
}
```

**Algorithm v7.4**:
```typescript
// lib/ranking-algorithm-v74.ts (lines 143-211)

metrics.info?.vscode_installs  // ◄─── It reads here (WRONG!)
metrics.info?.metrics?.*       // ◄─── And here (ALSO WRONG!)
```

---

## Complete Fix Checklist

- [ ] Update `calculateDataCompleteness()` in `lib/ranking-algorithm-v74.ts`
- [ ] Add checks for `metrics.metrics.vscode.installs`
- [ ] Add checks for `metrics.metrics.github.stars`
- [ ] Add checks for `metrics.metrics.npm.downloads_last_month`
- [ ] (Bonus) Add checks for `metrics.metrics.pypi.downloads_last_month`
- [ ] Run `npx tsx scripts/verify-data-paths.ts` to verify
- [ ] Run `npx tsx scripts/test-data-completeness.ts` to see new scores
- [ ] Generate new rankings with fixed algorithm

---

## Full Documentation

See detailed investigation:
- `docs/research/INVESTIGATION_SUMMARY.md` - Executive summary
- `docs/research/DATA_AVAILABILITY_INVESTIGATION.md` - Technical details
- `docs/research/DATA_PATH_DIAGRAM.md` - Visual diagrams
