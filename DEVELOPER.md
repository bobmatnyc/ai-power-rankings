# 🔧 AI Power Rankings - Developer Guide

## 🎯 Priority Index for Developers

**Follow this order when working on the project:**

### 🔴 CRITICAL - Start Here
1. **Read CLAUDE.md** - Project configuration and single-path standards
2. **Check TrackDown** - Link ALL work to tickets in `/trackdown/`  
3. **Run Quality Check** - `pnpm run ci:local` before ANY commit
4. **Follow Single-Path** - Use only THE documented way for each operation

### 🟡 IMPORTANT - Core Setup  
5. **Install Dependencies** - `pnpm install` (not npm/yarn)
6. **Start Development** - `pnpm run dev:pm2 start` (THE way)
7. **Review Architecture** - Understand Next.js 15 App Router structure
8. **Check Types** - Fix TypeScript errors (320+ issues to resolve)

### 🟢 STANDARD - Development Flow
9. **Create Feature Branch** - From ticket requirements
10. **Implement Changes** - Follow coding standards below
11. **Test Thoroughly** - Unit, integration, manual testing
12. **Documentation** - Update relevant docs immediately

---

## 🏗️ Technical Architecture

### Tech Stack Overview
```
Next.js 15 (App Router) + TypeScript + React
├── Styling: Tailwind CSS + shadcn/ui components
├── Data: JSON file-based storage system  
├── Testing: Vitest + Testing Library
├── Linting: Biome (ESLint + Prettier replacement)
├── Package Manager: pnpm (REQUIRED)
└── Deployment: Vercel
```

### Project Structure (By Priority)

#### 🔴 CRITICAL - Core Application
```
/src/app/                   # Next.js 15 App Router
  ├── [lang]/              # Internationalized routes
  │   ├── page.tsx         # Homepage with rankings
  │   ├── tools/           # Tool detail pages
  │   └── news/            # News listing pages
  ├── api/                 # API routes
  │   ├── rankings/        # Rankings data
  │   ├── news/            # News articles
  │   └── admin/           # Admin operations
  └── globals.css          # Global styles

/src/lib/                   # Core business logic
  ├── data/                # Data access layers
  ├── utils/               # Utility functions
  ├── types/               # TypeScript definitions
  └── services/            # Business services

/data/json/                 # Primary data storage
  ├── tools/               # Tool definitions
  ├── news/                # News articles
  ├── rankings/            # Historical rankings
  └── companies/           # Company information
```

#### 🟡 IMPORTANT - Components & Cache
```
/src/components/            # React components
  ├── ui/                  # shadcn/ui base components
  ├── rankings/            # Rankings-specific components
  ├── news/                # News-specific components
  └── layout/              # Layout components

/src/data/cache/            # Generated cache files
  ├── rankings-static.json # Pre-computed rankings
  ├── news.json            # News cache
  └── tools.json           # Tools cache
```

#### 🟢 STANDARD - Configuration & Scripts
```
/docs/                      # Project documentation
/scripts/                   # Build and utility scripts  
/trackdown/                 # Local task management
/.claude-mpm/              # Agent memories and config
```

---

## 🔧 Development Environment Setup

### Prerequisites
```bash
# Required versions
Node.js: 18+ (LTS recommended)
pnpm: 8.15.4+ (DO NOT use npm or yarn)
```

### Installation (THE way)
```bash
# 1. Clone and install
git clone <repository>
cd ai-power-ranking
pnpm install

# 2. Start development (THE way)
pnpm run dev:pm2 start

# 3. Monitor logs
pnpm run dev:pm2 logs

# 4. Verify setup
curl http://localhost:3000
```

---

## 🎯 Single-Path Development Commands

### 🔴 CRITICAL Operations
```bash
# THE way to develop
pnpm run dev:pm2 start     # Start with PM2 process management
pnpm run dev:pm2 logs      # View development logs
pnpm run dev:pm2 restart   # Restart dev server
pnpm run dev:pm2 stop      # Stop dev server

# THE way to validate code (before ANY commit)
pnpm run ci:local          # Run all quality checks

# THE way to deploy
pnpm run pre-deploy        # Validate before deployment
vercel deploy              # Deploy to Vercel
```

### 🟡 IMPORTANT Operations  
```bash
# Individual quality checks
pnpm run lint              # Check code style
pnpm run type-check        # Check TypeScript
pnpm run test              # Run tests
pnpm run format            # Format code

# Cache operations  
pnpm run cache:generate    # Generate all caches
pnpm run cache:rankings    # Rankings cache only
pnpm run cache:news        # News cache only
pnpm run cache:tools       # Tools cache only
```

