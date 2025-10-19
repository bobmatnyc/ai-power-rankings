# Project Organization Standard

**Project**: AI Power Ranking
**Framework**: Next.js 14 (App Router)
**Version**: 1.0.0
**Last Updated**: 2025-10-19

---

## Overview

This document defines the official organization rules for the AI Power Ranking project. All files must follow these conventions to maintain consistency and discoverability.

---

## Directory Structure

### Root Level
```
/
├── app/                    # Next.js App Router pages and API routes
├── components/             # React components
├── lib/                    # Core business logic and utilities
├── public/                 # Static assets
├── docs/                   # ALL documentation (see Documentation Organization)
├── tests/                  # Test suites and test documentation
├── scripts/                # Database migrations and utility scripts
├── .claude/                # Claude Code configuration and agents
├── tmp/                    # Temporary files and backups (gitignored)
├── CLAUDE.md               # Project guide for AI assistants
├── README.md               # User-facing project overview
└── package.json            # Project configuration
```

### Next.js Specific (App Router)
```
app/
├── [lang]/                 # Internationalized pages
│   ├── rankings/          # Rankings feature pages
│   ├── news/              # News and articles pages
│   ├── about/             # Static content pages
│   └── layout.tsx         # Root layout
├── api/                    # API routes
│   ├── rankings/          # Rankings endpoints
│   ├── news/              # News endpoints
│   └── admin/             # Admin endpoints (protected)
└── globals.css            # Global styles
```

### Component Organization
```
components/
├── auth/                   # Authentication components
├── news/                   # News display components
├── ui/                     # Reusable UI components
├── layout/                 # Layout components (sidebar, nav)
└── [feature]/              # Feature-specific components
```

### Business Logic
```
lib/
├── db/                     # Database layer
│   ├── repositories/      # Data access patterns
│   └── migrations/        # Drizzle migrations
├── services/              # Business logic services
├── utils/                 # Utility functions
└── schema.ts              # Database schema definitions
```

---

## Documentation Organization

**CRITICAL**: ALL documentation must go in `/docs/` subdirectories. NO documentation files at project root except CLAUDE.md and README.md.

### Documentation Categories

| Category | Directory | Purpose | Examples |
|----------|-----------|---------|----------|
| **Deployment** | `docs/deployment/` | Deployment guides, checklists, verification reports | Deployment checklists, Vercel deployment reports |
| **Development** | `docs/development/` | Contributing guides, implementation docs, guides | Contributing guide, implementation summaries |
| **Performance** | `docs/performance/` | Performance optimization reports, Lighthouse results | Optimization reports, performance testing |
| **Reference** | `docs/reference/` | Technical references, configuration docs, analysis reports | Auth config, baseline scoring, schema analysis |
| **Security** | `docs/security/` | Security audits, authentication docs, security reports | Admin security verification, auth implementation |
| **Troubleshooting** | `docs/troubleshooting/` | Debugging guides, issue resolution, fix summaries | Clerk auth fixes, debugging procedures |
| **Archive** | `docs/_archive/` | Outdated or superseded documentation | Old reports, deprecated guides |

### Documentation Subdirectories

```
docs/
├── deployment/
│   ├── DEPLOYMENT-CHECKLIST.md
│   ├── DEPLOYMENT-STATUS.md
│   └── VERCEL-*.md
├── development/
│   ├── CONTRIBUTING.md
│   ├── guides/
│   └── NEXT-STEPS-*.md
├── performance/
│   ├── LIGHTHOUSE-*.md
│   ├── PERFORMANCE-*.md
│   └── PHASE-*.md
├── reference/
│   ├── AUTHENTICATION-CONFIG.md
│   ├── PROJECT_ORGANIZATION.md (this file)
│   ├── baseline-scoring-usage.md
│   └── reports/
│       └── analysis/
├── security/
│   ├── ADMIN-ACCESS-*.md
│   └── PRODUCTION-*.md
├── troubleshooting/
│   ├── CLERK-*.md
│   ├── AUTHENTICATION-*.md
│   └── DEBUG-*.md
└── _archive/
    └── [date]-[filename].md
```

### Documentation File Naming

