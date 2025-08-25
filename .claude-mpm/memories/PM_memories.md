# Project Manager Memory - AI Power Rankings

<!-- MEMORY LIMITS: 8KB max | 10 sections max | 15 items per section -->
<!-- Last Updated: 2025-08-25 | Role: Project Manager -->

## Project Overview
- **Name**: AI Power Rankings
- **Type**: Next.js web application
- **Purpose**: AI technology rankings and news aggregation
- **Stack**: Next.js 14, TypeScript, React, Tailwind CSS
- **Database**: JSON file-based storage
- **Deployment**: Vercel
- **Task System**: Local TrackDown in `/trackdown/`

## Recent Project Updates
- **August 2025 Cleanup**: Consolidated API routes, reduced code by 30%
- **News System**: Expanded collection with 13 new articles for August 2025
- **Algorithm**: Updated to v7.1 for improved ranking calculations
- **Task Management**: Migrated from Notion to local TrackDown system
- **Memory System**: Implemented Claude-MPM for multi-agent coordination

## Critical Workflows
- **Development**: Feature branch → PR → Review → Main
- **Testing**: type-check → lint → test → ci:local
- **Deployment**: pre-deploy → build → cache:generate → deploy
- **News Ingestion**: Validate → Backup → Ingest → Test → Cache
- **Rankings Update**: Calculate → Validate → Cache → Deploy

## Active Priorities
1. Maintain code quality (TypeScript strict mode)
2. Ensure data integrity (JSON validation)
3. Optimize performance (cache generation)
4. Regular news updates (monthly ingestion)
5. Accurate rankings (Algorithm v7.1)

## Team Coordination
- **Engineer**: Implementation and architecture
- **QA**: Testing and validation
- **Research**: Documentation and analysis
- **Ops**: Deployment and monitoring
- **Version Control**: Git and release management

## Key Metrics
- **Code Coverage**: Target 80%+
- **Build Time**: Under 2 minutes
- **Type Safety**: 100% (no any types)
- **File Size**: Max 800 lines (ideal 400)
- **Performance**: Lighthouse score 90+

## Risk Management
- **Data Loss**: Daily backups, version control
- **Type Errors**: Pre-commit validation
- **Deployment Failures**: Staging environment testing
- **Breaking Changes**: Feature flags, gradual rollout

## Communication Patterns
- **Handoffs**: Include ticket ID, changes, summary, next steps
- **Commits**: Link to TrackDown tickets (TSK-XXX)
- **PRs**: Comprehensive description with test plan
- **Documentation**: Update immediately after changes

## Resource Locations
- **Documentation**: `/docs/` directory
- **Task Tracking**: `/trackdown/` directory
- **Data Storage**: `/data/json/` directory
- **Cache Files**: `/src/data/cache/` directory
- **Configurations**: `/.claude-mpm/config/` directory

## Decision Log
- **2025-08**: Adopted local TrackDown for task management
- **2025-08**: Implemented Claude-MPM for agent coordination
- **2025-08**: Consolidated API routes for maintainability
- **2025-08**: Standardized on JSON file storage
- **2025-07**: Upgraded to Algorithm v7.1