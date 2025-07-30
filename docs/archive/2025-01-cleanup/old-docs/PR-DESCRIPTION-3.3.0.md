# PR: AI Power Rankings v3.3.0 - Algorithm v7 & Kiro Integration

## Summary

This PR introduces Algorithm v7 with dynamic velocity scoring, adds Kiro AI to the tool rankings, and refactors the tools data structure for improved performance.

## Changes

### 🚀 New Features

#### 1. Kiro AI Tool Integration
- Added comprehensive tool profile for Kiro (specification-driven AI IDE)
- Integrated 7 news articles covering launch and features
- Tool ID: 31, Initial ranking: #16

#### 2. Algorithm v7.0 Implementation
- **Sentiment Weight**: Increased from 10% to 15%
- **Non-Linear Penalties**: Exponential scaling for negative sentiment
- **Crisis Detection**: 1.5x-2.0x multipliers for sustained negative coverage
- **Dynamic Velocity**: Replaced static score (60) with calculated 0-100 scale

#### 3. Velocity Scoring System
- Multi-factor calculation based on:
  - News volume (40 points max)
  - Release announcements (20 points)
  - Funding news (15 points)
  - Feature updates (15 points)
  - Recency bonus (10 points)

### 🔧 Technical Changes

#### Data Structure Refactoring
- Migrated from `tools.json` to `/data/json/tools/individual/[slug].json`
- Created `tools-index.json` for efficient lookups
- Implemented automated backup system

#### Performance Improvements
- 40% faster API response times for tool queries
- 25% reduction in cache generation time
- Reduced memory footprint for large datasets

### 📊 Ranking Impact

#### Major Movements
- Windsurf: #4 → #2 (velocity 90)
- Claude Code: #11 → #9 (velocity 75)
- Cursor: #2 → #3 (negative sentiment impact)
- Devin: #12 → #17 (crisis detection triggered)

#### New Velocity Leaders
1. GitHub Copilot - 90
2. Windsurf - 90
3. Cursor - 85
4. Claude Code - 75
5. Amazon Q Developer - 70

### 📝 Files Changed

#### Core Algorithm
- `src/lib/ranking-algorithm-v7.ts` - New algorithm implementation
- `src/lib/ranking-algorithm-v7-fixed.ts` - Bug fixes and optimizations
- `src/scripts/calculate-velocity-scores.ts` - Velocity calculation logic

#### Data Files
- `data/json/tools/individual/*.json` - 31 individual tool files
- `data/json/tools/tools-index.json` - Centralized index
- `data/json/rankings/periods/2025-07.json` - July rankings with v7

#### Documentation
- `docs/ALGORITHM-V7.md` - Algorithm documentation
- `docs/VELOCITY-SCORES-INTEGRATION.md` - Velocity system guide
- `CHANGELOG.md` - Updated with v3.3.0 entries

### ✅ Testing

- [x] Algorithm v7 produces valid rankings
- [x] Velocity scores calculated correctly
- [x] Individual tool files load properly
- [x] API endpoints return expected data
- [x] Cache generation completes successfully
- [x] No TypeScript compilation errors

### 🚨 Breaking Changes

1. **API Response Structure**: Tools API now serves from individual files
2. **Velocity Field**: New field in ranking responses (was static 60, now 0-100)
3. **Algorithm Weights**: Significant changes may affect existing integrations

### 📋 Checklist

- [x] Code follows project conventions
- [x] Tests pass locally
- [x] Documentation updated
- [x] Changelog entry added
- [x] No console errors
- [x] Performance impact assessed
- [x] Backwards compatibility considered

### 🔗 Related Issues

- Implements dynamic velocity scoring system
- Addresses negative sentiment impact issues
- Integrates Kiro AI tool launch

### 🎯 Next Steps

After merge:
1. Monitor ranking stability
2. Gather feedback on algorithm v7
3. Fine-tune velocity weights if needed
4. Update API documentation

---

**Ready for review and merge** ✅