# AI Power Ranking - Documentation Index

**Last Updated**: 2026-02-03
**Project Version**: 0.3.14

## 📚 Documentation Structure

This directory contains all project documentation organized by topic area. Use this index to quickly find the documentation you need.

---

## 🚀 Quick Start

**New to the project?** Start here:
1. [Development - CONTRIBUTING.md](./development/CONTRIBUTING.md) - Setup and contribution guidelines
2. [Reference - AUTHENTICATION-CONFIG.md](./reference/AUTHENTICATION-CONFIG.md) - Authentication setup
3. [Development - READY-FOR-TESTING.md](./development/READY-FOR-TESTING.md) - Testing procedures

---

## 📂 Directory Guide

### 🚢 [deployment/](./deployment/)
Deployment guides, checklists, and verification reports.

**Key Documents:**
- [DEPLOYMENT-CHECKLIST.md](./deployment/DEPLOYMENT-CHECKLIST.md) - Pre-deployment checklist
- [DEPLOYMENT-STATUS.md](./deployment/DEPLOYMENT-STATUS.md) - Current deployment status
- [DEPLOYMENT-SUCCESS.md](./deployment/DEPLOYMENT-SUCCESS.md) - Deployment success reports
- [DEPLOYMENT-VERIFICATION.md](./deployment/DEPLOYMENT-VERIFICATION.md) - Verification procedures
- [releases/](./deployment/releases/) - Release notes and changelogs
  - [RELEASE_NOTES_v0.3.13.md](./deployment/releases/RELEASE_NOTES_v0.3.13.md) - v0.3.13 release notes
  - [CHANGELOG.md](./deployment/releases/CHANGELOG.md) - Complete project changelog

### 🔧 [development/](./development/)
Development guides, workflows, and contribution documentation.

**Key Documents:**
- [CONTRIBUTING.md](./development/CONTRIBUTING.md) - **START HERE** - Development setup and guidelines
- [CACHE_IMPLEMENTATION_COMPLETE.md](./development/CACHE_IMPLEMENTATION_COMPLETE.md) - Caching implementation summary
- [CLERK-BUTTON-TESTING-GUIDE.md](./development/CLERK-BUTTON-TESTING-GUIDE.md) - Clerk authentication testing
- [NEXT-STEPS-RECOMMENDATIONS.md](./development/NEXT-STEPS-RECOMMENDATIONS.md) - Future development roadmap
- [SESSION-SUMMARY.md](./development/SESSION-SUMMARY.md) - Development session summaries
- [guides/](./development/guides/) - Detailed implementation guides
  - Authentication implementation
  - Database migrations
  - Schema changes
  - Preferences refactoring
  - Article processing

### ⚡ [performance/](./performance/)
Performance optimization reports, Lighthouse scores, and ISR configuration.

**Key Documents:**
- [CLS_FIX_SUMMARY.md](./performance/CLS_FIX_SUMMARY.md) - Cumulative Layout Shift fixes
- [LIGHTHOUSE-OPTIMIZATIONS.md](./performance/LIGHTHOUSE-OPTIMIZATIONS.md) - Latest Lighthouse optimizations
- [ISR-OPTIMIZATION-REPORT.md](./performance/ISR-OPTIMIZATION-REPORT.md) - Incremental Static Regeneration setup
- [PERFORMANCE-OPTIMIZATIONS.md](./performance/PERFORMANCE-OPTIMIZATIONS.md) - Comprehensive optimization guide
- [LIGHTHOUSE-TESTING-READY.md](./performance/LIGHTHOUSE-TESTING-READY.md) - Lighthouse testing procedures
- Phase 2 optimization reports (FCP, verification, testing)

### 📖 [reference/](./reference/)
Reference materials, configuration specs, reports, and technical documentation.

