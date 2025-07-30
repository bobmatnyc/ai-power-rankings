# AI Power Rankings Algorithm Adjustments

## Date: July 29, 2025

### Context
Based on the fact-check article revealing significant inaccuracies in ranking claims and the need for more nuanced evaluation criteria.

## Recommended Adjustments

### 1. **Reduce News Impact Weight**
**Current**: 30% of total score
**Recommended**: 15-20%
**Rationale**: The fact-check revealed that news volume doesn't correlate with actual tool performance or adoption. GitHub Copilot's supposed jump from #19 to #1 was fictitious, suggesting our news weighting creates too much volatility.

### 2. **Add Verified Metrics Requirement**
**Issue**: Many tools show metrics without source verification
**Solution**: 
- Add a "verification_tier" to each metric:
  - Tier 1: Official company announcements with links
  - Tier 2: Reputable third-party benchmarks (LogRocket, etc.)
  - Tier 3: Community reports or unverified claims
- Weight Tier 1 at 100%, Tier 2 at 75%, Tier 3 at 25%

### 3. **Differentiate SWE-bench Variants**
**Current**: Single swe_bench_score field
**Recommended Structure**:
```json
"swe_bench": {
  "verified": 80.2,
  "verified_standard": 72.7,
  "full": null,
  "lite": null,
  "model_version": "Claude Sonnet 4",
  "test_conditions": "parallel compute",
  "date": "2025-07-29",
  "source": "LogRocket"
}
```

### 4. **Enterprise Adoption Metrics**
**New Factor**: Add enterprise adoption as a ranking factor
**Weight**: 10-15%
**Metrics**:
- Number of business customers
- Percentage of enterprise developers using
- Fortune 500 adoption rate
- Security certifications

**Example**: GitHub Copilot has 50,000 business customers and 97% enterprise developer usage

### 5. **Stability and Reliability Score**
**Issue**: Claude Code's 529 errors despite high performance
**New Factor**: Infrastructure reliability
**Weight**: 5-10%
**Metrics**:
- Uptime percentage
- Error rate reports
- Support response times
- Infrastructure incidents

### 6. **Innovation Decay Adjustment**
**Current**: Linear decay over time
**Recommended**: Stepped decay with verification
- Month 1-3: 100% (if continuously verified)
- Month 4-6: 75% (if adoption confirmed)
- Month 7-12: 50% (if still relevant)
- Month 12+: 25% (legacy innovation)

### 7. **Market Intelligence Corrections**
**Add Penalty Factors**:
- Abandoned acquisitions: -5 points (e.g., Windsurf)
- Unverified claims: -3 points per instance
- Infrastructure issues: -2 to -10 based on severity

**Add Bonus Factors**:
- Verified enterprise wins: +3 points
- Independent benchmark leadership: +5 points
- Open source with high adoption: +3 points

## Implementation Priority

1. **Immediate**: Fix SWE-bench score structure and verification
2. **Next Sprint**: Add enterprise adoption metrics
3. **Next Quarter**: Implement reliability scoring
4. **Future**: Full algorithm overhaul to v8.0

## Expected Impact

These adjustments should:
- Reduce ranking volatility from news cycles
- Increase correlation between rankings and real-world usage
- Penalize tools with reliability issues despite high benchmarks
- Reward consistent, verified performance over hype

## Notes for Next Analysis

When processing future articles:
- Always verify source links before accepting claims
- Distinguish between different versions of the same tool
- Track failed predictions/claims for credibility scoring
- Maintain a "corrections log" for transparency