# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.3.0] - 2025-07-22

### Added
- **🚀 Kiro AI Tool**: New specification-driven AI IDE added to rankings
  - Comprehensive tool profile with Claude Sonnet 4.0/3.7 integration
  - MCP (Model Context Protocol) support and enterprise features
  - Production-ready development methodology focus
  - 7 news articles integrated covering launch and features

- **📊 Algorithm v7.0 - Enhanced Sentiment & Velocity**: Major ranking algorithm overhaul
  - Increased sentiment weight from 10% to 15% for better crisis reflection
  - Non-linear negative sentiment penalty (exponential scaling)
  - Crisis detection system with 1.5x-2.0x impact multipliers
  - Dynamic velocity scoring based on real-time news activity
  - Replaced static velocity (60) with calculated scores (0-100)

- **🔄 Dynamic Velocity Scoring System**: Real-time momentum tracking
  - News volume component (40 points max)
  - Release announcements (20 points max)
  - Funding news (15 points max)
  - Feature updates (15 points max)
  - Recency bonus (10 points max)
  - Momentum categories: High (≥70), Medium (40-69), Low (20-39), Stagnant (<20)

### Changed
- **🗂️ Tools Data Structure Refactoring**: Improved scalability and performance
  - Migrated from monolithic tools.json to individual tool files
  - New structure: `/data/json/tools/individual/[tool-slug].json`
  - Centralized index file for efficient lookups
  - Automated backup system during migration

- **📈 Ranking Updates**: July 2025 rankings with algorithm v7
  - GitHub Copilot maintains #1 with velocity score 90
  - Windsurf rises to #2 (velocity 90, strong momentum)
  - Cursor drops to #3 due to negative sentiment impact
  - Claude Code enters top 10 at #9 (velocity 75)
  - Kiro debuts at #16 with promising initial metrics

- **📰 News Integration Enhancements**: Improved impact calculations
  - Better handling of productivity paradox articles
  - Enhanced sentiment analysis for crisis situations
  - More accurate tool-article matching algorithms

### Technical Updates
- **Performance Optimizations**
  - Faster cache generation with individual tool files
  - Improved API response times for tool queries
  - Reduced memory footprint for large datasets

- **Data Integrity Improvements**
  - Enhanced validation for tool metrics
  - Automated consistency checks across repositories
  - Better error handling in ranking calculations

### Developer Experience
- **New Scripts**:
  - `calculate-velocity-scores.ts`: Generate velocity metrics from news
  - `consolidate-tools-data.ts`: Migrate to individual file structure
  - `test-velocity-integration.ts`: Validate velocity scoring system
  - `execute-july-rankings-v7.ts`: Run algorithm v7 calculations

### Fixed
- **Sentiment Impact**: Negative news now properly affects rankings with exponential penalties
- **Tool Matching**: Improved accuracy in associating news articles with correct tools
- **Cache Generation**: Resolved issues with stale data in generated caches
- **TypeScript Errors**: Fixed compilation issues in various modules

### Breaking Changes
- Tools API now returns data from individual files instead of monolithic JSON
- Velocity score calculation changed from static (60) to dynamic (0-100)
- Ranking algorithm weights adjusted - may cause significant position changes

## [3.2.0] - 2025-07-14

### Added
- **🧠 Productivity Paradox Research Integration**: Integrated METR organization research findings into ranking algorithm
  - Cognitive bias correction factor (43%) applied to user satisfaction metrics
  - Actual productivity impact (-19%) vs perceived improvement (+24%) factored into business sentiment
  - Research-based risk factors added to affected tools
- **🏆 Enhanced Ranking Algorithm v6.0-productivity-adjusted**: Major algorithm enhancement incorporating research findings
  - Business sentiment adjustments for market-leading tools (GitHub Copilot, Gemini Code Assist, Cursor, Amazon Q)
  - Market share-proportional impact calculation for cognitive bias effects
  - New ranking period: `2025-07-14-productivity-adjusted.json`
