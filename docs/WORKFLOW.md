# 🔁 AI Power Rankings - Development Workflow

**Version**: 3.0  
**Updated**: 2025-06-27  
**Reference**: This document contains the complete workflow procedures for the AI Power Rankings project. It should be referenced from `INSTRUCTIONS.md`.

**Changes in v3.0**:

- Migrated from GitHub Issues to TrackDown for project management
- Added TrackDown workflow documentation
- Integrated markdown-based project tracking
- Git-native project management approach

**Changes in v2.1**:

- Added cache-first architecture documentation
- Updated deployment workflow for resilient operation
- Client-side data processing guidelines
- Database fallback procedures

**Changes in v2.0**:

- Complete rewrite for AI Power Rankings project
- Added metrics extraction workflow using AI
- Source-oriented data collection procedures
- Monthly ranking generation process

---

## 🔁 1. Git Workflow & Version Control

We treat Git as a tool for **narrating engineering decisions**—not just storing code. Use it intentionally to reflect clarity, atomicity, and collaboration.

### ✅ Commit Philosophy

- **Commit early, commit often**, but only once the change is coherent.
- Each commit should answer: _What changed, and why?_
- Prefer **small, purposeful commits** over monolithic ones.

### 🔤 Conventional Commit Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(optional-scope): short summary

[optional body]
[optional footer(s)]
```

**Examples:**

- `feat(metrics): add AI-powered article extraction`
- `fix(ranking): correct agentic capability weight`
- `chore(db): migrate to source-oriented schema`

**Valid types**:  
`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`, `data`

### 🌱 Branch Naming Convention

Branches should reflect purpose and follow a `type/slug` format:

```
feature/metrics-extraction
fix/ranking-algorithm
data/june-2025-update
chore/update-deps
```

---

## 📋 2. Project Management with TrackDown

We use TrackDown, a markdown-based project tracking system that stores all project management artifacts as code within the repository.

### 📁 TrackDown Structure

```
trackdown/
├── BACKLOG.md              # Central tracking file for all work items (T-XXX tickets)
├── ROADMAP.md              # High-level planning and milestones
├── RETROSPECTIVES.md       # Sprint retrospectives
├── METRICS.md              # Project metrics and velocity tracking
├── templates/              # Work item templates
├── archive/                # Completed sprints and historical data
└── scripts/                # Automation tools
```

**IMPORTANT**: All tickets (T-XXX) are tracked in `/trackdown/BACKLOG.md` - this is the ONLY place to look for ticket information. The main project backlog is located at `/trackdown/BACKLOG.md` (not `/docs/BACKLOG.md`)

### 📝 Work Item Management

#### Creating New Work Items

1. **Open BACKLOG.md** in your editor
2. **Add to appropriate section** (Current Sprint, Backlog, or Epic)
3. **Use consistent format** (default assignee is @bobmatnyc):

```markdown
## **[T-XXX]** Task Title

**Type:** Task/Bug/Story  
**Epic:** EP-XXX (if applicable)  
**Priority:** Critical/High/Medium/Low  
**Story Points:** 1-13  
**Assignee:** @bobmatnyc  
**Status:** Backlog/Ready/In Progress/Done  
**Sprint:** X

**Description:**
Clear description of what needs to be done.

**Acceptance Criteria:**

- [ ] Specific measurable outcome
- [ ] Another verifiable criterion

**Technical Notes:**
Implementation details, considerations, or constraints.

**Definition of Done:**

- [ ] Code reviewed and approved
- [ ] Tests written and passing
- [ ] Documentation updated
```

### 🏃 Daily Workflow

1. **Morning Sync**

   ```bash
   # Pull latest changes
   git pull

   # Review current sprint in BACKLOG.md
   grep -A5 "## 🎯 Current Sprint" trackdown/BACKLOG.md

   # Update your task status
   # Change - [ ] to - [x] for completed items
   ```

2. **During Development**

   - Update task status in BACKLOG.md as you progress
   - Add technical notes discoveries
   - Create sub-tasks if needed

3. **End of Day**
   ```bash
   # Commit BACKLOG updates
   git add trackdown/BACKLOG.md
   git commit -m "chore(trackdown): update task T-XXX status to in-progress"
   git push
   ```

### 📊 Status Values

- `Backlog` - Not yet prioritized
- `Ready` - Ready for development
- `In Progress` - Currently being worked on
- `In Review` - Under code/design review
- `Testing` - In QA testing phase
- `Done` - Completed and deployed
- `Blocked` - Cannot proceed

### 🎯 Sprint Management

#### Sprint Planning

1. Review items in backlog
2. Move committed items to "Current Sprint" section
3. Update sprint number in frontmatter
4. Commit changes with message: `chore(trackdown): start sprint X`

#### Sprint Completion

1. Move completed items to archive
2. Update RETROSPECTIVES.md with learnings
3. Calculate velocity in METRICS.md
4. Plan next sprint

### 🔗 Linking Code to Tasks

In pull requests and commits, reference TrackDown items:

```bash
# In commit messages
git commit -m "feat(rankings): implement JSON storage - closes T-007"

