# Changelog

All notable changes to the AI Power Ranking project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.3.9] - 2025-11-11

### Changed
- **Documentation Organization**: Restructured 69 documentation files into categorized hierarchy
  - Organized docs into structured subdirectories for improved navigation
  - Updated CLAUDE.md with new organization structure
  - Enhanced project documentation accessibility and maintainability

### Added
- **Development Scripts**: Tracked 4 utility scripts in git for team collaboration
  - `check-table-structure.ts` - Database schema verification
  - `check-v76-article-details.ts` - Article data validation
  - `migrate-v76-to-articles-simple.ts` - Simplified migration utility
  - `migrate-v76-to-articles-table.ts` - Full migration script

### Fixed
- **Build Configuration**: Updated .gitignore for test reports
  - Added playwright-report-chunk-verification/ to ignore patterns
  - Added qa-reports/ directory to ignore patterns
  - Improved repository cleanliness for test artifacts

### Documentation
- New structure improves discoverability and organization
- CLAUDE.md updated with hierarchy information
- Project structure improvements for better maintainability

---

## [0.3.0] - 2025-10-24

### Added
- **Monthly Summaries Feature**: LLM-generated monthly AI landscape reports
  - New database table `monthly_summaries` with 8 optimized indexes
  - What's New API endpoint (`/api/whats-new/summary`) for programmatic access
  - Database migration `0007_add_monthly_summaries.sql`
  - npm scripts: `db:verify-summaries` and `db:apply-summaries`
- **New AI Development Tools**: 3 cutting-edge tools added to rankings (October 2025)
  - **ClackyAI** (Rank #8, Score 85/100) - Agentic cloud development environment with autonomous coding
  - **Flint** (Rank #6, Score 87/100) - Autonomous website development platform with AI-powered design
  - **DFINITY Caffeine** (Rank #4, Score 88/100) - AI full-stack application platform on Internet Computer blockchain
  - All tools scored using Algorithm v7.2 baseline methodology
- **Database Migration Tooling**: 14 new utility scripts for database operations
  - Tools management: `add-new-tools-october-2025.ts`, `update-october-2025-tools.ts`, `verify-october-2025-tools.ts`
  - Summaries management: `apply-monthly-summaries-migration.ts`, `verify-monthly-summaries.ts`
  - API verification: `check-tools-in-api.ts`, `query-gitlab-duo.ts`, `show-gitlab-duo-comparison.ts`
  - Enhancement scripts: `enhance-gitlab-duo-agent-platform.ts`, `verify-gitlab-duo-enhancement.ts`
  - Reporting: `final-october-2025-report.ts`

### Changed
- **GitLab Duo Enhancement**: Updated with Agent Platform details and July-October 2025 capabilities
  - Added agentic workflow automation features
  - Updated tool description with latest platform features
- **Documentation**: Enhanced `scripts/README-database-scripts.md` with monthly summaries section
  - Added verification and migration workflows
  - Documented new database scripts and their usage

### Database
- New table: `monthly_summaries` (month, year, summary, created_at, updated_at)
- Indexes: Primary key, unique month-year, year-month composite, and timestamp indexes
- Total active tools: 10 tools with complete scoring data
- Algorithm v7.2 baseline scoring applied to all new entries

### Documentation
- New implementation evidence: `docs/reference/OCTOBER-2025-TOOL-ADDITIONS.md`
- New migration success report: `docs/deployment/MONTHLY-SUMMARIES-MIGRATION-SUCCESS.md`
- New migration evidence: `docs/reference/OCTOBER-2025-MIGRATION-EVIDENCE.md`

---

## [0.2.0] - 2025-10-24

### Added
- **SEO Enhancement**: Comprehensive Schema.org structured data markup across the site
  - Organization schema with company info, expertise areas, and multi-language support
  - Website schema with search functionality and audience targeting
  - SoftwareApplication schema on tool pages with ratings and pricing
  - Review schema with tool rankings and scores
  - Breadcrumb navigation schema for improved UX
- **Content Quality**: Enhanced article ingestion with 750-1000 word AI-generated summaries
  - Increased from 200-300 character teasers to comprehensive primary content
  - Improved quality requirements (clear intro/body/conclusion, logical flow, no truncation)
  - Expanded token budget from 16k to 32k for richer content generation
- **Documentation**: Branch cleanup plan with comprehensive analysis of 24 branches
  - Archived 9 experimental branches (2,870+ commits preserved)
  - Categorized all branches with merge/archive/delete recommendations
  - Created actionable cleanup commands and risk assessments

### Changed
- Article summary field now serves as primary content (not just preview)
- Made article rewritten_content field optional (extended archival version)
- Updated repository structure with organized archive branches

### Performance
- Server-side schema generation for optimal SEO (no client-side overhead)
- Type-safe schema implementation with proper guards

### Expected Impact
- 20-30% improvement in search rankings from proper structured data
- 30-40% higher click-through rates from rich search results
- Star ratings, rich snippets, and organization panels in Google search
- Better content quality with comprehensive AI-generated articles

---

## [0.1.4] - 2025-10-19

### Fixed
- TypeScript type errors across components and API routes
- Security hardening for admin and API endpoints

### Changed
- Documentation structure reorganization
- Added project essentials (README.md, CHANGELOG.md, PROJECT_ORGANIZATION.md)
- Updated i18n dictionaries to Algorithm v7.2
- Updated homepage tagline to Algorithm v7.2

### Added
- Algorithm v7.2 with October 2025 rankings
- News article for Algorithm v7.2 release
- Enhanced rankings API response (description, website_url, logo fields)

### Performance
- Eliminated 3.3s TTFB delay
- Optimized vendor chunk splitting
- Updated Clerk DNS prefetch to production domain

---

## [0.1.3] - 2025-10-15

### Added
- State of Union component for October 2025 market overview
- Semantic HTML improvements across major pages
- CLAUDE.md documentation with AI-optimized project guide
- Documentation archive directory structure

### Changed
- Updated homepage, methodology, about, rankings, and tools pages with proper `<main>` tags
- Enhanced semantic structure for better accessibility

### Security
- Removed 25+ test/debug endpoints for production security
- Added `NODE_ENV` guards to 5 admin debug endpoints

---

## [0.1.2] - 2025-10-12

### Fixed
- Score calculation fix: Added baseline score derivation for incomplete tool scores

### Removed
- All test pages and typography demo
- Test endpoint cleanup for production readiness

---

## [0.1.1] - 2025-10-11

### Security
- Version bump following security hardening
- Admin endpoint protection with environment guards

### Documentation
- Consolidated project documentation structure
- Organized docs into deployment, development, performance, reference, security, troubleshooting

---

## [0.1.0] - 2025-10-01

### Added
- Initial production release
- Rankings system with comprehensive AI tool evaluation
- News and articles system with automated ingestion
- Multi-language support via [lang] parameter
- Clerk authentication integration (Core 2)
- Newsletter signup integration

### Changed
- Updated all social links to HyperDev branding
- Replaced contact form with newsletter CTA
- Fixed logo alignment and Clerk modal visibility

### Fixed
- Vercel deployment authentication for preview environments
- Database schema authentication improvements
- Algorithm version corrections

---

## [0.0.1] - 2025-09-01

### Added
- Initial project setup
- Next.js 14 App Router structure
- PostgreSQL database with Drizzle ORM
- Basic rankings and news features
- Tailwind CSS styling

---

## Legend

- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements

---

**Note**: This changelog tracks significant changes. For detailed commit history, see the git log.