**Key Documents:**
- [AUTHENTICATION-CONFIG.md](./reference/AUTHENTICATION-CONFIG.md) - Authentication configuration reference
- [CONTENT_MANAGEMENT.md](./reference/CONTENT_MANAGEMENT.md) - Content management guidelines
- [baseline-scoring-usage.md](./reference/baseline-scoring-usage.md) - Baseline scoring system documentation
- [DATABASE-UPDATE-SUMMARY.md](./reference/DATABASE-UPDATE-SUMMARY.md) - Database update logs
- [SCORING-FIX-SUMMARY.md](./reference/SCORING-FIX-SUMMARY.md) - Scoring algorithm fixes
- [PROJECT_ORGANIZATION.md](./reference/PROJECT_ORGANIZATION.md) - Project organization standards
- [reports/](./reference/reports/) - Detailed analysis and test reports
  - [analysis/](./reference/reports/analysis/) - Code analysis reports
  - [security/](./reference/reports/security/) - Security audit reports
  - [test-reports/](./reference/reports/test-reports/) - UAT and E2E test reports

### 🔍 [troubleshooting/](./troubleshooting/)
Debugging guides, issue resolution, and troubleshooting documentation.

**Key Documents:**
- [NPM_DATA_QUALITY_FIX.md](./troubleshooting/NPM_DATA_QUALITY_FIX.md) - NPM data quality issue resolution
- [CLERK-AUTHENTICATION-FIX.md](./troubleshooting/CLERK-AUTHENTICATION-FIX.md) - Clerk authentication issues
- [AUTHENTICATION-FINAL-SUMMARY.md](./troubleshooting/AUTHENTICATION-FINAL-SUMMARY.md) - Auth troubleshooting summary
- Clerk sign-in debugging guides
- Admin access troubleshooting
- Session management issues

### 🧮 [algorithms/](./algorithms/)
Algorithm documentation, implementation summaries, and release notes.

**Key Documents:**
- [ALGORITHM_CHANGELOG.md](./algorithms/ALGORITHM_CHANGELOG.md) - Algorithm change history
- [ALGORITHM_V73_RELEASE_NOTES.md](./algorithms/ALGORITHM_V73_RELEASE_NOTES.md) - V73 algorithm release notes
- [ALGORITHM_V73_IMPLEMENTATION_SUMMARY.md](./algorithms/ALGORITHM_V73_IMPLEMENTATION_SUMMARY.md) - V73 implementation details
- [ALGORITHM_V74_IMPLEMENTATION_SUMMARY.md](./algorithms/ALGORITHM_V74_IMPLEMENTATION_SUMMARY.md) - V74 implementation details

### 🏗️ [architecture/](./architecture/)
*Currently empty - future home for architecture diagrams and system design docs*

### 🔌 [api/](./api/)
*Currently empty - API documentation to be added here. See `/app/api/*/README.md` for endpoint-specific docs*

### 📝 [content/](./content/)
*Currently empty - future home for content guidelines and editorial documentation*

---

## 📊 Documentation by Topic

### Authentication & Security
- **Setup**: [reference/AUTHENTICATION-CONFIG.md](./reference/AUTHENTICATION-CONFIG.md)
- **Troubleshooting**: [troubleshooting/CLERK-AUTHENTICATION-FIX.md](./troubleshooting/CLERK-AUTHENTICATION-FIX.md)
- **Implementation**: [development/guides/AUTHENTICATION_IMPLEMENTATION.md](./development/guides/AUTHENTICATION_IMPLEMENTATION.md)
- **Security Audit**: [reference/reports/security/PRODUCTION-ADMIN-SECURITY-VERIFICATION.md](./reference/reports/security/PRODUCTION-ADMIN-SECURITY-VERIFICATION.md)

### Database & Migrations
- **Schema Comparison**: [development/guides/DATABASE_SCHEMA_COMPARISON.md](./development/guides/DATABASE_SCHEMA_COMPARISON.md)
- **Migration Guides**: [development/guides/MIGRATION-0003-SUMMARY.md](./development/guides/MIGRATION-0003-SUMMARY.md)
- **Data Updates**: [reference/DATABASE-UPDATE-SUMMARY.md](./reference/DATABASE-UPDATE-SUMMARY.md)

### Performance Optimization
- **Lighthouse**: [performance/LIGHTHOUSE-OPTIMIZATIONS.md](./performance/LIGHTHOUSE-OPTIMIZATIONS.md)
- **ISR Setup**: [performance/ISR-OPTIMIZATION-REPORT.md](./performance/ISR-OPTIMIZATION-REPORT.md)
- **Phase 2 Optimizations**: [performance/PHASE-2-FCP-OPTIMIZATION-REPORT.md](./performance/PHASE-2-FCP-OPTIMIZATION-REPORT.md)

