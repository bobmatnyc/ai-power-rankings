---
title: "Ranking Methodology"
subtitle: "Understanding how we evaluate and rank AI coding tools"
---

## Algorithm Overview

### Algorithm v7.0: Dynamic News Intelligence & Tool Capabilities

Our ranking algorithm evaluates AI coding tools through a comprehensive framework that considers multiple factors, applies dynamic modifiers, incorporates real-time news analysis for velocity scoring, and enhances assessment of subprocess and tool management capabilities.

#### Key Features

- Dynamic velocity scoring from real-time news analysis
- Enhanced subprocess and tool capability assessment
- Innovation decay over time (6-month half-life)
- Platform risk penalties and bonuses
- Revenue quality adjustments by business model
- Enhanced technical performance weighting
- Data validation requirements
- Logarithmic scaling for market metrics

## Scoring Factors

Our evaluation framework considers both primary and secondary factors to provide a holistic assessment of each tool's capabilities and market position.

### Primary Factors

#### 🤖 Agentic Capability (30%)

Multi-file editing, task planning, autonomous operation, subprocess management, tool ecosystem support

#### 💡 Innovation (15%)

Time-decayed innovation score, breakthrough features

#### ⚡ Technical Performance (12.5%)

SWE-bench scores with enhanced weighting, multi-file support, context window, subprocess performance

#### 👥 Developer Adoption (12.5%)

GitHub stars, active users, community engagement

#### 📈 Market Traction (12.5%)

Revenue, user growth, funding, valuation

### Secondary Factors

#### 💬 Business Sentiment (7.5%)

Market perception, platform risks, competitive position

#### 🚀 Development Velocity (5%)

Dynamic momentum from news sentiment, feature releases, community response (30-day window)

#### 🛡️ Platform Resilience (5%)

Multi-model support, independence, self-hosting options

## Innovation Scoring Framework

Our innovation scoring (15% of total) evaluates breakthrough capabilities and paradigm shifts in AI coding tools.

### Key Innovation Dimensions

#### 🤖 Autonomy Architecture (25%)

Planning sophistication, execution independence, and learning capabilities

**Scale:**

- Basic (1-3): Single-step execution with manual guidance
- Advanced (4-6): Multi-step planning with checkpoints
- Revolutionary (7-10): Self-improving autonomous systems

#### 🧠 Context Understanding (20%)

Codebase comprehension, context scale, and multi-modal integration

**Scale:**

- File-level (1-3): Single file understanding
- Project-level (4-6): Full architecture comprehension
- Business-level (7-10): Intent and logic understanding

#### ⚡ Technical Capabilities (20%)

AI model innovation, unique features, and performance breakthroughs

**Scale:**

- Standard (1-3): Off-the-shelf implementations
- Enhanced (4-6): Custom models and orchestration
- Breakthrough (7-10): Novel architectures and paradigms

#### 🔄 Workflow Transformation (15%)

Development process innovation and human-AI collaboration models

**Scale:**

- Enhancement (1-3): Improves existing workflows
- Innovation (4-6): Enables new methodologies
- Revolution (7-10): Fundamentally changes development

#### 🌐 Ecosystem Integration (10%)

Protocol innovation and platform strategy

**Scale:**

- Standard (1-3): Traditional integrations
- Protocol Creation (4-6): Open standards (MCP, A2A)
- Industry Leadership (7-10): Wide protocol adoption

#### 📊 Market Impact (10%)

Category innovation and industry influence

**Scale:**

- Participant (1-3): Competes in existing categories
- Category Leader (4-6): Defines category standards
- Category Creator (7-10): Creates new paradigms

### Scoring Scale

| Score | Description                |
| ----- | -------------------------- |
| 9-10  | Revolutionary breakthrough |
| 7-8   | Major innovation           |
| 5-6   | Significant advancement    |
| 3-4   | Incremental improvement    |
| 1-2   | Minimal innovation         |
| 0     | No innovation              |

> **Note:** Innovation scores are evaluated monthly and consider both absolute innovation and relative progress within the competitive landscape. Scores may decrease over time as innovations become standard features.

