# Claude Code Instructions

## CRITICAL: Review Required Documentation

**IMPORTANT**: Before starting any work, you MUST review these files:

1. `/docs/INSTRUCTIONS.md` - Core development instructions
2. `/docs/WORKFLOW.md` - Required workflow processes
3. `/docs/PROJECT.md` - Project specifications and requirements
4. `/docs/DATABASE.md` - Database connection, schema, and manipulation guide

**Following these instructions is MANDATORY. Ask for clarification before considering ANY variance from the documented procedures.**

## Additional Documentation

### Content Management
- `/docs/PAYLOAD.md` - Payload CMS developer guide for managing content
- `/docs/PAYLOAD-CMS-API.md` - API reference for Claude Desktop integration

### Features & Systems
- `/docs/CACHE.md` - Cache-first architecture and static JSON management
- `/docs/NEWS-INGESTION.md` - News article ingestion from Google Drive
- `/docs/TRANSLATIONS.md` - Internationalization (i18n) guide

### Operations
- `/docs/DEPLOYMENT.md` - Vercel deployment procedures
- `/docs/SITEMAP-SUBMISSION.md` - SEO and sitemap management
- `/docs/RANKINGS-JUNE-2025.md` - Current rankings data

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
# Development
pnpm dev              # Start dev server (clears Next.js cache)
pnpm dev:no-cache-clear  # Start without cache clear

# Quality Checks
npm run ci:local      # Run all checks locally
npm run lint          # Check code style
npm run type-check    # Check TypeScript
npm run test          # Run tests

# Cache Management
npm run cache:generate   # Generate all cache files
npm run cache:rankings   # Generate rankings cache
npm run cache:tools      # Generate tools cache
npm run cache:news       # Generate news cache

# Database
npm run db:seed          # Seed database
npm run db:generate-types # Generate TypeScript types
```

### Key Directories
- `/src/app` - Next.js App Router pages
- `/src/components` - React components
- `/src/lib` - Core utilities and services
- `/src/collections` - Payload CMS collections
- `/src/data/cache` - Static JSON cache files
- `/docs` - Project documentation

### Environment Variables
Always use bracket notation for environment variables:
```typescript
// ✅ CORRECT
process.env["NEXT_PUBLIC_SUPABASE_URL"]

// ❌ WRONG
process.env.NEXT_PUBLIC_SUPABASE_URL
```