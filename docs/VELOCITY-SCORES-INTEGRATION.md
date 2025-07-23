# Velocity Scores Integration Guide

## Overview

This document outlines the calculated development velocity scores based on news sentiment and activity analysis. These scores provide dynamic momentum indicators that can replace the static velocity score of 60 currently used in the ranking algorithm.

## Velocity Score Calculation Methodology

### Score Components (0-100 scale)

1. **News Volume (40 points max)**
   - 4 points per article in last 30 days
   - Captures overall attention and activity

2. **Release Announcements (20 points max)**
   - 10 points per release/launch news
   - Weighted heavily as indicator of active development

3. **Funding News (15 points max)**
   - 15 points per funding announcement
   - Indicates growth and investment confidence

4. **Feature Updates (15 points max)**
   - 5 points per feature/update news
   - Shows continuous improvement

5. **Recency Bonus (10 points max)**
   - 10 points: news within 7 days
   - 5 points: news within 14 days
   - 2 points: news within 21 days
   - Rewards recent momentum

### Momentum Categories

- **High**: Score ≥ 70 (very active development)
- **Medium**: Score 40-69 (moderate activity)
- **Low**: Score 20-39 (limited activity)
- **Stagnant**: Score < 20 (minimal or no activity)

## Key Findings

### High-Velocity Leaders (Score ≥ 70)

1. **GitHub Copilot** - Score: 90
   - 17 news items in 30 days
   - 11 release announcements
   - Strong funding/growth news

2. **Windsurf** - Score: 90
   - 12 news items in 30 days
   - Major acquisition news (Cognition/Devin)
   - $5.4B valuation discussions

3. **Cursor** - Score: 85
   - 14 news items in 30 days
   - 9 release announcements
   - Consistent feature updates

4. **Kiro** - Score: 83
   - 7 news items in 30 days
   - Recent AWS launch (July 2025)
   - Strong initial momentum

5. **Tabnine** - Score: 69
   - 6 news items in 30 days
   - Market growth projections ($8.2B by 2026)
   - Steady development pace

### Low-Activity Tools (Score < 20)

- **18 tools** with no news in 90 days (58% of total)
- **26 tools** classified as "stagnant" (84% of total)
- Many established tools lacking recent announcements

## Integration Recommendations

### 1. Replace Static Velocity Score

**Current Algorithm:**
```typescript
const velocity = 60; // Static for all tools
```

**Proposed Integration:**
```typescript
// Load velocity scores from calculated data
const velocityScores = loadVelocityScores();
const velocity = velocityScores[tool.id] || 20; // Default to 20 if no score
```

### 2. Enhanced Momentum Weighting

**Consider momentum category in calculations:**
```typescript
const momentumMultiplier = {
  'high': 1.2,
  'medium': 1.0,
  'low': 0.8,
  'stagnant': 0.6
};

const adjustedScore = baseScore * momentumMultiplier[tool.momentum];
```

### 3. Time Decay Integration

**Combine with existing time decay for news:**
```typescript
// Velocity score already includes recency
// But can be further refined with exponential decay
const ageAdjustedVelocity = velocity * getAgeMultiplier(lastNewsDate);
```

## Implementation Steps

1. **Store Velocity Scores**
   - Add velocity data to tool records
   - Update via scheduled job (weekly/monthly)

2. **Modify Ranking Algorithm**
   - Replace hardcoded velocity with dynamic scores
   - Test impact on rankings

3. **Monitor and Adjust**
   - Track ranking changes
   - Adjust weighting factors based on results
   - Consider additional signals (GitHub activity, downloads)

## Sample Velocity Data Structure

```json
{
  "toolId": "2",
  "toolName": "GitHub Copilot",
  "score": 90,
  "newsCount30Days": 17,
  "newsCount90Days": 19,
  "lastNewsDate": "2025-07-18T18:02:33.000Z",
  "releaseNews": 11,
  "fundingNews": 4,
  "featureNews": 1,
  "momentum": "high",
  "recentHighlights": [
    "Claude's Growing Pains",
    "When Platform Partners Become Platform Problems: The $5.4B Windsurf Breakdown"
  ]
}
```

## Expected Impact

1. **Better differentiation** between actively developed vs stagnant tools
2. **More accurate rankings** reflecting current market dynamics
3. **Improved user value** by highlighting tools with momentum
4. **Data-driven insights** into AI tool ecosystem trends

## Next Steps

1. Review and approve velocity calculation methodology
2. Test integration with sample rankings
3. Implement storage and update mechanisms
4. Deploy to production with monitoring
5. Iterate based on user feedback and ranking quality