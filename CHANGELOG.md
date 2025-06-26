# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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