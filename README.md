# AI Power Rankings

The definitive ranking system for agentic AI coding tools, providing data-driven monthly power rankings and market intelligence.

## 🚀 Overview

AI Power Rankings tracks, analyzes, and ranks autonomous AI development tools through:

- **Monthly Power Rankings** - Algorithm-based rankings emphasizing agentic capabilities
- **Comprehensive Metrics** - Technical performance, adoption, market traction, and innovation
- **Market Intelligence** - Industry trends, funding analysis, and strategic insights
- **Transparent Methodology** - Open algorithm with clear scoring criteria

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router & Turbopack
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL with Neon (JSONB storage) + JSON File fallback
- **ORM**: Drizzle ORM with repository pattern
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui + Radix UI
- **Data Visualization**: Recharts
- **Code Quality**: Biome (unified linting & formatting)
- **Deployment**: Vercel
- **Analytics**: Vercel Analytics & Speed Insights

## 📦 Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/ai-power-rankings.git
cd ai-power-rankings
```

2. Install dependencies:

```bash
pnpm install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

4. Configure your `.env.local` with required keys:

```bash
# Database Configuration (Required for production)
DATABASE_URL="postgresql://username:password@host/database?sslmode=require"
USE_DATABASE="true"  # Set to "false" to use JSON fallback

# Analytics & Monitoring
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your_analytics_id

# Newsletter & Contact Form  
RESEND_API_KEY=your_resend_key
CONTACT_EMAIL=your_contact_email

# Authentication (optional)
AUTHORIZED_EMAILS=admin@yoursite.com

# Other optional integrations...
```

### Database Setup

The application supports both PostgreSQL and JSON file storage:

- **Production**: Uses PostgreSQL with Neon for scalability and advanced features
- **Development**: Can use JSON files for quick setup or PostgreSQL for full testing
- **Fallback**: Automatically falls back to JSON files if database is unavailable

For detailed database setup instructions, see [docs/DATABASE-SETUP.md](docs/DATABASE-SETUP.md).

## 🚦 Development

### Start the development server:

```bash
pnpm dev
```

### Run quality checks:

```bash
pnpm ci:local    # Runs lint, type-check, format-check, and tests
pnpm pre-deploy  # Run before any deployment
```

### Key Scripts:

- `pnpm dev` - Start development server with Turbopack (auto-clears cache)
- `pnpm build` - Build for production with static rankings generation
- `pnpm biome:check` - Run Biome linting and formatting
- `pnpm type-check` - Check TypeScript types
- `pnpm test` - Run tests with Vitest
- `pnpm validate:all` - Validate JSON data integrity

### Database Scripts:

- `pnpm db:test` - Test database connection (works with both JSON and PostgreSQL)
- `pnpm db:migrate:json` - Migrate data from JSON files to PostgreSQL
- `pnpm db:push` - Push schema changes to database
- `pnpm db:studio` - Open Drizzle Studio (database GUI)

## 📚 Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[CLAUDE.md](CLAUDE.md)** - AI agent instructions and entry point
- **[REPOSITORY-STRUCTURE.md](REPOSITORY-STRUCTURE.md)** - Complete repository organization guide
- **[docs/INSTRUCTIONS.md](docs/INSTRUCTIONS.md)** - Core development principles
- **[docs/WORKFLOW.md](docs/WORKFLOW.md)** - Development workflow and processes
- **[docs/PROJECT.md](docs/PROJECT.md)** - Project architecture and specifications
- **[docs/JSON-STORAGE.md](docs/JSON-STORAGE.md)** - JSON file storage architecture

For a complete list of documentation, see the [docs directory](./docs/).

## 🏗️ Architecture

### Hybrid Architecture (PostgreSQL + JSON Fallback)

- **Production Database**: PostgreSQL with Neon for scalability and advanced queries
- **Development Flexibility**: JSON files for rapid development and offline work
- **Automatic Fallback**: System gracefully falls back to JSON if database unavailable
- **Data Migration**: Tools migrate JSON data to PostgreSQL seamlessly
- **Performance**: Sub-100ms response times with optimized JSONB queries

### Enhanced Ranking Algorithm v6.0-productivity-adjusted

#### Core Components
- **Research Integration**: Incorporates academic research findings (METR productivity study)
- **Cognitive Bias Correction**: 43% bias factor applied to user satisfaction metrics
- **Market Impact Analysis**: Business sentiment adjustments based on market share
- **News Impact Scoring**: Real-time integration of industry news and funding data

#### Algorithm Weights

- **Agentic Capability** (25%) - Autonomous planning and execution
- **Technical Capability** (20%) - Performance and features
- **Developer Adoption** (20%) - Users and community
- **Market Traction** (15%) - Revenue and growth
- **Business Sentiment** (10%) - Market perception
- **Development Velocity** (5%) - Release frequency
- **Platform Resilience** (5%) - Dependencies

## 🗂️ Data Storage

The project uses a hybrid storage architecture:

**PostgreSQL Database (Production)**
- **31 Tools**: Migrated with full metadata and JSONB flexibility
- **313 News Articles**: Full-text search and tool mention indexing
- **Monthly Rankings**: Historical data with algorithm versioning
- **Performance**: Sub-100ms queries with GIN indexes on JSONB columns

**JSON File Fallback**
- **High Performance**: Direct file access for development
- **Full Offline Support**: Works without internet connection
- **Automatic Backups**: Rotation system preserves data history
- **Type-Safe**: Full TypeScript schemas for all data structures

The system automatically detects database availability and switches between modes seamlessly.

## 🚀 Deployment

The application is deployed on Vercel:

1. **Pre-deployment checks**:

```bash
npm run pre-deploy
```

2. **Push to main branch** - Vercel automatically deploys

3. **Monitor deployment**:

```bash
npm run check-deployment
```

## 🔐 Security

- Environment variables use bracket notation for production compatibility
- Database clients centralized in `/lib/database`
- Service role keys only for admin operations
- All secrets in `.env.local` (never committed)

## 📊 Data Collection

### Automated Collection

- **GitHub Metrics**: Via GitHub API for development activity tracking
- **News Ingestion**: From Google Drive with AI-powered analysis
- **Article Scoring**: Automated relevance and impact scoring
- **Ranking Integration**: News impacts tool rankings in real-time

For detailed information about news collection and ingestion, see [docs/NEWS-INGESTION.md](docs/NEWS-INGESTION.md).

### Manual Updates

- Qualitative scores (innovation, sentiment)
- Market intelligence and insights
- Tool verification and corrections

## 🤝 Contributing

1. Read [INSTRUCTIONS.md](docs/INSTRUCTIONS.md) for development standards
2. Follow the workflow in [WORKFLOW.md](docs/WORKFLOW.md)
3. Use conventional commits
4. Run `npm run ci:local` before pushing
5. Create feature branches and use squash merges

## 📈 Version History

- **v2.0.0** (Current) - Single database architecture, enhanced schema
- **v1.2.0** - Source-oriented metrics, AI extraction
- **v1.1.0** - Enhanced database schema
- **v1.0.0** - Initial release with core ranking system

## 📄 License

This project is proprietary software. All rights reserved.

## 🔗 Links

- **Production**: [https://aipowerranking.com](https://aipowerranking.com)
- **Documentation**: [/docs](./docs)
- **Issues**: [GitHub Issues](https://github.com/yourusername/ai-power-rankings/issues)

---

Built with ❤️ for the AI development community
