# Algorithm Version Changelog

This document tracks all changes to the AI Power Ranking algorithm over time.

## Version 7.6 - Market-Validated Scoring
**Release Date:** November 1, 2025
**Status:** Current

### Focus
Market-validated scoring that combines real-world adoption metrics with technical capabilities for objective evaluations.

### Key Changes
- **Developer Adoption:** Increased weight to 18% (from 15%)
  - Rationale: Real-world adoption is the strongest signal of tool value
  - Metrics: GitHub stars, VS Code installs, npm/PyPI downloads

- **Technical Performance:** Increased weight to 18% (from 10%)
  - Rationale: Objective benchmarks provide measurable quality indicators
  - Metrics: SWE-bench scores, code quality, response speed, context windows

- **Agentic Capability:** Maintained at 12%
  - Autonomous coding abilities remain important differentiator
  - Multi-step problem solving, self-correction, tool integration

- **Market Traction:** Maintained at 12%
  - Business validation through enterprise adoption and ARR
  - Funding rounds, valuation, market penetration

- **Business Sentiment:** Maintained at 12%
  - Industry perception, news coverage, analyst reports
  - Customer satisfaction, brand recognition

- **Development Velocity:** Maintained at 12%
  - Active development, release frequency
  - Feature velocity, bug fix responsiveness

- **Innovation:** Reduced to 10% (from 15%)
  - Still valued but balanced against proven results
  - Novel approaches, patents, research publications

- **Platform Resilience:** Reduced to 8% (from 10%)
  - Stability important but secondary to adoption and performance
  - Uptime, error rates, recovery time, security

### Missing Data Handling
- **New:** Added confidence multiplier system (0.7-1.0)
- Complete data (7-8 dimensions): 1.0× (no penalty)
- Mostly complete (5-6 dimensions): 0.9× multiplier
- Partial data (3-4 dimensions): 0.8× multiplier
- Limited data (1-2 dimensions): 0.7× multiplier

### Impact
- More emphasis on real-world metrics over theoretical potential
- Rewards tools with proven adoption and technical capability
- Penalizes incomplete or unverifiable data

---

## Version 7.5 - Initial Market-Validated Approach
**Release Date:** October 1, 2025
**Status:** Superseded

### Focus
First iteration of market-validated scoring approach.

### Key Features
- Introduced market validation emphasis
- Balanced innovation with proven results
- Enhanced data validation requirements

---

## Version 7.3 - Innovation-Focused
**Release Date:** September 1, 2025
**Status:** Superseded

### Focus
Innovation-focused weights emphasizing breakthrough capabilities.

### Key Features
- Higher innovation weight (20%)
- Agentic capability emphasis (25%)
- Platform risk modifiers
- Innovation decay modeling

---

## Version 7.2 - Enhanced Modifiers
**Release Date:** August 1, 2025
**Status:** Superseded

### Key Changes
- Innovation decay modeling (6-month half-life)
- Platform risk assessment
- Revenue quality adjustments
- Logarithmic scaling improvements

---

## Version 7.1 - Refined Weights
**Release Date:** July 1, 2025
**Status:** Superseded

### Key Changes
- Adjusted factor weights based on community feedback
- Improved data validation processes
- Enhanced benchmark integration

---

## Version 7.0 - Major Overhaul
**Release Date:** June 1, 2025
**Status:** Superseded

### Key Changes
- 8-factor scoring system introduction
- Dynamic modifiers system
- Multi-source data validation
- Weekly update cadence

---

## Methodology Principles

### Consistency
- Factor definitions remain stable across versions
- Weight changes are data-driven and documented
- Breaking changes result in major version increments

### Transparency
- All changes publicly documented
- Rationale provided for weight adjustments
- Community feedback incorporated

### Data Quality
- Cross-source validation required
- Outlier detection and review
- Missing data handling clearly defined

### Evolution
- Algorithm improves based on:
  - Community feedback
  - Market changes
  - Data availability improvements
  - Testing against real-world outcomes

---

## Version History Summary

| Version | Date | Focus | Status |
|---------|------|-------|--------|
| 7.6 | 2025-11-01 | Market-Validated Scoring | **Current** |
| 7.5 | 2025-10-01 | Initial Market Validation | Superseded |
| 7.3 | 2025-09-01 | Innovation-Focused | Superseded |
| 7.2 | 2025-08-01 | Enhanced Modifiers | Superseded |
| 7.1 | 2025-07-01 | Refined Weights | Superseded |
| 7.0 | 2025-06-01 | Major Overhaul | Superseded |

---

## Future Considerations

### Under Review
- Real-time user feedback integration
- Developer survey data weighting
- Ecosystem compatibility scoring
- Total cost of ownership metrics

### Planned Improvements
- Enhanced benchmark coverage (beyond SWE-bench)
- Regional market variation adjustments
- Category-specific weight variations
- Automated data quality scoring

---

*Last Updated: November 1, 2025*
*Current Algorithm Version: 7.6*