| Type | Pattern | Example |
|------|---------|---------|
| **Checklists** | `[TOPIC]-CHECKLIST.md` | `DEPLOYMENT-CHECKLIST.md` |
| **Reports** | `[TOPIC]-REPORT.md` | `PERFORMANCE-OPTIMIZATION-REPORT.md` |
| **Summaries** | `[TOPIC]-SUMMARY.md` | `SESSION-SUMMARY.md` |
| **Guides** | `[TOPIC]-GUIDE.md` | `AUTHENTICATION-IMPLEMENTATION-GUIDE.md` |
| **Status** | `[TOPIC]-STATUS.md` | `DEPLOYMENT-STATUS.md` |
| **Fixes** | `[TOPIC]-FIX.md` | `CLERK-FIX-SUMMARY.md` |
| **Configuration** | `[TOPIC]-CONFIG.md` | `AUTHENTICATION-CONFIG.md` |
| **Verification** | `[TOPIC]-VERIFICATION.md` | `DEPLOYMENT-VERIFICATION.md` |

### Root-Level Documentation Rules

**ONLY these files are allowed at project root:**
- `CLAUDE.md` - Project guide for AI assistants
- `README.md` - User-facing project overview
- `CHANGELOG.md` - Version history (optional)
- `LICENSE` - License information (if applicable)

**ALL other documentation MUST be in `/docs/` subdirectories.**

---

## File Placement Rules

### By File Type

| File Type | Location | Naming Convention | Example |
|-----------|----------|-------------------|---------|
| **Pages** | `app/[lang]/[feature]/` | `page.tsx` | `app/[lang]/rankings/page.tsx` |
| **API Routes** | `app/api/[resource]/` | `route.ts` | `app/api/rankings/current/route.ts` |
| **Components** | `components/[category]/` | `kebab-case.tsx` | `components/ui/signup-modal.tsx` |
| **Services** | `lib/services/` | `kebab-case.service.ts` | `lib/services/article-ingestion.service.ts` |
| **Repositories** | `lib/db/repositories/` | `kebab-case.repository.ts` | `lib/db/repositories/article.repository.ts` |
| **Utilities** | `lib/utils/` | `kebab-case.ts` | `lib/utils/format-date.ts` |
| **Types** | `lib/types/` or collocated | `kebab-case.ts` | `lib/types/article.ts` |
| **Tests** | `tests/` or `__tests__/` | `*.test.ts` | `tests/article.test.ts` |
| **Scripts** | `scripts/` | `kebab-case.ts` | `scripts/migrate-data.ts` |
| **Documentation** | `docs/[category]/` | `UPPER-CASE.md` | `docs/deployment/DEPLOYMENT-CHECKLIST.md` |

### By Purpose

| Purpose | Primary Location | Secondary Location |
|---------|------------------|-------------------|
| **User Interface** | `components/` | `app/[lang]/` (page components) |
| **Business Logic** | `lib/services/` | `lib/db/repositories/` |
| **Data Access** | `lib/db/repositories/` | `lib/db/` |
| **API Endpoints** | `app/api/` | N/A |
| **Static Content** | `app/[lang]/[page]/` | `public/` (assets) |
| **Configuration** | Root level | `lib/config/` |
| **Testing** | `tests/` | `__tests__/` (collocated) |

---

## Naming Conventions

### Files

| Type | Convention | Example |
|------|------------|---------|
| **React Components** | PascalCase | `SignupModal.tsx` |
| **Services** | kebab-case | `article-ingestion.service.ts` |
| **Utilities** | kebab-case | `format-date.ts` |
| **Types** | kebab-case | `article-types.ts` |
| **Tests** | kebab-case | `article.test.ts` |
| **Documentation** | UPPER-CASE | `DEPLOYMENT-CHECKLIST.md` |

### Directories

| Type | Convention | Example |
|------|------------|---------|
| **Features** | kebab-case | `rankings/`, `news/` |
| **Components** | kebab-case | `ui/`, `auth/` |
| **Services** | kebab-case | `services/`, `repositories/` |
| **Documentation** | lowercase | `deployment/`, `performance/` |

### Code Identifiers