# In PR descriptions
Related to EP-001
Implements T-007, T-008
```

### 📈 Tracking Progress

```bash
# Count completed tasks in current sprint
grep -c "\- \[x\]" trackdown/BACKLOG.md

# Find all in-progress tasks
grep -B5 "Status: In Progress" trackdown/BACKLOG.md

# Generate simple status report
echo "Sprint Progress:"
echo "Completed: $(grep -c '- \[x\]' trackdown/BACKLOG.md)"
echo "In Progress: $(grep -c 'Status: In Progress' trackdown/BACKLOG.md)"
echo "Remaining: $(grep -c '- \[ \]' trackdown/BACKLOG.md)"
```

### 🚨 Important TrackDown Principles

1. **Single Source of Truth**: BACKLOG.md is the authoritative source
2. **Atomic Updates**: Commit BACKLOG changes separately from code
3. **Regular Syncs**: Pull before editing to avoid conflicts
4. **Clear History**: Use descriptive commit messages for tracking changes

---

## 📊 3. Metrics Collection Workflow

### 🤖 AI-Powered Extraction

1. **Identify Source**: Find relevant article, benchmark, or report
2. **Extract Metrics**: Use `extract-metrics-from-article.ts`
   ```bash
   pnpm run extract-metrics "https://article-url.com"
   ```
3. **Review JSON**: Verify extracted metrics follow schema
4. **Store in Database**: Metrics automatically stored with unique source URL

### 📝 Manual Data Entry

For sources that can't be automatically extracted:

```typescript
// Use upsert_metrics_source function
SELECT upsert_metrics_source(
    'https://source-url.com',
    'media', // or 'official', 'benchmark', 'research'
    'TechCrunch',
    '2025-06-15',
    '{
        "context": {...},
        "tools": {
            "tool-id": {
                "metrics": {...},
                "analysis": "..."
            }
        },
        "metadata": {...}
    }'::jsonb
);
```

### 🔍 Multi-Tool Sources

Single articles often contain metrics for multiple tools:

- Benchmark results comparing tools
- Market analysis articles
- Funding round comparisons

Each source URL is unique - updates replace existing data.

---

## 🏆 4. Monthly Ranking Process

### 📅 Schedule (1st of each month)

1. **Data Collection Deadline** (Last week of month)

   - Gather all recent metrics
   - Update qualitative scores (innovation, business sentiment)
   - Verify data quality

2. **Algorithm Execution** (1st, 9 AM UTC)

   ```bash
   pnpm run generate-rankings
   ```

3. **Quality Assurance** (1st, 10 AM UTC)

   - Review ranking movements
   - Verify major changes have explanations
   - Check for data anomalies

4. **Publication** (1st, 12 PM UTC)
   - Update ranking_cache table
   - Generate "Real Story" explanations
   - Publish to website
   - Send newsletter

### 🎯 Algorithm v4.0 Weights

- **Agentic Capability** (25%): Autonomous capabilities
- **Technical Capability** (20%): Performance, features
- **Developer Adoption** (20%): Users, community
- **Market Traction** (15%): ARR, valuation
- **Business Sentiment** (10%): Market perception
- **Development Velocity** (5%): Release frequency
- **Platform Resilience** (5%): Dependencies

---

## 📋 5. Metrics Guidelines

### 🎯 Scoring Criteria

Refer to `/docs/METRICS-GUIDELINES.md` for detailed scoring:

- **Agentic Capability** (0-10): Autonomous planning and execution
- **Innovation Score** (0-10): Technical breakthroughs
- **Business Sentiment** (-1 to +1): Market dynamics

### 📊 Confidence Levels

- **High**: Official announcements, verified data
- **Medium**: Credible estimates, derived metrics
- **Low**: Speculation, rough estimates

### 🔗 Source Attribution

Every metric must include:

- Unique source URL
- Evidence quote or description
- Confidence level
- Collection timestamp

---

## 🛡️ 6. JSON Storage Architecture

### 📦 Overview

The AI Power Rankings uses a JSON file-based storage system for all data:

- **Primary storage** in `/data/json/` for all application data
- **Static caches** in `/src/data/cache/` for production performance
- **Client-side processing** for filtering and sorting

### 🔄 Managing Data Files

```bash
# Generate cache files from JSON data
pnpm run cache:generate

