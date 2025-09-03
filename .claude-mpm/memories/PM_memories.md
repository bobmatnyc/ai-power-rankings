# Project Manager Memory - AI Power Rankings

<!-- MEMORY LIMITS: 8KB max | 10 sections max | 15 items per section -->
<!-- Last Updated: 2025-08-25 | Role: Project Manager -->

## Project Overview
- **Name**: AI Power Rankings
- **Type**: Next.js 15 web application
- **Purpose**: AI technology rankings and news aggregation with multilingual support
- **Stack**: Next.js 15, TypeScript, React, Tailwind CSS, JSON file storage
- **Deployment**: Vercel
- **Task System**: Local TrackDown in `/trackdown/`
- **Principle**: Single-Path Standards (ONE way to do ANYTHING)

## Recent Project Updates
- **September 2025**: Claude Code optimization with priority-based organization
- **August 2025**: Consolidated API routes, reduced code by 30%
- **News System**: Expanded collection with 13 new articles for August 2025
- **Algorithm**: Updated to v7.1 for improved ranking calculations
- **Documentation**: Implemented priority-based CLAUDE.md (🔴🟡🟢⚪)
- **Single-Path Standards**: Established THE ONE way for all operations

## 🔴 CRITICAL Workflows (Single-Path)
- **Development**: `pnpm run dev:pm2 start` (THE way to develop)
- **Quality Check**: `pnpm run ci:local` (THE way to validate)
- **Deployment**: `pnpm run pre-deploy && vercel deploy` (THE way to deploy)
- **Cache Generation**: `pnpm run cache:generate` (THE way to cache)
- **Data Backup**: `pnpm run backup:create` (THE way to backup)

## Active Priorities (By Priority Level)
### 🔴 CRITICAL
1. Enforce single-path standards (ONE way to do anything)
2. Link all work to TrackDown tickets (mandatory)
3. Run `pnpm run ci:local` before ANY commit
4. Follow priority-based documentation order

### 🟡 IMPORTANT  
5. Maintain TypeScript quality (fix 300+ lint issues)
6. Ensure data integrity (JSON validation)
7. Optimize performance (cache generation)

### 🟢 STANDARD
8. Regular news updates (monthly ingestion)
9. Accurate rankings (Algorithm v7.1)
10. Documentation maintenance

## Team Coordination (Single-Path)
- **Engineer**: `@engineer "task description (TSK-XXX)"` - Implementation
- **QA**: `@qa "validation task (TSK-XXX)"` - Testing and validation  
- **Research**: `@research "analysis task (TSK-XXX)"` - Documentation
- **Ops**: `@ops "deployment task (TSK-XXX)"` - Infrastructure
- **Version Control**: `@version-control "git task (TSK-XXX)"` - Git ops

## Key Metrics & Quality Gates
- **Linting**: 320+ issues to fix (75 errors, 245 warnings)
- **Type Safety**: CRITICAL - Remove all `any` types (currently many)
- **Build Time**: Under 2 minutes (currently working)
- **Performance**: Lighthouse score 90+
- **Code Coverage**: Target 80%+

## Tool Configurations (Working)
- **Biome**: biome.json configured for linting/formatting
- **TypeScript**: tsconfig.json with strict mode
- **Package Manager**: pnpm (not npm/yarn)
- **Husky**: Pre-commit hooks configured
- **Vitest**: Testing framework configured

## Risk Management (Priority-Based)
### 🔴 CRITICAL Risks
- **Type Errors**: Many `any` types need fixing
- **Single-Path Violations**: Multiple ways to do same tasks
- **Documentation Drift**: Docs not matching reality

### 🟡 IMPORTANT Risks  
- **Data Loss**: Daily backups, version control
- **Deployment Failures**: Use staging validation
- **Breaking Changes**: Feature flags, gradual rollout

## Resource Locations (By Priority)
### 🔴 CRITICAL
- **CLAUDE.md**: Project configuration (priority-organized)
- **TrackDown**: `/trackdown/` directory (task management)
- **Core Docs**: `/docs/INSTRUCTIONS.md`, `/docs/WORKFLOW.md`

### 🟡 IMPORTANT
- **Data**: `/data/json/` directory (primary storage)
- **Cache**: `/src/data/cache/` directory (performance)
- **Memory**: `/.claude-mpm/memories/` (agent knowledge)

## Decision Log
- **2025-09**: Implemented single-path standards and priority organization
- **2025-08**: Adopted local TrackDown for task management
- **2025-08**: Implemented Claude-MPM for agent coordination
- **2025-08**: Consolidated API routes for maintainability