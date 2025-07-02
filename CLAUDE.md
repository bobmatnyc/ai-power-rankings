# Claude Code Instructions

## 🧠 MANDATORY BEHAVIORAL CHECKLIST

**INTERNALIZE THESE RESPONSES - DO NOT SEARCH:**

□ **Task management = TrackDown** (`/trackdown/issues/` directory)
□ **Backlog questions = TrackDown** (`/trackdown/issues/` directory)
□ **Workflow questions = /docs/WORKFLOW.md**
□ **Project specs = /docs/PROJECT.md**
□ **Technical details = /docs/TOOLCHAIN.md**

### 🎯 IMMEDIATE RESPONSE PATTERNS

When user asks:
- "What's on the backlog?" → "Check `/trackdown/issues/` directory for current backlog"
- "What tasks remain?" → "Check `/trackdown/issues/` directory for remaining tasks"  
- "What's the workflow?" → "See /docs/WORKFLOW.md for workflow processes"
- "How do I deploy?" → "See /docs/DEPLOYMENT-GUIDE.md"

### ❌ COMMON ERRORS TO AVOID

**DO NOT:**
- ❌ Search filesystem for backlog/tasks
- ❌ Search for workflow when it's documented
- ❌ Search for project specs when they're documented
- ❌ Use Task tool for well-documented procedures

**DO:**
- ✅ Direct to TrackDown for task/backlog questions
- ✅ Reference specific documentation files directly
- ✅ Use documented procedures immediately

## CRITICAL: Review Required Documentation

**IMPORTANT**: Before starting any work, you MUST review these core files:

1. **📋 `/docs/INSTRUCTIONS.md`** - Core development instructions
2. **🔄 `/docs/WORKFLOW.md`** - Required workflow processes
3. **📊 `/docs/PROJECT.md`** - Project specifications and requirements
4. **🔧 `/docs/TOOLCHAIN.md`** - Technical implementation and toolchain guide
5. **💾 `/docs/JSON-STORAGE.md`** - JSON file storage architecture and data management

**Following these instructions is MANDATORY. Ask for clarification before considering ANY variance from the documented procedures.**

## ⚠️ YOLO Mode Requirements

**CRITICAL**: When working in YOLO mode, you MUST:

1. **Always work from a TrackDown task** in a properly named branch tied to that task
2. **Follow proper epic/subticket workflow** for complex work (documentation epics, feature development)
3. **Link all to-dos and action items** back to TrackDown ticket tasks
4. **Validate against code as source of truth** - assume source code is correct when documentation conflicts arise

## 📚 Documentation Navigation

### 🔧 Core Development

- [`/docs/INSTRUCTIONS.md`](/docs/INSTRUCTIONS.md) - Development instructions
- [`/docs/WORKFLOW.md`](/docs/WORKFLOW.md) - Required workflow processes
- [`/docs/PROJECT.md`](/docs/PROJECT.md) - Project specifications
- [`/docs/TOOLCHAIN.md`](/docs/TOOLCHAIN.md) - Technical implementation and toolchain guide
- [`/docs/TESTING.md`](/docs/TESTING.md) - Testing strategy and procedures
- [`/docs/LINTING-STANDARDS.md`](/docs/LINTING-STANDARDS.md) - Code quality standards

### 💾 Data & Storage

- [`/docs/JSON-STORAGE.md`](/docs/JSON-STORAGE.md) - JSON file storage system
- [`/docs/CACHE.md`](/docs/CACHE.md) - Cache generation and static JSON management
- [`/docs/BACKUP-RECOVERY.md`](/docs/BACKUP-RECOVERY.md) - Data backup and recovery procedures

### 🌐 Features & Systems

- [`/docs/NEWS-INGESTION.md`](/docs/NEWS-INGESTION.md) - News article ingestion from Google Drive
- [`/docs/TRANSLATIONS.md`](/docs/TRANSLATIONS.md) - Internationalization (i18n) guide
- [`/docs/RANKINGS-JUNE-2025.md`](/docs/RANKINGS-JUNE-2025.md) - Current rankings data

