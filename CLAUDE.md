# 🤖 Claude Code - AI Power Ranking Project Guide

**Project**: aipowerranking
**Version**: 0.1.1
**Last Updated**: 2025-10-08
**Primary Developer**: Robert (Masa) Matsuoka

## 📊 Quick Project Status

**Current Phase**: Production stabilization and content development
**Active Branch**: main
**Recent Focus**: Security hardening, test cleanup, authentication improvements

---

## 🎯 Project Overview

AI Power Ranking is a Next.js web application that ranks and tracks AI tools and technologies. The application features:

- **Rankings System**: Comprehensive AI tool evaluation and scoring
- **News & Articles**: AI industry news and analysis
- **Multi-language Support**: Internationalized content delivery
- **Authentication**: Clerk-based user management
- **Database**: PostgreSQL with Drizzle ORM

---

## 📁 Project Structure

### Key Directories

- **`app/[lang]/`** - Next.js 14 internationalized pages (App Router)
  - `rankings/` - AI tool rankings interface
  - `news/` - News articles and blog posts
  - `about/`, `methodology/`, `tools/` - Static content pages

- **`components/`** - React components
  - `news/` - News display components
  - `auth/` - Clerk authentication components
  - `ui/` - Reusable UI components
  - `layout/` - App sidebar and navigation

- **`lib/`** - Core business logic
  - `db/` - Database connection, repositories, migrations
  - `services/` - Article ingestion and processing services
  - `schema.ts` - Database schema definitions

- **`docs/`** - Technical documentation
- **`scripts/`** - Database migrations and utility scripts
- **`tests/`** - Test suites and testing documentation

### Most Active Files (Last 30 Days)

1. `components/ui/signup-for-updates-modal.tsx` - Newsletter signup
2. `components/auth/clerk-provider-client.tsx` - Authentication provider
3. `components/layout/app-sidebar.tsx` - Navigation sidebar
4. `app/api/rankings/current/route.ts` - Rankings API endpoint
5. `lib/services/article-ingestion.service.ts` - News ingestion

---

## 🚀 Development Commands

### Setup & Running
```bash
npm install                    # Install dependencies
npm run dev                    # Start development server
npm run build                  # Production build
npm run start                  # Start production server
```

### Database Operations
```bash
npm run db:push                # Push schema changes
npm run db:studio              # Open Drizzle Studio
npm run db:migrate             # Run migrations
```

### Quality & Testing
```bash
npm run lint                   # Run ESLint
npm run type-check             # TypeScript type checking
npm test                       # Run test suite
```

---

## 📈 Recent Activity Report (Last 30 Days)

### Commit Summary
- **Total Commits**: 19
- **Primary Contributor**: Robert (Masa) Matsuoka (100%)
- **Commit Type Breakdown**:
  - Fixes: 10 commits (53%)
  - Features: 3 commits (16%)
  - Chores: 3 commits (16%)
  - Other: 3 commits (15%)

### Recent Major Changes (Last 8 Hours)

#### Security & Cleanup (Phases 2-3)
- **v0.1.1 Release**: Version bump following security hardening
- **Test Endpoint Removal**: Removed 25+ test/debug endpoints for production security
- **Admin Endpoint Protection**: Added `NODE_ENV` guards to 5 admin debug endpoints
- **Test Page Cleanup**: Removed all test pages and typography demo
- **Score Calculation Fix**: Added baseline score derivation for incomplete tool scores

#### Recent Work (Last 30 Hours)
- **Documentation Organization**: Consolidated project documentation structure
- **Authentication Updates**: Upgraded Clerk to Core 2 naming, enabled authentication
- **UI Improvements**: Fixed logo alignment and Clerk modal visibility issues
- **Social Media Updates**: Updated all social links to HyperDev branding
- **Newsletter Integration**: Replaced contact form with newsletter signup CTA
- **Performance Optimizations**: Data updates and algorithm version corrections

#### Earlier Activity (Last 9 Days)
- **Database Schema Fixes**: Authentication improvements and comprehensive tooling
- **Vercel Deployment**: Fixed Clerk authentication for preview environments
- **Initial Deployment**: Source code committed and deployed

### Development Patterns Observed

