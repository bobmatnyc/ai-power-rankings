# June 2025 Data Import Summary

## Source Data

- **Original File**: `data/incoming/ai-power-rankings-updates-june-2025.json`
- **Processing Date**: 2025-06-10
- **Records Processed**: 8 news items → 14 metrics + 3 tools + 11 capabilities

## Import Files Created

### 1. Metrics History (`june-2025-metrics-import.json`)

- **Records**: 14 metrics entries
- **Key Updates**:
  - **Cursor**: $500M ARR milestone, 360K paying users
  - **Claude Code**: 72.7% SWE-bench breakthrough score
  - **GitHub Copilot**: $400M ARR, 15M users
  - **Augment Code**: $227M funding, $977M valuation, 65.4% SWE-bench
  - **Devin**: Price cut reality check, $1.5M ARR, 75K users
  - **Windsurf**: $40M ARR at acquisition
  - **OpenAI Codex CLI**: 75% SWE-bench score
  - **Zed**: 47K GitHub stars

### 2. Tool Updates (`june-2025-tool-updates.json`)

- **Records**: 3 new/updated tools
- **New Tools**:
  - **Augment Code**: Stealth exit with Series B
  - **OpenAI Codex CLI**: Open-source autonomous coding
- **Updated Tools**:
  - **Windsurf**: Acquisition status

### 3. Capabilities Updates (`june-2025-capabilities-updates.json`)

- **Records**: 11 capability entries
- **Key Features**:
  - Augment Code: 200K token context window
  - OpenAI Codex CLI: o3 reasoning model integration
  - Zed: Rust-based architecture emphasis

## Database Changes

### Metric Definitions Added

- `monthly_arr`: Monthly Annual Recurring Revenue
- `users`: Active user count
- `swe_bench_score`: SWE-bench coding benchmark
- `total_funding_usd`: Total funding raised
- `valuation_usd`: Company valuation
- `context_window_tokens`: AI context window size
- `github_stars`: Repository star count

### Tools Added/Updated

- Added missing tool: `zed`
- Updated existing tools with new information
- Maintained foreign key integrity

## Import Results

- ✅ **14 metrics** successfully imported
- ✅ **3 tools** successfully imported/updated
- ✅ **11 capabilities** successfully imported
- ✅ All schema validations passed
- ✅ All foreign key constraints satisfied

## Key Market Insights Captured

1. **Growth Velocity**: Cursor's record-breaking $500M ARR achievement
2. **Technical Benchmarks**: Claude 4's 72.7% SWE-bench approaching human performance
3. **Market Consolidation**: OpenAI's $3B Windsurf acquisition
4. **Funding Reality**: Devin's 96% price cut revealing adoption challenges
5. **Scale Advantages**: GitHub Copilot's sustained enterprise dominance
6. **Innovation Pipeline**: New entrants like Augment Code and OpenAI Codex CLI

## Import Commands Used

```bash
# 1. Add metric definitions
node scripts/add-metric-definitions.js

# 2. Check and add missing tools
node scripts/check-and-add-tools.js

# 3. Import tools first (for foreign key constraints)
node scripts/import-data.js data/imports/june-2025-tool-updates.json

# 4. Import metrics data
node scripts/import-data.js data/imports/june-2025-metrics-import.json

# 5. Import capabilities
node scripts/import-data.js data/imports/june-2025-capabilities-updates.json
```

## Next Steps

- Run ranking recalculation to reflect new metrics
- Update algorithm weights if needed based on new data points
- Consider adding news_updates table entries for historical tracking
- Review and validate imported data accuracy
