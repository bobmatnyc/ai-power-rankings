# AI Power Rankings - Technical Architecture

## Project Overview
AI Power Rankings is a Next.js 15 application that provides real-time rankings and analytics for AI coding tools. It features a sophisticated ranking algorithm (v6.0) that evaluates tools across multiple dimensions including market traction, technical capabilities, and developer adoption.

## Technical Stack
- **Framework**: Next.js 15.3.3 with App Router and Turbopack
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS with shadcn/ui components
- **Language**: TypeScript
- **Deployment**: Vercel
- **External Services**: OpenAI API for metrics analysis

## Core Architecture

### 1. Database Schema
The application uses Supabase with the following key tables:
- `companies`: Tool vendor information
- `tools`: AI coding tools with metadata
- `metrics_history`: Time-series metrics data (JSON storage)
- `rankings`: Calculated rankings per period
- `ranking_periods`: Time period management
- `ranking_cache`: Pre-computed ranking data for performance

### 2. Ranking Algorithm (v6.0)
Located in `/src/lib/ranking-algorithm-v6.ts`, the algorithm evaluates tools across 8 dimensions:
- Market Traction Score (20%)
- Technical Capability Score (15%)
- Developer Adoption Score (20%)
- Agentic Capability Score (10%)
- Innovation Score (10%)
- Development Velocity Score (10%)
- Platform Resilience Score (10%)
- Business Sentiment Score (5%)

### 3. Key Features
- **Dynamic Rankings**: Real-time calculation with caching
- **Category Filtering**: Tools organized by type (code-assistant, ai-editor, etc.)
- **Tag-based Filtering**: Filter by capabilities (autocomplete, chat, etc.)
- **Metrics Visualization**: Historical trends and score breakdowns
- **MCP Integration**: Model Context Protocol server for AI assistants

### 4. API Routes Structure
```
/api/
├── rankings/          # Get current rankings
├── tools/            # Tool details and management
│   └── [slug]/       # Individual tool endpoints
├── collect/          # Metrics collection endpoints
└── mcp/             # MCP server endpoints
    ├── rpc/         # JSON-RPC handler
    ├── oauth/       # OAuth flow (simplified for dev)
    └── config/      # MCP configuration
```

### 5. MCP (Model Context Protocol) Integration
The project includes an MCP server that allows AI assistants like Claude to:
- Query current rankings
- Get detailed tool information
- Analyze trends and comparisons
- Access via HTTP JSON-RPC protocol

### 6. Environment Variables Required
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Optional Services
OPENAI_API_KEY (for automated metrics extraction)
GITHUB_TOKEN (for GitHub metrics)

# MCP Development
ENABLE_DEV_MODE=true (simplifies OAuth for local testing)
```

### 7. Key Components
- `/src/components/ranking/`: Ranking display components
- `/src/components/tool/`: Tool detail components
- `/src/lib/ranking-algorithm.ts`: Core ranking logic
- `/src/lib/database.ts`: Database connection utilities
- `/src/types/`: TypeScript type definitions

### 8. Data Flow
1. Metrics are collected via API endpoints or manual entry
2. Stored in `metrics_history` as JSON with timestamps
3. Ranking algorithm processes metrics on-demand
4. Results cached in `ranking_cache` for performance
5. Frontend displays via React Server Components

### 9. Development Notes
- Uses App Router with Server Components
- Implements ISR (Incremental Static Regeneration) for performance
- CORS enabled for MCP endpoints
- Rate limiting on public API endpoints
- Comprehensive error handling and logging

### 10. Testing & Development
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run linting
npm run lint

# Run type checking
npm run typecheck
```

## Architecture Decisions
1. **JSON Storage for Metrics**: Flexible schema for evolving metric types
2. **Separate Ranking Cache**: Optimizes read performance
3. **Server Components**: Reduces client bundle size
4. **MCP Integration**: Enables AI assistant interactions
5. **Tag-based Filtering**: Allows multi-dimensional tool discovery