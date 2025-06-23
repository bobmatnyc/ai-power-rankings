# AI Power Rankings Documentation

Welcome to the AI Power Rankings documentation. This directory contains all the essential documentation for developing and maintaining the AI Power Rankings platform.

## 📚 Core Documentation

### Essential Files (Start Here)

1. **[CLAUDE.md](../CLAUDE.md)** - Entry point for AI agents and development instructions
2. **[INSTRUCTIONS.md](INSTRUCTIONS.md)** - Core development principles and standards
3. **[WORKFLOW.md](WORKFLOW.md)** - Required workflow processes and deployment procedures
4. **[PROJECT.md](PROJECT.md)** - Project architecture and technical specifications
5. **[DATABASE.md](DATABASE.md)** - Complete database documentation and operations guide

## 📖 Feature Documentation

### Data Collection & Processing

- **[METRICS-GUIDELINES.md](METRICS-GUIDELINES.md)** - Scoring criteria and metrics definitions
- **[METRICS-EXTRACTION-PROMPT.md](METRICS-EXTRACTION-PROMPT.md)** - AI prompt for article analysis
- **[ARTICLE-INGESTION.md](ARTICLE-INGESTION.md)** - Article processing and data extraction
- **[NEWS-INGESTION.md](NEWS-INGESTION.md)** - News collection and processing system
- **[GOOGLE_DRIVE_INTEGRATION.md](GOOGLE_DRIVE_INTEGRATION.md)** - Google Drive setup for news ingestion

### Technical Guides

- **[DEV-SERVER.md](DEV-SERVER.md)** - Development server with automatic port detection
- **[LINTING-STANDARDS.md](LINTING-STANDARDS.md)** - Code quality and linting configuration
- **[I18N-DEBUGGING.md](I18N-DEBUGGING.md)** - Internationalization debugging guide
- **[TRANSLATIONS.md](TRANSLATIONS.md)** - Translation management system
- **[FAVICON-FETCHING-GUIDE.md](FAVICON-FETCHING-GUIDE.md)** - Favicon fetching implementation

### SEO & Analytics

- **[GOOGLE_SEARCH_CONSOLE.md](GOOGLE_SEARCH_CONSOLE.md)** - Search Console integration
- **[SITEMAP-SUBMISSION.md](SITEMAP-SUBMISSION.md)** - Sitemap generation and submission
- **[google-search-console-setup.md](google-search-console-setup.md)** - Setup guide

### Rankings & Analysis

- **[LONGITUDINAL-RANKINGS.md](LONGITUDINAL-RANKINGS.md)** - Historical ranking analysis
- **[RANKINGS-JUNE-2025.md](RANKINGS-JUNE-2025.md)** - June 2025 ranking results

## 📁 Subdirectories

### `/data`

Contains data files and SQL scripts:

- **ALGORITHM6.md** - Algorithm version 6 documentation
- **POPULATE.sql** - Database population scripts
- **UPDATE-\*.sql/json** - Data update files

### `/design`

Design documents and specifications:

- **[ALGORITHM.md](design/ALGORITHM.md)** - Ranking algorithm design
- **[DB_DESIGN.md](design/DB_DESIGN.md)** - Database design documentation
- **[PRD.md](design/PRD.md)** - Product Requirements Document
- **[seo-implementation-guide.md](design/seo-implementation-guide.md)** - SEO implementation strategy
- **[ai-power-rankings-cms-migration-plan.md](design/ai-power-rankings-cms-migration-plan.md)** - CMS migration planning

### `/translations`

Translation reports and management:

- **translation-report.json** - Translation coverage data
- **translation-report.md** - Human-readable translation report

### `/archive`

Historical documentation preserved for reference. Contains outdated documentation from previous phases of the project.

## 🚀 Quick Start

For new developers:

1. Start with **[CLAUDE.md](../CLAUDE.md)** for overview
2. Read **[INSTRUCTIONS.md](INSTRUCTIONS.md)** for development principles
3. Review **[WORKFLOW.md](WORKFLOW.md)** for processes
4. Consult **[DATABASE.md](DATABASE.md)** for database operations

## 📋 Documentation Standards

- Use clear, descriptive filenames
- Include creation and update dates in documents
- Follow Markdown best practices
- Keep documentation up-to-date with code changes
- Archive outdated documentation rather than deleting

## 🔧 Maintenance

- Documentation should be reviewed monthly
- Update dates when making significant changes
- Move outdated docs to `/archive` with dated subdirectories
- Ensure all new features have corresponding documentation
