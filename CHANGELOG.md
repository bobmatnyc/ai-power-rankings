# Changelog

All notable changes to the AI Power Rankings project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-06-25

### Added
- **Cache-First Architecture**: Implemented resilient data fetching strategy
  - Static JSON cache files for rankings, tools, and news data
  - Automatic fallback to cached data when database is unavailable
  - Preview environments now use cache-first approach by default
- **Client-Side Data Processing**: Improved performance and reliability
  - All major pages now fetch data once and filter/sort on client
  - Reduced API calls and improved response times
  - Better user experience with instant filtering
- **Database Debugging Tools**: Added comprehensive debugging endpoints
  - `/api/debug-db-direct` - Direct database connection testing
  - `/api/debug-env` - Environment variable verification
  - `/api/debug-static` - Static cache data validation
  - `/api/health/db` - Database health monitoring
- **Error Boundaries**: Added React error boundaries for better error handling

### Changed
- **Layout Improvements**: Enhanced desktop experience
  - Expanded content width from `max-w-4xl` to `max-w-7xl`
  - News, methodology, and about pages now fill screen better
  - Responsive padding preserves mobile experience
- **Tools Page Architecture**: Converted to client-side rendering
  - Fixed loading issues with server-side fetching
  - Created `tools-client.tsx` for dynamic data loading
  - Improved reliability in preview environments
- **API Routes Enhancement**: All routes now support cache-first mode
  - Rankings API returns cached data with metadata
  - News API sends all data for client-side pagination
  - Tools API includes cache status information

### Fixed
- **Tool Detail Pages**: Restored missing tabs section
  - Re-added ToolDetailTabs component
  - Fixed pricing, news, and history sections
  - Properly passing dict prop to child components
- **Build-Time Errors**: Resolved static generation issues
  - Removed database calls during build phase
  - Fixed TypeScript strict mode violations
  - Eliminated dynamic import SSR conflicts

### Technical
- **Dependencies**: Added connection pooling and retry logic
- **Documentation**: Updated WORKFLOW.md with new deployment process
- **Environment**: Temporarily enabled cache-first for all environments

## [2.0.0] - 2025-06-22

### Changed
- **Major Architecture Update**: Simplified to single database architecture
  - Removed two-database system and environment switching
  - Consolidated all operations to use `iupygejzjkwyxtitescy` database
  - Updated DATABASE.md to reflect single database approach
- **Documentation Overhaul**: 
  - Archived outdated documentation from POC and v0 phases
  - Created comprehensive docs/README.md index
  - Updated all documentation to reflect current architecture
  - Cleaned up references to old database systems
- **Version Bump**: Updated to v2.0.0 to reflect architectural changes

### Improved
- Simplified database connection instructions
- Clearer documentation structure with proper archiving
- Updated README with current project state

## [1.2.0] - 2025-06-18

### Added
- **Improved News Volume Weighting**: Logarithmic scaling for better distribution of news impact
  - Claude Code properly ranked #4 with 20 news mentions (was #5)
  - More balanced scoring between high and low news volume tools
- **Google Drive News Ingestion**: 4 new articles imported
  - Bolt.new Figma integration (70% faster design-to-code)
  - Google Jules user backlash over beta limitations
  - Firebase Studio growth concerns
  - Developer community feedback on Google's AI tools
- **Updated Documentation**:
  - Comprehensive Google Drive integration guide
  - Enhanced database migration strategies in DATABASE.md
  - Updated PROJECT.md with current implementation status

### Changed
- **News Impact Algorithm**: 
  - Volume bonus now uses `Math.log(count + 1) * 15` instead of capped linear scale
  - Better recognition for tools with extensive media coverage
  - Prevents gaming through article spam
- **Rankings Update**:
  - Cursor maintains #1 with 210.4 news impact score
  - Claude Code rises to #4 with proper news volume weighting
  - Lovable at #3 with funding momentum
- **What's New Page**: Updated with current rankings and statistics
  - Shows 107 total articles (up from 103)
  - Displays ranking changes with color-coded badges

### Fixed
- **News Volume Recognition**: Tools with many articles now properly weighted
- **API Response**: Includes updated scoring calculations

## [1.1.0] - 2025-06-18

### Added
- **Ranking Change Indicators**: Visual indicators showing tool movement
  - Green arrows for upward movement
  - Red arrows for downward movement
  - NEW badges for first-time entries
  - Hover tooltips explaining changes
- **Enhanced Database**: Migrated to new development database
  - 39 tools with complete profiles
  - 103 news articles
  - Improved schema with `info` JSONB field

### Changed
- **Database Infrastructure**: New development database as primary
- **Ranking Positions**: Major movements due to complete data
- **Home Page**: Shows ranking changes inline

### Fixed
- **Database Connection Issues**: All pages now use correct database
- **Data Consistency**: Resolved discrepancies between pages

## [1.0.1] - 2025-06-11

### Added
- **Tech Stack Modal**: Created comprehensive technical summary popup accessible from About page
- **STACK.md**: Added detailed technical documentation covering all technologies, metrics, and architecture

