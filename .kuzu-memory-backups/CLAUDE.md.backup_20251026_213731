# 🤖 Claude Code - AI Power Ranking Project Guide

**Project**: aipowerranking
**Version**: 0.1.3
**Last Updated**: 2025-10-15
**Primary Developer**: Robert (Masa) Matsuoka

---

## 🎯 Priority Index

### 🔴 CRITICAL Instructions
- **Security**: Admin endpoints MUST have `NODE_ENV` guards (see line 221)
- **Database**: NEVER modify schema directly - use Drizzle migrations (see line 223)
- **Authentication**: All protected routes require Clerk configuration (see line 155)
- **Type Safety**: TypeScript errors MUST be resolved before commits (see line 224)

### 🟡 IMPORTANT Instructions
- **Testing**: Reference `/tests/` documentation for testing patterns (see line 209)
- **Documentation**: Check `/docs/` before making changes (see line 204)
- **Deployment**: Follow Vercel deployment patterns for authentication (see line 145)
- **Components**: Follow App Router conventions in `app/[lang]/` (see line 212)

### 🟢 STANDARD Instructions
- **Code Style**: Follow existing patterns in active files (see line 205)
- **Content**: Use markdown for static pages (see line 217)
- **API Routes**: Use `app/api/` with proper authentication (see line 216)
- **Business Logic**: Add to `lib/services/` or `lib/db/repositories/` (see line 215)

### ⚪ OPTIONAL
- **Optimization**: Performance improvements guided by Lighthouse scores
- **Internationalization**: Multi-language support via `[lang]` parameter (see line 152)
- **Future**: CMS migration and admin dashboard enhancements

---

## 📊 Quick Project Status

**Current Phase**: Production stabilization and content development
**Active Branch**: main
**Recent Focus**: State of Union feature, semantic HTML improvements, content development

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

- **`docs/`** - [**📖 Complete Documentation Index**](docs/README.md)
  - `deployment/` - Deployment guides and verification
  - `development/` - Contributing guides and implementation docs
  - `performance/` - Performance optimization reports
  - `reference/` - Technical references and configuration
    - [PROJECT_ORGANIZATION.md](docs/reference/PROJECT_ORGANIZATION.md) - **Organization standard and file placement rules**
  - `security/` - Security audits and authentication docs
  - `troubleshooting/` - Debugging and issue resolution
- **`scripts/`** - Database migrations and utility scripts
- **`tests/`** - Test suites and testing documentation
- **`tmp/`** - Temporary files and backups (gitignored)

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
- **Total Commits**: 20 (as of 2025-10-12)
- **Primary Contributor**: Robert (Masa) Matsuoka (100%)
- **Commit Type Breakdown**:
  - Fixes: 10 commits (50%)
  - Features: 4 commits (20%)
  - Chores: 3 commits (15%)
  - Other: 3 commits (15%)

### Latest Changes (Last 4 Hours) 🟢

#### State of Union Feature (Just Committed)
- **✅ New Component**: Created `StateOfUnion` component for October 2025 market overview
  - Features trust crisis analysis (84% usage vs 33-46% trust)
  - Highlights Replit's $150M ARR milestone
  - Links to Claude Sonnet 4.5 agentic capabilities
  - Addresses GitHub Copilot failure rates and market competition
- **✅ Integration**: Added State of Union to news content page
- **✅ Semantic HTML**: Improved structure with proper `<main>` tags across pages
  - Homepage structure enhancement
  - Methodology, about, rankings, tools pages updated
- **✅ Documentation**: Added CLAUDE.md with AI-optimized project guide
- **✅ Version Management**: Created docs archive directory structure

#### Recent Major Changes (Last 4 Days)

##### Security & Cleanup (Phases 2-3)
- **v0.1.1 Release**: Version bump following security hardening
- **Test Endpoint Removal**: Removed 25+ test/debug endpoints for production security
- **Admin Endpoint Protection**: Added `NODE_ENV` guards to 5 admin debug endpoints
- **Test Page Cleanup**: Removed all test pages and typography demo
- **Score Calculation Fix**: Added baseline score derivation for incomplete tool scores

##### Earlier Work (Last 30 Days)
- **Documentation Organization**: Consolidated project documentation structure
- **Authentication Updates**: Upgraded Clerk to Core 2 naming, enabled authentication
- **UI Improvements**: Fixed logo alignment and Clerk modal visibility issues
- **Social Media Updates**: Updated all social links to HyperDev branding
- **Newsletter Integration**: Replaced contact form with newsletter signup CTA
- **Performance Optimizations**: Data updates and algorithm version corrections
- **Database Schema Fixes**: Authentication improvements and comprehensive tooling
- **Vercel Deployment**: Fixed Clerk authentication for preview environments

### Development Patterns Observed

1. **Content-Driven Development**: Focus on editorial components like State of Union
2. **Iterative Security Hardening**: Multi-phase approach to removing test endpoints
3. **Production Readiness Focus**: Emphasis on deployment, authentication, and data quality
4. **Semantic Web Standards**: Improving HTML structure and accessibility
5. **Documentation Excellence**: Comprehensive guides and version management
6. **UI/UX Refinement**: Ongoing improvements to user interface and experience