# Or manually update individual caches
pnpm run cache:rankings
pnpm run cache:tools
pnpm run cache:news

# Backup JSON data
pnpm run backup:create
```

**When to Update Cache:**

- After modifying JSON data files
- Before major deployments
- When adding/removing tools
- After running daily rankings
- When news content is updated

### 🚀 Data Strategy by Environment

- **Production**: Pre-generated cache files for optimal performance
- **Preview**: Direct JSON file access with caching
- **Development**: Direct JSON file access for real-time updates

### 📊 Client-Side Data Flow

1. **Initial Load**: Fetch all data from API (returns JSON data)
2. **Client Processing**: Filter, sort, and paginate on client
3. **Performance**: Instant interactions after initial load
4. **Reliability**: No external dependencies

### 🔍 Debugging Cache Issues

```bash
# Check cache status
curl https://your-site.com/api/debug-static

# Verify cache timestamps
curl https://your-site.com/api/rankings | jq '._cached, ._cachedAt'

# Test database connection
curl https://your-site.com/api/health/db
```

---

## 🗄️ 7. JSON Data Operations

### 📥 Importing Data

```bash
# Import tools from CSV
pnpm run import:tools --file=tools.csv

# Import rankings data
pnpm run import:rankings --file=rankings-2025-01.json

# Import news articles
pnpm run import:news --source=google-drive
```

### 📤 Exporting Data

```bash
# Export all data
pnpm run export:all --format=json

# Export specific data type
pnpm run export:tools --format=csv

# Export for analysis
pnpm run export:rankings --format=sql
```

### 🔄 Data Management

```bash
# Validate all JSON files
pnpm run validate:all

# Create backup
pnpm run backup:create

# Restore from backup
pnpm run backup:restore --date=2025-01-29

# Check data integrity
pnpm run health:check
```

---

## 🧪 8. Testing & Validation

### 🚨 CRITICAL: Pre-Deployment Checklist

**ALWAYS run this before any deployment:**

```bash
# 1. Run local build to catch TypeScript errors early
pnpm run build

# 2. Run comprehensive pre-deployment check
pnpm run pre-deploy  # Comprehensive pre-deployment check
```

The build process includes:

- TypeScript compilation check (catches all type errors)
- Next.js optimization
- Static page generation

The pre-deploy command runs:

- `pnpm run lint` - ESLint checks
- `pnpm run type-check` - TypeScript compilation check
- `pnpm run format:check` - Code formatting verification
- `pnpm run test` - Full test suite

### 🚀 Post-Push Deployment Verification

**After pushing to GitHub, ALWAYS verify Vercel deployment:**

```bash
pnpm run check-deployment  # Monitors Vercel deployment status
```

This script:

- Detects the latest commit SHA
- Finds the corresponding Vercel deployment
- Monitors deployment progress in real-time
- Shows build logs if deployment fails
- Provides debugging guidance for failures

#### 📋 Manual Deployment Verification Steps

If the automated script isn't available or you need to check manually:

1. **Visit Vercel Dashboard**:

   - Go to https://vercel.com/dashboard
   - Find your project (ai-power-rankings)
   - Click on the latest deployment

2. **Check Build Logs**:

   - Look for red error messages in the build output
   - Common error patterns:
     - `Type 'X' is not assignable to type 'Y'` - TypeScript errors
     - `Module not found: Can't resolve '@vercel/blob'` - Missing dependencies
     - `SASL authentication failed` - Database connection issues

