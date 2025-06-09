# AI Power Rankings - Metrics Guidelines

## Overview

This document defines the guidelines for assigning qualitative and quantitative metrics to AI coding tools. Each metric should be evidence-based and sourced when possible.

## Metric Categories

### 1. Agentic Capability (0-10 scale)

**Definition**: The tool's ability to autonomously plan, execute, and complete coding tasks without constant human guidance.

#### Scoring Guidelines:

**9-10: Full Autonomous Agent**

- Can independently plan and execute complex, multi-file projects
- Self-corrects errors without human intervention
- Manages dependencies and environment setup
- Examples: Devin (9.5), Claude Code (9.0)

**7-8: Advanced Autonomy**

- Multi-file editing with context awareness
- Can execute planned sequences of changes
- Some self-correction capability
- Examples: Cursor (8.0), Windsurf (8.5), Jules (8.0)

**5-6: Moderate Autonomy**

- Single or limited multi-file editing
- Requires human guidance for complex tasks
- Basic planning capability
- Examples: GitHub Copilot (5.0), Bolt.new (6.5), Replit Agent (6.0)

**3-4: Limited Autonomy**

- Primarily suggestions and completions
- Minimal independent action
- Requires constant human direction
- Examples: Tabnine (3.0), Continue (4.0), Sourcery (4.0)

**1-2: No Autonomy**

- Pure autocomplete or analysis only
- No ability to take independent action
- Examples: Traditional linters, static analyzers

### 2. Business Sentiment (-1.0 to +1.0 scale)

**Definition**: Market perception, business relationships, and strategic positioning.

#### Scoring Guidelines:

**+0.8 to +1.0: Exceptional**

- Market leader or fastest growing
- Strong partnerships and ecosystem
- Positive developer sentiment
- Examples: Cursor (+0.9), Aider (+0.9)

**+0.5 to +0.7: Strong**

- Growing market presence
- Good reputation and relationships
- Positive momentum
- Examples: Claude Code (+0.7), GitHub Copilot (+0.8)

**+0.2 to +0.4: Neutral-Positive**

- Stable business position
- Mixed but generally positive sentiment
- Some challenges but growing
- Examples: Devin (+0.2), Tabnine (+0.3)

**-0.2 to +0.1: Neutral-Negative**

- Business challenges visible
- Mixed market reception
- Uncertain future
- Examples: Some smaller tools

**-0.3 to -1.0: Negative**

- Major conflicts or issues
- Declining market position
- Negative developer sentiment
- Examples: Windsurf (-0.3 due to Anthropic conflict)

### 3. Technical Capability (0-10 scale)

**Definition**: Raw technical performance, features, and capabilities.

#### Key Factors:

- SWE-bench or other benchmark scores
- Context window size
- Language support breadth
- Unique technical features
- Performance and reliability

### 4. Developer Adoption (0-10 scale)

**Definition**: Actual usage and community engagement.

#### Key Metrics:

- User count (paid or active)
- Downloads/installs
- GitHub stars (for open source)
- Community activity
- Enterprise adoption

### 5. Market Traction (0-10 scale)

**Definition**: Business success and financial metrics.

#### Key Metrics:

- ARR (Annual Recurring Revenue)
- Valuation
- Funding raised
- Growth rate
- Market share

### 6. Innovation Score (0-10 scale)

**Definition**: Technical or product innovation that advances the field or creates new paradigms.

#### Scoring Guidelines:

**9-10: Paradigm Shifting**

- Creates entirely new category or approach
- Fundamentally changes how developers work
- Industry follows their lead
- Examples: Devin (9.0 - first autonomous engineer), Claude Artifacts (8.5 - interactive AI development)

**7-8: Breakthrough Innovation**

- Significant technical advancement
- Novel approach to existing problems
- Clear differentiation from competitors
- Examples: Cursor (8.0 - codebase-wide understanding), v0 (8.0 - MCP protocol pioneer), Windsurf (7.5 - Cascade flow)

