# AI Power Rankings - Phase 1A & 1B Specification

## Phase 1A: Data Structure & Frontend
**Goal**: Build complete frontend experience with robust data foundation using seed data
**Timeline**: 4-6 weeks
**Outcome**: Fully functional website with 30+ manually curated tools and rankings

## Phase 1B: Crawler & Updater  
**Goal**: Automate data collection and ranking generation pipeline
**Timeline**: 3-4 weeks after 1A
**Outcome**: Self-updating rankings with daily data collection and monthly ranking recalculation

---

# Phase 1A: Data Structure & Frontend

## Database Schema Design

### Core Tables Structure

#### `tools` - Master Tool Registry
```sql
-- Primary tool information
id (varchar, primary key) -- e.g., 'cursor', 'github-copilot'
name (varchar, not null) -- Display name
slug (varchar, unique) -- URL-friendly identifier
category (varchar) -- 'code-editor', 'autonomous-agent', 'app-builder'
subcategory (varchar) -- More specific classification
description (text) -- Brief tool description
website_url (varchar)
github_repo (varchar) -- Format: 'owner/repo'
company_name (varchar)
founded_date (date)
pricing_model (varchar) -- 'free', 'freemium', 'paid', 'enterprise'
license_type (varchar) -- 'open-source', 'proprietary', 'commercial'
status (varchar) -- 'active', 'discontinued', 'beta'
logo_url (varchar)
created_at (timestamp)
updated_at (timestamp)
```

#### `tool_capabilities` - Technical Specifications
```sql
tool_id (varchar, foreign key)
autonomy_level (integer) -- 1-10 scale
context_window_size (integer) -- Token limit
supports_multi_file (boolean)
supported_languages (jsonb) -- Array of programming languages
supported_platforms (jsonb) -- Array of platforms/IDEs
integration_types (jsonb) -- API, plugin, standalone, etc.
llm_providers (jsonb) -- OpenAI, Anthropic, Google, etc.
deployment_options (jsonb) -- Cloud, on-premise, local
```

#### `tool_metrics` - Current Metric Snapshot
```sql
tool_id (varchar, foreign key)
metric_date (date)
github_stars (integer)
github_forks (integer)
github_watchers (integer)
github_commits_last_month (integer)
github_contributors (integer)
github_last_commit (timestamp)
funding_total (bigint) -- Total funding in USD cents
valuation_latest (bigint) -- Latest valuation in USD cents
estimated_users (integer)
social_mentions_30d (integer)
sentiment_score (decimal) -- -1 to 1
community_size (integer)
release_frequency_days (integer) -- Average days between releases
```

#### `rankings` - Historical Ranking Data
```sql
id (uuid, primary key)
period (varchar) -- 'june-2025', 'july-2025'
tool_id (varchar, foreign key)
position (integer)
score (decimal) -- Overall ranking score
movement (varchar) -- 'up', 'down', 'same', 'new', 'returning'
movement_positions (integer) -- Number of positions moved
previous_position (integer)
score_breakdown (jsonb) -- Individual factor scores
algorithm_version (varchar)
created_at (timestamp)
```

#### `ranking_periods` - Period Metadata
```sql
period (varchar, primary key)
display_name (varchar) -- 'June 2025'
publication_date (date)
tools_count (integer)
algorithm_version (varchar)
editorial_summary (text)
major_changes (jsonb) -- Notable movements and new entries
is_current (boolean)
```

#### `news_updates` - Tool-Related News
```sql
id (uuid, primary key)
title (varchar)
summary (text)
url (varchar)
source (varchar)
published_at (timestamp)
related_tools (jsonb) -- Array of tool IDs
category (varchar) -- 'funding', 'product', 'industry'
importance_score (integer) -- 1-10
```

#### `email_subscribers` - Newsletter Signups
```sql
id (uuid, primary key)
email (varchar, unique)
subscribed_at (timestamp)
is_active (boolean)
preferences (jsonb) -- What updates they want
source (varchar) -- How they found us
```

### Seed Data Requirements

#### Tool Categories & Examples
```json
{
  "code-editors": [
    "cursor", "windsurf", "zed-agent", "pear-ai"
  ],
  "autonomous-agents": [
    "claude-code", "jules", "devin", "opendevin", "aider"
  ],
  "app-builders": [
    "bolt-new", "lovable", "v0-vercel", "replit-agent"
  ],
  "code-completion": [
    "github-copilot", "gemini-code-assist", "tabnine", "codeium"
  ],
  "testing-tools": [
    "qodo-gen", "diffblue-cover", "snyk-code"
  ]
}
```