### 🟢 STANDARD Operations
```bash
# Data management
pnpm run validate:all      # Validate JSON files
pnpm run backup:create     # Create data backup
pnpm run backup:restore    # Restore from backup

# Build operations
pnpm run build            # Production build
pnpm run start            # Start production server
```

---

## 💻 Code Standards & Best Practices

### TypeScript Rules (CRITICAL)
```typescript
// ✅ CORRECT - Use bracket notation for env vars
process.env["VARIABLE_NAME"]

// ❌ WRONG - Never use dot notation
process.env.VARIABLE_NAME

// ✅ CORRECT - Proper typing
interface RankingData {
  rank: number;
  tool_id: string;
  score: number;
}

// ❌ WRONG - Never use any (320+ issues to fix)
const data: any = getRankings();
```

### File Organization
```typescript
// Component structure
import { ComponentType } from 'react';
import { UtilityType } from '@/lib/types';

interface ComponentProps {
  // Props definition
}

export default function Component({ prop }: ComponentProps) {
  // Implementation
}
```

### Styling Standards
```tsx
// Use Tailwind CSS classes
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
  
// Use CSS variables for theming
<div className="text-primary bg-background border-border">

// Component composition with shadcn/ui
import { Button } from '@/components/ui/button';
```

---

## 📊 API Architecture

### Route Structure
```
/api/
├── rankings/
│   ├── route.ts         # GET /api/rankings
│   └── [period]/        # GET /api/rankings/2025-08
├── tools/
│   ├── route.ts         # GET /api/tools
│   └── [slug]/          # GET /api/tools/chatgpt
├── news/
│   ├── route.ts         # GET /api/news  
│   └── [slug]/          # GET /api/news/article-slug
└── admin/               # Admin operations
    ├── news/            # News management
    └── rankings/        # Rankings management
```

### Data Flow Pattern
```
Request → API Route → Service Layer → Data Repository → JSON Files
                                  ↓
Response ← JSON Transform ← Cache Layer ← File System
```

### Error Handling
```typescript
// Standard API response pattern
try {
  const data = await service.getData();
  return NextResponse.json({ data });
} catch (error) {
  loggers.api.error("Operation failed", { error });
  return NextResponse.json(
    { error: "Internal server error" }, 
    { status: 500 }
  );
}
```

---

## 🧪 Testing Strategy

### Test Structure
```
/src/
├── __tests__/           # Unit tests
├── components/
│   └── __tests__/       # Component tests  
└── lib/
    └── __tests__/       # Service tests
```

### Testing Commands (THE way)
```bash
# Run all tests
pnpm run test

# Watch mode
pnpm run test:watch

# Coverage report
pnpm run test:coverage

# UI testing
pnpm run test:ui
```

### Test Patterns
```typescript
// Component testing
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import Component from './Component';

test('renders correctly', () => {
  render(<Component prop="value" />);
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});

// Service testing
import { expect, test } from 'vitest';
import { service } from '@/lib/services/service';

test('processes data correctly', async () => {
  const result = await service.processData(inputData);
  expect(result).toEqual(expectedOutput);
});
```

---

## 💾 Data Management

### JSON Storage System
```
/data/json/
├── tools.json           # Tool definitions
├── companies.json       # Company information  
├── news/
│   ├── by-month/        # Monthly news archives
│   └── articles.json    # All articles
└── rankings/
    ├── current.json     # Latest rankings
    └── historical/      # Historical rankings
```

### Data Access Patterns
```typescript
// Repository pattern
import { NewsRepository } from '@/lib/data/news';

const newsRepo = new NewsRepository();
const articles = await newsRepo.getAll();
const article = await newsRepo.getBySlug(slug);
await newsRepo.upsert(articleData);
```

### Cache Strategy
```typescript
// Cache generation (THE way)
pnpm run cache:generate

// Cache files location
/src/data/cache/
├── rankings-static.json  # Pre-computed rankings
├── news.json            # News cache  
└── tools.json           # Tools cache
```

---

## 🌐 Internationalization (i18n)

### Language Support
```
Supported: en, es, fr, de, it, pt, ru, ja, ko, zh, hi, ar
Default: en (English)
Fallback: en for missing translations
```

### Translation Management
```bash
# Check translations
pnpm run i18n:check

# Sync translations  
pnpm run i18n:sync

# Debug missing translations
pnpm run i18n:debug
```

### Usage Patterns
```typescript
// Component with translations
import { getDictionary } from '@/lib/i18n';

export default async function Page({ params }: { params: { lang: string } }) {
  const dict = await getDictionary(params.lang);
  
  return (
    <h1>{dict.rankings.title}</h1>
  );
}
```

---

## 🚀 Performance Optimization

### Key Metrics
- **Lighthouse Score**: Target 90+
- **First Contentful Paint**: < 2s
- **Time to Interactive**: < 3s
- **Cumulative Layout Shift**: < 0.1

