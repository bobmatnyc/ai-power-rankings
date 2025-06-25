# AI Power Ranking - Technical Stack

## Project Overview

AI Power Ranking is a full-stack web application built in 2 days that provides data-driven rankings of AI coding tools. The site combines real-time data processing, internationalization, and a sophisticated ranking algorithm.

## Quick Stats

- **Total Source Files**: 100+
- **Lines of Code**: 15,000+
- **React Components**: 35+
- **API Routes**: 25+
- **Database Migrations**: 10+
- **Supported Languages**: 9
- **Cache Files**: 3 (rankings, tools, news)
- **Build Time**: ~2 days initial + ongoing iterations
- **Developer**: 1 (Bob Matsuoka)

## Technology Stack

### Frontend

- **Next.js 15.3.3** - React framework with App Router
- **React 19.0** - UI library
- **TypeScript 5** - Type-safe JavaScript
- **Tailwind CSS 3.4** - Utility-first CSS framework
- **Radix UI** - Unstyled, accessible component library
- **Lucide React** - Icon library
- **Framer Motion** - Animation library

### Backend

- **Node.js** - JavaScript runtime
- **Payload CMS 3.0** - Headless CMS for content management
- **Supabase** - PostgreSQL database & authentication
- **Cache-First Architecture** - Static JSON fallback system
- **Resend** - Email service for newsletters
- **Cloudflare Turnstile** - CAPTCHA service

### Database & Data Layer

- **PostgreSQL** (via Supabase) - Primary database
- **Payload CMS Collections** - Tools, Companies, News, Metrics
- **Static JSON Cache** - Resilient fallback data layer
- **10+ custom tables** for tools, rankings, metrics, and newsletter subscriptions
- **Materialized views** for performance optimization
- **JSONB columns** for flexible data storage

### Development & Testing

- **Vitest** - Unit testing framework (36 tests)
- **Pino** - Structured JSON logging
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - Static type checking

### Infrastructure

- **Vercel** - Deployment platform with edge functions
- **GitHub Actions** - CI/CD (planned)
- **Cloudflare** - CDN and security
- **Static Cache Layer** - JSON files for database-free operation

## Architecture

### Directory Structure

```
src/
├── app/              # Next.js App Router pages
│   ├── [lang]/       # Internationalized routes
│   └── api/          # API endpoints
├── components/       # React components
│   ├── forms/        # Form components
│   ├── layout/       # Layout components
│   ├── news/         # News-related components
│   ├── ranking/      # Ranking display components
│   ├── tool/         # Tool detail components
│   └── ui/           # Shared UI components
├── data/             # Static cache layer
│   └── cache/        # JSON cache files
├── i18n/             # Internationalization
├── lib/              # Utility functions & core logic
├── payload/          # Payload CMS configuration
└── types/            # TypeScript type definitions
```

### Payload CMS Integration

Payload CMS 3.0 serves as the content management layer:

- **Collections**: Tools, Companies, News, Tool Metrics
- **Rich Text Editing**: Lexical editor for content
- **Media Management**: Tool logos and screenshots
- **API Generation**: Automatic REST and GraphQL APIs
- **Admin Panel**: Custom dashboard at `/admin`
- **Database Sync**: Direct PostgreSQL integration
- **Type Safety**: Full TypeScript support

### Key Features Implementation

#### 1. **Ranking Algorithm (v6.0)**

- 8 scoring factors with dynamic weights
- 3 modifier systems (innovation decay, platform risk, revenue quality)
- Logarithmic scaling for fair comparisons
- Weekly recalculation with historical tracking

#### 2. **Internationalization (i18n)**

- 8 languages: EN, DE, FR, IT, JP, KO, UK, HR
- Dynamic language routing with Next.js middleware
- Fallback system for missing translations
- Server-side rendering for SEO

#### 3. **Real-time News System**

- Pulls from metrics_history table events
- Infinite scroll with intersection observer
- Category filtering and sorting
- Responsive card layout

