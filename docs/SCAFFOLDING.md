# AI Power Rankings - Local Development Setup

## 1. Project Initialization

### Create the project structure:
```bash
mkdir ai-power-rankings
cd ai-power-rankings

# Initialize Next.js project with TypeScript
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir

# Initialize Git
git init
```

### Project Directory Structure:
```
ai-power-rankings/
├── src/
│   ├── app/                          # Next.js 13+ app directory
│   │   ├── layout.tsx               # Root layout
│   │   ├── page.tsx                 # Landing page
│   │   ├── rankings/
│   │   │   └── page.tsx             # Rankings page
│   │   ├── tools/
│   │   │   └── [slug]/
│   │   │       └── page.tsx         # Tool detail page
│   │   ├── api/                     # API routes
│   │   │   ├── collect/
│   │   │   ├── rankings/
│   │   │   └── tools/
│   │   └── globals.css
│   ├── components/                   # Reusable UI components
│   │   ├── ui/                      # shadcn/ui components
│   │   ├── ranking/                 # Ranking-specific components
│   │   ├── tool/                    # Tool-specific components
│   │   └── layout/                  # Layout components
│   ├── lib/                         # Utility libraries
│   │   ├── database.ts              # Supabase client
│   │   ├── ranking-algorithm.ts     # Core ranking logic
│   │   ├── data-collectors/         # Data collection modules
│   │   └── utils.ts                 # General utilities
│   ├── types/                       # TypeScript type definitions
│   │   ├── database.ts              # Database types
│   │   ├── rankings.ts              # Ranking types
│   │   └── tools.ts                 # Tool types
│   └── data/                        # Seed data and static assets
│       ├── seed/                    # Database seed files
│       ├── tools/                   # Tool logos and assets
│       └── rankings/                # Initial ranking data
├── database/                        # Database schema and migrations
│   ├── schema.sql                   # Complete database schema
│   ├── migrations/                  # Database migrations
│   └── seed.sql                     # Seed data script
├── scripts/                         # Utility scripts
│   ├── seed-database.ts             # Database seeding script
│   ├── collect-data.ts              # Data collection script
│   └── generate-rankings.ts         # Ranking generation script
├── docs/                            # Documentation
│   ├── api.md                       # API documentation
│   ├── database.md                  # Database documentation
│   └── deployment.md                # Deployment guide
├── public/                          # Static assets
│   ├── tools/                       # Tool logos
│   └── icons/                       # UI icons
├── .env.local                       # Environment variables
├── .env.example                     # Environment variables template
├── package.json
├── README.md
└── vercel.json                      # Vercel configuration
```

## 2. Dependencies Installation

### Core dependencies:
```bash
npm install @supabase/supabase-js
npm install @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-avatar
npm install @radix-ui/react-badge @radix-ui/react-button @radix-ui/react-card
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-table
npm install lucide-react
npm install class-variance-authority clsx tailwind-merge
npm install recharts
npm install date-fns
npm install zod
npm install react-hook-form @hookform/resolvers
```

### Development dependencies:
```bash
npm install -D @types/node
npm install -D eslint-config-next
npm install -D prettier eslint-config-prettier
npm install -D tailwindcss-animate
```

### Data collection dependencies:
```bash
npm install @octokit/rest
npm install axios
npm install cheerio
npm install csv-parser
npm install dotenv
```

## 3. Environment Configuration

### Create `.env.local`:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# GitHub API
GITHUB_TOKEN=your_github_token

# News APIs
PERPLEXITY_API_KEY=your_perplexity_key

# Vercel (for deployment)
VERCEL_URL=

# Development
NODE_ENV=development
```

### Create `.env.example`:
```bash
# Copy from .env.local but with placeholder values
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
# ... etc
```

## 4. Database Setup

### Supabase Setup:
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Initialize Supabase project
supabase init

# Start local development (optional)
supabase start

# Or create remote project
supabase projects create ai-power-rankings
```

