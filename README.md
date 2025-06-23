# AI Power Rankings

The definitive ranking system for agentic AI coding tools, providing data-driven monthly power rankings and market intelligence.

## 🚀 Overview

AI Power Rankings tracks, analyzes, and ranks autonomous AI development tools through:

- **Monthly Power Rankings** - Algorithm-based rankings emphasizing agentic capabilities
- **Comprehensive Metrics** - Technical performance, adoption, market traction, and innovation
- **Market Intelligence** - Industry trends, funding analysis, and strategic insights
- **Transparent Methodology** - Open algorithm with clear scoring criteria

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (strict mode)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui + Radix UI
- **Data Visualization**: Recharts
- **Deployment**: Vercel
- **Analytics**: Vercel Analytics

## 📦 Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/ai-power-rankings.git
cd ai-power-rankings
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

4. Configure your `.env.local` with:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://iupygejzjkwyxtitescy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Other required keys...
```

## 🚦 Development

### Start the development server:

```bash
npm run dev
```

### Run quality checks:

```bash
npm run ci:local    # Runs lint, type-check, format-check, and tests
npm run pre-deploy  # Run before any deployment
```

### Key Scripts:

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run type-check` - Check TypeScript types
- `npm run test` - Run tests
- `npm run extract-metrics` - Extract metrics from articles using AI

## 📚 Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[CLAUDE.md](CLAUDE.md)** - AI agent instructions and entry point
- **[docs/INSTRUCTIONS.md](docs/INSTRUCTIONS.md)** - Core development principles
- **[docs/WORKFLOW.md](docs/WORKFLOW.md)** - Development workflow and processes
- **[docs/PROJECT.md](docs/PROJECT.md)** - Project architecture and specifications
- **[docs/DATABASE.md](docs/DATABASE.md)** - Database documentation and operations

## 🏗️ Architecture

### Source-Oriented Metrics System

- Each article/benchmark can contain metrics for multiple tools
- Metrics stored as pure JSON with unique source URLs
- AI-powered extraction using GPT-4 for consistent data collection

### Algorithm v4.0 Weights

- **Agentic Capability** (25%) - Autonomous planning and execution
- **Technical Capability** (20%) - Performance and features
- **Developer Adoption** (20%) - Users and community
- **Market Traction** (15%) - Revenue and growth
- **Business Sentiment** (10%) - Market perception
- **Development Velocity** (5%) - Release frequency
- **Platform Resilience** (5%) - Dependencies

## 🗄️ Database

The project uses Supabase (PostgreSQL) with:

- **Project ID**: `iupygejzjkwyxtitescy`
- **Enhanced schema** with JSONB fields for flexible data storage
- **Materialized views** for performance
- **Source-oriented** metrics storage

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

- GitHub metrics via GitHub API
- News ingestion from Google Drive
- AI-powered article analysis

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

- **Production**: [https://aipowerrankings.com](https://aipowerrankings.com)
- **Documentation**: [/docs](./docs)
- **Issues**: [GitHub Issues](https://github.com/yourusername/ai-power-rankings/issues)

---

Built with ❤️ for the AI development community
