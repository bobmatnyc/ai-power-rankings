# Release Notes - v0.3.1

**Release Date:** October 26, 2025

## Summary

Version 0.3.1 introduces several important improvements to the authentication system, news management, and user experience features.

## Features

### Unified Feed for What's New Modal
- Implemented a unified feed system that consolidates updates and news
- Provides users with a centralized view of recent changes and announcements
- Enhances user engagement with the platform

### Published Date Field in News Editor
- Added published date field to the news editor
- Enables better control over content publication timing
- Improves content management workflow for administrators

## Bug Fixes

### Locale-Aware Routing for Authentication Pages
- Fixed authentication pages to properly handle locale-aware routing
- Ensures consistent language experience across authentication flows
- Resolves navigation issues in multi-language deployments

## Refactoring

### Data-Driven Approach
- Replaced over-engineered phase system with a cleaner, data-driven approach
- Simplifies codebase maintenance
- Improves code readability and scalability

## Documentation

### KuzuMemory Integration
- Simplified CLAUDE.md for KuzuMemory integration
- Updated project documentation for better AI assistant interactions
- Enhanced development experience with improved context management

## Technical Details

- **Framework:** Next.js 15.5.4
- **Deployment:** Vercel
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** Clerk

## Migration Notes

No database migrations required for this release.

## What's Next

Future releases will focus on:
- Enhanced analytics and reporting
- Additional tool categories
- Performance optimizations
- Expanded multi-language support

---

**Full Changelog:** https://github.com/[your-org]/aipowerranking/compare/v0.3.0...v0.3.1