### Active Development Areas

- **✅ State of Union**: Completed and integrated into news section
- **Content Pages**: Semantic HTML improvements across all major pages
- **News System**: Enhanced with market overview and analysis features
- **Authentication**: Stable Clerk integration with Core 2 naming
- **Documentation**: CLAUDE.md established for AI agent guidance

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

**📖 [COMPLETE DOCUMENTATION INDEX](docs/README.md)** - Start here for all documentation

### Quick Links by Topic

**🚢 Deployment & Operations**
- [Deployment Checklist](docs/deployment/DEPLOYMENT-CHECKLIST.md) - Pre-deployment verification
- [Latest Deployment](docs/deployment/VERCEL-DEPLOYMENT-v0.1.3-VERIFIED.md) - v0.1.3 verification

**🔧 Development & Contributing**
- [Contributing Guide](docs/development/CONTRIBUTING.md) - Setup and guidelines
- [Development Guides](docs/development/guides/) - Implementation guides
- [Next Steps](docs/development/NEXT-STEPS-RECOMMENDATIONS.md) - Roadmap

**⚡ Performance**
- [Lighthouse Optimizations](docs/performance/LIGHTHOUSE-OPTIMIZATIONS.md) - Performance guide
- [ISR Configuration](docs/performance/ISR-OPTIMIZATION-REPORT.md) - Static regeneration

**📖 Reference & Configuration**
- [Authentication Config](docs/reference/AUTHENTICATION-CONFIG.md) - Clerk setup
- [Baseline Scoring](docs/reference/baseline-scoring-usage.md) - Scoring system
- [Analysis Reports](docs/reference/reports/analysis/) - Technical analysis

**🔍 Troubleshooting**
- [Clerk Auth Issues](docs/troubleshooting/CLERK-AUTHENTICATION-FIX.md) - Auth debugging
- [Authentication Summary](docs/troubleshooting/AUTHENTICATION-FINAL-SUMMARY.md) - Auth troubleshooting

### External Documentation
- **Testing**: [/tests/README.md](tests/README.md) - Test suite documentation
- **Scripts**: [/scripts/README-database-scripts.md](scripts/README-database-scripts.md) - Database tools
- **API Docs**: See `/app/api/*/README.md` for endpoint-specific documentation

---

## 🎯 Current Work Context

### ✅ Recently Completed (2025-10-12)
- ✅ State of Union component created and integrated
- ✅ Semantic HTML improvements across all major pages
- ✅ CLAUDE.md documentation established with priority markers
- ✅ All changes committed to main branch

### Next Steps (Recommended)
1. 🟡 Monitor State of Union component performance and user engagement
2. 🟢 Continue content development for news and analysis sections
3. 🟢 Consider additional editorial features for market insights
4. ⚪ Explore internationalization for State of Union content
5. 🔴 Maintain security standards for all new features

---

## 💡 Tips for AI Assistance

### When Working on This Project

1. 🟡 **Check Documentation First**: Extensive docs in `/docs/` and `/scripts/`
2. 🟢 **Follow Existing Patterns**: Look at active files for current coding standards
3. 🔴 **Security Awareness**: Admin endpoints require `NODE_ENV` guards
4. 🔴 **Database Changes**: Use Drizzle migrations, don't modify schema directly
5. 🟡 **Authentication**: Test with Clerk configuration in mind
6. 🟡 **Testing**: Reference `/tests/` documentation for testing patterns

### File Modification Guidelines

**📋 See [PROJECT_ORGANIZATION.md](docs/reference/PROJECT_ORGANIZATION.md) for complete organization rules**

- 🟡 **Page Components**: Follow App Router conventions in `app/[lang]/`
- 🟢 **Reusable Components**: Place in appropriate `components/` subdirectory
- 🟢 **Business Logic**: Add to `lib/services/` or `lib/db/repositories/`
- 🟡 **API Routes**: Use `app/api/` with proper authentication checks
- 🟢 **Documentation**: Place in appropriate `/docs/` subdirectory (deployment, development, performance, reference, security, troubleshooting)
- 🔴 **Root Level**: Only CLAUDE.md, README.md, CHANGELOG.md, and LICENSE allowed at project root
- 🟢 **Content**: Markdown content files for static pages

### Common Pitfalls to Avoid

1. 🔴 Don't create test/debug endpoints without `NODE_ENV` guards
2. 🔴 Don't bypass authentication on admin routes
3. 🔴 Don't modify database schema without migrations
4. 🔴 Don't ignore TypeScript type errors
5. 🟡 Don't commit without testing authentication flows

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

## 📊 Project Metrics

**Last Activity Snapshot**: 2025-10-12 (just now)
**Project Health**: 🟢 Active development, production-ready
**Documentation Status**: 🟢 Comprehensive, well-maintained with priority markers
**Recent Velocity**: 🟢 20 commits in 30 days, consistent development pace
**Code Quality**: 🟡 TypeScript strict mode, comprehensive testing suite
**Security Posture**: 🟢 Admin endpoints protected, test endpoints removed
