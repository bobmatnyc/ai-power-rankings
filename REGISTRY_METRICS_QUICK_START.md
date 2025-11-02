# Package Registry Metrics - Quick Start Guide

## Overview
Automated scripts to collect metrics from VS Code Marketplace, npm, and PyPI registries.

**Current Coverage: 92.5% (49/53 tools)**

## Quick Commands

### Collect All Metrics (Full Run)
```bash
# Collect from all three registries (takes ~5-10 minutes total)
npx tsx scripts/collect-vscode-metrics.ts --full  # ~3-4 minutes
npx tsx scripts/collect-npm-metrics.ts --full     # ~2-3 minutes
npx tsx scripts/collect-pypi-metrics.ts --full    # ~2-3 minutes

# Generate comprehensive report
npx tsx scripts/generate-registry-metrics-report.ts
```

### Test Mode (5 tools only)
```bash
# Quick test on 5 tools
npx tsx scripts/collect-vscode-metrics.ts --test
npx tsx scripts/collect-npm-metrics.ts --test
npx tsx scripts/collect-pypi-metrics.ts --test
```

### Preview Mode (no collection)
```bash
# See what would be collected without making API calls
npx tsx scripts/collect-vscode-metrics.ts
npx tsx scripts/collect-npm-metrics.ts
npx tsx scripts/collect-pypi-metrics.ts
```

## What Gets Collected

### VS Code Marketplace
- Extension ID and publisher
- Install count
- Average rating and rating count
- Last updated date
- Current version

### npm Registry
- Package name
- Monthly and weekly download counts
- Current version
- License
- Dependencies count
- Last publish date

### PyPI
- Package name
- Monthly download count (via pypistats.org)
- Current version
- Python version requirement
- License
- Last release date

## Data Storage

Metrics are stored in the database under `tools.data.metrics`:

```json
{
  "metrics": {
    "vscode": {
      "extension_id": "GitHub.copilot",
      "installs": 57339056,
      "rating": 4.2,
      "ratings_count": 1020
    },
    "npm": {
      "package_name": "@github/copilot",
      "downloads_last_month": 265480,
      "downloads_last_week": 54754
    },
    "pypi": {
      "package_name": "aider-chat",
      "downloads_last_month": 218611,
      "current_version": "0.86.1"
    },
    "github": {
      "stars": 50000,
      "forks": 5000
    }
  }
}
```

## Current Results (as of Nov 1, 2025)

| Registry | Coverage | Top Tool | Top Metric |
|----------|----------|----------|------------|
| VS Code | 73.6% (39/53) | GitHub Copilot | 57.3M installs |
| npm | 79.2% (42/53) | ChatGPT Canvas* | 17.1M downloads/mo |
| PyPI | 11.3% (6/53) | Aider | 218K downloads/mo |
| **Combined** | **92.5% (49/53)** | - | - |

*Note: Some matches may be false positives and require manual validation

## Tools with Multiple Metrics (High Confidence)

✅ **3 Sources:**
- Aider (VS Code + PyPI + GitHub)
- Claude Code (VS Code + npm + PyPI)
- Goose (VS Code + npm + GitHub)
- Cline (VS Code + npm + PyPI)
- GitHub Copilot (VS Code + npm + PyPI)

📊 **2 Sources:** 31 tools

## Tools with No Metrics (Manual Review Needed)

❌ **4 tools:**
- Anything Max
- Windsurf
- Microsoft IntelliCode
- ClackyAI

## Maintenance Schedule

**Recommended:** Run monthly to keep metrics current

```bash
# Add to cron or GitHub Actions
# Run on 1st of each month at 2am
0 2 1 * * cd /path/to/project && npx tsx scripts/collect-vscode-metrics.ts --full && npx tsx scripts/collect-npm-metrics.ts --full && npx tsx scripts/collect-pypi-metrics.ts --full
```

## API Rate Limits

- **VS Code Marketplace:** No authentication required, 2 sec delay between requests
- **npm Registry:** No authentication required, 1 sec delay between requests
- **PyPI:** No authentication required, 1 sec delay between requests

Total time for full collection: ~5-10 minutes

## Troubleshooting

### Issue: "Database connection not available"
**Solution:** Ensure `.env.local` has correct `DATABASE_URL_DEVELOPMENT`

### Issue: "Package not found" for known package
**Solution:** Check manual mappings in collector script, may need to add tool

### Issue: False positive matches
**Solution:** Add tool to `knownPackages` with `null` value to skip

### Issue: Rate limit errors
**Solution:** Increase `requestDelay` in collector class

## Next Steps

1. **Validate Top Tools:** Manually check top 10 in each registry for accuracy
2. **Remove False Positives:** Update known mappings to exclude incorrect matches
3. **Integrate into Algorithm:** Use metrics in Developer Adoption factor (v7.3)
4. **Automate Collection:** Add to CI/CD pipeline for monthly updates

## See Also

- [PACKAGE_REGISTRY_METRICS_REPORT.md](./PACKAGE_REGISTRY_METRICS_REPORT.md) - Full detailed report
- [scripts/collect-vscode-metrics.ts](./scripts/collect-vscode-metrics.ts) - VS Code collector
- [scripts/collect-npm-metrics.ts](./scripts/collect-npm-metrics.ts) - npm collector
- [scripts/collect-pypi-metrics.ts](./scripts/collect-pypi-metrics.ts) - PyPI collector
- [scripts/generate-registry-metrics-report.ts](./scripts/generate-registry-metrics-report.ts) - Report generator

---

**Status:** ✅ Production Ready
**Coverage:** 92.5% (49/53 tools)
**Last Updated:** November 1, 2025