| Type | Convention | Example |
|------|------------|---------|
| **React Components** | PascalCase | `ArticleCard` |
| **Functions** | camelCase | `fetchArticles()` |
| **Variables** | camelCase | `articleData` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_ARTICLES` |
| **Types/Interfaces** | PascalCase | `ArticleData` |
| **Enums** | PascalCase | `ArticleStatus` |

---

## Special Directories

### `.claude/`
Claude Code configuration and agent definitions.
- **agents/** - Agent personality definitions
- **commands/** - Custom slash commands
- **config.json** - Claude Code configuration

### `tmp/`
Temporary files and backups (must be gitignored).
- Backup archives before reorganization
- Temporary export files
- Development scratch files

### `docs/_archive/`
Outdated or superseded documentation.
- Prefix with date: `2025-10-15-OLD-DEPLOYMENT-GUIDE.md`
- Include reason for archival in frontmatter
- Reference replacement document if applicable

---

## Framework-Specific Rules

### Next.js App Router

1. **Pages** must be in `app/[lang]/[feature]/page.tsx`
2. **Layouts** must be named `layout.tsx`
3. **Loading states** must be named `loading.tsx`
4. **Error boundaries** must be named `error.tsx`
5. **API routes** must be in `app/api/[resource]/route.ts`
6. **Metadata** should be exported from page components

### React Components

1. **One component per file** (except small, tightly coupled components)
2. **Component files** match component name: `ArticleCard.tsx` exports `ArticleCard`
3. **Index files** for re-exporting: `components/ui/index.ts`
4. **Collocated tests** allowed: `ArticleCard.test.tsx` next to `ArticleCard.tsx`

### TypeScript

1. **Type definitions** in `lib/types/` or collocated
2. **Shared types** in `lib/types/`
3. **Feature-specific types** collocated with feature
4. **Database types** generated from Drizzle schema

---

## Migration Procedures

### Moving Documentation Files

1. **Identify category** (deployment, development, performance, reference, security, troubleshooting)
2. **Check naming convention** (UPPER-CASE.md)
3. **Move with git**: `git mv OLD_PATH NEW_PATH`
4. **Update references** in CLAUDE.md, README.md, and other docs
5. **Verify links** still work

### Reorganizing Components

1. **Identify component purpose** (ui, auth, feature-specific)
2. **Check dependencies** (imports, exports)
3. **Move with git**: `git mv components/OLD components/NEW`
4. **Update imports** across project
5. **Test build**: `npm run build`

### Archiving Documentation

1. **Create archive copy**: `docs/_archive/YYYY-MM-DD-[filename].md`
2. **Add archive note** to frontmatter:
   ```markdown
   > **ARCHIVED**: This document was archived on YYYY-MM-DD.
   > Replaced by: [New Document](../path/to/new.md)
   > Reason: [Brief explanation]
   ```
3. **Update references** to point to new document
4. **Remove from main docs** (but keep in archive)

---

## Best Practices

### Documentation

1. **Single source of truth**: Avoid duplicating information
2. **Link liberally**: Reference other docs instead of copying
3. **Keep current**: Update when making related changes
4. **Version important docs**: Use frontmatter with version/date
5. **Archive don't delete**: Move outdated docs to `_archive/`

### Code Organization

1. **Feature cohesion**: Keep related files close together
2. **Separation of concerns**: UI, business logic, data access
3. **Reusability**: Extract common patterns to lib/
4. **Discoverability**: Use conventional names and locations
5. **Consistency**: Follow existing patterns

### File Management

1. **Use git mv**: Preserve history when moving files
2. **Update imports**: Always update after moving files
3. **Test builds**: Verify after reorganization
4. **Document changes**: Note structural changes in commits

---

## Validation Checklist

Use this checklist to validate project organization:

- [ ] No documentation files at root (except CLAUDE.md, README.md, CHANGELOG.md, LICENSE)
- [ ] All docs in appropriate `/docs/` subdirectories
- [ ] Documentation follows naming conventions (UPPER-CASE.md)
- [ ] Components in appropriate subdirectories (ui/, auth/, feature/)
- [ ] Business logic in `lib/services/` or `lib/db/repositories/`
- [ ] API routes follow `app/api/[resource]/route.ts` pattern
- [ ] Test files in `tests/` or collocated with `__tests__/`
- [ ] Scripts in `scripts/` directory
- [ ] Temporary files in `tmp/` (gitignored)
- [ ] Archived docs in `docs/_archive/` with dates
- [ ] All files follow naming conventions
- [ ] Git history preserved for moved files
- [ ] Imports updated after file moves
- [ ] Build succeeds after reorganization

---

## References

- **CLAUDE.md**: Project guide with quick reference
- **docs/README.md**: Complete documentation index
- **Next.js Documentation**: https://nextjs.org/docs
- **Drizzle ORM**: https://orm.drizzle.team/

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-10-19 | Initial organization standard |

---

**Maintained by**: Project Organizer Agent
**Review Frequency**: Quarterly or after major structural changes