#### 4. **Newsletter System**

- Double opt-in verification flow
- Resend API integration
- Unsubscribe functionality
- GDPR-compliant data handling

#### 5. **Performance Optimizations**

- Cache-first data fetching with JSON fallback
- Client-side filtering and sorting
- Static site generation (SSG) for most pages
- Incremental static regeneration (ISR)
- Database query optimization
- Image optimization with Next.js Image
- Single API call per page with client processing

## API Endpoints

### Core Data APIs (Cache-First)

1. **GET /api/rankings** - Fetch current rankings (cache-first)
2. **GET /api/tools** - List all tools (cache-first)
3. **GET /api/tools/[slug]** - Tool details with history
4. **GET /api/news** - Complete news feed (client-side pagination)

### Newsletter APIs

5. **POST /api/newsletter/subscribe** - Newsletter signup
6. **GET /api/newsletter/verify/[token]** - Email verification
7. **POST /api/newsletter/unsubscribe** - Unsubscribe

### Debug & Health APIs

8. **GET /api/health/db** - Database connection status
9. **GET /api/debug-static** - Cache validation
10. **GET /api/debug-env** - Environment verification

### Utility APIs

11. **GET /api/favicon** - Dynamic favicon fetching
12. **GET /api/[...slug]** - Payload CMS proxy

## Database Schema Highlights

### Payload CMS Collections

- **tools** - Core tool information with rich metadata
- **companies** - Company profiles and relationships
- **news** - News articles and updates
- **tool_metrics** - Performance and adoption metrics

### Custom Tables

- **metrics_history** - Time-series metrics data
- **ranking_cache** - Materialized rankings for performance
- **newsletter_subscriptions** - Email list management
- **innovation_decay** - Tracks feature age for scoring
- **platform_risks** - Risk assessment data
- **revenue_models** - Business model classifications

### Cache Layer

- **rankings.json** - Pre-calculated rankings with metadata
- **tools.json** - Complete tools database snapshot
- **news.json** - Recent news and updates

## Development Workflow

1. **Local Development**: `npm run dev`
2. **Type Checking**: `npm run type-check`
3. **Testing**: `npm test`
4. **Build**: `npm run build`
5. **Pre-deployment**: `npm run pre-deploy`

## Performance Metrics

- **Lighthouse Score**: 95+ (Performance)
- **Build Time**: ~45 seconds
- **Page Load**: <1s (cached)
- **API Response**: <50ms (cache-first)
- **Database Fallback**: 100% functional without DB
- **Client Filtering**: Instant (no API calls)

## Security Measures

- Environment variable validation
- SQL injection prevention via parameterized queries
- XSS protection with React's built-in escaping
- CSRF protection with SameSite cookies
- Rate limiting on API endpoints
- Cloudflare DDoS protection

## Monitoring & Logging

- **Pino** structured logging with context
- **Vercel Analytics** for performance monitoring
- **Error tracking** with detailed stack traces
- **Database query logging** for optimization

## Future Enhancements

- GraphQL API layer
- Redis caching layer
- WebSocket for real-time updates
- Advanced search with Algolia
- A/B testing framework
- Mobile app with React Native

## Cache-First Architecture (v2.1)

The application now implements a resilient cache-first approach:

1. **Static JSON caches** serve as primary data source
2. **Database as enhancement** - site works without DB connection
3. **Client-side processing** - filtering, sorting, pagination
4. **Automatic fallback** - seamless degradation on DB issues
5. **Manual cache updates** - controlled data freshness

## Development Philosophy

Built with the principle of "ship fast, iterate faster" - this entire application was created in 2 days by a single developer. The focus was on:

1. **Data accuracy** over perfect UI
2. **Resilience** over real-time perfection
3. **Developer experience** over premature optimization
4. **Transparency** over marketing polish
5. **Reliability** over complex dependencies

---

_Last updated: June 2025 (v2.1.0)_