3. **Immediate Actions for Common Errors**:

   **TypeScript Errors**:

   ```bash
   # Run locally to see all TypeScript errors
   pnpm run build
   # or
   pnpm run type-check
   ```

   **Module Import Errors**:

   ```bash
   # Check if module should be dynamically imported
   # Example: @vercel/blob should only load in production
   ```

   **Database Connection Errors**:

   ```bash
   # Verify environment variables in Vercel dashboard
   # Ensure using session pooler (port 5432) not transaction pooler
   ```

4. **Fix and Redeploy**:

   ```bash
   # After fixing errors locally
   pnpm run build  # Verify fix works
   git add .
   git commit -m "fix: deployment error - [brief description]"
   git push

   # Monitor the new deployment
   pnpm run check-deployment
   ```

### ✅ Before Committing

```bash
# IMPORTANT: Always run a local build first!
pnpm run build  # This catches TypeScript errors that will fail on Vercel

# Then run comprehensive checks (prevents other deployment failures)
pnpm run ci:local

# Or run individual checks:
pnpm run lint
pnpm run type-check
pnpm run test

# Test algorithm calculations
npm test src/lib/ranking-algorithm.test.ts

# Validate metrics schema
pnpm run validate-metrics
```

### 🔍 Post-Deployment Error Detection Workflow

**CRITICAL**: After every push to main branch:

1. **Wait 2-3 minutes** for Vercel to start the deployment
2. **Run deployment check**:
   ```bash
   pnpm run check-deployment
   ```
3. **If deployment fails**, the script will show you:

   - The exact error from Vercel logs
   - Suggested fix commands
   - Links to relevant documentation

4. **Common deployment failures and fixes**:

   | Error Type | Example                                          | Fix Command                             |
   | ---------- | ------------------------------------------------ | --------------------------------------- |
   | TypeScript | `Type 'Date' is not assignable to type 'string'` | `pnpm run type-check` then fix the file |
   | ESLint     | `Expected { after 'if' condition`                | `pnpm run lint:fix`                     |
   | Import     | `Module not found: @vercel/blob`                 | Check dynamic imports in code           |
   | Database   | `SASL authentication failed`                     | Verify env vars in Vercel dashboard     |
   | Build      | `next build failed`                              | `pnpm run build` locally first          |

### 🚫 Never Deploy Without Type Checking

TypeScript errors will cause Vercel deployment failures. The build process now includes automatic type checking to catch errors early:

```bash
pnpm run build  # Now includes type-check before building
```

### 🔍 Data Quality Checks

- Verify metric values are within expected ranges
- Check for missing required metrics
- Validate source URLs are unique
- Ensure evidence is provided for claims

---

## 📅 9. Release Schedule

### Monthly Cycle

- **Week 1**: Previous month's rankings published
- **Week 2-3**: Continuous data collection
- **Week 4**: Final data gathering, quality checks
- **Month End**: Algorithm execution and review

### Hotfixes

For critical updates between monthly cycles:

1. Document reason for off-cycle update
2. Run partial ranking recalculation
3. Note update in changelog

---

## 📚 10. Documentation Updates

When adding new features or changing processes:

1. Update relevant docs:

   - `PROJECT.md`: Architecture changes
   - `DATABASE.md`: Schema modifications
   - `METRICS-GUIDELINES.md`: Scoring criteria
   - `WORKFLOW.md`: Process changes

2. Keep exports current:

   ```bash
   pnpm run export-docs
   ```

3. Update CLAUDE.md if adding new reference docs

---

## 🚀 11. Complete Deployment Workflow

### 📋 Step-by-Step Deployment Process

1. **Pre-flight Checks**:

   ```bash
   pnpm run pre-deploy       # Run all tests and checks
   ```

2. **Update Cache Files** (if data changed):

   ```bash
   pnpm run cache:generate   # Generate all cache files
   # Or update individual caches:
   # pnpm run cache:rankings
   # pnpm run cache:tools
   # pnpm run cache:news
   ```