## Dynamic Modifiers

Our algorithm applies sophisticated modifiers to capture market dynamics and ensure rankings reflect real-world conditions.

### 🔄 Innovation Decay

Innovation impact decreases over time as breakthrough features become standard. We apply exponential decay with a 6-month half-life.

```
score = originalScore * e^(-0.115 * monthsOld)
```

### ⚠️ Platform Risk

Adjustments based on platform dependencies and business risks.

#### Penalties

- Acquired by LLM provider: -2.0
- Exclusive LLM dependency: -1.0
- Competitor controlled: -1.5
- Regulatory risk: -0.5
- Funding distress: -1.0

#### Bonuses

- Multi-LLM support: +0.5
- Open source LLM ready: +0.3
- Self-hosted option: +0.3

### 💰 Revenue Quality

Market traction scores are adjusted based on business model quality.

| Business Model                  | Multiplier |
| ------------------------------- | ---------- |
| Enterprise High ACV (>$100k)    | 100%       |
| Enterprise Standard ($10k-100k) | 80%        |
| SMB SaaS (<$10k)                | 60%        |
| Consumer Premium                | 50%        |
| Freemium                        | 30%        |
| Open Source/Donations           | 20%        |

## Dynamic News Intelligence

### News-Based Velocity Scoring

Development velocity is now dynamically calculated using sophisticated news analysis that tracks momentum across multiple dimensions.

#### Momentum Indicators
- Product releases and feature announcements
- Partnership and integration news  
- Technical breakthroughs and benchmarks
- Community adoption and success stories
- Industry recognition and awards

#### Sentiment Scoring
- Positive momentum: +3 to +5 boost
- Strong progress: +1 to +3 boost
- Neutral/stable: 0 adjustment
- Challenges/setbacks: -1 to -3 penalty
- Critical issues: -3 to -5 penalty

### 30-Day Rolling Window

Velocity scores use a 30-day rolling window with exponential decay, giving more weight to recent developments while maintaining trend awareness.

```
velocityScore = Σ(sentimentScore * e^(-λ * daysOld)) / 30
```

## Subprocess & Tool Support

### Enhanced Agentic Capabilities

Agentic capability scoring now includes sophisticated evaluation of subprocess orchestration and tool utilization.

#### Subprocess Management (40%)
- Multi-agent orchestration capabilities
- Task delegation sophistication
- Parallel execution support
- Context passing and integration
- Error handling and recovery

#### Tool Ecosystem (60%)
- Native tool support depth
- Third-party tool integration
- Custom tool creation APIs
- Tool discovery and selection
- Protocol support (MCP, etc.)

### Scoring Rubric

| Capability Level | Score Adjustment |
|-----------------|------------------|
| Advanced multi-tool orchestration | +5.0 |
| Sophisticated subprocess management | +4.0 |
| Rich native tool ecosystem | +3.0 |
| Basic tool support | +1.0 |
| Limited/no tool capabilities | 0.0 |

## Enhanced Technical Performance

### SWE-bench Score Interpretation

Technical performance scoring uses nuanced interpretation of SWE-bench results with logarithmic scaling:

```
technicalScore = log(1 + sweBenchScore) * performanceMultiplier
```

### Performance Multipliers

| Performance Level | Multiplier |
|------------------|------------|
| Exceptional (>90th percentile) | 1.5x |
| Strong (75-90th percentile) | 1.3x |
| Good (50-75th percentile) | 1.1x |
| Average (25-50th percentile) | 1.0x |
| Below average (<25th percentile) | 0.8x |

## Data Sources & Validation

### Data Collection Methods

- Official APIs and documentation
- Expert evaluation and research
- Public announcements and releases
- Community feedback and usage data
- Benchmark results and performance metrics

### Validation Requirements

- Minimum 80% core metrics completeness
- Source reliability threshold of 60%
- Outlier detection for >50% monthly changes
- Cross-validation with multiple sources

### Update Frequency

Rankings are updated monthly, with continuous data collection and validation throughout each period.
