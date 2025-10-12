# 📋 Project Information - aipowerranking

This file contains structured information about the project that helps KuzuMemory provide better context.

## 🏗️ Project Overview

**Project Name**: aipowerranking
**Type**: Web Application
**Language**: TypeScript
**Framework**: Next.js 14 (App Router)
**Version**: 0.1.1

## 🎯 Project Purpose

AI Power Ranking is a comprehensive web application that ranks and tracks AI tools and technologies. It provides users with data-driven insights into the AI tool landscape through systematic evaluation and scoring, industry news aggregation, and detailed methodology documentation.

## 🏛️ Architecture

### Tech Stack
- **Backend**: Next.js 14 API Routes (TypeScript)
- **Database**: PostgreSQL with Drizzle ORM
- **Cache**: Not implemented
- **Frontend**: React 18 with Next.js App Router
- **Deployment**: Vercel
- **Authentication**: Clerk
- **Styling**: Tailwind CSS

### Key Components
- **Rankings System**: AI tool evaluation and scoring engine with baseline derivation
- **News Ingestion**: Article processing service for AI industry news
- **Authentication Layer**: Clerk-based user management with Core 2 integration
- **Internationalization**: Multi-language routing via `[lang]` parameter
- **Repository Pattern**: Database access via repositories in `lib/db/repositories/`

## 📏 Conventions & Standards

### Code Style
- TypeScript with strict type checking
- ESLint for code quality
- Component-based architecture (React)
- Server/Client component separation (Next.js App Router)

### API Design
- RESTful API routes in `app/api/`
- Admin endpoints require `NODE_ENV` checks
- No test/debug endpoints in production
- Proper authentication guards on protected routes

### Database
- Drizzle ORM for type-safe queries
- Migration-based schema changes (no direct schema modifications)
- Repository pattern for data access
- Schema definitions in `lib/schema.ts`

### Testing
- Test documentation in `/tests/` directory
- Security-focused: all test endpoints removed from production
- UAT reports track known issues and resolutions

## 🚀 Development Workflow

### Getting Started
1. Clone repository and install dependencies: `npm install`
2. Configure environment variables (Clerk, DATABASE_URL)
3. Run database migrations: `npm run db:migrate`
4. Start development server: `npm run dev`

### Common Tasks
- **Run tests**: `npm test`
- **Start dev server**: `npm run dev`
- **Build for production**: `npm run build`
- **Database operations**: `npm run db:push`, `npm run db:studio`
- **Type checking**: `npm run type-check`
- **Linting**: `npm run lint`

## 🤝 Team Preferences

### Development
- Primary developer: Robert (Masa) Matsuoka
- Iterative development approach with phased rollouts
- Security-first mindset (multi-phase test endpoint removal)
- Production stability prioritized over rapid feature deployment

### Communication
- Detailed commit messages with conventional commits (feat/fix/chore)
- Comprehensive documentation in `/docs/` directory
- UAT reports for tracking issues and resolutions
- Version tracking with semantic versioning

### Code Review
- Type safety enforcement with TypeScript
- Security review for admin endpoints (NODE_ENV guards)
- Authentication flow validation required
- Migration-based database changes only

## 📚 Important Resources

- **Documentation**: `/docs/` directory (CONTRIBUTING, AUTHENTICATION-CONFIG, baseline-scoring-usage)
- **API Docs**: API routes in `app/api/` with inline documentation
- **Testing Guide**: `/tests/README.md`, `/tests/QUICK_START.md`
- **Deployment Guide**: Vercel-based deployment (see UAT reports)
- **Scripts & Tools**: `/scripts/` directory (database migrations, cleanup utilities)
- **UAT Reports**: `/uat-screenshots/EXECUTIVE-SUMMARY.md`

---

**💡 Tip**: Update this file as the project evolves. KuzuMemory will use this information to provide better context for AI assistance.

**🤖 AI Integration**: This information is automatically included in AI prompts to provide project-specific context.