3. **Commit and Push**:

   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin main
   ```

4. **Verify Deployment**:

   ```bash
   pnpm run check-deployment # Monitor Vercel deployment
   ```

5. **If Deployment Fails**:

   - Check error logs from the script output
   - Common issues:
     - TypeScript errors: Run `pnpm run type-check` locally
     - ESLint errors: Run `pnpm run lint` locally
     - Missing environment variables: Check Vercel dashboard
     - Outdated cache files: Run `pnpm run cache:generate`
   - Fix issues and push again

6. **Verify Production**:
   - Visit https://aipowerranking.com
   - Check new features are working
   - Monitor error logs in Vercel dashboard

### 🔄 Automated Deployment Recovery

If a deployment fails, the check-deployment script will:

1. Show the exact error from Vercel build logs
2. Provide specific commands to debug locally
3. Suggest fixes based on error type

**Automatic Error Fixing**:

```bash
pnpm run fix-deployment   # Automatically fix common deployment errors
```

This script can fix:

- ESLint errors (auto-fixable ones)
- Prettier formatting issues
- Missing dependencies
- Provides guidance for TypeScript errors
- Alerts about missing environment variables

### 🎯 Complete Deployment Automation

For a fully automated deployment workflow:

```bash
# 1. Fix any issues and prepare for deployment
pnpm run fix-deployment && pnpm run pre-deploy

# 2. Commit and push if all checks pass
git add . && git commit -m "fix: deployment issues" && git push

# 3. Monitor deployment
pnpm run check-deployment
```

---

## 📚 12. Quick Reference

### Common Commands

```bash
# Data collection
pnpm run extract-metrics [URL]          # Extract from article
pnpm run collect:github                 # Update GitHub metrics
pnpm run collect:all                    # Run all collectors

# Rankings
pnpm run generate-rankings              # Calculate new rankings
pnpm run preview-rankings               # Preview without saving
pnpm run export-rankings                # Export for publication

# Database
pnpm run db:migrate                     # Run migrations
pnpm run db:backup                      # Backup database
pnpm run db:restore [file]              # Restore from backup

# Exports
pnpm run export-by-date                 # Organized by month
pnpm run export-showcase                # Top tools summary
pnpm run export-all                     # Complete export
```

### Environment Variables

```bash
# Required for metrics extraction
OPENAI_API_KEY=your-key-here
PERPLEXITY_API_KEY=your-key-here

# Required for data collection
GITHUB_TOKEN=your-token
GOOGLE_API_KEY=your-key
GOOGLE_DRIVE_FOLDER_ID=your-folder-id

# Required for features
RESEND_API_KEY=your-key
```

### 🚀 Vercel Deployment Configuration

**Setting up environment variables in Vercel:**

```bash
# Install Vercel CLI
pnpm i -g vercel

# Login to Vercel
vercel login

# Set environment variables for all environments
vercel env add GITHUB_TOKEN production
vercel env add PERPLEXITY_API_KEY production
vercel env add GOOGLE_API_KEY production
vercel env add RESEND_API_KEY production

# Deploy to production
vercel --prod
```

**Key Vercel Configuration Requirements:**

1. **File System Access**: Ensure build process has access to generate cache files
2. **API Keys**: All data collection APIs must be configured
3. **Environment Sync**: Use `vercel env pull .env.vercel` to sync variables locally
4. **Build Cache**: Configure proper caching for JSON files

**Critical Environment Variables for Production:**

```bash
GITHUB_TOKEN=<your-github-token>
PERPLEXITY_API_KEY=<your-perplexity-key>
GOOGLE_API_KEY=<your-google-key>
GOOGLE_DRIVE_FOLDER_ID=<your-folder-id>
RESEND_API_KEY=<your-resend-key>
NEXT_PUBLIC_BASE_URL=https://aipowerranking.com
NODE_ENV=production
```

### Pricing Data Management

When updating pricing information:

1. **Use dedicated pricing scripts**:

   ```bash
   tsx scripts/update-pricing-details.ts
   ```

2. **Handle database constraints**:

   - Check if pricing plan exists before upsert
   - Use manual insert/update if no unique constraint
   - Consider adding constraints for frequently updated data

3. **Pricing data structure**:

   - Store in `pricing_plans` table
   - Include features array (JSONB)
   - Include limits object (JSONB)
   - Mark primary plans with `is_primary`

4. **Display pricing in UI**:
   - Fetch pricing plans in API route
   - Add dedicated pricing tab in tool details
   - Show primary plan price in overview
   - Format currency properly

---

## 🌐 13. Translation Management

### 📝 Internal Translation Tools

The project includes internal JavaScript tools for managing translations located in `src/i18n/dictionaries/`:

- **apply_translations.js** - Applies translation batches to main dictionary files
- **fix_untranslated.js** - Identifies strings that need translation
- **monitor_i18n.js** - Tracks translation progress and completeness
- **verify_i18n.js** - Ensures consistency across all language files

### ⚠️ Important Notes

1. **These are internal workflow tools** - They should NOT be included in builds or CI/CD
2. **They use CommonJS** - Intentionally kept as `.js` files with `require()` syntax
3. **They are excluded from**:
   - TypeScript compilation (`tsconfig.json` excludes `src/scripts/**/*`)
   - ESLint checking (via `.eslintignore` in the directory)
   - Build process (not imported by any production code)

### 🔧 Using Translation Tools

```bash
# Check translation status
node src/i18n/dictionaries/monitor_i18n.js