#### Initial Rankings Data (June 2025)
- **30+ tools** with complete profiles
- **Ranking positions 1-30+** with realistic scores
- **Movement indicators** based on hypothetical previous month
- **Score breakdowns** across all algorithm factors

#### Sample Tool Profiles Needed
1. **Cursor** - Top ranked code editor with Claude integration
2. **GitHub Copilot** - Established incumbent with broad adoption
3. **Claude Code** - New autonomous agent from Anthropic
4. **Bolt.new** - Popular app builder with rapid prototyping
5. **Lovable** - Rising app builder with strong growth

---

## Frontend Page Specifications

### 1. Landing Page (`/`)

#### Hero Section
- **Headline**: "The Definitive Monthly Rankings of Agentic AI Coding Tools"
- **Subheading**: "Data-driven analysis of the tools reshaping software development"
- **Top 3 Preview**: Current #1, #2, #3 tools with logos and brief descriptions
- **CTA Buttons**: "View Full Rankings" and "Learn Our Methodology"

#### Value Proposition Section
- **For Developers**: "Make informed decisions about AI tools"
- **For Teams**: "Evaluate tools before adoption"
- **For Industry**: "Track market trends and emerging technologies"

#### Latest Updates Section
- **Recent News**: 3-4 latest significant tool updates or funding announcements
- **Ranking Changes**: "Since last month: Cursor ↗️+2, Jules ↘️-3, Lovable NEW"
- **Market Insights**: Brief analysis of current trends

#### Email Signup Section
- **Value Proposition**: "Get monthly rankings and exclusive insights"
- **Form**: Email input with clear privacy policy
- **Social Proof**: "Join 500+ developers already subscribed"

#### Algorithm Overview Section
- **Transparency**: "How We Rank" with 6 factor breakdown
- **Methodology Link**: Clear path to detailed algorithm explanation
- **Update Schedule**: "Rankings updated monthly, data collected daily"

### 2. Rankings Page (`/rankings`)

#### Header Section
- **Current Period**: "June 2025 Power Rankings"
- **Last Updated**: Clear timestamp
- **View Options**: Toggle between table and grid layouts
- **Export**: Download as CSV or PDF

#### Filtering Sidebar
- **Category Filter**: Multi-select checkboxes
- **Pricing Filter**: Free, Freemium, Paid, Enterprise
- **License Filter**: Open Source, Commercial
- **Capabilities**: Autonomy level, multi-file support, etc.
- **Clear Filters**: Reset to show all tools

#### Sorting Options
- **Rank** (default)
- **Movement** (biggest movers first)
- **Score** (highest to lowest)
- **Alphabetical**
- **Recently Updated**

#### Rankings Display

##### Table Layout
| Rank | Tool | Movement | Score | Category | The Real Story |
|------|------|----------|-------|----------|----------------|
| 1 | Cursor | ↗️ +1 | 8.94 | Code Editor | $9.9B valuation validates market leadership... |

##### Grid Layout
```
[Tool Card]
├── Logo & Name
├── Rank & Movement Badge
├── Category Tag
├── Score Progress Bar
├── Key Metrics (Stars, Funding)
└── Brief Description
```

#### Pagination
- **Items Per Page**: 20, 50, 100 options
- **Load More**: Infinite scroll option
- **Jump to Page**: Direct navigation

### 3. Tool Detail Page (`/tools/[slug]`)

#### Tool Header
- **Logo & Name**: Large, prominent display
- **Company & Category**: Clear labeling
- **Current Rank**: Large badge with movement indicator
- **Key Actions**: Visit Website, View GitHub, Compare Tools

#### Overview Section
- **Description**: 2-3 paragraph tool overview
- **Key Features**: Bullet points of main capabilities
- **Pricing**: Current pricing tiers and model
- **Availability**: Platform availability and access

#### Ranking Performance
- **Current Score**: Large display with breakdown by factor
- **Historical Chart**: 6-month ranking trend
- **Movement Analysis**: Explanation of recent changes
- **Peer Comparison**: How it compares to similar tools

#### Technical Specifications
- **Capabilities Matrix**: Supported languages, platforms, features
- **Integration Options**: IDEs, platforms, APIs
- **Dependencies**: LLM providers, infrastructure requirements
- **Architecture**: Deployment options and technical details

#### Metrics Dashboard
- **GitHub Stats**: Stars, forks, commits, contributors
- **Development Activity**: Release frequency, recent updates
- **Community Metrics**: User estimates, social mentions
- **Business Metrics**: Funding, valuation (when available)

#### Recent Updates
- **Timeline**: Chronological list of recent developments
- **News Mentions**: Relevant articles and announcements
- **Feature Releases**: Recent product updates
- **Funding News**: Investment rounds and partnerships

