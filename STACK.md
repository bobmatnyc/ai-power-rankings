# AI Power Ranking - Technical Stack

## Project Overview

AI Power Ranking is a full-stack web application built in 2 days that provides data-driven rankings of AI coding tools. The site combines real-time data processing, internationalization, and a sophisticated ranking algorithm.

## Quick Stats

- **Total Source Files**: 88
- **Lines of Code**: 12,057
- **React Components**: 27
- **API Routes**: 13
- **Database Migrations**: 8
- **Supported Languages**: 8
- **Build Time**: ~2 days
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
- **Supabase** - PostgreSQL database & authentication
- **Resend** - Email service for newsletters
- **Cloudflare Turnstile** - CAPTCHA service

### Database

- **PostgreSQL** (via Supabase)
- **8 custom tables** for tools, rankings, metrics, and newsletter subscriptions
- **Materialized views** for performance optimization
- **JSONB columns** for flexible data storage

### Development & Testing

- **Vitest** - Unit testing framework (36 tests)
- **Pino** - Structured JSON logging
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - Static type checking

### Infrastructure

- **Vercel** - Deployment platform
- **GitHub Actions** - CI/CD (planned)
- **Cloudflare** - CDN and security

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
├── i18n/             # Internationalization
├── lib/              # Utility functions & core logic
└── types/            # TypeScript type definitions
```

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

- Static site generation (SSG) for most pages
- Incremental static regeneration (ISR)
- Database query optimization
- Image optimization with Next.js Image

## API Endpoints

1. **GET /api/rankings** - Fetch current rankings
2. **GET /api/tools** - List all tools
3. **GET /api/tools/[slug]** - Tool details with history
4. **GET /api/news** - Paginated news feed
5. **POST /api/newsletter/subscribe** - Newsletter signup
6. **GET /api/newsletter/verify/[token]** - Email verification
7. **POST /api/newsletter/unsubscribe** - Unsubscribe
8. **GET /api/favicon** - Dynamic favicon fetching

## Database Schema Highlights

- **tools** - Core tool information with JSONB info column
- **metrics_history** - Time-series metrics data
- **ranking_cache** - Materialized rankings for performance
- **newsletter_subscriptions** - Email list management
- **innovation_decay** - Tracks feature age for scoring
- **platform_risks** - Risk assessment data
- **revenue_models** - Business model classifications

## Development Workflow

1. **Local Development**: `npm run dev`
2. **Type Checking**: `npm run type-check`
3. **Testing**: `npm test`
4. **Build**: `npm run build`
5. **Pre-deployment**: `npm run pre-deploy`

## Performance Metrics

- **Lighthouse Score**: 95+ (Performance)
- **Build Time**: ~30 seconds
- **Page Load**: <1s (cached)
- **API Response**: <100ms (average)

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

## Development Philosophy

Built with the principle of "ship fast, iterate faster" - this entire application was created in 2 days by a single developer. The focus was on:

1. **Data accuracy** over perfect UI
2. **Real-time updates** over static content
3. **Developer experience** over premature optimization
4. **Transparency** over marketing polish

---

_Last updated: June 2025_
