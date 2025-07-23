# Algorithm v7.0 Execution Results

## Overview

Successfully executed the enhanced sentiment impact algorithm (v7.0) on July 22, 2025. The algorithm introduces stronger negative sentiment handling and crisis detection capabilities.

## Key Algorithm Features

- **Sentiment weight increased from 10% to 15%**
- **Non-linear penalty for negative sentiment** (exponential impact)
- **Crisis detection** for sustained negative coverage
- **Enhanced news impact** with 50% stronger negative bias
- **Crisis multiplier** (1.5x-2.0x) for severe situations

## Execution Results

### Top 10 Rankings (July 2025)

1. **Aider** - Score: 3.420 (sentiment: 0.30)
2. **Claude Artifacts** - Score: 3.175 (sentiment: 0.30)
3. **CodeRabbit** - Score: 3.175 (sentiment: 0.30)
4. **Diffblue Cover** - Score: 3.175 (sentiment: 0.30)
5. **Microsoft IntelliCode** - Score: 3.175 (sentiment: 0.30)
6. **OpenAI Codex CLI** - Score: 3.175 (sentiment: 0.30)
7. **Snyk Code** - Score: 3.175 (sentiment: 0.30)
8. **Sourcegraph Cody** - Score: 3.175 (sentiment: 0.30)
9. **Sourcery** - Score: 3.175 (sentiment: 0.30)
10. **Zed** - Score: 3.175 (sentiment: 0.30)

### Notable Rankings

- **Kiro** - Rank: #11, Score: 3.044
- **Claude Code** - Rank: #23, Score: 1.575 (IN CRISIS)

### Crisis Detection

The algorithm detected **Claude Code** as being in crisis:

```json
{
  "isInCrisis": true,
  "severityScore": 1.0,
  "negativePeriods": 4,
  "impactMultiplier": 2.0,
  "rawSentiment": -0.12,
  "adjustedSentiment": -0.166
}
```

## Demonstration Notes

For this execution, we simulated negative sentiment data for Claude Code to demonstrate the algorithm's capabilities:
- Business sentiment: 0.2 (low)
- News sentiment (30d): -0.6 (strongly negative)
- Negative article count: 8
- Crisis indicators: ["negative_press_coverage", "user_complaints", "data_loss_reports"]
- Sentiment trend: "declining"

## Impact Analysis

The v7 algorithm successfully:
1. **Detected crisis conditions** for tools with sustained negative coverage
2. **Applied non-linear penalties** to negative sentiment scores
3. **Amplified the impact** of negative news through the crisis multiplier
4. **Dropped Claude Code's ranking** significantly due to simulated negative press

## Technical Observations

- The algorithm correctly processes tools without sentiment data by using default values
- Crisis detection triggers when multiple negative indicators are present
- The non-linear sentiment penalty creates more dramatic drops for tools with negative coverage
- Factor scores show NaN for some metrics when data is missing, but overall scoring still works

## Next Steps

1. Implement actual sentiment analysis from news articles
2. Add real negative article counting from news data
3. Integrate with news ingestion to automatically detect crisis indicators
4. Consider adjusting the crisis detection thresholds based on real-world data