### Database Schema (`database/schema.sql`):
```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tools table
CREATE TABLE tools (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    description TEXT,
    website_url VARCHAR(255),
    github_repo VARCHAR(255),
    company_name VARCHAR(100),
    founded_date DATE,
    pricing_model VARCHAR(20),
    license_type VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    logo_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tool capabilities
CREATE TABLE tool_capabilities (
    tool_id VARCHAR(50) REFERENCES tools(id),
    autonomy_level INTEGER CHECK (autonomy_level >= 1 AND autonomy_level <= 10),
    context_window_size INTEGER,
    supports_multi_file BOOLEAN DEFAULT FALSE,
    supported_languages JSONB,
    supported_platforms JSONB,
    integration_types JSONB,
    llm_providers JSONB,
    deployment_options JSONB,
    PRIMARY KEY (tool_id)
);

-- Tool metrics (current snapshot)
CREATE TABLE tool_metrics (
    tool_id VARCHAR(50) REFERENCES tools(id),
    metric_date DATE DEFAULT CURRENT_DATE,
    github_stars INTEGER DEFAULT 0,
    github_forks INTEGER DEFAULT 0,
    github_watchers INTEGER DEFAULT 0,
    github_commits_last_month INTEGER DEFAULT 0,
    github_contributors INTEGER DEFAULT 0,
    github_last_commit TIMESTAMP,
    funding_total BIGINT DEFAULT 0,
    valuation_latest BIGINT DEFAULT 0,
    estimated_users INTEGER DEFAULT 0,
    social_mentions_30d INTEGER DEFAULT 0,
    sentiment_score DECIMAL(3,2) DEFAULT 0.5,
    community_size INTEGER DEFAULT 0,
    release_frequency_days INTEGER,
    PRIMARY KEY (tool_id, metric_date)
);

-- Rankings
CREATE TABLE rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period VARCHAR(20) NOT NULL,
    tool_id VARCHAR(50) REFERENCES tools(id),
    position INTEGER NOT NULL,
    score DECIMAL(5,3) NOT NULL,
    movement VARCHAR(10),
    movement_positions INTEGER DEFAULT 0,
    previous_position INTEGER,
    score_breakdown JSONB,
    algorithm_version VARCHAR(10),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(period, tool_id)
);

-- Ranking periods
CREATE TABLE ranking_periods (
    period VARCHAR(20) PRIMARY KEY,
    display_name VARCHAR(50) NOT NULL,
    publication_date DATE NOT NULL,
    tools_count INTEGER NOT NULL,
    algorithm_version VARCHAR(10),
    editorial_summary TEXT,
    major_changes JSONB,
    is_current BOOLEAN DEFAULT FALSE
);

-- News updates
CREATE TABLE news_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    url VARCHAR(500) NOT NULL,
    source VARCHAR(100) NOT NULL,
    published_at TIMESTAMP NOT NULL,
    related_tools JSONB,
    category VARCHAR(50),
    importance_score INTEGER CHECK (importance_score >= 1 AND importance_score <= 10),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Email subscribers
CREATE TABLE email_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    subscribed_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    preferences JSONB,
    source VARCHAR(50)
);

-- Create indexes for performance
CREATE INDEX idx_rankings_period ON rankings(period);
CREATE INDEX idx_rankings_position ON rankings(position);
CREATE INDEX idx_tools_category ON tools(category);
CREATE INDEX idx_tools_status ON tools(status);
CREATE INDEX idx_news_published ON news_updates(published_at);
CREATE INDEX idx_metrics_date ON tool_metrics(metric_date);
```

## 5. TypeScript Types

### `src/types/database.ts`:
```typescript
export interface Tool {
  id: string;
  name: string;
  slug: string;
  category: string;
  subcategory?: string;
  description?: string;
  website_url?: string;
  github_repo?: string;
  company_name?: string;
  founded_date?: string;
  pricing_model?: 'free' | 'freemium' | 'paid' | 'enterprise';
  license_type?: 'open-source' | 'proprietary' | 'commercial';
  status: 'active' | 'discontinued' | 'beta';
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ToolCapabilities {
  tool_id: string;
  autonomy_level: number;
  context_window_size?: number;
  supports_multi_file: boolean;
  supported_languages: string[];
  supported_platforms: string[];
  integration_types: string[];
  llm_providers: string[];
  deployment_options: string[];
}

export interface ToolMetrics {
  tool_id: string;
  metric_date: string;
  github_stars: number;
  github_forks: number;
  github_watchers: number;
  github_commits_last_month: number;
  github_contributors: number;
  github_last_commit?: string;
  funding_total: number;
  valuation_latest: number;
  estimated_users: number;
  social_mentions_30d: number;
  sentiment_score: number;
  community_size: number;
  release_frequency_days?: number;
}

export interface Ranking {
  id: string;
  period: string;
  tool_id: string;
  position: number;
  score: number;
  movement: 'up' | 'down' | 'same' | 'new' | 'returning';
  movement_positions: number;
  previous_position?: number;
  score_breakdown: Record<string, number>;
  algorithm_version: string;
  created_at: string;
}

export interface RankingPeriod {
  period: string;
  display_name: string;
  publication_date: string;
  tools_count: number;
  algorithm_version: string;
  editorial_summary?: string;
  major_changes: Record<string, any>;
  is_current: boolean;
}
```

