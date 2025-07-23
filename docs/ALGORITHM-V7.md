# Algorithm v7.0: Enhanced Sentiment Impact

## Overview

Algorithm v7.0 introduces significant improvements to how negative sentiment affects rankings, addressing the issue where sustained negative coverage wasn't adequately reflected in tool rankings.

## Key Changes

### 1. Increased Sentiment Weight (10% → 15%)

**Before (v6.0):**
- Business sentiment: 7.5%
- Community sentiment: 2.5% (part of the 10% total)

**After (v7.0):**
- Business sentiment: 15% (doubled impact)
- Other weights adjusted proportionally

### 2. Non-Linear Negative Sentiment Penalty

**Implementation:**
```typescript
// Positive sentiment: linear scaling
if (sentiment >= 0) return sentiment;

// Negative sentiment: exponential penalty
// -0.1 → -0.12, -0.5 → -0.75, -1.0 → -2.0
return -Math.pow(Math.abs(sentiment), 1.5) * 2;
```

This ensures that negative sentiment has increasingly severe impact as it worsens.

### 3. Crisis Detection System

The algorithm now detects crisis situations based on multiple factors:

**Crisis Indicators:**
- News sentiment below -0.3 (30% negative)
- 5+ negative articles in 30 days
- Presence of specific crisis indicators
- Declining sentiment trend

**Crisis Impact:**
- Normal situations: 1.0x multiplier
- Crisis situations: 1.5x to 2.0x multiplier on negative sentiment

### 4. Enhanced News Impact Calculations

**Negative News Amplification:**
- Positive news: 20% impact modifier
- Negative news: 30% impact modifier (50% stronger)
- Impact cap adjusted: -3 to +2 (allowing stronger negative impact)

**Distribution Changes:**
- Business sentiment: 50% of news impact (up from 40%)
- Market traction: 25% (down from 30%)
- Developer adoption: 15% (down from 20%)
- Innovation: 10% (maintained)

## Usage

### Running the New Algorithm

```bash
# Execute July rankings with v7.0
pnpm run rankings:july-v7

# The script will:
# 1. Load all tools and news data
# 2. Calculate sentiment scores with crisis detection
# 3. Apply non-linear penalties
# 4. Generate rankings with movement tracking
# 5. Save to data/json/rankings/periods/2025-07.json
```

### Integration with Existing Code

```typescript
import { LatestRankingEngine } from "@/lib/ranking-algorithm";

const engine = new LatestRankingEngine();
const score = engine.calculateToolScore(metrics, currentDate, newsArticles);

// Access sentiment analysis
console.log(score.sentimentAnalysis);
// {
//   rawSentiment: 0.3,
//   adjustedSentiment: -0.45,  // After non-linear penalty
//   newsImpact: -2.1,
//   crisisDetection: {
//     isInCrisis: true,
//     severityScore: 0.75,
//     impactMultiplier: 1.875
//   }
// }
```

## Expected Impact

### Tools with Negative Coverage
- **Claude Code**: Significant ranking drop expected due to:
  - Google Drive controversy
  - Development issues
  - Sustained negative sentiment
  
### Tools in Crisis
- Automatic detection and amplified impact
- Clear visibility in ranking outputs
- Transparent scoring adjustments

### Balanced Approach
- Positive tools maintain fair rankings
- Negative impact is proportional to severity
- Crisis detection prevents gaming the system

## Monitoring and Validation

The algorithm provides detailed logging:
- Crisis detection alerts
- Sentiment adjustment details
- News impact calculations
- Movement tracking

## Future Improvements

Potential enhancements for v8.0:
1. Time-weighted crisis recovery (gradual improvement)
2. Source credibility weighting
3. Competitor comparison adjustments
4. Market segment normalization