- **📊 Comprehensive Impact Analysis**: Detailed reporting and validation system
  - Impact summary reports with ranking movement analysis
  - Validation framework ensuring data integrity (5-point validation system)
  - Backup system for all modified data with rollback capability
- **🔬 Research-Based Methodology**: Academic research integration framework
  - Source attribution to METR productivity study
  - Transparent methodology documentation for research incorporation
  - Risk factor categorization system for market impact assessment

### Changed
- **Ranking Calculations**: Updated to include productivity paradox adjustments for 4 major tools (70%+ market coverage)
- **News Data Enhancement**: July 2025 articles enhanced with productivity research impact metadata
- **Business Sentiment Scoring**: Market-share proportional adjustments based on cognitive bias research
- **Algorithm Documentation**: Enhanced with productivity research methodology and validation processes

### Fixed
- **Cognitive Bias Correction**: Addressed systematic bias in user satisfaction metrics for AI coding tools
- **Market Reality Alignment**: Rankings now better reflect actual productivity impact vs user perception
- **Data Integrity**: Comprehensive validation system prevents ranking calculation errors

## [3.1.2] - 2025-07-09

### Added
- **What's New Modal**: Interactive modal showing recent platform updates and news from past 3 days
- **Changelog Integration**: Real-time display of platform changes from changelog API
- **Auto-show Functionality**: Modal automatically shows for new visitors with 24-hour reset
- **User Preferences**: "Don't show again" option with localStorage persistence

### Changed
- **Update Display Order**: Rankings/news updates now appear before platform updates in modal
- **Modal Prioritization**: Changelog entries show top 10 recent items regardless of date
- **News Filtering**: News items filtered to past 3 days for relevance

### Fixed
- **Build Integration**: Modal properly integrated with "Last updated" button in build badge
- **Scroll Functionality**: Added proper scroll support for longer content in modal
- **Real Data Integration**: Removed hardcoded fake data, using actual APIs

## [3.1.0] - 2025-07-01

### Added
- **Interactive Tool Links**: Top 10 rankings on the updates page now link directly to tool detail pages
- **Innovation Ontology**: Detailed innovation scoring framework documentation in `/data/innovation/`
- **Dynamic Updates Page**: Real-time generation of ranking changes and statistics from latest data

### Fixed
- **Domain Correction**: Fixed all references from plural "aipowerrankings.com" to singular "aipowerranking.com"
- **Translation Completeness**: All language files (DE, FR, HR, IT, UK) now have complete translations
- **TypeScript Errors**: Resolved all ESLint errors in scripts directory
- **Tool Company Data**: Fixed missing company information display for tools like GitHub Copilot

### Changed
- **Updates Page**: Migrated from static markdown to dynamic data generation using UpdatesGenerator
- **API Enhancement**: Tool API endpoints now properly fetch and include company data

## [3.0.0] - 2025-06-30

### 🚀 Major Architecture Change
- **Complete Migration to JSON File Storage**: Removed dependency on Payload CMS and Supabase database
- **100% Static Operation**: Application now runs entirely from JSON files, no database required
- **TrackDown Integration**: Replaced GitHub Issues with git-native project management system

### Added
- **JSON File Architecture**
  - Primary data storage in `/data/json/` for all application data
  - Backup system with automatic rotation (keeps last 10 backups)
  - Data validation and integrity checks
  - Performance optimization for large datasets
  
- **New Features**
  - Tool pricing data display with detailed plan information
  - Expandable "... and X more tools" in rankings views
  - Business metrics, scores, and history tabs in tool details
  - PM2 process manager support for development server
  - Comprehensive data import/export scripts
  
- **Developer Experience**
  - TrackDown project management system in `/trackdown/`
  - Enhanced debugging workflow with PM2
  - Automated backup and restore procedures
  - JSON schema validation
  - Performance monitoring tools

### Changed
- **Data Storage**
  - Migrated from Payload CMS collections to JSON repositories
  - Companies, tools, rankings, and news now stored as JSON files
  - Removed all database dependencies
  - Simplified data access patterns
  
- **API Architecture**
  - All API endpoints now read from JSON files
  - Removed Payload-specific authentication
  - Simplified API responses
  - Better error handling for file operations
  