## 6. Core Components Setup

### `src/lib/database.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Service client for server-side operations
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

### `src/lib/ranking-algorithm.ts`:
```typescript
export interface RankingWeights {
  marketTraction: number;      // 25%
  technicalCapability: number; // 20%
  developerAdoption: number;   // 20%
  developmentVelocity: number; // 15%
  platformResilience: number;  // 10%
  communitySentiment: number;  // 10%
}

export const DEFAULT_WEIGHTS: RankingWeights = {
  marketTraction: 0.25,
  technicalCapability: 0.20,
  developerAdoption: 0.20,
  developmentVelocity: 0.15,
  platformResilience: 0.10,
  communitySentiment: 0.10
};

export interface ToolScore {
  toolId: string;
  overallScore: number;
  factorScores: {
    marketTraction: number;
    technicalCapability: number;
    developerAdoption: number;
    developmentVelocity: number;
    platformResilience: number;
    communitySentiment: number;
  };
}

export class RankingEngine {
  constructor(private weights: RankingWeights = DEFAULT_WEIGHTS) {}

  calculateToolScore(metrics: any): ToolScore {
    // Implementation will be added in Phase 1B
    throw new Error('Not implemented yet');
  }
}
```

## 7. Initial Seed Data

### `src/data/seed/tools.json`:
```json
[
  {
    "id": "cursor",
    "name": "Cursor",
    "slug": "cursor",
    "category": "code-editor",
    "subcategory": "ai-enhanced-ide",
    "description": "AI-powered code editor with deep GPT-4 integration",
    "website_url": "https://cursor.com",
    "github_repo": null,
    "company_name": "Cursor Inc",
    "founded_date": "2023-01-01",
    "pricing_model": "freemium",
    "license_type": "proprietary",
    "status": "active",
    "logo_url": "/tools/cursor.png"
  },
  {
    "id": "github-copilot",
    "name": "GitHub Copilot",
    "slug": "github-copilot",
    "category": "code-completion",
    "subcategory": "ide-integration",
    "description": "AI pair programmer from GitHub and OpenAI",
    "website_url": "https://github.com/features/copilot",
    "github_repo": null,
    "company_name": "GitHub (Microsoft)",
    "founded_date": "2021-06-29",
    "pricing_model": "paid",
    "license_type": "proprietary",
    "status": "active",
    "logo_url": "/tools/github-copilot.png"
  }
  // Add more tools...
]
```

## 8. Development Scripts

### `package.json` scripts:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate-types": "supabase gen types typescript --local > src/types/supabase.ts",
    "db:reset": "supabase db reset",
    "db:seed": "tsx scripts/seed-database.ts",
    "collect:github": "tsx scripts/collect-github-data.ts",
    "generate:rankings": "tsx scripts/generate-rankings.ts"
  }
}
```

### `scripts/seed-database.ts`:
```typescript
import { supabaseAdmin } from '../src/lib/database';
import toolsData from '../src/data/seed/tools.json';

async function seedDatabase() {
  console.log('Seeding database...');
  
  // Insert tools
  const { error: toolsError } = await supabaseAdmin
    .from('tools')
    .insert(toolsData);
    
  if (toolsError) {
    console.error('Error seeding tools:', toolsError);
    return;
  }
  
  console.log('Database seeded successfully!');
}

seedDatabase().catch(console.error);
```

## 9. Initial Development Workflow

### Start development:
```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your actual values

# 3. Set up database
supabase db push

# 4. Seed database
npm run db:seed

# 5. Start development server
npm run dev
```

### Development checklist:
- [ ] Database schema created
- [ ] Seed data loaded
- [ ] Environment variables configured
- [ ] Basic components working
- [ ] Type definitions in place
- [ ] API routes structured

## 10. Next Steps (Phase 1A)

1. **Week 1-2**: Complete database setup and seed data
2. **Week 3-4**: Build core frontend components
3. **Week 5-6**: Implement ranking display and tool details
4. **Phase 1B**: Add data collection and automation

## Git Workflow

```bash
# Initial commit
git add .
git commit -m "Initial project scaffolding"

# Create development branch
git checkout -b develop

# Feature branches
git checkout -b feature/rankings-table
git checkout -b feature/tool-details
git checkout -b feature/data-collection
```

This scaffolding provides a solid foundation for building the AI Power Rankings platform with all the necessary structure, dependencies, and initial setup to begin development.