# Find untranslated strings
node src/i18n/dictionaries/fix_untranslated.js

# Apply translation batches
node src/i18n/dictionaries/apply_translations.js

# Verify consistency
node src/i18n/dictionaries/verify_i18n.js
```

### 📋 Translation Workflow

1. **Monitor Status**: Run `monitor_i18n.js` to see completion percentages
2. **Identify Gaps**: Run `fix_untranslated.js` to create `translate_[lang]_needed.json` files
3. **Get Translations**: Use external service or manual translation
4. **Apply Batches**: Place translated files as `translate_[lang]_*.json` and run `apply_translations.js`
5. **Verify**: Run `verify_i18n.js` to ensure all languages have consistent keys

### ⚠️ Important: Translation Tool Scripts

**DO NOT DELETE** the JavaScript files in `/src/i18n/dictionaries/`. These are internal translation management tools that should be:

- ✅ Excluded from ESLint (configured in `eslint.config.mjs`)
- ✅ Excluded from TypeScript checking
- ✅ Excluded from build processes
- ✅ Kept in the repository
- ❌ NOT deleted
- ❌ NOT included in CI/CD checks

These tools use CommonJS syntax and are essential for managing translations. They include:

- `verify_i18n.js`, `sync_structure.js`, `fix_untranslated.js`
- `translate_batch.js`, `validate_translations.js`, `check_sizes.js`
- `extract_used_keys.js`, `key_comparison.js`, `update_template.js`

---

## 🚨 14. Deployment Troubleshooting Guide

### Common Vercel Deployment Issues & Solutions

Based on extensive deployment experience, here are the most common issues and their solutions:

#### 1. **File System Access Errors**

**Symptoms**:

- `ENOENT: no such file or directory`
- Build fails when generating cache files
- Missing JSON data files in production

**Root Causes**:

- JSON files not included in build
- Cache generation failing during build
- Incorrect file paths in production

**Solutions**:

```bash
# Ensure JSON files are included in build
# Add to vercel.json:
{
  "functions": {
    "app/api/*": {
      "includeFiles": "data/json/**"
    }
  }
}

# Generate cache during build
# Add to package.json scripts:
"vercel-build": "next build && pnpm run cache:generate"
```

**Key Learning**: JSON files must be explicitly included in Vercel builds and cache must be generated during build process.

#### 2. **React Rendering Errors in Translations**

**Symptoms**:

- `Objects are not valid as a React child`
- Build fails on specific language pages (e.g., /fr/methodology, /it/methodology)

**Root Causes**:

- Duplicate translation structures in JSON files
- Complex nested objects instead of strings in translation keys
- Conflicting key definitions

**Solutions**:

```bash
# 1. Check for duplicate keys in translation files
grep -n "agenticCapability\|technicalPerformance\|marketTraction" src/i18n/dictionaries/[lang].json

# 2. Look for duplicate structure blocks (usually 100+ lines)
# Common pattern: duplicate methodology sections starting around line 480-600

# 3. Remove entire duplicate blocks, not just individual keys
```

**Prevention**:

- Use translation monitoring tools before deployment
- Run `node src/i18n/dictionaries/verify_i18n.js`
- Check for React-renderable values only (strings, not objects)

#### 3. **Environment Variable Issues**

**Symptoms**:

- Site redirects to production URL from Vercel preview
- Authentication failures
- Missing functionality in deployed app

**Root Causes**:

- Hardcoded production URLs
- Environment variables set incorrectly
- VERCEL_URL not being used properly

**Solutions**:

```bash
# Remove hardcoded URLs to allow Vercel automatic URL detection
vercel env rm NEXTAUTH_URL production
vercel env rm NEXT_PUBLIC_BASE_URL production
vercel env rm NEXT_PUBLIC_PAYLOAD_URL production