#### Related Tools
- **Similar Tools**: 3-4 tools in same category
- **Alternatives**: Different approaches to same problem
- **Comparison Links**: Quick access to side-by-side comparisons

---

## UI/UX Design Requirements

### Design System
- **Color Palette**: Professional blues and grays with green/red for movement
- **Typography**: System fonts optimized for readability and data display
- **Components**: Consistent ranking cards, metric displays, trend indicators
- **Icons**: Unified icon set for movements, categories, and actions

### Responsive Design
- **Desktop First**: Optimized for developer workstations
- **Tablet**: Adapted grid layouts and touch-friendly interactions
- **Mobile**: Simplified layouts with essential information prioritized

### Performance Requirements
- **Page Load**: <2 seconds for initial load
- **Interaction**: <300ms for filtering and sorting
- **Images**: Optimized tool logos and screenshots
- **Caching**: Aggressive caching for static ranking data

### Accessibility
- **WCAG 2.1 AA**: Full compliance with accessibility standards
- **Keyboard Navigation**: All functionality accessible via keyboard
- **Screen Readers**: Proper ARIA labels and semantic HTML
- **Color Contrast**: Sufficient contrast ratios throughout

---

# Phase 1B: Crawler & Updater

## Data Collection Pipeline Architecture

### Collection Schedule
- **Daily Collection** (6 AM UTC): GitHub metrics, news scanning, basic updates
- **Weekly Deep Dive** (Sundays): Social sentiment, detailed analysis, validation
- **Monthly Ranking** (1st of month): Algorithm execution, ranking generation

### Data Sources Integration

#### GitHub API Collection
**Frequency**: Daily
**Endpoints**:
- Repository statistics
- Commit activity
- Contributor counts
- Release information
- Issue metrics

**Data Points**:
- Stars, forks, watchers
- Commits in last 30 days
- Contributors count
- Last commit timestamp
- Open/closed issues ratio
- Release frequency

#### Perplexity AI Integration
**Frequency**: Daily for news, weekly for deep analysis
**Use Cases**:
- Recent news and announcements
- Funding and investment updates
- Product launch detection
- Market sentiment analysis
- Competitive intelligence

**Queries**:
- "[Tool name] news funding investment 2025"
- "[Tool name] product updates features release"
- "[Tool name] user adoption metrics statistics"
- "AI coding tools market trends [current month]"

#### Web Scraping Targets
**Frequency**: Weekly
**Sources**:
- Company websites for pricing updates
- Product Hunt for launch metrics
- Crunchbase for funding data
- Social media for user sentiment

#### Manual Research Integration
**Frequency**: As needed
**Sources**:
- Company press releases
- Industry analyst reports
- Developer survey results
- Expert interviews

### Data Processing Pipeline

#### Event-Driven Architecture
```
Raw Data Collection → Event Storage → Data Validation → Metric Calculation → Ranking Generation
```

#### Data Validation Rules
- **Completeness**: Required fields present
- **Accuracy**: Cross-reference multiple sources
- **Freshness**: Data recency requirements
- **Consistency**: Format and type validation
- **Anomaly Detection**: Identify unusual changes

#### Error Handling
- **API Rate Limits**: Exponential backoff and retry logic
- **Data Quality Issues**: Flagging and manual review queues
- **Source Failures**: Graceful degradation and alerting
- **Validation Failures**: Rollback and correction processes

### Ranking Algorithm Implementation

#### Score Calculation Process
1. **Data Normalization**: Convert all metrics to 0-1 scale using percentile ranking
2. **Factor Scoring**: Calculate individual factor scores with proper weighting
3. **Composite Score**: Combine factors using algorithm weights
4. **Peer Adjustment**: Adjust scores relative to category peers
5. **Movement Calculation**: Compare to previous period for position changes

#### Algorithm Factors

##### Market Traction (25%)
- Funding amount (log scale normalization)
- Valuation data (when available)
- Estimated user adoption
- Industry recognition metrics

##### Technical Capability (20%)
- Autonomy level assessment
- Context window capabilities
- Multi-file editing support
- Language and platform breadth

##### Developer Adoption (20%)
- GitHub engagement metrics
- Community size indicators
- Integration ecosystem
- User satisfaction signals

##### Development Velocity (15%)
- Release frequency analysis
- Feature development rate
- Issue resolution speed
- Team activity levels

##### Platform Resilience (10%)
- LLM provider diversity
- Technical architecture assessment
- Dependency risk evaluation
- Business model sustainability

##### Community Sentiment (10%)
- Social media mentions
- Review aggregation
- Developer feedback
- Expert opinions

