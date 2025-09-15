# AI Power Rankings - Claude Code Configuration

## 🎯 Priority Index

**Critical Actions for Claude Code & AI Assistants**

### 🔴 CRITICAL - Must Do First
- **Review Required Documentation**: [`/REPOSITORY-STRUCTURE.md`](/REPOSITORY-STRUCTURE.md) → [`/docs/INSTRUCTIONS.md`](/docs/INSTRUCTIONS.md) → [`/docs/WORKFLOW.md`](/docs/WORKFLOW.md)
- **Link to TrackDown Tickets**: All work must reference local `trackdown/` tasks
- **Use Single-Path Commands**: Only ONE way to perform each operation (see below)
- **Run Pre-Checks**: `pnpm run ci:local` before ANY commit

### 🟡 IMPORTANT - Core Operations
- **Development**: `pnpm run dev:pm2 start` (THE way to develop)
- **Quality Check**: `pnpm run ci:local` (THE way to validate code)
- **Deployment**: `pnpm run pre-deploy && vercel deploy` (THE way to deploy)
- **Cache Generation**: `pnpm run cache:generate` (THE way to update caches)

### 🟢 STANDARD - Daily Operations
- **Testing**: `pnpm run test` (THE way to run tests)
- **Linting**: `pnpm run lint` (THE way to check code style)
- **Type Checking**: `pnpm run type-check` (THE way to validate types)
- **Data Backup**: `pnpm run backup:create` (THE way to backup data)

### ⚪ OPTIONAL - Additional Tools
- **Performance Monitoring**: `pnpm run perf:audit`
- **Bundle Analysis**: `pnpm run analyze`
- **API Testing**: `pnpm run test:api:all`

## 🏗️ Project Overview

**Next.js 15 web application** providing AI power rankings and news aggregation with comprehensive data management and multilingual support.

**Tech Stack**: Next.js 15, TypeScript, Tailwind CSS, JSON file-based storage, Vercel deployment

**Development Server**: The AI Power Rankings development server runs on **port 3001** as the designated development port.

## 🎯 Single-Path Standards (ONE Way to Do ANYTHING)

### Development Commands
```bash
# THE way to start development (runs on port 3001)
pnpm run dev:pm2 start

# Access the development site at:
# http://localhost:3001

# THE way to check code quality
pnpm run ci:local

# THE way to build for production
pnpm run build

# THE way to deploy
pnpm run pre-deploy && vercel deploy
```

### Project Navigation Commands
```bash
# Check backlog
ls trackdown/

# View workflow
cat docs/WORKFLOW.md

# Check deployment guide
cat docs/DEPLOYMENT-GUIDE.md
```

## 🔴 CRITICAL: Review Required Documentation

**MANDATORY**: Before ANY work, review in this order:

1. **📁 [`/REPOSITORY-STRUCTURE.md`](/REPOSITORY-STRUCTURE.md)** - Project organization
2. **📋 [`/docs/INSTRUCTIONS.md`](/docs/INSTRUCTIONS.md)** - Core development rules
3. **🔄 [`/docs/WORKFLOW.md`](/docs/WORKFLOW.md)** - Required processes
4. **📊 [`/docs/PROJECT.md`](/docs/PROJECT.md)** - Project specifications
5. **🔧 [`/docs/TOOLCHAIN.md`](/docs/TOOLCHAIN.md)** - Technical implementation
6. **💾 [`/docs/JSON-STORAGE.md`](/docs/JSON-STORAGE.md)** - Data architecture

**Following these is MANDATORY. No exceptions without explicit approval.**

## 📚 Documentation Navigation (By Priority)

### 🔴 CRITICAL - Start Here
- [`/REPOSITORY-STRUCTURE.md`](/REPOSITORY-STRUCTURE.md) - Project organization (READ FIRST)
- [`/docs/INSTRUCTIONS.md`](/docs/INSTRUCTIONS.md) - Development rules (READ SECOND)
- [`/docs/WORKFLOW.md`](/docs/WORKFLOW.md) - Required processes (READ THIRD)
- [`/docs/PROJECT.md`](/docs/PROJECT.md) - Project specifications
- [`/docs/TOOLCHAIN.md`](/docs/TOOLCHAIN.md) - Technical implementation guide
- [`/docs/JSON-STORAGE.md`](/docs/JSON-STORAGE.md) - Data architecture

