# Algorithm v6.0 - Code-Ready Modifiers

## 1. Innovation Decay Function

```typescript
// Apply temporal decay to innovation scores
function calculateInnovationWithDecay(innovations: Innovation[], currentDate: Date): number {
  return innovations.reduce((total, innovation) => {
    const monthsOld = (currentDate.getTime() - innovation.date.getTime()) / (30 * 24 * 60 * 60 * 1000);
    const decayedScore = innovation.score * Math.exp(-0.115 * monthsOld); // 6-month half-life
    return total + decayedScore;
  }, 0);
}
```

## 2. Platform Risk Modifiers

```typescript
// Platform risk penalties and bonuses
const platformRiskModifiers = {
  // Penalties (subtract from business sentiment score)
  acquired_by_llm_provider: -2.0,      // OpenAI acquires competitor
  exclusive_llm_dependency: -1.0,      // Only works with one LLM
  competitor_controlled: -1.5,         // Owned by direct competitor
  regulatory_risk: -0.5,               // Privacy/compliance issues
  funding_distress: -1.0,              // Running out of funding
  
  // Bonuses (add to platform resilience score)
  multi_llm_support: +0.5,             // Works with 3+ LLM providers
  open_source_llm_ready: +0.3,         // Supports open models
  self_hosted_option: +0.3              // Can run locally
};

function applyPlatformRiskModifiers(tool: Tool): number {
  let modifier = 0;
  tool.riskFactors.forEach(factor => {
    if (platformRiskModifiers[factor]) {
      modifier += platformRiskModifiers[factor];
    }
  });
  return modifier;
}
```

## 3. Revenue Quality Modifiers

```typescript
// Adjust revenue based on business model quality
const revenueQualityMultipliers = {
  enterprise_high_acv: 1.0,        // >$100k ACV
  enterprise_standard: 0.8,        // $10k-100k ACV
  smb_saas: 0.6,                   // <$10k ACV
  consumer_premium: 0.5,           // Consumer subscriptions
  freemium: 0.3,                   // Freemium model
  open_source_donations: 0.2       // Donation-based
};

function calculateQualityAdjustedRevenue(revenue: number, businessModel: string): number {
  const multiplier = revenueQualityMultipliers[businessModel] || 0.5;
  return revenue * multiplier;
}
```

## 4. Enhanced Technical Performance Weighting

```typescript
// Reweight technical performance sub-factors
function calculateTechnicalPerformance(tool: ToolMetrics): number {
  const sweBenchScore = tool.sweBenchScore / 100; // Normalize 0-100% to 0-1
  const multiFileScore = tool.multiFileCapability / 10; // Expert assessment 1-10
  const contextScore = Math.min(tool.contextWindow / 200000, 1); // Normalize to 200k max
  const languageScore = Math.min(tool.languageSupport / 20, 1); // Max 20 languages
  
  return (
    sweBenchScore * 0.4 +           // Increased from 25% to 40%
    multiFileScore * 0.3 +          // Maintained at 30%
    contextScore * 0.2 +            // Reduced from 25% to 20%
    languageScore * 0.1             // Reduced from 25% to 10%
  ) * 12.5; // Overall technical weight
}
```

## 5. Enhanced Agentic Capability Calculation

```typescript
// More precise agentic capability weighting
function calculateAgenticCapability(tool: ToolMetrics): number {
  const sweBenchScore = tool.sweBenchScore / 100; // 0-1 scale
  const multiFileScore = tool.multiFileCapability / 10; // 0-1 scale
  const planningScore = tool.planningDepth / 10; // Expert assessment
  const contextUtilScore = tool.contextUtilization / 10; // Expert assessment
  
  return (
    sweBenchScore * 0.4 +           // Primary benchmark
    multiFileScore * 0.25 +         // Multi-file capability
    planningScore * 0.2 +           // Planning & reasoning
    contextUtilScore * 0.15         // Context utilization
  ) * 30; // Overall agentic weight (30% of total)
}
```

## 6. Enhanced Market Traction with Quality

```typescript
function calculateMarketTraction(tool: ToolMetrics): number {
  const adjustedRevenue = calculateQualityAdjustedRevenue(tool.revenue, tool.businessModel);
  
  // Log scale normalization for exponential metrics
  const revenueScore = Math.log10(adjustedRevenue + 1) / 10; // Normalize to ~0-1
  const userScore = Math.log10(tool.userCount + 1) / 7; // Normalize to ~0-1
  const fundingScore = Math.log10(tool.funding + 1) / 11; // Normalize to ~0-1
  const valuationScore = Math.log10(tool.valuation + 1) / 12; // Normalize to ~0-1
  
  return (
    revenueScore * 0.4 +            // Quality-adjusted revenue primary
    userScore * 0.3 +               // User adoption
    fundingScore * 0.2 +            // Funding raised
    valuationScore * 0.1            // Latest valuation
  ) * 12.5; // Overall market weight
}
```

## 7. Updated Algorithm Weights

```typescript
const ALGORITHM_WEIGHTS_V6 = {
  agentic_capability: 0.30,        // Primary differentiator
  innovation: 0.15,                // With decay function
  technical_performance: 0.125,    // Enhanced benchmark focus
  developer_adoption: 0.125,       // Maintained
  market_traction: 0.125,          // With revenue quality
  business_sentiment: 0.075,       // With platform risk
  development_velocity: 0.05,      // Minimum threshold
  platform_resilience: 0.05       // With independence bonuses
};
```

## 8. Complete Score Calculation

```typescript
function calculateToolScore(tool: ToolMetrics): number {
  const agentic = calculateAgenticCapability(tool) * ALGORITHM_WEIGHTS_V6.agentic_capability;
  const innovation = calculateInnovationWithDecay(tool.innovations, new Date()) * ALGORITHM_WEIGHTS_V6.innovation;
  const technical = calculateTechnicalPerformance(tool) * ALGORITHM_WEIGHTS_V6.technical_performance;
  const adoption = calculateDeveloperAdoption(tool) * ALGORITHM_WEIGHTS_V6.developer_adoption;
  const market = calculateMarketTraction(tool) * ALGORITHM_WEIGHTS_V6.market_traction;
  
  // Apply platform risk modifiers
  const platformRiskModifier = applyPlatformRiskModifiers(tool);
  const sentiment = (calculateBusinessSentiment(tool) + platformRiskModifier) * ALGORITHM_WEIGHTS_V6.business_sentiment;
  
  const velocity = calculateDevelopmentVelocity(tool) * ALGORITHM_WEIGHTS_V6.development_velocity;
  const resilience = calculatePlatformResilience(tool) * ALGORITHM_WEIGHTS_V6.platform_resilience;
  
  return Math.max(0, Math.min(10, 
    agentic + innovation + technical + adoption + market + sentiment + velocity + resilience
  ));
}
```

## 9. Data Validation Rules

```typescript
// Minimum data completeness for ranking inclusion
const VALIDATION_RULES = {
  min_metrics_required: 0.8,        // 80% of core metrics must be populated
  min_confidence_score: 0.6,        // Source reliability threshold
  max_monthly_change: 0.5,          // Flag >50% month-over-month changes
  outlier_position_jump: 3          // Flag tools moving >3 positions
};

function validateToolForRanking(tool: ToolMetrics): boolean {
  const completeness = calculateDataCompleteness(tool);
  const confidenceScore = calculateSourceConfidence(tool);
  
  return completeness >= VALIDATION_RULES.min_metrics_required && 
         confidenceScore >= VALIDATION_RULES.min_confidence_score;
}
```