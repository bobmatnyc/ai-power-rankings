# AI Power Rankings - Project Documentation

## Architecture & Design Decisions

### Overview
// Created: 2025-06-08
This project is a comprehensive web platform that tracks, ranks, and analyzes agentic AI coding tools through data-driven monthly power rankings. The platform serves as the definitive resource for developers seeking to understand the rapidly evolving landscape of autonomous AI development tools.

The platform follows a monthly update cycle with daily data collection, implementing a transparent algorithmic ranking system that combines quantitative metrics with qualitative analysis.

### Tech Stack
// Created: 2025-06-08
- **Frontend Framework**: Next.js 13+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **UI Components**: Radix UI + shadcn/ui
- **Data Visualization**: Recharts
- **Authentication**: Supabase Auth
- **Deployment**: Vercel
- **Data Collection**: GitHub API, Perplexity AI API, Web Scraping
- **Email**: Resend (for newsletters)
- **Analytics**: Vercel Analytics

### Core Components

#### 1. Database Layer (Supabase)
// Created: 2025-06-08
Responsible for:
- Storing tool profiles, metrics, and rankings data
- Managing historical trend data and movement tracking
- Handling user subscriptions and preferences
- Providing real-time data synchronization
- Supporting complex queries for ranking calculations

#### 2. Data Collection Pipeline
// Created: 2025-06-08
Responsible for:
- **GitHub API Integration**: Repository metrics (stars, forks, commits, contributors)
- **News Aggregation**: RSS feeds, industry publications, funding announcements
- **Web Scraping**: Tool websites, pricing updates, feature releases
- **Social Sentiment**: Community discussions, developer feedback
- **Manual Research**: Expert analysis, hands-on testing, industry reports

#### 3. Ranking Algorithm Engine
// Created: 2025-06-08
Responsible for:
- **Score Calculation**: Weighted algorithm across 6 key factors
  - Market Traction (25%): Funding, valuation, user adoption
  - Technical Capability (20%): Autonomy level, features, context understanding
  - Developer Adoption (20%): GitHub metrics, community size, integrations
  - Development Velocity (15%): Release frequency, feature development
  - Platform Resilience (10%): LLM diversity, dependency risk assessment
  - Community Sentiment (10%): Reviews, social mentions, satisfaction
- **Movement Detection**: Comparing positions across ranking periods
- **Normalization**: Converting diverse metrics to comparable scales
- **Validation**: Sanity checking and anomaly detection

#### 4. Frontend Application (Next.js)
// Created: 2025-06-08
Responsible for:
- **Landing Page**: Hero section, value proposition, latest updates
- **Rankings Table**: Interactive sortable table with filtering and search
- **Tool Detail Pages**: Comprehensive profiles with metrics and analysis
- **Comparison Views**: Side-by-side tool comparisons
- **Historical Trends**: Visualizing ranking movements over time
- **Newsletter Signup**: Email subscription management

#### 5. API Layer
// Created: 2025-06-08
Responsible for:
- **Data Access**: RESTful endpoints for tool data and rankings
- **Collection Triggers**: Automated data collection via cron jobs
- **Ranking Generation**: Monthly ranking calculation endpoints
- **Subscription Management**: Email list and preference handling
- **Public API**: External access to ranking data (future)

#### 6. Automation & Scheduling
// Created: 2025-06-08
Responsible for:
- **Daily Collection**: GitHub metrics, news scanning (6 AM UTC)
- **Weekly Analysis**: Deep market research, sentiment analysis (Sundays)
- **Monthly Rankings**: Algorithm execution, ranking generation (1st of month)
- **Email Distribution**: Newsletter sending and subscriber management
- **Error Monitoring**: Failed collection alerts and data quality checks

## Development Practices

### Code Organization
// Created: 2025-06-08
- `src/app/`: Next.js 13+ app directory structure
  - `api/`: API routes for data access and collection
  - `rankings/`: Rankings page and filtering
  - `tools/[slug]/`: Dynamic tool detail pages