### 🟡 IMPORTANT - Core Systems
- [`/docs/DEPLOYMENT-GUIDE.md`](/docs/DEPLOYMENT-GUIDE.md) - Deployment procedures (THE way to deploy)
- [`/docs/TESTING.md`](/docs/TESTING.md) - Testing strategy (THE way to test)
- [`/docs/CACHE.md`](/docs/CACHE.md) - Cache generation (THE way to cache)
- [`/docs/BACKUP-RECOVERY.md`](/docs/BACKUP-RECOVERY.md) - Data backup (THE way to backup)
- [`/docs/LINTING-STANDARDS.md`](/docs/LINTING-STANDARDS.md) - Code quality standards

### 🟢 STANDARD - Features & Operations
- [`/docs/NEWS-INGESTION.md`](/docs/NEWS-INGESTION.md) - News article ingestion
- [`/docs/TRANSLATIONS.md`](/docs/TRANSLATIONS.md) - Internationalization guide
- [`/docs/RANKINGS-JUNE-2025.md`](/docs/RANKINGS-JUNE-2025.md) - Current rankings
- [`/docs/PERFORMANCE-OPTIMIZATION.md`](/docs/PERFORMANCE-OPTIMIZATION.md) - Performance optimization
- [`/docs/SITEMAP-SUBMISSION.md`](/docs/SITEMAP-SUBMISSION.md) - SEO management

### ⚪ OPTIONAL - Troubleshooting & Reference
- [`/docs/TROUBLESHOOTING-RANKINGS.md`](/docs/TROUBLESHOOTING-RANKINGS.md) - Rankings troubleshooting
- [`/docs/I18N-DEBUGGING.md`](/docs/I18N-DEBUGGING.md) - Translation debugging
- [`/docs/RATE-LIMITING.md`](/docs/RATE-LIMITING.md) - API rate limiting
- [`/docs/TOOL-MAPPING.md`](/docs/TOOL-MAPPING.md) - Tool mapping documentation
- [`/docs/METRICS-GUIDELINES.md`](/docs/METRICS-GUIDELINES.md) - Metrics extraction
- [`/docs/design/claude-code-best-practices.md`](/docs/design/claude-code-best-practices.md) - Claude Code best practices

## 🔴 CRITICAL Development Rules

**NEVER BREAK THESE RULES:**

1. **🎯 Single-Path Principle**: Use ONLY the documented commands (ONE way to do ANYTHING)
2. **📋 TrackDown Linkage**: ALL work must reference `trackdown/` tickets  
3. **✅ Pre-Commit Checks**: Run `pnpm run ci:local` before ANY commit
4. **📖 Documentation First**: Review required docs before starting work
5. **💻 Code as Truth**: When docs conflict with code, code is correct

## 🟡 IMPORTANT Development Guidelines

**Always Follow:**
- Use `pnpm run pre-deploy` before deployment (THE way to deploy)
- Follow existing code patterns and conventions
- Use bracket notation for environment variables: `process.env["VAR_NAME"]`
- Never deviate from documented instructions without explicit approval

## 🟢 STANDARD Pre-Deployment Checklist

**THE deployment process:**

```bash
# THE way to prepare for deployment
pnpm run pre-deploy  # Runs lint, type-check, format-check, and tests

# THE way to deploy
vercel deploy
```

This prevents deployment failures due to TypeScript errors or code quality issues.

## ⚡ Quick Reference (Single-Path Commands)

### 🔴 CRITICAL - Essential Commands

```bash
# THE way to develop (PM2 process management on port 3001)
pnpm run dev:pm2 start   # Start dev server on port 3001 (THE ONLY WAY)
pnpm run dev:pm2 logs    # View server logs
pnpm run dev:pm2 restart # Restart server
pnpm run dev:pm2 stop    # Stop server

# Access development site at:
# http://localhost:3001

# THE way to validate code before commit
pnpm run ci:local        # Run all checks (THE ONLY WAY)

# THE way to deploy
pnpm run pre-deploy      # Pre-deployment validation (THE ONLY WAY)
```

### 🟡 IMPORTANT - Core Operations

```bash
# Quality Checks (individual tools)
pnpm run lint           # Check code style
pnpm run type-check     # Check TypeScript
pnpm run test           # Run tests

# Cache Management  
pnpm run cache:generate # Generate all cache files (THE way)
```

### 🟢 STANDARD - Data & Build Operations

```bash
# Data Management
pnpm run validate:all   # Validate JSON files
pnpm run backup:create  # Create data backup

# Build Operations
pnpm run build         # Build for production

# Specific Cache Operations
pnpm run cache:rankings # Generate rankings cache only
pnpm run cache:tools    # Generate tools cache only
pnpm run cache:news     # Generate news cache only
```