- **Development Workflow**
  - Switch from npm to pnpm for package management
  - Updated all documentation to reflect pnpm commands
  - Improved development server stability with PM2
  - Enhanced TypeScript configuration

### Fixed
- **UI/UX Issues**
  - Tool icons now show generic SVG instead of text initials
  - Missing translation keys added (back, viewSource)
  - Duplicate headers removed from rankings views
  - Tool descriptions limited to 3 lines on index page
  
- **Data Issues**
  - Tool pricing data properly displayed
  - Business metrics correctly fetched from tool info
  - Rankings history properly loaded
  - News items correctly associated with tools
  
- **Technical Issues**
  - TypeScript errors in Next.js 15 async params
  - Module resolution issues
  - Build errors from removed dependencies
  - Development server stability

### Removed
- **Payload CMS** - Complete removal of CMS dependency
- **Supabase** - No longer required for data storage
- **Database Migrations** - Replaced with JSON file operations
- **Authentication System** - Simplified to basic admin access
- **OAuth Integration** - Removed complex auth flows
- **Database Connection Pool** - No longer needed

### Migration Guide
1. **Data Migration**: Use `pnpm run json:migrate` to convert existing data
2. **Backup Creation**: Run `pnpm run backup:create` before major changes
3. **Cache Generation**: No longer required - direct JSON file access
4. **Environment Variables**: Database URLs no longer needed

### Technical Details
- **Performance**: ~10x faster data access with JSON files vs database queries
- **Reliability**: No database connection issues, works offline
- **Scalability**: Handles 100+ tools and 1000+ news items efficiently
- **Storage**: ~5MB total for all application data

### Breaking Changes
- Payload CMS admin panel no longer available
- Database connection strings removed from environment
- API authentication simplified (no OAuth)
- Some admin features consolidated or removed

## [2.2.0] - 2025-06-26

### Added
- **Cache-First Architecture**: Implemented hybrid cache system with filesystem storage for development and Vercel Blob storage for production
- **Ranking Change Analysis**: New system to calculate and explain ranking movements with detailed narratives
- **Payload CMS API Access**: Enabled API key authentication for programmatic access via Claude Desktop
- **Cache Management Dashboard**: New admin page at `/dashboard/cache` for managing static JSON cache files
- **Automatic Cache Clearing**: Next.js cache now clears automatically when starting dev server with `pnpm dev`
- **Comprehensive Documentation**: Created `PAYLOAD.md` for developers and enhanced `PAYLOAD-CMS-API.md` with step-by-step examples

### Changed
- **SEO Descriptions**: Moved to language dictionaries for proper i18n support
- **"500K+ developers" Claim**: Removed misleading claim, replaced with "developers worldwide"
- **Admin Dashboard**: Updated active features count and removed non-existent SEO Dashboard
- **Environment Variables**: Standardized to use bracket notation for better production compatibility

### Fixed
- **@vercel/blob Import**: Fixed module import errors with dynamic loading for non-Vercel environments
- **TypeScript Errors**: Resolved various type issues and linting warnings
- **Deployment Resilience**: Site now works even when database is unavailable thanks to cache-first approach

### Technical
- **CacheManager**: Unified cache operations with priority order: Blob → Filesystem → None
- **RankingChangeAnalyzer**: Analyzes factor changes and generates human-readable explanations
- **Blob Storage Integration**: Production-ready ephemeral storage for generated cache files
- **API Authentication**: Added `apiKey` and `enableAPIKey` fields to Users collection

## [2.1.0] - 2025-06-25

### Added
- Initial implementation of cache-first architecture
- Basic ranking system with algorithm v6.0
- Payload CMS integration
- Multi-language support (9 languages)

## [2.0.0] - 2025-06-08

### Added
- Complete rewrite for AI Power Rankings
- Source-oriented metrics architecture
- Monthly ranking generation process
- Supabase database integration
- Next.js 15 with App Router

## [1.0.0] - 2025-05-01

### Added
- Initial release
- Basic tool tracking functionality
- Simple ranking algorithm