# AI Power Rankings - Claude Code Configuration

## Project Overview

This is a Next.js web application that provides AI power rankings and news aggregation, showcasing the latest developments in AI technology with comprehensive data management and multilingual support.

### Project Navigation

When user asks:
- "What's on the backlog?" → "Check local `trackdown/` directory for current tasks"
- "What tasks remain?" → "Check local `trackdown/` directory for remaining work"  
- "What's the workflow?" → "See /docs/WORKFLOW.md for workflow processes"
- "How do I deploy?" → "See /docs/DEPLOYMENT-GUIDE.md"

### Development Guidelines

**DO:**
- ✅ Use local trackdown system for task management
- ✅ Use local docs/ for project-specific information
- ✅ Link commits to local project tickets
- ✅ Reference specific documentation files directly
- ✅ Use documented procedures immediately

## CRITICAL: Review Required Documentation

**IMPORTANT**: Before starting any work, you MUST review these core files:

1. **📁 `/REPOSITORY-STRUCTURE.md`** - Complete repository organization guide
2. **📋 `/docs/INSTRUCTIONS.md`** - Core development instructions
3. **🔄 `/docs/WORKFLOW.md`** - Required workflow processes
4. **📊 `/docs/PROJECT.md`** - Project specifications and requirements
5. **🔧 `/docs/TOOLCHAIN.md`** - Technical implementation and toolchain guide
6. **💾 `/docs/JSON-STORAGE.md`** - JSON file storage architecture and data management

**Following these instructions is MANDATORY. Ask for clarification before considering ANY variance from the documented procedures.**

## ⚠️ Development Requirements

**CRITICAL**: When working on this project, you MUST:

1. **Always work from a local task** in a properly named branch tied to that task
2. **Follow proper structured workflow** for complex work (documentation epics, feature development)
3. **Link all to-dos and action items** back to local project tasks
4. **Validate against code as source of truth** - assume source code is correct when documentation conflicts arise

## 📚 Documentation Navigation

### 🏗️ Repository Organization

- [`/REPOSITORY-STRUCTURE.md`](/REPOSITORY-STRUCTURE.md) - Complete repository layout and organization
- [`/docs/archive/2025-01-cleanup/CLEANUP-SUMMARY.md`](/docs/archive/2025-01-cleanup/CLEANUP-SUMMARY.md) - Recent cleanup operations

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

## 🤖 Claude-MPM Multi-Agent Configuration

### Agent System Overview

This project uses Claude-MPM's multi-agent system for specialized task handling. Each agent has specific responsibilities and expertise areas.

### Available Agents

| Agent | Primary Focus | When to Use |
|-------|--------------|-------------|
| **Engineer** | Clean architecture, code reduction, SOLID principles | Feature implementation, refactoring, architecture decisions |
| **QA** | Testing, validation, quality assurance | Test creation, bug verification, quality checks |
| **Research** | Investigation, documentation, analysis | Technical research, documentation updates, dependency analysis |
| **Ops** | Deployment, infrastructure, monitoring | Deployment tasks, CI/CD, performance optimization |
| **Version Control** | Git operations, branching, PR management | Commits, merges, release management |

### Agent Delegation Guidelines

**IMPORTANT**: When working with multiple agents:

1. **Start with the right agent** - Choose based on primary task type
2. **Use explicit handoffs** - Be clear when switching between agents
3. **Maintain context** - Reference TrackDown tickets in all agent work
4. **Update memories** - Agents learn from each task for future improvements

### Memory Management

- **Location**: `.claude-mpm/memories/[agent]_memories.md`
- **Auto-updated**: Agents update their memories after significant learnings
- **Manual edits**: Developers can edit memory files for accuracy
- **Size limits**: 8KB per file, auto-truncates when exceeded

### Task Assignment Patterns

```bash
# Feature Development Flow
@engineer "Implement new ranking algorithm feature (TSK-123)"
@qa "Write tests for ranking algorithm"
@version-control "Create PR for ranking feature"

# Bug Fix Flow  
@qa "Reproduce bug TSK-456 in rankings display"
@engineer "Fix rankings display bug"
@qa "Verify fix and update tests"

# Documentation Flow
@research "Analyze current API usage patterns"
@engineer "Update API documentation based on findings"
```

### Integration with TrackDown

**CRITICAL**: All agent work MUST reference TrackDown tickets:

1. Include ticket ID in initial request to agent
2. Agents will link commits to tickets automatically
3. Use ticket branches for all development work
4. Update ticket status through agent commands

### Best Practices

1. **Single Responsibility**: Give each agent one clear task at a time
2. **Context Preservation**: Include ticket IDs and relevant file paths
3. **Memory Updates**: Allow agents to update memories for learnings
4. **Validation Steps**: Use QA agent to verify all changes
5. **Documentation**: Update docs through Research agent findings

### Quick Reference

```bash
# Check agent memories
ls .claude-mpm/memories/

# View agent configuration
cat .claude-mpm/config/agents.json

# Review Claude-MPM setup
cat docs/CLAUDE-MPM-SETUP.md
```

For detailed multi-agent setup and configuration, see [`/docs/CLAUDE-MPM-SETUP.md`](/docs/CLAUDE-MPM-SETUP.md).