### ⚪ OPTIONAL - Alternative/Legacy Commands (Use Only When Necessary)

```bash
# Alternative Development (NOT RECOMMENDED - use dev:pm2)
pnpm dev                # Start dev server (clears cache) 
pnpm dev:no-cache-clear # Start without cache clear
pnpm run dev:server     # Simple server script
```

## 🔄 AI Assistant Development Workflow

**THE workflow after completing any task:**

```bash
# 1. THE way to validate your work
pnpm run ci:local

# 2. THE way to restart development (if needed)
pnpm run dev:pm2 restart

# 3. THE way to monitor (if needed)
pnpm run dev:pm2 logs
```

## 📁 Key Directories (By Priority)

### 🔴 CRITICAL - Core Application
- `/src/app` - Next.js App Router pages (THE app structure)
- `/src/lib` - Core utilities and services (THE business logic)
- `/data/json` - Primary JSON data storage (THE data source)

### 🟡 IMPORTANT - Components & Cache  
- `/src/components` - React components (THE UI components)
- `/src/data/cache` - Generated cache files (THE performance layer)

### 🟢 STANDARD - Documentation & Scripts
- `/docs` - Project documentation (THE knowledge base)
- `/scripts` - Build and utility scripts (THE automation)

## 🔧 Code Standards

### Environment Variables
**THE way to access environment variables:**

```typescript
// ✅ CORRECT (THE ONLY WAY)
process.env["GITHUB_TOKEN"];

// ❌ WRONG (NEVER USE)
process.env.GITHUB_TOKEN;
```

## 🤖 Claude-MPM Multi-Agent Configuration

**Multi-agent system for specialized task handling with TrackDown integration**

### 🔴 CRITICAL - Agent Rules

**ALWAYS:**
1. **📋 Reference TrackDown tickets** in all agent requests: `@engineer "Task description (TSK-123)"`
2. **🎯 Single responsibility** - One clear task per agent request
3. **🔗 Explicit handoffs** - Clear transitions between agents
4. **💾 Update memories** - Agents learn from each task

### 🟡 IMPORTANT - Available Agents

| Agent | Primary Focus | Use When |
|-------|--------------|----------|
| **Engineer** | Clean architecture, SOLID principles | Feature implementation, refactoring |
| **QA** | Testing, validation, quality assurance | Test creation, bug verification |
| **Research** | Investigation, documentation, analysis | Technical research, documentation updates |
| **Ops** | Deployment, infrastructure, monitoring | Deployment tasks, performance optimization |
| **Version Control** | Git operations, branching, PR management | Commits, merges, release management |

### 🟢 STANDARD - Task Assignment Patterns

**THE workflows for multi-agent tasks:**

```bash
# Feature Development (THE way)
@engineer "Implement feature X (TSK-123)"
@qa "Write tests for feature X (TSK-123)"
@version-control "Create PR for feature X (TSK-123)"

# Bug Fix (THE way)
@qa "Reproduce bug Y (TSK-456)"
@engineer "Fix bug Y (TSK-456)"
@qa "Verify fix for bug Y (TSK-456)"

# Documentation (THE way)
@research "Analyze Z patterns (TSK-789)"
@engineer "Update docs based on findings (TSK-789)"
```

### ⚪ OPTIONAL - Memory Management

- **Location**: `.claude-mpm/memories/[agent]_memories.md`
- **Auto-updated**: Agents update memories after significant learnings
- **Manual edits**: Developers can edit memory files for accuracy
- **Size limits**: 8KB per file, auto-truncates when exceeded

**Check memories:**
```bash
ls .claude-mpm/memories/
cat .claude-mpm/memories/engineer_memories.md
```

**Detailed setup**: [`/docs/CLAUDE-MPM-SETUP.md`](/docs/CLAUDE-MPM-SETUP.md)

---

## 🎯 Meta-Instructions for CLAUDE.md Maintenance

**For future updates to this file:**

1. **🔴 CRITICAL items MUST remain at top** - Most important for agentic coders
2. **🎯 Single-Path Principle** - Only ONE way documented for each operation
3. **📋 Priority Organization** - Always organize by 🔴🟡🟢⚪ priority levels
4. **🔗 Link Validation** - All documentation links must remain functional
5. **💫 Memory Integration** - Update agent memories when major changes are made

**This file is THE source of truth for Claude Code configuration and MUST be kept current with project reality.**
