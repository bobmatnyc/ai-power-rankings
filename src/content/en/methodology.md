---
title: "Our Methodology"
subtitle: "How We Rank AI Tools"
---

# Our Ranking Methodology

**Algorithm Version 7.6 - Market-Validated Scoring**

Our ranking system combines real-world adoption metrics with technical capabilities to provide objective evaluations of AI coding tools. We prioritize measurable data over theoretical assessments.

## Ranking Algorithm v7.6

Our algorithm evaluates tools across 8 dimensions with market-validated weights that emphasize real-world adoption and proven results:

### 1. Developer Adoption (18%)
**Real users and active engagement**
- GitHub Stars (open source tools)
- VS Code Extension installs
- npm/PyPI download volumes
- Active user communities
- Developer testimonials

### 2. Technical Performance (18%)
**Objective benchmarks and capabilities**
- SWE-bench verified scores
- Code quality metrics
- Response speed and latency
- Context window size
- Multi-file editing support

### 3. Agentic Capability (12%)
**Autonomous coding abilities**
- Task planning sophistication
- Multi-step problem solving
- Self-correction abilities
- Tool/API integration
- Autonomous iteration

### 4. Market Traction (12%)
**Business validation and growth**
- Enterprise customer adoption
- Annual Recurring Revenue (ARR)
- Funding rounds and valuation
- Market penetration
- Customer retention

### 5. Business Sentiment (12%)
**Industry perception and trust**
- News coverage quality
- Industry analyst reports
- Customer satisfaction scores
- Brand recognition
- Market positioning

### 6. Development Velocity (12%)
**Active development and innovation**
- Release frequency
- Feature velocity
- Bug fix responsiveness
- Roadmap execution
- Community engagement

### 7. Innovation (10%)
**Novel approaches and breakthroughs**
- Unique technical capabilities
- Patent applications
- Research publications
- Industry firsts
- Technical differentiation

### 8. Platform Resilience (8%)
**Stability and reliability**
- Uptime and availability
- Error rate metrics
- Recovery time
- Security posture
- Infrastructure quality

## Data Sources

We collect metrics from multiple authoritative sources:

- **GitHub**: Stars, forks, contributors, commit activity
- **Package Registries**: npm, PyPI, VS Code Marketplace download stats
- **Benchmarks**: SWE-bench verified scores, HumanEval results
- **Company Data**: Funding announcements, ARR, customer counts
- **News Analysis**: Coverage from tech media and industry publications
- **Developer Surveys**: Community feedback and satisfaction ratings

## Data Quality & Missing Data

### Missing Data Handling
Tools are penalized for incomplete data using a confidence multiplier (0.7-1.0):
- **Complete data** (7-8 dimensions): 1.0× (no penalty)
- **Mostly complete** (5-6 dimensions): 0.9× multiplier
- **Partial data** (3-4 dimensions): 0.8× multiplier
- **Limited data** (1-2 dimensions): 0.7× multiplier

### Data Verification
- Cross-reference metrics from multiple sources
- Validate company-provided data against public records
- Remove outliers and incorrect mappings
- Regular audits for data quality

## Scoring Methodology

### Individual Factor Scores
Each dimension receives a 0-100 score based on:
1. **Normalization**: Scale raw metrics to 0-100 range
2. **Benchmarking**: Compare against category leaders
3. **Weighting**: Apply market-validated weights
4. **Confidence**: Multiply by data completeness factor

### Overall Score Calculation
```
Overall Score = Σ (Factor Score × Weight × Confidence)
```

### Tiebreaker Logic
When scores are identical, we use:
1. Developer Adoption metrics (primary)
2. Technical Performance scores (secondary)
3. Most recent data timestamp (tertiary)

## Transparency Commitment

We believe in complete transparency:
- **Open Weights**: All weights publicly documented
- **Data Sources**: Attribution for all metrics
- **Reproducible**: Scoring logic available in our codebase
- **Monthly Updates**: Rankings refreshed with latest data
- **Version History**: Algorithm changes tracked and documented

## Algorithm Evolution

### Version 7.6 (Current - November 2025)
**Focus: Market-Validated Scoring**
- Increased Developer Adoption weight to 18% (from 15%)
- Increased Technical Performance to 18% (from 10%)
- Balanced other factors to emphasize proven results
- Added missing data penalty system

### Previous Versions
- **v7.5**: Initial market-validated approach
- **v7.3**: Innovation-focused weights
- **Earlier**: Experimental scoring methods

## Continuous Improvement

Our methodology evolves based on:
- **Community Feedback**: Developer input and suggestions
- **Industry Changes**: New tools, capabilities, and metrics
- **Data Availability**: Access to additional data sources
- **Algorithm Testing**: A/B testing against market reality

## Transparency & Feedback

Questions about our methodology?
- View our [open-source algorithm code](https://github.com/yourusername/aipowerranking)
- Review [ranking change history](/en/rankings)
- Submit feedback through our [GitHub issues](https://github.com/yourusername/aipowerranking/issues)

*Last updated: November 2025 - Algorithm v7.6*