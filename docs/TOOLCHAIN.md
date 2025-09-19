# 🔧 AI Power Rankings - Toolchain Documentation

## Purpose

This document provides comprehensive toolchain mastery for the AI Power Rankings project, covering modules, frameworks, code standards, and technical configurations. This is the definitive guide for understanding and working with the project's technical stack.

## 🏗️ Project Architecture

### Tech Stack Overview

- **Frontend Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript (strict mode)
- **Package Manager**: pnpm (not npm/yarn)
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + shadcn/ui
- **Testing**: Vitest
- **Linting**: ESLint + Prettier
- **Authentication**: NextAuth.js
- **Deployment**: Vercel

### Data Architecture

- **Primary Storage**: PostgreSQL database with Drizzle ORM
- **ORM**: Drizzle - type-safe database queries and migrations
- **Database Schema**: `/src/lib/db/schema.ts`
- **Migrations**: `/src/lib/db/migrations/`
- **Email**: Resend
- **Analytics**: Custom implementation

## 📁 Project Structure

```
src/
├── app/                 # Next.js App Router pages and API routes
│   ├── [lang]/         # Internationalized pages
│   ├── api/            # API routes organized by domain
│   │   ├── admin/      # Administrative endpoints
│   │   ├── companies/  # Company data endpoints
│   │   ├── news/       # News content endpoints
│   │   ├── rankings/   # Rankings data endpoints
│   │   └── tools/      # Tools data endpoints
│   └── globals.css     # Global styles
├── components/         # React components organized by domain
│   ├── admin/          # Administrative UI components
│   ├── layout/         # Layout and navigation components
│   ├── news/           # News-related components
│   ├── ranking/        # Rankings display components
│   ├── seo/            # SEO optimization components
│   ├── tools/          # Tools display components
│   └── ui/             # Reusable UI components (shadcn/ui)
├── lib/                # Core utilities and services
│   ├── db/             # Database schema and migrations
│   │   ├── schema.ts   # Drizzle schema definitions
│   │   └── migrations/ # Database migration files
│   ├── i18n/           # Internationalization utilities
│   ├── seo/            # SEO utilities and tools
│   └── cache/          # Cache management
├── data/               # Static data and content
│   └── pages/          # Static page content
├── types/              # TypeScript type definitions
├── hooks/              # Custom React hooks
├── i18n/               # Internationalization configuration
├── scripts/            # Build and utility scripts
└── middleware.ts       # Next.js middleware
```

## 🔧 Development Environment Setup

### Required Tools

- **Node.js**: v18+ (check with `node --version`)
- **pnpm**: Latest version (install with `npm install -g pnpm`)
- **Git**: For version control
- **VS Code**: Recommended IDE with extensions:
  - TypeScript and JavaScript Language Features
  - Tailwind CSS IntelliSense
  - ESLint
  - Prettier

### Environment Variables

Always use bracket notation for environment variables:

```typescript
// ✅ CORRECT
process.env["GITHUB_TOKEN"];
process.env["NEXTAUTH_SECRET"];

// ❌ WRONG
process.env.GITHUB_TOKEN;
process.env.NEXTAUTH_SECRET;
```

## 📦 Package Management

### pnpm Commands

```bash
# Development
pnpm dev                    # Start dev server (clears Next.js cache)
pnpm dev:no-cache-clear    # Start without cache clear
pnpm run dev:pm2 start     # Start with PM2 process management
pnpm run dev:pm2 logs      # View server logs
pnpm run dev:pm2 restart   # Restart server
pnpm run dev:pm2 stop      # Stop server

# Build & Deployment
pnpm build                 # Production build with cache generation
pnpm start                 # Start production server
pnpm run pre-deploy        # Full CI pipeline check

# Quality Assurance
pnpm run ci:local          # Run all checks locally
pnpm run lint              # ESLint check
pnpm run lint:fix          # Auto-fix linting issues
pnpm run type-check        # TypeScript validation
pnpm run format            # Format code with Prettier
pnpm run format:check      # Check formatting
pnpm test                  # Run test suite
pnpm run test:watch        # Run tests in watch mode
pnpm run test:coverage     # Generate coverage report

# Database Management
pnpm run db:push           # Push schema changes to database
pnpm run db:generate       # Generate migration files
pnpm run db:migrate        # Run database migrations
pnpm run db:studio         # Open Drizzle Studio UI
```

## 🎨 Styling System

### Tailwind CSS Configuration

- **Design System**: Custom design tokens in `tailwind.config.js`
- **Dark Mode**: Class-based dark mode support
- **Responsive**: Mobile-first responsive design
- **Components**: shadcn/ui component library

### CSS Architecture

```typescript
// Component styling approach
<div className="bg-background text-foreground border border-border rounded-lg p-4">
  <h2 className="text-2xl font-bold mb-2">Component Title</h2>
  <p className="text-muted-foreground">Component description</p>
</div>
```

## 🗄️ Data Management

### Database System - Drizzle ORM with PostgreSQL

The project uses Drizzle ORM for type-safe database operations:

```typescript
// Database connection
import { db } from "@/lib/db";
import { tools, rankings, news } from "@/lib/db/schema";

// Type-safe queries
const allTools = await db.select().from(tools);
const tool = await db.select().from(tools).where(eq(tools.slug, "tool-name"));
```

