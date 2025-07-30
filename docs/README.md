# 📚 AI Power Rankings - Documentation Index

Welcome to the AI Power Rankings documentation! This guide helps you navigate the comprehensive documentation for this project.

## 🚀 Quick Start - Hub Architecture

**New to the project?** Use these four main hubs for navigation:

1. **📋 [INSTRUCTIONS.md](INSTRUCTIONS.md)** - Core development instructions and technical guidance
2. **🔄 [WORKFLOW.md](WORKFLOW.md)** - Build/refactor/deploy processes and YOLO mode requirements
3. **📊 [PROJECT.md](PROJECT.md)** - Business goals, functionality, and strategic direction
4. **🔧 [TOOLCHAIN.md](TOOLCHAIN.md)** - Comprehensive toolchain mastery and technical configuration

## 🔗 Key Entry Points

- **[../CLAUDE.md](../CLAUDE.md)** - Project context and task linkage requirements for AI assistants
- **[../REPOSITORY-STRUCTURE.md](../REPOSITORY-STRUCTURE.md)** - Complete repository organization and layout guide

## ⚡ 2-Click Accessibility

All daily-use information is accessible within 2 clicks from these main hub files. Each hub serves as a navigation center with quick reference sections and detailed linking.

## 📁 Documentation Categories

### 🔧 Core Development

Essential files for developers working on the project:

- **[INSTRUCTIONS.md](INSTRUCTIONS.md)** - Development setup and core instructions
- **[WORKFLOW.md](WORKFLOW.md)** - Required development workflow processes
- **[PROJECT.md](PROJECT.md)** - Project specifications and requirements
- **[TESTING.md](TESTING.md)** - Testing strategy and procedures
- **[LINTING-STANDARDS.md](LINTING-STANDARDS.md)** - Code quality and linting standards

### 💾 Data & Storage

Data management, storage, and caching systems:

- **[JSON-STORAGE.md](JSON-STORAGE.md)** - JSON file storage architecture
- **[CACHE.md](CACHE.md)** - Cache generation and static JSON management
- **[BACKUP-RECOVERY.md](BACKUP-RECOVERY.md)** - Data backup and recovery procedures

### 🌐 Features & Systems

Application features and system integrations:

- **[NEWS-INGESTION.md](NEWS-INGESTION.md)** - News article ingestion from Google Drive
- **[TRANSLATIONS.md](TRANSLATIONS.md)** - Internationalization (i18n) implementation
- **[RANKINGS-JUNE-2025.md](RANKINGS-JUNE-2025.md)** - Current rankings data and methodology
- **[METRICS-GUIDELINES.md](METRICS-GUIDELINES.md)** - Scoring criteria and metrics definitions
- **[ARTICLE-INGESTION.md](ARTICLE-INGESTION.md)** - Article processing and data extraction

### 🚀 Operations & Deployment

Deployment, hosting, and operational procedures:

- **[DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md)** - Comprehensive deployment procedures
- **[SITEMAP-SUBMISSION.md](SITEMAP-SUBMISSION.md)** - SEO and sitemap management
- **[PERFORMANCE-OPTIMIZATION.md](PERFORMANCE-OPTIMIZATION.md)** - Performance optimization strategies

### 🔍 Troubleshooting & Maintenance

Debugging, troubleshooting, and maintenance guides:

- **[TROUBLESHOOTING-RANKINGS.md](TROUBLESHOOTING-RANKINGS.md)** - Rankings system troubleshooting
- **[I18N-DEBUGGING.md](I18N-DEBUGGING.md)** - Translation and i18n debugging
- **[RATE-LIMITING.md](RATE-LIMITING.md)** - API rate limiting strategies

### 📖 Reference & Guides

Additional references and specialized guides:

- **[design/claude-code-best-practices.md](design/claude-code-best-practices.md)** - Claude Code best practices
- **[TOOL-MAPPING.md](TOOL-MAPPING.md)** - Tool mapping documentation
- **[METRICS-EXTRACTION-PROMPT.md](METRICS-EXTRACTION-PROMPT.md)** - AI prompts for analysis

## 📂 Directory Structure

```
docs/
├── README.md                          # This documentation index
├── INSTRUCTIONS.md                    # Core development instructions
├── WORKFLOW.md                        # Development workflow
├── PROJECT.md                         # Project specifications
├── JSON-STORAGE.md                    # JSON file storage architecture
├── DEPLOYMENT-GUIDE.md                # Deployment procedures
├── archive/                           # Historical documentation and backups
│   ├── ARCHIVE-GUIDE.md              # Guide to archive structure
│   ├── 2025-01-cleanup/              # January 2025 cleanup artifacts
│   ├── 2025-06-cleanup/              # June 2025 cleanup artifacts
│   └── 2025-07-cleanup/              # July 2025 cleanup artifacts
├── design/                            # Design documents and architecture
├── data/                             # Data-related documentation
├── api/                              # API documentation
├── incoming/                         # New documentation to be organized
├── tickets/                          # Ticket-specific documentation
└── translations/                     # Translation-related files
```

### 📁 Key Subdirectories

#### `/design`

Architecture and design documents:

- **[ALGORITHM.md](design/ALGORITHM.md)** - Ranking algorithm design
- **[DB_DESIGN.md](design/DB_DESIGN.md)** - Database design documentation
- **[PRD.md](design/PRD.md)** - Product Requirements Document
- **[claude-code-best-practices.md](design/claude-code-best-practices.md)** - Claude Code best practices

#### `/archive`

Historical documentation preserved for reference:

- **[archive/ARCHIVE-GUIDE.md](archive/ARCHIVE-GUIDE.md)** - Guide to understanding the archive structure
- **[archive/2025-01-cleanup/CLEANUP-SUMMARY.md](archive/2025-01-cleanup/CLEANUP-SUMMARY.md)** - January 2025 cleanup operations
- Contains obsolete documentation, backup files, and deprecated scripts from previous project phases

#### `/translations`

Translation management files:

- **translation-report.json** - Translation coverage data
- **translation-report.md** - Human-readable translation report

## 🏃‍♂️ Quick Commands

```bash
# Start development server
pnpm run dev:pm2 start

# Run quality checks
pnpm run ci:local

# Generate cache files
pnpm run cache:generate

# Deploy preparation
pnpm run pre-deploy
```

## 🤝 Contributing to Documentation

When adding new documentation:

1. Place files in the appropriate category directory
2. Update this README.md index
3. Add references in CLAUDE.md if relevant for AI assistants
4. Follow existing naming conventions
5. Include clear headings and navigation

## 📞 Need Help?

- Check the troubleshooting section above
- Review the workflow documentation
- Look for relevant guides in the reference section
- Check the archive for historical context

---

**Last updated:** January 2025  
**Maintained by:** AI Power Rankings Development Team