#### Ranking Generation
- **Score Calculation**: Execute algorithm across all active tools
- **Position Assignment**: Rank tools by composite score
- **Movement Analysis**: Compare to previous ranking period
- **Validation**: Sanity check results and flag anomalies
- **Publication**: Update database and trigger frontend updates

### Automation Infrastructure

#### Vercel Cron Jobs
```javascript
// vercel.json cron configuration
{
  "crons": [
    {
      "path": "/api/collect/daily",
      "schedule": "0 6 * * *" // Daily at 6 AM UTC
    },
    {
      "path": "/api/collect/weekly", 
      "schedule": "0 8 * * 0" // Weekly on Sunday at 8 AM UTC
    },
    {
      "path": "/api/rankings/generate",
      "schedule": "0 10 1 * *" // Monthly on 1st at 10 AM UTC
    }
  ]
}
```

#### Collection Endpoints

##### `/api/collect/daily`
- GitHub metrics for all active tools
- Basic news scanning via Perplexity
- System health checks
- Data quality validation

##### `/api/collect/weekly`
- Deep market analysis
- Social sentiment collection
- Competitor research
- Data accuracy validation

##### `/api/rankings/generate`
- Execute ranking algorithm
- Generate new period snapshot
- Update tool positions
- Trigger notification systems

#### Error Monitoring & Alerting
- **Failed Collections**: Email alerts for pipeline failures
- **Data Anomalies**: Automatic flagging of unusual metrics
- **API Limits**: Monitoring and preventive throttling
- **Performance Issues**: Response time and success rate tracking

### Data Quality Assurance

#### Validation Framework
- **Schema Validation**: Ensure data matches expected structure
- **Range Validation**: Check metrics fall within reasonable bounds
- **Consistency Checks**: Cross-validate between related metrics
- **Historical Validation**: Flag dramatic unexplained changes

#### Manual Review Processes
- **New Tool Addition**: Human verification of tool information
- **Significant Changes**: Review ranking movements >5 positions
- **Data Anomalies**: Investigate flagged inconsistencies
- **Algorithm Updates**: Validate scoring changes before deployment

#### Quality Metrics
- **Data Completeness**: Percentage of required fields populated
- **Source Reliability**: Track accuracy of different data sources
- **Update Frequency**: Monitor collection schedule adherence
- **Validation Pass Rate**: Percentage of data passing quality checks

### Performance & Scalability

#### Optimization Strategies
- **Batch Processing**: Group API calls to minimize overhead
- **Intelligent Caching**: Cache frequently accessed data
- **Incremental Updates**: Only collect changed data when possible
- **Rate Limit Management**: Respect API limits with proper throttling

#### Monitoring & Analytics
- **Collection Metrics**: Track success rates and execution times
- **Data Volume**: Monitor growth in collected data
- **Algorithm Performance**: Track ranking calculation efficiency
- **System Resources**: Database performance and storage usage

---

## Implementation Timeline

### Phase 1A Timeline (4-6 weeks)

#### Week 1-2: Database & Infrastructure
- Supabase project setup and configuration
- Database schema implementation
- Seed data creation (30+ tools)
- Initial manual ranking calculation

#### Week 3-4: Frontend Development
- Next.js project setup with Tailwind
- Component library and design system
- Landing page implementation
- Rankings page with filtering/sorting

#### Week 5-6: Tool Details & Polish
- Tool detail page implementation
- Responsive design refinement
- Performance optimization
- Testing and bug fixes

### Phase 1B Timeline (3-4 weeks)

#### Week 1: Collection Infrastructure
- GitHub API integration
- Perplexity AI integration
- Basic data validation framework
- Error handling and logging

#### Week 2: Ranking Algorithm
- Algorithm implementation
- Score calculation logic
- Movement detection
- Historical comparison

#### Week 3: Automation Setup
- Vercel cron job configuration
- Collection endpoint implementation
- Data processing pipeline
- Quality assurance processes

#### Week 4: Testing & Monitoring
- End-to-end pipeline testing
- Performance optimization
- Monitoring and alerting setup
- Documentation and deployment

## Success Criteria

### Phase 1A Success
- **Complete Frontend**: All three pages fully functional
- **30+ Tools**: Comprehensive tool profiles with accurate data
- **Performance**: Sub-2 second page loads
- **Responsive**: Works perfectly on desktop, tablet, mobile

### Phase 1B Success
- **Automated Collection**: Daily data updates without manual intervention
- **Accurate Rankings**: Algorithm produces sensible, defensible rankings
- **Reliable Pipeline**: 99%+ uptime for data collection
- **Quality Data**: <5% error rate in collected metrics

The combination of 1A and 1B creates a fully functional, self-updating AI Power Rankings platform ready for public launch and community engagement.