1. **Iterative Security Hardening**: Multi-phase approach to removing test endpoints
2. **Production Readiness Focus**: Emphasis on deployment, authentication, and data quality
3. **UI/UX Refinement**: Ongoing improvements to user interface and experience
4. **Content Development**: Active work on markdown content and static pages
5. **Continuous Integration**: Regular version bumps and incremental improvements

### Active Development Areas

- **Content Pages**: Currently modifying page.tsx files for various sections
- **News System**: New state-of-union component being developed
- **Authentication**: Ongoing Clerk integration refinements
- **UI Components**: Modal and signup flow improvements

---

## 🔧 Technical Context

### Technology Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Clerk
- **Deployment**: Vercel
- **Styling**: Tailwind CSS (inferred from component structure)

### Key Integrations
- **Clerk**: User authentication and management
- **Drizzle ORM**: Type-safe database operations
- **Article Ingestion**: Automated news content processing
- **Internationalization**: Multi-language routing via `[lang]` parameter

### Environment Configuration
- Development authentication requires proper Clerk configuration
- Database connection via `DATABASE_URL` environment variable
- Admin endpoints protected by `NODE_ENV` checks

---

## 📚 Documentation Resources

### Primary Documentation
- **Authentication**: `/docs/AUTHENTICATION-CONFIG.md`
- **Contributing**: `/docs/CONTRIBUTING.md`
- **Baseline Scoring**: `/docs/baseline-scoring-usage.md`

### Testing Documentation
- **Test Summary**: `/tests/TEST_SUMMARY.md`
- **Quick Start**: `/tests/QUICK_START.md`
- **Test README**: `/tests/README.md`

### Scripts & Tools
- **Database Scripts**: `/scripts/README-database-scripts.md`
- **Migration Guide**: `/scripts/MIGRATION-QUICK-START.md`
- **Cleanup Scripts**: `/scripts/CLEANUP-SCRIPTS-USAGE.md`
- **Test Scripts**: `/scripts/README-test-scripts.md`

### Project Reports
- **UAT Summary**: `/uat-screenshots/EXECUTIVE-SUMMARY.md`
- **Comprehensive UAT**: `/uat-screenshots/COMPREHENSIVE-UAT-REPORT.md`

---

## 🎯 Current Work Context

### Uncommitted Changes
- Multiple page.tsx files modified across different sections
- New state-of-union component in development
- Content and UI refinements in progress

### Next Steps (Inferred)
1. Complete current page modifications
2. Integrate new news component
3. Continue content development
4. Maintain production stability

---

## 💡 Tips for AI Assistance

### When Working on This Project

1. **Check Documentation First**: Extensive docs in `/docs/` and `/scripts/`
2. **Follow Existing Patterns**: Look at active files for current coding standards
3. **Security Awareness**: Admin endpoints require `NODE_ENV` guards
4. **Database Changes**: Use Drizzle migrations, don't modify schema directly
5. **Authentication**: Test with Clerk configuration in mind
6. **Testing**: Reference `/tests/` documentation for testing patterns

### File Modification Guidelines

- **Page Components**: Follow App Router conventions in `app/[lang]/`
- **Reusable Components**: Place in appropriate `components/` subdirectory
- **Business Logic**: Add to `lib/services/` or `lib/db/repositories/`
- **API Routes**: Use `app/api/` with proper authentication checks
- **Content**: Markdown content files for static pages

### Common Pitfalls to Avoid

1. Don't create test/debug endpoints without `NODE_ENV` guards
2. Don't bypass authentication on admin routes
3. Don't modify database schema without migrations
4. Don't ignore TypeScript type errors
5. Don't commit without testing authentication flows

---

## 🔗 Branch Information

**Main Branch**: `main`
**Active Branches**: main, main-old, staging-new

**Feature Branches** (Remote):
- Translations and localization improvements
- Performance optimizations (Lighthouse)
- SEO enhancements
- Admin dashboards
- CMS migration experiments

---

## 📞 Getting Help

This project has comprehensive documentation. When stuck:

1. Check `/docs/` for technical guides
2. Review `/tests/` for testing examples
3. Consult `/scripts/` for tooling documentation
4. Review recent commits for pattern examples
5. Check UAT reports for known issues and resolutions

---

**Last Activity Snapshot**: 2025-10-08 (8 hours ago)
**Project Health**: Active development, production-ready
**Documentation Status**: Comprehensive, well-maintained
