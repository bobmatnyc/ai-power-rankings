# AI Power Rankings Repository Structure

Last Updated: 2025-01-29

## Overview

This document provides a comprehensive overview of the AI Power Rankings repository structure after the January 2025 cleanup. The repository is organized to maximize developer efficiency while maintaining a clean, logical hierarchy.

## Root Directory Layout

```
ai-power-rankings/
├── README.md              # Project overview and quick start guide
├── CHANGELOG.md           # Version history and release notes
├── CLAUDE.md              # Claude Code AI agent configuration
├── STACK.md               # Technology stack documentation
├── DEPLOYMENT-TRIGGER.md  # Deployment tracking
├── VERSION                # Current version number
├── REPOSITORY-STRUCTURE.md # This file - repository organization guide
│
├── package.json           # Node.js dependencies and scripts
├── pnpm-lock.yaml        # Package manager lock file
├── tsconfig.json         # TypeScript configuration
├── next.config.ts        # Next.js configuration
├── biome.json            # Biome linter/formatter configuration
├── tailwind.config.js    # Tailwind CSS configuration
├── postcss.config.js     # PostCSS configuration
├── vitest.config.ts      # Vitest testing configuration
├── vercel.json           # Vercel deployment configuration
├── components.json       # shadcn/ui component configuration
└── gpm.config.js         # Git project manager configuration
```

## Directory Structure

### `/src` - Source Code
The main application code, following Next.js App Router conventions.

```
src/
├── app/                   # Next.js App Router pages
│   ├── [lang]/           # Internationalized routes
│   ├── api/              # API routes
│   └── *.tsx             # Root layout and pages
├── components/           # React components
│   ├── admin/            # Admin dashboard components
│   ├── layout/           # Layout components (nav, footer, etc.)
│   ├── news/             # News-related components
│   ├── ranking/          # Rankings display components
│   ├── tools/            # Tool detail components
│   └── ui/               # Reusable UI components (shadcn/ui)
├── lib/                  # Core utilities and business logic
│   ├── json-db/          # JSON database repositories
│   ├── cache/            # Caching utilities
│   ├── seo/              # SEO utilities
│   └── *.ts              # Various utility functions
├── hooks/                # Custom React hooks
├── contexts/             # React contexts
├── i18n/                 # Internationalization
│   └── dictionaries/     # Translation files (9 languages)
├── data/                 # Static data and cache
│   ├── cache/            # Generated cache files
│   └── seo-content.ts    # SEO content definitions
├── types/                # TypeScript type definitions
└── scripts/              # Build and maintenance scripts
```

### `/data` - Data Storage
All application data, using JSON file-based architecture.

```
data/
├── json/                 # Primary JSON data storage
│   ├── companies/        # Company information
│   ├── news/             # News articles and updates
│   │   ├── articles/     # Articles by month (YYYY-MM.json)
│   │   └── by-month/     # Monthly indexes
│   ├── rankings/         # Power rankings data
│   │   └── periods/      # Historical rankings by date
│   ├── tools/            # Tool information
│   │   └── individual/   # Individual tool JSON files
│   ├── subscribers/      # Newsletter subscribers
│   └── settings/         # Site configuration
├── backups/              # Automated backup storage
├── imports/              # Data import staging
├── exports/              # Data export results
└── metrics-by-date/      # Historical metrics tracking
```

### `/docs` - Documentation
Comprehensive project documentation.

```
docs/
├── INSTRUCTIONS.md       # Core development instructions
├── WORKFLOW.md           # Development workflow guide
├── PROJECT.md            # Project specifications
├── TOOLCHAIN.md          # Technical implementation guide
├── JSON-STORAGE.md       # JSON architecture documentation
├── DEPLOYMENT-GUIDE.md   # Deployment procedures
├── archive/              # Archived documentation and backups
│   ├── 2025-01-cleanup/  # January 2025 cleanup artifacts
│   ├── 2025-06-cleanup/  # June 2025 cleanup artifacts
│   └── 2025-07-cleanup/  # July 2025 cleanup artifacts
└── [various].md          # Feature-specific documentation
```

### `/public` - Static Assets
Publicly accessible files.

```
public/
├── data/                 # Public data files
│   └── rankings.json     # Current rankings (static)
├── favicon.ico           # Site favicon
├── site.webmanifest      # PWA manifest
├── openapi.json          # API documentation
└── [images]              # Various image assets
```

### `/scripts` - Utility Scripts
TypeScript scripts for maintenance and operations.

```
scripts/
├── generate-*-cache.ts   # Cache generation scripts
├── fix-*.ts              # Data fixing utilities
├── test-*.ts             # Testing scripts
├── validate-*.ts         # Validation utilities
└── [various].ts          # Other utility scripts
```

### `/database` - Database Schema
SQL schema and migration files (legacy, for reference).

```
database/
├── schema.sql            # Database schema
├── migrations/           # SQL migration files
└── validation-queries.sql # Data validation queries
```

### `/tasks` & `/TICKETS` - Task Management
Local task tracking using TrackDown system.

```
tasks/                    # TrackDown task management
├── epics/                # Epic-level tasks
├── issues/               # Issue tracking
├── tasks/                # Individual tasks
└── templates/            # Task templates

TICKETS/                  # Additional ticket tracking
└── T-*.md                # Individual ticket files
```

## Important Files

### Configuration Files
- `.env.local` - Environment variables (not in git)
- `.env.example` - Environment variable template
- `.gitignore` - Git ignore rules
- `.npmrc` - npm configuration

### Development Files
- `dev-server.log` - Development server logs
- `dev-startup.log` - Startup logs
- `performance.config.json` - Performance configuration

### Build Artifacts
- `.next/` - Next.js build output (not in git)
- `node_modules/` - Dependencies (not in git)
- `tsconfig.tsbuildinfo` - TypeScript build info

## Archive Structure

The `/docs/archive` directory contains historical artifacts organized by cleanup date:

```
docs/archive/
├── 2025-01-cleanup/      # January 2025 cleanup
│   ├── CLEANUP-SUMMARY.md # Cleanup operations summary
│   ├── backups/          # All backup files from cleanup
│   ├── old-docs/         # Archived documentation
│   ├── scripts/          # Obsolete Python scripts
│   └── temp-files/       # Temporary files
├── 2025-06-cleanup/      # June 2025 artifacts
└── 2025-07-cleanup/      # July 2025 artifacts
```

## Key Principles

1. **JSON-First Architecture**: All data stored in JSON files, no active database dependency
2. **Cache-Driven Performance**: Pre-generated caches for optimal performance
3. **Internationalization**: Full support for 9 languages
4. **Type Safety**: Strict TypeScript throughout
5. **Clean Organization**: Clear separation of concerns and logical grouping

## Quick Navigation

- **Development docs**: `/docs/INSTRUCTIONS.md`
- **Main data**: `/data/json/`
- **Source code**: `/src/`
- **API routes**: `/src/app/api/`
- **Components**: `/src/components/`
- **Translations**: `/src/i18n/dictionaries/`
- **Scripts**: `/scripts/`
- **Backups**: `/data/backups/` and `/docs/archive/`

## Maintenance Notes

- Regular backups are stored in `/data/backups/` with timestamps
- Archived files are organized by cleanup date in `/docs/archive/`
- The `.claude-pm/` directories contain Claude project manager files
- All obsolete files have been archived, not deleted, for reference