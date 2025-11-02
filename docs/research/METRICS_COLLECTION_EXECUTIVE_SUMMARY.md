# Metrics Collection Research - Executive Summary

**Date:** November 1, 2025  
**Research Duration:** 4 hours  
**Status:** ✅ Complete

---

## TL;DR

We can achieve **80-85% metrics coverage** for all 51 AI coding tools within **4 weeks** at **$0-250/month** cost. Quick wins available this week using free APIs (GitHub, SWE-bench, VS Code, npm, PyPI).

---

## Current State

- **Tools:** 51 actively ranked, 53 in database
- **Current Data Coverage:** ~0-5% (proxy metrics only)
- **Algorithm:** v7.2/v7.3 using category bonuses and feature counts
- **Problem:** 72.5% duplicate scores due to lack of real metrics

---

## Available Data Sources

### FREE (Immediate Implementation)

1. **SWE-bench Scores** - https://www.swebench.com/
   - Coverage: 15-20 tools
   - Method: Manual scraping
   - Impact: Primary metric for agentic capability (35% weight)

2. **GitHub API** - 5,000 requests/hour with token
   - Coverage: 20-25 tools (open source)
   - Metrics: Stars, forks, commits, contributors
   - Impact: Developer adoption (12.5% weight)

3. **VS Code Marketplace API** - Undocumented but accessible
   - Coverage: 15-20 tools
   - Metrics: Install counts, ratings
   - Impact: Developer adoption (12.5% weight)

4. **npm Registry API** - Official, unlimited
   - Coverage: 5-10 tools
   - Metrics: Download stats
   - Impact: Developer adoption (12.5% weight)

5. **PyPI Stats API** - Official, 180 days
   - Coverage: 5-10 tools  
   - Metrics: Download stats
   - Impact: Developer adoption (12.5% weight)

6. **HackerNews API** - Official, no auth
   - Coverage: All 51 tools
   - Metrics: Mentions, sentiment
   - Impact: Community traction (12.5% weight)

### PAID (Optional Enhancement)

7. **Crunchbase API** - $49-199/month
   - Coverage: 30-40 tools
   - Metrics: Funding, valuation, employees
   - Impact: Market traction (12.5% weight)

8. **NewsData.io** - $199/month
   - Coverage: All 51 tools
   - Metrics: Comprehensive news tracking
   - Impact: Business sentiment (12.5% weight)

---

## Coverage Projection

### Phase 1 (Week 1) - FREE
```
SWE-bench:    40% (15-20 tools)
GitHub:       45% (20-25 tools)
VS Code:      35% (15-20 tools)
npm/PyPI:     20% (8-10 tools each)

Overall: ~28% coverage
Cost: $0
```

### Phase 2 (Weeks 2-3) - FREE
```
+ News mentions:    100% (all tools)
+ HackerNews:       100% (all tools)
+ Community metrics: 100% (aggregated)

Overall: ~51% coverage
Cost: $0
```

### Phase 3 (Week 4) - OPTIONAL PAID
```
+ Funding data:     70% (30-40 tools)
+ Advanced news:    100% (all tools)

Overall: ~75% coverage
Cost: $0-250/month
```

### With Manual Research - ONGOING
```
+ Manual enrichment
+ SWE-bench updates
+ Public research

Overall: 80-85% coverage
Cost: $0-250/month
```

---

## Quick Wins - This Week

### Day 1-2: SWE-bench Collection
- Research leaderboard at swebench.com
- Map tool names to our database
- Manual data entry for 15-20 tools
- **Impact:** Immediate scoring accuracy for autonomous agents

### Day 3-4: GitHub Metrics
- Create GitHub personal access token
- Implement collection script (provided in report)
- Collect stars, forks, commits for 20-25 tools
- **Impact:** Real adoption data for open source tools

### Day 5: Package Registries
- Implement VS Code, npm, PyPI collectors
- Collect install/download metrics
- **Impact:** Usage data for 30-40 additional tools

**Week 1 Result:** 28% coverage, $0 cost, 20-25 hours effort