# Let Vercel use its automatic VERCEL_URL environment variable
# Update getUrl() function to check VERCEL_URL first
```

#### 4. **Missing Translation Keys**

**Symptoms**:

- Warning logs: `Missing translation [it]: methodology.factors.xxx`
- Pages render with missing text
- Build succeeds but with 100+ translation warnings

**Prevention & Fix**:

```bash
# 1. Before deployment, check translation completeness
node src/i18n/dictionaries/monitor_i18n.js

# 2. Generate list of missing translations
node src/i18n/dictionaries/fix_untranslated.js

# 3. Common missing keys pattern:
# - methodology.algorithm.features.*
# - methodology.factors.*
# - methodology.modifiers.*
# - methodology.dataSources.*
# - rankings.algorithm.*
```

### Deployment Checklist

Before pushing to production, verify:

- [ ] Run `pnpm run build` - catches ALL TypeScript errors that will fail on Vercel
- [ ] Run `pnpm run ci:local` - catches lint and other errors
- [ ] Generate cache files with `pnpm run cache:generate`
- [ ] Verify JSON data files are valid with `pnpm run validate:all`
- [ ] Verify no duplicate structures in translation JSON files
- [ ] Remove hardcoded production URLs for preview deployments
- [ ] Run translation verification scripts
- [ ] Test locally with production-like environment

### Quick Fixes for Common Errors

```bash
# Fix TypeScript errors before deployment
pnpm run type-check

# Fix translation structure issues
node src/i18n/dictionaries/verify_i18n.js

# Check for duplicate translation keys
for lang in fr it de ko uk hr; do
  echo "Checking $lang..."
  jq -r 'paths(scalars) as $p | "\($p|join("."))"' src/i18n/dictionaries/$lang.json | sort | uniq -d
done

# Verify environment variables are set correctly
vercel env ls
```

### Emergency Deployment Recovery

If deployment keeps failing:

1. **Check Vercel build logs** for specific error
2. **Database issues**: Verify connection string and port
3. **Translation issues**: Remove duplicate blocks, not just keys
4. **Environment issues**: Let Vercel handle URLs automatically
5. **Last resort**: Revert to last known working commit

```bash
# Find last successful deployment
git log --oneline | head -20
# Revert if needed
git revert HEAD
git push
```

### 🚨 Critical Deployment Workflow Summary

**Every deployment MUST follow this sequence**:

1. **Before Push**:

   ```bash
   pnpm run build         # Catch TypeScript errors
   pnpm run ci:local      # Run all checks
   ```

2. **After Push**:

   ```bash
   pnpm run check-deployment  # Monitor deployment
   ```

3. **If Deployment Fails**:
   - Read the error carefully
   - Fix locally using the error-specific commands above
   - Test the fix with `pnpm run build`
   - Commit and push the fix
   - Run `pnpm run check-deployment` again

**Remember**: Vercel deployments can fail even when local development works. The most common cause is TypeScript errors that aren't caught in development mode. ALWAYS run `pnpm run build` before pushing.

---

## 🐛 15. Development Debugging Workflow

### Real-time Error Detection and Fixing

**CRITICAL**: After every functional change, follow this debugging workflow to catch and fix errors immediately:

#### 1. **Start Development Server with PM2 (Recommended)**

```bash
# Kill any existing dev servers
pkill -f "next dev" || true

# Start server with PM2 for better process management
ppnpm run dev:pm2 start

# Monitor logs in real-time
ppnpm run dev:pm2 logs

# Or use the simple server script
ppnpm run dev:server
```

**Why PM2?**

- Keeps server running even if terminal closes
- Auto-restarts on crashes
- Better log management
- Easy process control

#### 2. **Development Server Management**

```bash
# Start the dev server
ppnpm run dev:pm2 start

# Check server status
ppnpm run dev:pm2 status

# View logs
ppnpm run dev:pm2 logs

# Restart server (useful after major changes)
ppnpm run dev:pm2 restart

