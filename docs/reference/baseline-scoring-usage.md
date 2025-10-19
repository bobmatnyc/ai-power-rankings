# Baseline Scoring System Usage Guide

## Overview

The baseline scoring system allows AI tools to have a stable baseline score with delta modifications applied on top. This enables tracking of temporary score changes due to news events, trending topics, or other time-based factors without permanently altering the core tool scores.

## Architecture

### Score Components

1. **Baseline Score**: The stable, fundamental score of a tool based on its core metrics
2. **Delta Score**: Temporary modifications based on recent events, news impact, trends
3. **Current Score**: The calculated score (baseline + delta) used for rankings

### Database Schema

```typescript
// tools table additions
baselineScore: jsonb  // Stores baseline scores per factor
deltaScore: jsonb     // Stores delta modifications per factor
currentScore: jsonb   // Cached current score calculation
scoreUpdatedAt: timestamp // Last time score was recalculated
```

## API Endpoints

### Get Tools with Scoring
```http
GET /api/tools
```

Response includes scoring data:
```json
{
  "tools": [{
    "id": "tool-123",
    "name": "Example Tool",
    "scoring": {
      "baseline_score": {
        "marketTraction": 75,
        "technicalCapability": 80,
        "overallScore": 77.5
      },
      "delta_score": {
        "marketTraction": 5,
        "communitySentiment": 10,
        "overallScore": 3
      },
      "current_score": {
        "marketTraction": 80,
        "technicalCapability": 80,
        "communitySentiment": 10,
        "overallScore": 80.5
      },
      "score_updated_at": "2025-01-15T10:00:00Z"
    }
  }]
}
```

### Admin Endpoints

#### Initialize Baseline Scores
```http
PUT /api/admin/tools/scoring
```
Initializes baseline scores from current tool data (one-time migration).

#### Update Tool Scoring
```http
POST /api/admin/tools/scoring
```

Request body:
```json
{
  "toolId": "tool-123",
  "baseline_score": {
    "marketTraction": 75,
    "technicalCapability": 80
  },
  "delta_score": {
    "communitySentiment": 10,
    "newsImpact": 5
  }
}
```

#### Recalculate All Scores
```http
POST /api/admin/tools/scoring/recalculate
```
Recalculates all current scores from baseline + delta.

## Usage Examples

### 1. Apply News Impact Delta

When a tool receives significant news coverage:

```typescript
import { toolScoringService } from '@/lib/services/tool-scoring.service';

// Apply positive delta for news impact
await toolScoringService.updateDeltaScore('tool-123', {
  communitySentiment: 15,  // +15 boost from positive news
  marketTraction: 5,        // +5 for increased visibility
  overallScore: 8           // +8 overall boost
});
```

### 2. Decay Delta Scores Over Time

Implement time-based decay for delta scores:

```typescript
// Example: Decay news impact over 30 days
function calculateNewsDecay(daysSinceNews: number): number {
  const decayRate = 0.9; // 10% decay per day
  return Math.max(0, Math.pow(decayRate, daysSinceNews));
}

// Apply decayed delta
const originalDelta = 20;
const daysSinceNews = 7;
const decayedDelta = originalDelta * calculateNewsDecay(daysSinceNews);

await toolScoringService.updateDeltaScore('tool-123', {
  newsImpact: decayedDelta
});
```

### 3. Reset Delta Scores

To remove all temporary modifications:

```typescript
await toolScoringService.updateDeltaScore('tool-123', {});
```

### 4. Batch Update Baseline Scores

After a major scoring algorithm update:

```typescript
const tools = await toolsRepository.findAll();

for (const tool of tools) {
  // Calculate new baseline using updated algorithm
  const newBaseline = calculateToolScore(tool.metrics);

  await toolScoringService.updateBaselineScore(tool.id, {
    marketTraction: newBaseline.marketTraction,
    technicalCapability: newBaseline.technicalCapability,
    // ... other factors
    overallScore: newBaseline.overall
  });
}
```

## Migration Script

To initialize baseline scores from existing data:

```bash
npm run script:initialize-baseline-scores
```

Or programmatically:

```typescript
import { initializeBaselineScores } from '@/scripts/initialize-baseline-scores';

await initializeBaselineScores();
```

## Best Practices

1. **Baseline Updates**: Only update baseline scores during major recalibrations
2. **Delta Management**: Use delta scores for temporary effects (news, trends, events)
3. **Decay Strategy**: Implement time-based decay for delta scores to ensure temporary boosts fade
4. **Caching**: Current scores are cached; recalculate when baseline or delta changes
5. **Audit Trail**: Track score changes with timestamps for transparency

## Score Factors

The scoring system tracks these factors:

- `marketTraction`: Market presence, funding, valuation
- `technicalCapability`: Technical features, capabilities
- `developerAdoption`: GitHub stars, community size
- `developmentVelocity`: Release frequency, commit activity
- `platformResilience`: Multi-platform support, reliability
- `communitySentiment`: User sentiment, reviews
- `overallScore`: Weighted combination of all factors

## Future Enhancements

1. **Historical Tracking**: Store score history for trend analysis
2. **Automated Decay**: Background job to decay delta scores
3. **Event-Based Deltas**: Automatic delta application based on news/events
4. **Score Explanations**: API to explain why scores changed
5. **A/B Testing**: Test different scoring algorithms with baseline/delta split