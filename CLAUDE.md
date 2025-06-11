# Claude Code Instructions

## CRITICAL: Review Required Documentation

**IMPORTANT**: Before starting any work, you MUST review these files:

1. `/docs/INSTRUCTIONS.md` - Core development instructions
2. `/docs/WORKFLOW.md` - Required workflow processes
3. `/docs/PROJECT.md` - Project specifications and requirements (if exists)
4. `/docs/DATABASE.md` - Database connection, schema, and manipulation guide

**Following these instructions is MANDATORY. Ask for clarification before considering ANY variance from the documented procedures.**

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