### Optimization Strategies
```typescript
// Static generation where possible
export const dynamic = 'force-static';

// Image optimization
import Image from 'next/image';
<Image src={src} alt={alt} width={100} height={100} />

// Component lazy loading
import dynamic from 'next/dynamic';
const LazyComponent = dynamic(() => import('./Component'));

// Cache headers
export const revalidate = 3600; // 1 hour
```

---

## 🔍 Debugging & Troubleshooting

### Common Issues & Solutions

#### TypeScript Errors (CRITICAL - 320+ to fix)
```bash
# Check specific errors
pnpm run type-check

# Common fixes
- Replace `any` with proper types
- Add missing interface definitions
- Fix import/export inconsistencies
```

#### Linting Issues (75 errors, 245 warnings)
```bash
# View all issues
pnpm run lint

# Auto-fix what's possible
pnpm run lint:fix

# Format code
pnpm run format
```

#### Development Server Issues
```bash
# Restart server (THE way)
pnpm run dev:pm2 restart

# Check logs
pnpm run dev:pm2 logs

# Clear cache and restart
rm -rf .next && pnpm run dev:pm2 restart
```

### Debug Tools
```typescript
// Console logging with context
import { loggers } from '@/lib/utils/logger';
loggers.api.info("Operation completed", { data, timestamp });

// Performance monitoring
console.time('operation');
// ... operation
console.timeEnd('operation');
```

---

## 📋 TrackDown Task Management

### Workflow (THE way)
1. **Check Tasks**: `ls trackdown/` 
2. **Create Branch**: `git checkout -b TSK-123-feature-name`
3. **Reference Tickets**: All commits must include ticket ID
4. **Update Status**: Move tickets through workflow stages

### Ticket Linking
```bash
# Commit with ticket reference
git commit -m "implement feature X (TSK-123)"

# PR title format  
"Feature: Implement X functionality (TSK-123)"
```

---

## 🤖 Claude-MPM Agent Integration

### Agent Usage (THE way)
```bash
# Engineer for implementation
@engineer "Implement ranking algorithm (TSK-123)"

# QA for testing
@qa "Write tests for feature X (TSK-123)"

# Research for documentation  
@research "Analyze API patterns (TSK-123)"

# Ops for deployment
@ops "Deploy feature to staging (TSK-123)"

# Version Control for Git operations
@version-control "Create PR for feature (TSK-123)"
```

### Memory System
- **Location**: `.claude-mpm/memories/`
- **Updates**: Agents learn from each task
- **Access**: `ls .claude-mpm/memories/`

---

## 🔐 Security & Environment

### Environment Variables
```bash
# Required variables
GITHUB_TOKEN=your_token
RESEND_API_KEY=your_key
NEXT_PUBLIC_SITE_URL=https://domain.com

# Access pattern (THE way)
process.env["GITHUB_TOKEN"]  # ✅ Bracket notation
process.env.GITHUB_TOKEN     # ❌ Never use dot notation
```

### Security Headers
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}
```

---

## 📈 Monitoring & Analytics

### Performance Monitoring
```bash
# Performance audit (THE way)
pnpm run perf:audit

# Bundle analysis
pnpm run analyze

# Cache statistics
pnpm run cache:stats
```

### Logging Strategy
```typescript
// Structured logging
import { loggers } from '@/lib/utils/logger';

loggers.api.info("Request processed", {
  endpoint: "/api/rankings",
  duration: 150,
  timestamp: new Date().toISOString()
});
```

---

## 🚨 Emergency Procedures

### Production Issues
1. **Rollback**: `vercel rollback` to previous version
2. **Check Logs**: Review Vercel function logs
3. **Data Recovery**: `pnpm run backup:restore --latest`
4. **Cache Clear**: Regenerate caches if data corruption

### Development Issues  
1. **Reset Environment**: `rm -rf .next node_modules && pnpm install`
2. **Check Dependencies**: `pnpm list --depth=0`
3. **Validate Data**: `pnpm run validate:all`
4. **Memory Check**: Review agent memories for context

---

## 📚 Additional Resources

### Documentation Priority Order
1. **CLAUDE.md** - Project configuration (READ FIRST)
2. **DEVELOPER.md** - This file (technical details)
3. **docs/INSTRUCTIONS.md** - Development instructions  
4. **docs/WORKFLOW.md** - Process workflows
5. **docs/TOOLCHAIN.md** - Technical stack details

### External Resources
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [Vitest](https://vitest.dev/)

---

**Remember: This project follows SINGLE-PATH STANDARDS. There is THE ONE way to do everything. When in doubt, check CLAUDE.md for the correct approach.**