# Stop server
ppnpm run dev:pm2 stop
```

#### 3. **AI Assistant Workflow: After Each Task**

**IMPORTANT**: After completing any development task, follow this routine:

```bash
# 1. Restart the dev server to ensure clean state
ppnpm run dev:pm2 restart

# 2. Monitor logs for any errors
ppnpm run dev:pm2 logs

# 3. Run type checking to catch TypeScript errors
ppnpm run type-check

# 4. Run linting to catch code style issues
ppnpm run lint

# 5. If everything looks good, the server is ready
```

#### 2. **Common Development Errors and Fixes**

| Error Type       | Example                                            | Immediate Fix                                               |
| ---------------- | -------------------------------------------------- | ----------------------------------------------------------- |
| Missing Import   | `ReferenceError: TrendingUp is not defined`        | Add to imports: `import { TrendingUp } from "lucide-react"` |
| Module Not Found | `Cannot find module 'tailwind-merge'`              | Clear cache: `rm -rf .next && pnpm dev`                     |
| Type Error       | `Type 'string' is not assignable to type 'number'` | Fix type or add type assertion                              |
| Hook Error       | `Invalid hook call`                                | Check hook is at component top level                        |
| Hydration Error  | `Text content does not match`                      | Ensure server/client render same content                    |

#### 3. **Active Error Monitoring Script**

Create a monitoring script at `scripts/monitor-dev.sh`:

```bash
#!/bin/bash

# Start dev server
echo "🚀 Starting development server..."
pkill -f "next dev" || true
nohup pnpm dev > dev-server.log 2>&1 &
DEV_PID=$!

# Wait for server to start
sleep 5

# Monitor for errors
echo "👀 Monitoring for errors..."
tail -f dev-server.log | while read line; do
  if [[ $line == *"⨯"* ]] || [[ $line == *"Error:"* ]] || [[ $line == *"error:"* ]]; then
    echo "🚨 ERROR DETECTED: $line"
    echo "📍 Check the code at the indicated location"
    echo "💡 Fix the error and save the file for hot reload"
  fi

  if [[ $line == *"✓ Compiled"* ]]; then
    echo "✅ Compilation successful"
  fi

  if [[ $line == *"⚠"* ]]; then
    echo "⚠️  WARNING: $line"
  fi
done
```

Make it executable: `chmod +x scripts/monitor-dev.sh`

#### 4. **Debugging Checklist After Changes**

- [ ] Run `pnpm dev` and monitor logs
- [ ] Check for compilation errors
- [ ] Test the changed functionality in browser
- [ ] Watch for runtime errors in console
- [ ] Verify hot reload is working
- [ ] Check for TypeScript errors: `pnpm run type-check`
- [ ] Run quick lint: `pnpm run lint`

#### 5. **Common Module Resolution Issues**

```bash
# Clear all caches when modules are missing
rm -rf .next
rm -rf node_modules/.cache
ppnpm install
pnpm dev
```

#### 6. **Port Conflicts**

```bash
# If port 3000 is in use
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 pnpm dev
```

#### 7. **Environment Variable Issues**

```bash
# Verify env vars are loaded
grep "Dynamic Environment Configuration" dev-server.log

# Check specific env var
echo $NEXT_PUBLIC_BASE_URL
```

### Quick Debug Commands

```bash
# Full reset and restart
pnpm dev:clean  # Add to package.json: "dev:clean": "rm -rf .next && pnpm dev"

# Check for TypeScript errors without full build
pnpm type-check

# Quick lint check on changed files
pnpm lint --fix

# Monitor specific error patterns
tail -f dev-server.log | grep -E "(Error|error|⨯|failed)"
```

### Pro Tips

1. **Keep logs visible**: Always have `tail -f dev-server.log` running in a terminal
2. **Fix immediately**: Don't accumulate errors - fix them as they appear
3. **Use Fast Refresh**: Save files to trigger hot reload instead of restarting
4. **Check browser console**: Some errors only appear in browser DevTools
5. **Network tab**: Monitor API calls for 500 errors indicating backend issues

## 👁️ 16. Final Note

Quality over quantity. Every metric should tell a story, backed by evidence.

The goal is to provide developers with trustworthy, actionable intelligence about AI coding tools. Maintain high standards for data quality and transparency in methodology.
