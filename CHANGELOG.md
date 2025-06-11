# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-01-10

### Added

- Resilient i18n system with automatic fallback support
- Dictionary utilities for safe property access
- Support for multiple locales (de, fr, it, jp, hr, ko, uk)
- Deep merge functionality for dictionary completeness

### Changed

- Updated getDictionary to handle missing properties gracefully
- Modified dictionary structure to be fully serializable for SSR
- Enhanced type safety for dictionary access

### Fixed

- Fixed Symbol serialization errors in Next.js SSR
- Resolved missing translation properties causing runtime errors

## [0.1.0] - 2025-01-09

### Initial Release

- Core AI Power Rankings application
- Basic ranking algorithm implementation
- Tool directory and comparison features
- Newsletter subscription system
- Initial internationalization setup