**5-6: Incremental Innovation**

- Meaningful improvements over status quo
- Good execution of proven concepts
- Some unique features
- Examples: Bolt.new (6.0 - browser-based development), GitHub Copilot (5.0 - established patterns)

**3-4: Limited Innovation**

- Minor improvements or features
- Mostly following established patterns
- Examples: Continue (4.0), Tabnine (3.0)

**1-2: No Innovation**

- Pure clone or basic implementation
- No meaningful differentiation

#### Key Innovation Types:

- **Technical**: New algorithms, architectures, or capabilities
- **Product**: New user experiences or workflows
- **Business Model**: New pricing or delivery methods
- **Ecosystem**: Platform or protocol innovations (e.g., v0's MCP)
- **Integration**: Novel ways of combining existing technologies

## Qualitative Assessment Guidelines

### Innovation Level

- **Breakthrough**: First-of-kind capability (e.g., Devin as first autonomous engineer)
- **Leading**: Best-in-class implementation
- **Competitive**: On par with alternatives
- **Lagging**: Behind the market

### Developer Experience

- **Exceptional**: Seamless, intuitive, delightful
- **Good**: Easy to use, well-documented
- **Average**: Functional but with friction
- **Poor**: Difficult to use or unreliable

### Strategic Position

- **Dominant**: Market leader with moat
- **Strong**: Well-positioned for growth
- **Vulnerable**: Facing significant threats
- **Declining**: Losing relevance

## Evidence Requirements

### Primary Sources (Preferred)

1. Company announcements
2. Official benchmark results
3. SEC filings or funding announcements
4. Product documentation
5. GitHub repository stats

### Secondary Sources (Acceptable)

1. Tech media coverage (TechCrunch, etc.)
2. Industry analyst reports
3. Developer surveys
4. Social media metrics
5. Community forums

### Estimation Methods

When direct data unavailable:

- ARR estimation: Users × average price
- User estimation: Downloads / activation rate
- Growth estimation: Sequential data points

## Update Frequency

- **Agentic Capability**: Quarterly or on major release
- **Business Sentiment**: Monthly
- **Technical Capability**: On new benchmarks
- **Developer Adoption**: Monthly
- **Market Traction**: Quarterly

## Scoring Consistency

1. **Relative Scoring**: Scores should be relative to the current market
2. **Regular Calibration**: Re-evaluate all tools quarterly
3. **Evidence-Based**: Every score must have justification
4. **Transparent Bias**: Acknowledge limitations in data

## Example Metric Entry

```json
{
  "tool_id": "cursor",
  "date": "2025-06-01",
  "source_url": "https://techcrunch.com/2025/06/05/cursor-9-9b-valuation/",
  "source_type": "media",
  "metrics": {
    "agentic_capability": {
      "value": 8.0,
      "evidence": "Composer mode enables multi-file editing with codebase understanding"
    },
    "business_sentiment": {
      "value": 0.9,
      "evidence": "Fastest growing SaaS ever, strong investor confidence"
    },
    "monthly_arr": {
      "value": 50000000000,
      "evidence": "$500M+ ARR reported in funding announcement"
    },
    "estimated_users": {
      "value": 600000,
      "evidence": "Estimated from ARR at $70-80 average price point"
    },
    "valuation": {
      "value": 990000000000,
      "evidence": "$9.9B Series C valuation"
    }
  },
  "notes": "Series C funding announcement with comprehensive metrics"
}
```

## Red Flags to Avoid

1. **Speculation without basis**: Don't guess metrics without methodology
2. **Outdated information**: Always use most recent data
3. **Conflicting sources**: Note discrepancies and use most reliable
4. **Marketing claims**: Verify with independent sources
5. **Biased comparisons**: Ensure fair evaluation criteria

## Regular Review Process

1. **Monthly**: Update adoption and sentiment metrics
2. **Quarterly**: Full review of all scores
3. **Ad-hoc**: Major events (funding, acquisition, launch)
4. **Annual**: Methodology review and calibration