---

## Cost Analysis

### Recommended Approach
```
Week 1:     FREE ($0)    - GitHub, SWE-bench, VS Code, npm, PyPI
Week 2-3:   FREE ($0)    - News enhancement, HackerNews
Week 4:     DECIDE       - Continue free OR add paid APIs
Ongoing:    $0-250/month - Based on Week 3 decision
```

### Cost Options
```
Option A (FREE):           $0/month - 75% coverage achievable
Option B (MINIMAL PAID):   $49/month - 80% coverage (Crunchbase Pro)
Option C (COMPREHENSIVE):  $248/month - 85% coverage (Crunchbase + News API)
```

---

## Implementation Effort

```
Phase 1 (Week 1):     20-25 hours
Phase 2 (Weeks 2-3):  15-20 hours
Phase 3 (Week 4):     15-20 hours
Total:                50-65 hours over 4 weeks
```

---

## Key Deliverables

### Scripts (All Provided in Report)
1. `/scripts/collect-swebench-scores.ts` - Manual SWE-bench data
2. `/scripts/collect-github-metrics.ts` - GitHub API integration
3. `/scripts/collect-vscode-metrics.ts` - VS Code marketplace
4. `/scripts/collect-npm-metrics.ts` - npm registry
5. `/scripts/collect-pypi-metrics.ts` - PyPI stats
6. `/scripts/collect-hackernews-metrics.ts` - HackerNews mentions
7. `/scripts/collect-funding-metrics.ts` - Crunchbase (optional)

### Database Changes
- **Schema:** No changes needed (using existing JSONB fields)
- **Structure:** Add `metrics` object to `tools.data`
- **Migration:** Zero-downtime (just data updates)

### Algorithm Updates
- Replace category bonuses with real SWE-bench scores
- Replace proxy GitHub stars with actual API data
- Replace estimated adoption with real install counts
- Update v7.3 → v7.4 or v8.0 with real metrics

---

## Success Criteria

✅ **Primary Goal:** 80%+ metrics coverage within 4 weeks
✅ **Cost Target:** $0-250/month ongoing
✅ **Quality Target:** Eliminate duplicate scores in top 20
✅ **Maintainability:** Automated weekly/monthly updates

---

## Risks & Mitigation

### Risk 1: API Rate Limits
**Mitigation:** Authenticated requests, daily collection, caching

### Risk 2: Tool-to-Package Mapping
**Mitigation:** Manual verification, configuration file, testing on subset

### Risk 3: Data Quality
**Mitigation:** Validation rules, spot-checking, timestamp tracking

### Risk 4: Budget Overruns
**Mitigation:** Start with free APIs, evaluate before upgrading

---

## Recommendation

### START IMMEDIATELY with Phase 1 (FREE)

**Why:**
1. Zero cost, zero risk
2. 28% coverage achievable this week
3. Immediate scoring improvements
4. No budget approval needed
5. Validated approach before investing

**Action Items:**
1. ✅ Review full research report
2. ✅ Create GitHub personal access token
3. ✅ Run provided scripts on subset
4. ✅ Validate results
5. ✅ Deploy for all tools
6. ✅ Monitor for week
7. ⏳ Decide on Phase 2-3 based on results

---

## Full Documentation

📄 **Comprehensive Report:** `/docs/research/METRICS_COLLECTION_RESEARCH_REPORT.md`
- 13 sections, 1000+ lines
- Detailed API documentation
- Complete implementation scripts
- Coverage analysis matrices
- Cost projections
- Timeline and effort estimates

---

## Next Steps

1. **Today:** Review this summary and full report
2. **Tomorrow:** Set up GitHub token and test scripts
3. **Week 1:** Implement Phase 1 (free APIs)
4. **Week 2:** Review results and decide on Phase 2-3
5. **Week 4:** Deploy to production with monitoring

---

**Questions?** See full report for complete details on:
- API authentication and rate limits
- Sample code for all collectors
- Coverage matrices by tool category
- Open source vs proprietary breakdown
- Algorithm updates needed
- Database schema details
