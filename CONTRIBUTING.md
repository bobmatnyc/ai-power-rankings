# Contributing to AI Power Ranking

Thank you for your interest in contributing to AI Power Ranking! This guide will help you understand our project structure, file organization conventions, and development workflow.

## Table of Contents

- [File Organization](#file-organization)
- [Directory Structure](#directory-structure)
- [File Naming Conventions](#file-naming-conventions)
- [Where to Place Files](#where-to-place-files)
- [What Not to Commit](#what-not-to-commit)
- [Development Workflow](#development-workflow)
- [Testing Guidelines](#testing-guidelines)
- [Documentation Standards](#documentation-standards)

## File Organization

**Golden Rule**: Keep the project root clean. The root directory should only contain essential configuration files and project metadata.

### Current Structure Issues

The project has accumulated 39+ report markdown files in the root directory. This CONTRIBUTING.md establishes guidelines to prevent future clutter and organize existing files properly.

## Directory Structure

```
aipowerranking/
├── app/                    # Next.js app directory (routes, API endpoints)
├── components/             # React components
│   ├── admin/             # Admin-specific components
│   ├── layout/            # Layout components
│   ├── news/              # News-related components
│   ├── ranking/           # Ranking display components
│   └── ui/                # Shared UI components
├── contexts/              # React contexts
├── data/                  # Static data and backups
│   ├── json/              # JSON data files
│   │   └── backup/        # Database and data backups
│   ├── deleted-articles-backup-*.json  # Article backups
│   ├── extracted-rankings/ # Historical ranking data
│   └── uuid-mappings.json # UUID mapping data
├── docs/                  # Documentation
│   ├── reports/           # Analysis reports and test results (NEW)
│   ├── guides/            # User and developer guides (NEW)
│   └── *.md               # General documentation
├── hooks/                 # React hooks
├── i18n/                  # Internationalization files
├── lib/                   # Utility libraries and services
│   ├── cache/             # Caching utilities
│   ├── db/                # Database schemas and repositories
│   │   ├── migrations/    # Database migrations
│   │   └── repositories/  # Data access layer
│   ├── server-actions/    # Next.js server actions
│   ├── services/          # Business logic services
│   └── types/             # TypeScript type definitions
├── logs/                  # Application logs (gitignored)
├── public/                # Public static assets
├── scripts/               # Utility scripts
│   ├── CLEANUP-SCRIPTS-USAGE.md  # Script documentation
│   └── *.ts               # TypeScript scripts
├── src/                   # Additional source files (if any)
├── tests/                 # All test files
│   ├── e2e/              # End-to-end tests
│   ├── uat/              # User acceptance tests
│   ├── security/         # Security tests
│   ├── fixtures/         # Test data and fixtures
│   └── utils/            # Test utilities
├── test-results/          # Test output (gitignored)
├── tmp/                   # Temporary files (partially gitignored)
│   └── staging-reports/  # Temporary staging test reports
├── uat-screenshots/       # UAT screenshots (gitignored)
├── types/                 # Global TypeScript types
└── [config files]         # Root-level configuration only
```

## File Naming Conventions

### General Rules

1. **Use kebab-case** for file names: `my-component.tsx`, `user-service.ts`
2. **Use UPPER_CASE** for environment-specific files: `.env.local`, `README.md`
3. **Use descriptive names** that clearly indicate the file's purpose
4. **Avoid abbreviations** unless they are widely understood (e.g., `db`, `api`, `ui`)

### Specific Patterns

#### Reports and Analysis Documents
```
docs/reports/REPORT-NAME-SUBJECT.md
```
Examples:
- `docs/reports/ARTICLE-ANALYSIS-FIX-SUMMARY.md`
- `docs/reports/BASELINE-SNAPSHOT-VERIFICATION-REPORT.md`
- `docs/reports/TOOL-MATCHING-INVESTIGATION-REPORT.md`
- `docs/reports/E2E-TEST-RESULTS-POST-FIX.md`

Pattern: `SUBJECT-TYPE.md` where:
- **SUBJECT**: What was analyzed/tested (ARTICLE, BASELINE, TOOL-MATCHING, E2E-TEST)
- **TYPE**: Document type (REPORT, SUMMARY, ANALYSIS, INVESTIGATION)

#### Test Files
```
tests/{category}/{test-name}.spec.ts
tests/{category}/{test-name}.uat.spec.ts
```
Examples:
- `tests/e2e/admin.spec.ts`
- `tests/e2e/rankings.spec.ts`
- `tests/uat/staging-comprehensive.uat.spec.ts`
- `tests/security/admin-route-protection.spec.ts`

Pattern:
- Use `.spec.ts` for standard tests
- Use `.uat.spec.ts` for user acceptance tests
- Use `.e2e.spec.ts` for end-to-end tests (optional, `.spec.ts` in e2e folder is sufficient)

#### Configuration Files
```
{tool}.config.{ts|js}
{tool}.{environment}.config.{ts|js}
```
Examples:
- `playwright.config.ts` (main config)
- `playwright.prod.config.ts` (production-specific)
- `playwright.security.config.ts` (security tests)
- `next.config.js`
- `tailwind.config.js`

#### Scripts
```
scripts/{action}-{subject}.ts
```
Examples:
- `scripts/cleanup-test-articles.ts`
- `scripts/fix-article-dates.ts`
- `scripts/analyze-baseline-state.ts`
- `scripts/verify-trending-data.ts`

Pattern: `{verb}-{noun}.ts` using kebab-case

#### Data Files
```
data/{category}/{name}-{timestamp}.json
```
Examples:
- `data/deleted-articles-backup-2025-10-03T16-40-47-201Z.json`
- `data/json/backup/news.json.backup-2025-08-19T06-02-32.737Z`

## Where to Place Files

### Test Files

**All test files belong in `/tests/` directory**, organized by category:

#### ✅ Correct Placement
```
tests/
├── e2e/
│   ├── admin.spec.ts
│   ├── rankings.spec.ts
│   └── locale.spec.ts
├── uat/
│   └── staging-comprehensive.uat.spec.ts
├── security/
│   └── admin-route-protection.spec.ts
└── fixtures/
    └── test-data.ts
```

#### ❌ Incorrect Placement (DO NOT DO THIS)
```
/ (root)
├── test-article-management.spec.ts        # Move to tests/e2e/
├── verify-article-dates.spec.ts          # Move to tests/e2e/
├── verify-fixes.spec.ts                  # Move to tests/e2e/
└── test-hydration.js                     # Move to tests/e2e/ or delete
```

### Test Configuration Files

Test configs can remain in root if they are:
1. Tool-required configuration (e.g., `playwright.config.ts`)
2. Environment-specific variations (e.g., `playwright.prod.config.ts`)

**Avoid creating one-off test configs**. Prefer using the main config with environment variables.

### Reports and Analysis Documents

**Report placement depends on whether they are temporary/staging or permanent documentation:**

#### Temporary/Staging Test Reports → `/tmp/staging-reports/`
These are **temporary verification reports** for staging environment testing:
- UAT staging test results
- Staging environment verification reports
- Quick summaries for deployment validation
- Temporary investigation reports for specific deployments

#### Permanent Analysis/Documentation → `/docs/reports/`
These are **permanent documentation** for historical reference:
- Production test results and analysis
- Architecture investigation reports
- Database migration summaries
- Performance benchmarks
- Issue fix reports for production

#### ✅ Correct Placement
```
tmp/
└── staging-reports/               # Temporary staging test reports
    ├── STAGING-MODAL-API-VERIFICATION-REPORT.md
    ├── UAT-STAGING-REPORT-2025-10-05.md
    ├── UAT-STAGING-RE-VERIFICATION-REPORT.md
    ├── UAT-QUICK-SUMMARY.md
    └── CLERK-STAGING-FIX-SUMMARY.md

docs/
├── reports/                       # Permanent documentation
│   ├── ARTICLE-ANALYSIS-FIX-SUMMARY.md
│   ├── BASELINE-SNAPSHOT-VERIFICATION-REPORT.md
│   ├── E2E-TEST-RESULTS-POST-FIX.md
│   ├── TOOL-MATCHING-INVESTIGATION-REPORT.md
│   └── PRODUCTION-E2E-TEST-REPORT.md
└── guides/
    ├── baseline-scoring-usage.md
    └── AUTHENTICATION-CONFIG.md
```

#### ❌ Incorrect Placement
```
/ (root)
├── STAGING-*.md                      # Move to tmp/staging-reports/
├── UAT-STAGING-*.md                  # Move to tmp/staging-reports/
├── ARTICLE-ANALYSIS-FIX-SUMMARY.md   # Move to docs/reports/
└── [... other report files ...]      # Move to appropriate location
```

#### Decision Guide: Where to Place Reports

**Use `/tmp/staging-reports/`** when the report is:
- ✅ Testing a staging deployment
- ✅ Temporary verification before production
- ✅ Quick test summary for a specific deployment
- ✅ Will be obsolete after production deployment

**Use `/docs/reports/`** when the report is:
- ✅ Production test results
- ✅ Historical reference for architecture decisions
- ✅ Permanent investigation/analysis documentation
- ✅ Will be referenced in the future

### Scripts

**All utility scripts belong in `/scripts/` directory**:

#### ✅ Correct Placement
```
scripts/
├── CLEANUP-SCRIPTS-USAGE.md             # Documentation for scripts
├── cleanup-test-articles.ts
├── fix-article-dates.ts
├── analyze-baseline-state.ts
└── verify-trending-data.ts
```

#### ❌ Incorrect Placement
```
/ (root)
├── analyze-uat-results.js               # Move to scripts/
├── check-html-structure.js              # Move to scripts/
├── parse-test-results.js                # Move to scripts/
├── test-browser-console.js              # Move to scripts/ or delete
└── verify-chunk-load.js                 # Move to scripts/ or delete
```

### Data Files and Backups

**All data files belong in `/data/` directory**:

```
data/
├── json/
│   └── backup/
│       └── news.json.backup-2025-08-19T06-02-32.737Z
├── deleted-articles-backup-*.json
├── extracted-rankings/
│   └── [extracted ranking data]
└── uuid-mappings.json
```

### What Should Stay in Root

**Only essential project files**:

1. **Configuration files** for tools that require root-level configs:
   - `package.json`, `package-lock.json`
   - `tsconfig.json`
   - `next.config.js`
   - `tailwind.config.js`
   - `postcss.config.js`
   - `drizzle.config.ts`
   - `playwright.config.ts` (and environment variants)

2. **Essential metadata**:
   - `README.md` (if exists)
   - `CONTRIBUTING.md` (this file)
   - `LICENSE`
   - `.gitignore`

3. **Build/framework files**:
   - `middleware.ts` (Next.js middleware)
   - `next-env.d.ts` (Next.js types)

## What Not to Commit

The `.gitignore` file defines what should not be committed. Key categories:

### Always Excluded

1. **Dependencies**: `node_modules/`, `.pnp`, `.pnp.js`
2. **Build artifacts**: `.next/`, `out/`, `build/`, `dist/`
3. **Environment files**: `.env`, `.env.local`, `.env.*.local`
4. **IDE files**: `.vscode/`, `.idea/`, `*.swp`, `.DS_Store`
5. **Logs**: `logs/`, `*.log`
6. **Cache**: `.cache/`, `.turbo`, `.claude/`, `.claude-mpm/`
7. **Test artifacts**:
   - `uat-screenshots/`
   - `test-results/`
   - `playwright-report/`
   - `*.webm`, `trace.zip`
8. **Sensitive data**: `*.pem`, `*.key`, `*.cert`, `credentials/`

### Report and Test Files (Controlled)

The `.gitignore` includes patterns for test artifacts:
```gitignore
QA_*.md
HYDRATION_*.md
TEST_*.txt
BEFORE_AFTER_*.md
test-results.json
```

**However**: Analysis reports and summaries (like `ARTICLE-ANALYSIS-FIX-SUMMARY.md`) are currently committed. This is acceptable but they should be in `/docs/reports/`, not in root.

### When to Commit Reports

**Commit permanent reports (`/docs/reports/`)** when:
- They document important system changes
- They provide historical context for decisions
- They serve as references for future work
- They are production-ready documentation

**Commit staging reports (`/tmp/staging-reports/`)** when:
- They document staging test results for team review
- They are needed for deployment validation
- They help track staging environment issues
- **Note**: These are temporary and can be deleted after production deployment

**Do not commit**:
- Personal debugging notes (use `/tmp/` without committing)
- Duplicate or obsolete reports
- Screenshots (unless essential documentation, store in `/tmp/`)
- Local test outputs (already gitignored in `test-results/`)

## Development Workflow

### Adding New Features

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Implement your changes** following the file organization rules

3. **Add tests** in the appropriate test directory:
   - E2E tests → `tests/e2e/`
   - UAT tests → `tests/uat/`
   - Security tests → `tests/security/`

4. **Run tests** to ensure nothing breaks:
   ```bash
   npm test
   # or specific test suites
   npx playwright test --config playwright.config.ts
   ```

5. **Document significant changes** (if needed) in `/docs/reports/`

6. **Commit with clear messages**:
   ```bash
   git add .
   git commit -m "feat: Add new feature with proper organization"
   ```

### Creating Utility Scripts

1. **Place in `/scripts/` directory**
2. **Use TypeScript** (`.ts`) for type safety
3. **Follow naming convention**: `{verb}-{noun}.ts`
4. **Add documentation** to `scripts/CLEANUP-SCRIPTS-USAGE.md` or create script-specific docs
5. **Include**:
   - Purpose description
   - Usage examples
   - Required environment variables
   - Safety features (dry-run, confirmations)

Example structure:
```typescript
// scripts/cleanup-old-data.ts

/**
 * Cleanup Old Data Script
 *
 * Purpose: Remove outdated records from the database
 * Usage: tsx scripts/cleanup-old-data.ts [--dry-run] [--auto-confirm]
 */

import { db } from '../lib/db/connection';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const autoConfirm = process.argv.includes('--auto-confirm');

  // Implementation...
}

main().catch(console.error);
```

## Testing Guidelines

### Test Organization

```
tests/
├── e2e/              # End-to-end tests (user flows)
├── uat/              # User acceptance tests
├── security/         # Security and authorization tests
├── fixtures/         # Shared test data
└── utils/            # Test helper functions
```

### Test File Naming

- E2E tests: `{feature}.spec.ts`
- UAT tests: `{scenario}.uat.spec.ts`
- Security tests: `{area}-protection.spec.ts`

### Test Configuration

- Main config: `playwright.config.ts`
- Environment-specific: `playwright.{env}.config.ts`
- Avoid one-off configs; use environment variables instead

### Running Tests

```bash
# All tests
npm test

# Specific suite
npx playwright test tests/e2e/

# Specific environment
npx playwright test --config playwright.prod.config.ts

# With UI
npx playwright test --ui

# Debug mode
npx playwright test --debug
```

## Documentation Standards

### When to Create Documentation

Create documentation for:
1. **New features** - How to use them
2. **Complex systems** - Architecture and design decisions
3. **Utility scripts** - Usage and safety guidelines
4. **Analysis results** - Testing outcomes, performance reports
5. **Setup procedures** - Installation, configuration, deployment

### Documentation Structure

#### User Guides (`docs/guides/`)
- Step-by-step instructions
- Clear examples
- Troubleshooting sections
- Use cases

#### Reports (`docs/reports/`)
- Analysis summaries
- Test results
- Investigation findings
- Performance benchmarks

#### Script Documentation (`scripts/`)
- Include a README or add to `CLEANUP-SCRIPTS-USAGE.md`
- Document all CLI flags
- Provide usage examples
- Explain safety features

### Documentation Format

Use Markdown with:
- Clear headings hierarchy
- Code blocks with syntax highlighting
- Tables for structured data
- Examples for complex concepts
- Links to related documentation

Example:
````markdown
# Feature Name

## Overview
Brief description of what this feature does.

## Quick Start

```bash
# Basic usage
npm run feature
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `foo` | string | `"bar"` | Does something |

## Examples

### Basic Example
```typescript
import { feature } from './feature';

feature.doSomething();
```

## Troubleshooting

### Error: "Something went wrong"
- Check that X is configured
- Verify Y is installed
````

## Migration Plan for Existing Files

To clean up the current project state:

### Phase 1: Create Directory Structure
```bash
mkdir -p docs/reports
mkdir -p docs/guides
```

### Phase 2: Move Report Files
```bash
# Move all analysis reports
mv *-REPORT.md docs/reports/
mv *-SUMMARY.md docs/reports/
mv *-ANALYSIS.md docs/reports/
mv *-INVESTIGATION*.md docs/reports/
mv *-RESULTS*.md docs/reports/
mv *-VERIFICATION*.md docs/reports/
mv UAT_*.md docs/reports/
```

### Phase 3: Move Test Files
```bash
# Move root-level test files to appropriate test directories
mv test-*.spec.ts tests/e2e/
mv verify-*.spec.ts tests/e2e/
```

### Phase 4: Move Scripts
```bash
# Move root-level scripts
mv analyze-*.js scripts/
mv check-*.js scripts/
mv parse-*.js scripts/
mv test-*.js scripts/
mv verify-*.js scripts/
```

### Phase 5: Clean Up Test Configs
Review and consolidate test configuration files. Consider whether all variations are necessary.

### Phase 6: Update .gitignore
Ensure the moved files are properly tracked or ignored based on their purpose.

## Questions or Issues?

If you have questions about where to place a file or how to organize something:

1. Check this CONTRIBUTING.md first
2. Look for similar existing files
3. Follow the established patterns
4. When in doubt, ask before creating new root-level files

## Summary Checklist

Before committing, ensure:

- [ ] Test files are in `/tests/{category}/`
- [ ] Reports are in `/docs/reports/`
- [ ] Scripts are in `/scripts/` with documentation
- [ ] Data files are in `/data/`
- [ ] No temporary files in root directory
- [ ] Configuration files are necessary and properly named
- [ ] Changes are tested
- [ ] Documentation is updated if needed

---

**Remember**: A clean, organized codebase is easier to maintain, understand, and contribute to. Thank you for helping keep this project well-structured!