### 🚀 Operations & Deployment

- [`/docs/DEPLOYMENT-GUIDE.md`](/docs/DEPLOYMENT-GUIDE.md) - Comprehensive deployment procedures
- [`/docs/SITEMAP-SUBMISSION.md`](/docs/SITEMAP-SUBMISSION.md) - SEO and sitemap management
- [`/docs/PERFORMANCE-OPTIMIZATION.md`](/docs/PERFORMANCE-OPTIMIZATION.md) - Performance optimization strategies

### 🔍 Troubleshooting & Maintenance

- [`/docs/TROUBLESHOOTING-RANKINGS.md`](/docs/TROUBLESHOOTING-RANKINGS.md) - Rankings troubleshooting
- [`/docs/I18N-DEBUGGING.md`](/docs/I18N-DEBUGGING.md) - Translation debugging
- [`/docs/RATE-LIMITING.md`](/docs/RATE-LIMITING.md) - API rate limiting strategies

### 📖 Reference & Guides

- [`/docs/design/claude-code-best-practices.md`](/docs/design/claude-code-best-practices.md) - Claude Code best practices
- [`/docs/TOOL-MAPPING.md`](/docs/TOOL-MAPPING.md) - Tool mapping documentation
- [`/docs/METRICS-GUIDELINES.md`](/docs/METRICS-GUIDELINES.md) - Metrics extraction guidelines

## Development Guidelines

- **CRITICAL**: Always run `pnpm run ci:local` before committing to catch TypeScript errors
- Use `pnpm run pre-deploy` before any deployment to ensure code quality
- Follow existing code patterns and conventions
- **NEVER deviate from documented instructions without explicit approval**
- **Code as Source of Truth**: Documentation must reflect current source code state
- **Task Linkage**: All development work must be linked to TrackDown tickets

## Pre-Deployment Checklist

Before pushing to production, ALWAYS run:

```bash
pnpm run pre-deploy  # Runs lint, type-check, format-check, and tests
```

This prevents deployment failures due to TypeScript errors or code quality issues.

## Quick Reference

### Common Commands

```bash
# Development (with PM2 process management)
pnpm run dev:pm2 start   # Start dev server with PM2
pnpm run dev:pm2 logs    # View server logs
pnpm run dev:pm2 restart # Restart server
pnpm run dev:pm2 stop    # Stop server
pnpm run dev:pm2 status  # Check server status

# Alternative Development Commands
pnpm dev              # Start dev server (clears Next.js cache)
pnpm dev:no-cache-clear  # Start without cache clear
pnpm run dev:server   # Start with simple server script

# Quality Checks
pnpm run ci:local      # Run all checks locally
pnpm run lint          # Check code style
pnpm run type-check    # Check TypeScript
pnpm run test          # Run tests

# Cache Management
pnpm run cache:generate   # Generate all cache files
pnpm run cache:rankings   # Generate rankings cache
pnpm run cache:tools      # Generate tools cache
pnpm run cache:news       # Generate news cache

# Data Management
pnpm run validate:all     # Validate JSON files
pnpm run backup:create    # Create data backup
```

### AI Assistant Development Workflow

After completing any task:

1. Restart dev server: `pnpm run dev:pm2 restart`
2. Monitor logs: `pnpm run dev:pm2 logs`
3. Check types: `pnpm run type-check`
4. Run lint: `pnpm run lint`

### Key Directories

- `/src/app` - Next.js App Router pages
- `/src/components` - React components
- `/src/lib` - Core utilities and services
- `/data/json` - Primary JSON data storage
- `/src/data/cache` - Generated cache files
- `/docs` - Project documentation

### Environment Variables

Always use bracket notation for environment variables:

```typescript
// ✅ CORRECT
process.env["GITHUB_TOKEN"];

// ❌ WRONG
process.env.GITHUB_TOKEN;
```