- `src/components/`: Reusable UI components
  - `ui/`: shadcn/ui base components
  - `ranking/`: Ranking-specific components
  - `tool/`: Tool profile components
- `src/lib/`: Core business logic and utilities
  - `database.ts`: Supabase client and queries
  - `ranking-algorithm.ts`: Core ranking calculations
  - `data-collectors/`: Data collection modules
- `src/types/`: TypeScript type definitions
- `database/`: Schema, migrations, and seed data
- `scripts/`: Utility scripts for data management

### Data Quality Standards
// Created: 2025-06-08
- **Multi-source Validation**: Confirm critical data from multiple sources
- **Recency Requirements**: Update key metrics monthly minimum
- **Accuracy Tracking**: Monitor and correct data inconsistencies
- **Source Attribution**: Clear citation for all data points
- **Community Verification**: Allow corrections from tool creators and users

### Algorithm Transparency
// Created: 2025-06-08
- **Open Methodology**: Publicly documented ranking factors and weights
- **Version Control**: Track algorithm changes with clear migration paths
- **Historical Consistency**: Maintain comparable scores across periods
- **Bias Mitigation**: Regular review and adjustment of ranking factors
- **Community Input**: Accept feedback on methodology improvements

### Error Handling & Monitoring
// Created: 2025-06-08
- **Collection Failures**: Automatic retry logic with exponential backoff
- **Data Validation**: Schema validation and range checking
- **API Rate Limits**: Respectful throttling and quota management
- **Quality Alerts**: Automated flagging of anomalous data changes
- **Performance Monitoring**: Track collection times and success rates

## Review Types & Analysis Framework

### Monthly Power Rankings
// Created: 2025-06-08
Comprehensive evaluation focusing on:
- **Position Changes**: Movement analysis with clear explanations
- **Market Dynamics**: Industry trends affecting tool positioning
- **New Entrants**: Tools gaining significant traction
- **Platform Risks**: Dependencies and strategic vulnerabilities
- **Feature Evolution**: How tools are adapting and improving

### Tool Deep Dives
// Created: 2025-06-08
In-depth analysis covering:
- **Hands-on Testing**: Real-world usage scenarios and workflows
- **Technical Assessment**: Capabilities, limitations, and architecture
- **Competitive Positioning**: How tools differentiate in their category
- **User Feedback**: Community sentiment and adoption patterns
- **Future Outlook**: Development roadmap and strategic direction

### Market Intelligence Reports
// Created: 2025-06-08
Strategic analysis including:
- **Funding Trends**: Investment patterns and valuation analysis
- **Technology Shifts**: Emerging capabilities and breakthrough features
- **Platform Evolution**: How agentic AI is reshaping development
- **Risk Assessment**: Platform dependencies and business model sustainability
- **Prediction Framework**: Evidence-based forecasting of tool trajectories

## Implementation Strategy

### Phase 1A: Core Infrastructure (Weeks 1-6)
// Created: 2025-06-08
1. **Database Design**: Complete schema implementation with seed data
2. **Frontend Foundation**: Landing page, rankings table, and basic navigation
3. **Tool Profiles**: Detailed pages with manual data entry for 30+ tools
4. **Basic Rankings**: Static monthly rankings with movement indicators
5. **UI/UX Polish**: Responsive design and performance optimization

### Phase 1B: Data Automation (Weeks 7-10)
// Created: 2025-06-08
1. **Collection Pipeline**: Automated GitHub API and news aggregation
2. **Algorithm Implementation**: Complete ranking calculation engine
3. **Scheduling System**: Vercel cron jobs for daily/monthly automation
4. **Data Validation**: Quality assurance and error handling
5. **Historical Migration**: Backfill trends and movement data