### Database Configuration

- **ORM**: Drizzle with full TypeScript support
- **Database**: PostgreSQL (via DATABASE_URL environment variable)
- **Schema**: Defined in `/src/lib/db/schema.ts`
- **Migrations**: Located in `/src/lib/db/migrations/`
- **Studio UI**: Access with `pnpm run db:studio`

### Migration Workflow

```bash
# Development (push schema changes directly)
pnpm run db:push

# Production (generate and run migrations)
pnpm run db:generate   # Create migration files
pnpm run db:migrate    # Apply migrations
```

## 🌐 Internationalization (i18n)

### Configuration

- **Framework**: Custom i18n implementation
- **Languages**: English (en), German (de), French (fr), Japanese (ja), Korean (ko), Chinese (zh), Croatian (hr), Italian (it), Ukrainian (uk)
- **Dictionaries**: Located in `/src/i18n/dictionaries/`

### Usage Pattern

```typescript
import { getDictionary } from '@/i18n/get-dictionary'

export default async function Page({ params }: { params: { lang: string } }) {
  const dict = await getDictionary(params.lang)

  return (
    <h1>{dict.home.title}</h1>
  )
}
```

## 🧪 Testing Strategy

### Testing Framework

- **Framework**: Vitest
- **Location**: Tests co-located with source files (`*.test.ts`)
- **Coverage**: Minimum 80% coverage requirement

### Testing Patterns

```typescript
// Unit test example
import { describe, it, expect } from "vitest";
import { calculateRankingScore } from "@/lib/ranking-algorithm";

describe("calculateRankingScore", () => {
  it("should calculate correct score for tool metrics", () => {
    const metrics = { agentic_capability: 85, performance: 90 };
    const score = calculateRankingScore(metrics);
    expect(score).toBe(87.5);
  });
});
```

## 🔗 API Architecture

### Route Organization

```
/api/
├── admin/           # Administrative functions
├── companies/       # Company data CRUD
├── news/           # News content management
├── rankings/       # Rankings generation and retrieval
└── tools/          # Tools data management
```

### API Patterns

```typescript
// Standard API route structure
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Business logic
  const data = await getData();

  return NextResponse.json(data);
}
```

## 🚀 Deployment & CI/CD

### Pre-deployment Checklist

```bash
# Always run before deployment
pnpm run pre-deploy
```

This command runs:

1. `pnpm run lint` - Code linting
2. `pnpm run type-check` - TypeScript validation
3. `pnpm run format:check` - Code formatting check
4. `pnpm run test` - Test suite execution

### Build Process

1. **Cache Generation**: Static JSON files generated
2. **Type Checking**: Full TypeScript validation
3. **Next.js Build**: Production optimization
4. **Asset Optimization**: Image and CSS optimization

## 🔧 Development Workflow

### Post-Task Verification

After completing any development task:

```bash
# 1. Restart development server
pnpm run dev:pm2 restart

# 2. Monitor for errors
pnpm run dev:pm2 logs

# 3. Validate TypeScript
pnpm run type-check

# 4. Check code quality
pnpm run lint
```

### Code Quality Standards

- **TypeScript**: Strict mode enabled, no `any` types
- **ESLint**: Standard configuration with custom rules
- **Prettier**: Consistent code formatting
- **Conventional Commits**: Standardized commit messages

## 🛠️ Custom Tools & Scripts

### Data Scripts

```bash
# Rankings management
pnpm run generate:rankings    # Generate ranking payload
pnpm run export-by-date      # Export data by date range

# News management
pnpm run extract-metrics     # Extract metrics from articles
pnpm run analyze-news        # Analyze news impact

# SEO & Sitemap
pnpm run seo:submit-sitemap  # Submit sitemap to search engines

# Internationalization
pnpm run i18n:sync          # Sync translation files
pnpm run i18n:check         # Validate translations
```

### Development Utilities

```bash
# Database utilities
pnpm run db:generate-types   # Generate Supabase types
pnpm run db:seed            # Seed development data

# Monitoring
pnpm run dev:monitor        # Monitor development server
```

## 🔒 Security & Best Practices

### Security Guidelines

- **Environment Variables**: Never commit secrets to repository
- **API Authentication**: NextAuth.js for secure authentication
- **Rate Limiting**: Implemented on all public API routes
- **Input Validation**: Strict validation on all user inputs

### Performance Optimization

- **Static Generation**: Pre-generate static content at build time
- **Image Optimization**: Next.js Image component for optimized images
- **Code Splitting**: Automatic code splitting with App Router
- **Caching**: Multi-layer caching strategy (build-time, runtime, client-side)

## 📚 Additional Resources

### Key Configuration Files

- `package.json` - Package dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `next.config.js` - Next.js configuration
- `vitest.config.ts` - Testing configuration

### Important Directories to Understand

- `/src/lib/json-db/` - Database abstraction layer
- `/src/components/ui/` - Reusable UI components
- `/src/app/api/` - API route definitions
- `/data/json/` - Primary data storage
- `/src/data/cache/` - Generated cache files

This toolchain documentation should be referenced whenever working with the project's technical implementation. Always validate against the current source code state when in doubt.