### Testing & QA
- **UAT Reports**: [reference/reports/test-reports/](./reference/reports/test-reports/)
- **Testing Guide**: [development/CLERK-BUTTON-TESTING-GUIDE.md](./development/CLERK-BUTTON-TESTING-GUIDE.md)
- **E2E Tests**: [reference/reports/test-reports/PRODUCTION-E2E-TEST-REPORT.md](./reference/reports/test-reports/PRODUCTION-E2E-TEST-REPORT.md)

### Scoring & Rankings
- **Baseline Scoring**: [reference/baseline-scoring-usage.md](./reference/baseline-scoring-usage.md)
- **Scoring Fixes**: [reference/SCORING-FIX-SUMMARY.md](./reference/SCORING-FIX-SUMMARY.md)
- **Tool Updates**: [reference/TOOLS-UPDATE-COMPARISON.md](./reference/TOOLS-UPDATE-COMPARISON.md)

---

## 🔗 External Documentation

### Scripts Documentation
Located in `/scripts/` directory:
- Database scripts: `/scripts/README-database-scripts.md`
- Migration quick start: `/scripts/MIGRATION-QUICK-START.md`
- Cleanup scripts: `/scripts/CLEANUP-SCRIPTS-USAGE.md`
- Test scripts: `/scripts/README-test-scripts.md`

### Tests Documentation
Located in `/tests/` directory:
- Test summary: `/tests/TEST_SUMMARY.md`
- Quick start: `/tests/QUICK_START.md`
- Main README: `/tests/README.md`

### API Documentation
Located in `/app/api/` subdirectories:
- Tools API: `/app/api/tools/README.md`
- Rankings API: `/app/api/rankings/README.md`
- News API: `/app/api/news/README.md`
- Companies API: `/app/api/companies/README.md`

---

## 📝 Documentation Standards

### File Naming Conventions
- **ALL-CAPS-WITH-DASHES.md** - Major reports and summaries
- **lowercase-with-dashes.md** - Guides and reference docs
- **PascalCase** or **snake_case** - Legacy files (being standardized)

### Document Structure
All documentation should include:
1. **Title** - Clear, descriptive title
2. **Date/Version** - When created or last updated
3. **Summary** - Brief overview of contents
4. **Details** - Comprehensive information
5. **References** - Links to related docs

### Maintenance
- Update this index when adding new major documentation
- Archive outdated docs to `/docs/_archive/`
- Keep cross-references up to date
- Use relative links within docs directory

---

## 🗂️ Archive

Historical and deprecated documentation is stored in:
- [_archive/](./archive/) - Archived documentation (when no longer current)
- [reference/reports/archive/](./reference/reports/archive/) - Archived reports

---

## 🆘 Need Help?

1. **Can't find what you need?** Check the topic-based sections above
2. **Looking for API docs?** See `/app/api/*/README.md` files
3. **Need test documentation?** See `/tests/README.md`
4. **Database scripts?** See `/scripts/README-database-scripts.md`
5. **Project overview?** See `/CLAUDE.md` in project root

---

## 📈 Recent Documentation Updates

**2026-02-03**: Documentation cleanup and consolidation
- Moved misplaced files to appropriate directories
- Created `docs/deployment/releases/` for release notes
- Moved algorithm documentation to `docs/algorithms/`
- Moved performance fixes to `docs/performance/`
- Moved development summaries to `docs/development/`
- Moved reference materials to `docs/reference/`
- Moved troubleshooting guides to `docs/troubleshooting/`
- Updated README to reflect current v0.3.14 structure

**2025-10-15**: Major documentation reorganization
- Organized all root-level docs into topic-based directories
- Created structured directory hierarchy (deployment, performance, development, etc.)
- Moved guides and reports into appropriate subdirectories
- Created this comprehensive index

**2025-10-14**: Performance documentation
- Added Lighthouse optimization guides
- ISR configuration documentation

**2025-10-13**: Authentication troubleshooting
- Clerk authentication fix guides
- Sign-in flow debugging documentation

---

**Questions or suggestions?** Update this index or contact the development team.