### Phase 2: Enhanced Features (Weeks 11-16)
// Created: 2025-06-08
1. **Advanced Filtering**: Category, capability, and metric-based filtering
2. **Comparison Tools**: Side-by-side tool comparisons
3. **Email Newsletter**: Automated monthly ranking distribution
4. **Public API**: External access to ranking data
5. **Community Features**: Tool submissions and correction system

### Phase 3: Intelligence Platform (Weeks 17-24)
// Created: 2025-06-08
1. **Predictive Analytics**: Tool trajectory forecasting
2. **Expert Network**: Contributor system for manual insights
3. **Advanced Visualizations**: Interactive charts and trend analysis
4. **Market Reports**: Automated industry intelligence generation
5. **Premium Features**: Enhanced analytics and early access

## Deployment & Usage

### Environment Setup
// Created: 2025-06-08
Required environment variables:
```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Data Collection APIs
GITHUB_TOKEN=your_github_token
PERPLEXITY_API_KEY=your_perplexity_key

# Email & Analytics
RESEND_API_KEY=your_resend_key
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your_analytics_id
```

### Development Workflow
// Created: 2025-06-08
```bash
# Setup
npm install
cp .env.example .env.local
npm run db:seed

# Development
npm run dev              # Start development server
npm run db:reset         # Reset and reseed database
npm run collect:github   # Manual data collection
npm run generate:rankings # Manual ranking generation

# Testing & Quality
npm run lint             # ESLint checking
npm run type-check       # TypeScript validation
npm test                 # Run test suite
```

### Data Collection Schedule
// Created: 2025-06-08
- **Daily (6 AM UTC)**: GitHub metrics, basic news scanning
- **Weekly (Sundays)**: Deep market analysis, sentiment collection
- **Monthly (1st, 10 AM UTC)**: Ranking algorithm execution
- **As Needed**: Manual research, expert analysis, breaking news

## Release Management & Content Strategy

### Content Publication Cycle
// Created: 2025-06-08

#### Monthly Rankings Release
1. **Data Collection**: Final metrics gathering (last week of month)
2. **Algorithm Execution**: Ranking calculation and validation
3. **Editorial Review**: Manual verification and insight generation
4. **Content Creation**: "The Real Story" explanations and market analysis
5. **Publication**: Website update and newsletter distribution

#### Quality Assurance Process
1. **Data Validation**: Multi-source verification of key changes
2. **Algorithm Review**: Sanity check ranking movements
3. **Editorial Standards**: Fact-checking and source attribution
4. **Community Review**: Allow 24-hour correction window before publication
5. **Performance Monitoring**: Track accuracy of predictions over time

### Version Control Strategy
// Created: 2025-06-08
- **Database Migrations**: Versioned schema changes with rollback capability
- **Algorithm Versions**: Tracked changes with historical recalculation
- **Content Versioning**: Editorial changes and correction tracking
- **Feature Releases**: Semantic versioning for platform capabilities

### Success Metrics
// Created: 2025-06-08

#### Platform Health
- Monthly unique visitors and engagement rates
- Email subscriber growth and retention
- Tool submission and community contribution rates
- Data collection success rates and quality scores

#### Market Impact
- Industry citations and media references
- Tool maker engagement and feedback
- Prediction accuracy tracking
- Community trust and satisfaction indicators

### Future Enhancements
// Created: 2025-06-08

#### Technical Roadmap
1. **Real-time Updates**: Live tool tracking for breaking news
2. **Machine Learning**: Automated trend detection and prediction
3. **API Ecosystem**: Third-party integrations and data syndication
4. **Mobile App**: Native mobile experience for rankings tracking
5. **International Expansion**: Multi-language and regional rankings

#### Content Evolution
1. **Video Content**: Tool demonstrations and expert interviews
2. **Podcast Series**: Weekly discussions on AI development trends
3. **Community Platform**: Developer forums and tool discussions
4. **Educational Content**: Guides for evaluating and adopting AI tools
5. **Enterprise Reports**: Custom analysis for organizational decision-making