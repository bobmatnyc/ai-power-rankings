# Changelog

All notable changes to the AI Power Ranking project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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
