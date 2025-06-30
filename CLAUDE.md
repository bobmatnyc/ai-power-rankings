# Claude Code Instructions

## CRITICAL: Review Required Documentation

**IMPORTANT**: Before starting any work, you MUST review these files:

1. `/docs/INSTRUCTIONS.md` - Core development instructions
2. `/docs/WORKFLOW.md` - Required workflow processes
3. `/docs/PROJECT.md` - Project specifications and requirements
4. `/docs/JSON-STORAGE.md` - JSON file storage architecture and data management
5. `/docs/MEMORY.md` - Memory system access

**Following these instructions is MANDATORY. Ask for clarification before considering ANY variance from the documented procedures.**

## Additional Documentation

### Data Management
- `/docs/JSON-STORAGE.md` - JSON file storage system documentation

### Features & Systems
- `/docs/CACHE.md` - Cache generation and static JSON management
- `/docs/NEWS-INGESTION.md` - News article ingestion from Google Drive
- `/docs/TRANSLATIONS.md` - Internationalization (i18n) guide

### Operations
- `/docs/DEPLOYMENT.md` - Vercel deployment procedures
- `/docs/JSON-DEPLOYMENT-GUIDE.md` - JSON system deployment guide
- `/docs/SITEMAP-SUBMISSION.md` - SEO and sitemap management
- `/docs/RANKINGS-JUNE-2025.md` - Current rankings data
- `/docs/TESTING.md` - Testing strategy and procedures
- `/docs/BACKUP-RECOVERY.md` - Data backup and recovery procedures
- `/docs/PERFORMANCE-OPTIMIZATION.md` - Performance optimization strategies

## Development Guidelines

- **CRITICAL**: Always run `npm run ci:local` before committing to catch TypeScript errors
- Use `npm run pre-deploy` before any deployment to ensure code quality
- Follow existing code patterns and conventions
- **NEVER deviate from documented instructions without explicit approval**

## Pre-Deployment Checklist

Before pushing to production, ALWAYS run:

```bash
npm run pre-deploy  # Runs lint, type-check, format-check, and tests
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
process.env["GITHUB_TOKEN"]

// ❌ WRONG
process.env.GITHUB_TOKEN
```