### Changed
- **Site Name**: Changed from "AI Power Rankings" to "AI Power Ranking" (singular) across all application components
- **About Page**: Updated team section to reflect single maintainer (Bob Matsuoka) with link to HyperDev blog
- **Personal Touch**: Added transparency about the one-person operation and rapid iteration approach

### Fixed
- TypeScript compilation errors preventing Vercel deployment
- Removed duplicate non-localized pages that were causing build errors
- Fixed intersection observer null check in news content
- Fixed duplicate property in i18n expected structure
- Fixed test setup NODE_ENV assignment

## [1.0.0] - 2025-06-11

### 🎉 Major Release - Production Ready

This marks the first major release of AI Power Rankings with comprehensive improvements across logging, testing, database access, and internationalization.

### Added
- **Pino Logging Framework**: Migrated from console.log to structured JSON logging with context-specific loggers
- **Vitest Testing Framework**: Added comprehensive test suite with 36 passing tests covering:
  - Utility functions (cn helper)
  - Build-time functionality 
  - Logger configuration
  - Database client initialization
  - API route health checks
- **Semantic Versioning**: Full semantic version support with automated version tracking
- **Enhanced Database Documentation**: Authoritative database access patterns in DATABASE.md
- **Newsletter System**: Complete email subscription with verification and Turnstile protection
- **8-Language i18n Support**: Full internationalization for English, German, French, Italian, Japanese, Korean, Ukrainian, Croatian
- **Real News API**: Refactored news system to use metrics_history as event source
- **Tool Company Associations**: Updated all 39 tools with proper company mappings and pricing models

### Changed
- **Database Access Patterns**: Centralized database client usage to prevent connection issues
- **News Data Source**: Migrated from mock data to real metrics_history events
- **Build System**: Enhanced with comprehensive linting, type checking, and testing workflows
- **UI/UX Improvements**: Modern sidebar navigation, responsive design, tool logos/favicons

### Fixed
- **Localization Issues**: Resolved Korean, Ukrainian, Croatian translation loading
- **Newsletter Subscriptions**: Fixed RLS policies blocking subscription saves
- **Database Connection Issues**: Eliminated "Invalid API key" and connection failures
- **TypeScript Errors**: Comprehensive type safety improvements across codebase
- **Build Failures**: Resolved all production build and deployment issues

### Technical Debt Resolved
- Replaced all console.log statements with structured Pino logging
- Added comprehensive test coverage for critical functions
- Standardized database access patterns across all API routes
- Implemented proper error handling and logging throughout application

## [0.2.0] - 2025-06-10

### Added
- **Comprehensive i18n System**: Complete internationalization support with fallback mechanisms
- **Language Selector**: Dynamic language switching for 8 supported languages
- **Translation Management**: Missing translation detection and crawling system
- **Semantic Versioning**: Initial version tracking and cache clearing system

### Fixed
- **Dictionary Loading**: Resolved runtime errors from missing translation keys
- **Mobile Navigation**: Improved mobile user experience and navigation flows
- **Build System**: Fixed Vercel deployment issues and Next.js 15 compatibility

## [0.1.0] - 2025-06-09

### Added
- **Complete UI Redesign**: Modern sidebar navigation with Crown of Technology branding
- **Newsletter System**: Email subscription with verification and unsubscribe flows
- **News Page**: Dynamic news content with card-based layout
- **Tool Pages**: Detailed tool information with metrics history and company data
- **Favicon System**: Dynamic favicon fetching and display for all tools
- **Status Indicators**: Real-time tool status and availability indicators

### Changed
- **Navigation Structure**: Moved to sidebar-based navigation for better UX
- **Branding**: Updated to "AI Power Rankings" with professional Crown logo
- **Tool Display**: Enhanced tool cards with logos, categories, and pricing info

## [0.0.1] - 2025-06-08

### Added
- **Initial Project Setup**: Next.js 15 with TypeScript and Tailwind CSS
- **Database Schema**: Complete PostgreSQL schema with Supabase integration
- **Core Features**: 
  - Tool rankings and metrics tracking
  - Company and pricing model data
  - Basic API endpoints for tools and rankings
  - MCP server integration for Claude.ai
- **Development Infrastructure**: 
  - ESLint and Prettier configuration
  - TypeScript strict mode
  - Git hooks and commit standards

### Technical Foundation
- **Database**: PostgreSQL with Supabase, comprehensive schema for tools, companies, metrics
- **API**: RESTful endpoints for all major resources
- **Authentication**: OAuth integration for external tool access
- **Deployment**: Vercel configuration with environment management

---

## Version History Summary

- **v1.0.0** (2025-06-11): Production-ready release with logging, testing, and comprehensive features
- **v0.2.0** (2025-06-10): Internationalization and semantic versioning
- **v0.1.0** (2025-06-09): Major UI redesign and newsletter system  
- **v0.0.1** (2025-06-08): Initial project foundation and core features

## Development Process

This project follows semantic versioning:
- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions  
- **PATCH** version for backwards-compatible bug fixes

All changes are tracked through Git history and automatically included in deployment workflows.