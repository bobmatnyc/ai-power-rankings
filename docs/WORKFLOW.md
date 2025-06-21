# 🔁 AI Power Rankings - Development Workflow

**Version**: 2.0  
**Updated**: 2025-06-09  
**Reference**: This document contains the complete workflow procedures for the AI Power Rankings project. It should be referenced from `INSTRUCTIONS.md`.

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

## 📊 2. Metrics Collection Workflow

### 🤖 AI-Powered Extraction

1. **Identify Source**: Find relevant article, benchmark, or report
2. **Extract Metrics**: Use `extract-metrics-from-article.ts`
   ```bash
   npm run extract-metrics "https://article-url.com"
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

## 🏆 3. Monthly Ranking Process

### 📅 Schedule (1st of each month)

1. **Data Collection Deadline** (Last week of month)

   - Gather all recent metrics
   - Update qualitative scores (innovation, business sentiment)
   - Verify data quality

2. **Algorithm Execution** (1st, 9 AM UTC)

   ```bash
   npm run generate-rankings
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

## 📋 4. Metrics Guidelines

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

## 🗄️ 5. Database Operations

### 📥 Importing Metrics

```bash
# Extract from article
npm run extract-metrics "https://article-url.com"

# Bulk import from JSON
npm run import-metrics data/metrics-2025-06.json

# Update specific metrics
npm run update-tool cursor --metric innovation_score --value 8.5
```

### 📤 Exporting Data

```bash
# Export by date (for manageable file sizes)
npm run export-by-date

# Export specific month
npm run export-month 2025-06

# Export for analysis
npm run export-for-analysis
```

### 🔄 Migration Commands

```bash
# Run database migrations
npm run db:migrate

# Seed initial data
npm run db:seed

# Reset and rebuild
npm run db:reset
```

---

## 🧪 6. Testing & Validation

### 🚨 CRITICAL: Pre-Deployment Checklist

**ALWAYS run this before any deployment:**

```bash
npm run pre-deploy  # Comprehensive pre-deployment check
```

This runs:

- `npm run lint` - ESLint checks
- `npm run type-check` - TypeScript compilation check
- `npm run format:check` - Code formatting verification
- `npm run test` - Full test suite

### 🚀 Post-Push Deployment Verification

**After pushing to GitHub, verify Vercel deployment:**

```bash
npm run check-deployment  # Monitors Vercel deployment status
```

This script:

- Detects the latest commit SHA
- Finds the corresponding Vercel deployment
- Monitors deployment progress in real-time
- Shows build logs if deployment fails
- Provides debugging guidance for failures

### ✅ Before Committing

```bash
# Run comprehensive checks (prevents Vercel deployment failures)
npm run ci:local

# Or run individual checks:
npm run lint
npm run type-check
npm run test

# Test algorithm calculations
npm test src/lib/ranking-algorithm.test.ts

# Validate metrics schema
npm run validate-metrics
```

### 🚫 Never Deploy Without Type Checking

TypeScript errors will cause Vercel deployment failures. The build process now includes automatic type checking to catch errors early:

```bash
npm run build  # Now includes type-check before building
```

### 🔍 Data Quality Checks

- Verify metric values are within expected ranges
- Check for missing required metrics
- Validate source URLs are unique
- Ensure evidence is provided for claims

---

## 📅 7. Release Schedule

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

## 📚 8. Documentation Updates

When adding new features or changing processes:

1. Update relevant docs:

   - `PROJECT.md`: Architecture changes
   - `DATABASE.md`: Schema modifications
   - `METRICS-GUIDELINES.md`: Scoring criteria
   - `WORKFLOW.md`: Process changes

2. Keep exports current:

   ```bash
   npm run export-docs
   ```

3. Update CLAUDE.md if adding new reference docs

---

## 🚀 9. Complete Deployment Workflow

### 📋 Step-by-Step Deployment Process

1. **Pre-flight Checks**:

   ```bash
   npm run pre-deploy       # Run all tests and checks
   ```

2. **Commit and Push**:

   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin main
   ```

3. **Verify Deployment**:

   ```bash
   npm run check-deployment # Monitor Vercel deployment
   ```

4. **If Deployment Fails**:

   - Check error logs from the script output
   - Common issues:
     - TypeScript errors: Run `npm run type-check` locally
     - ESLint errors: Run `npm run lint` locally
     - Missing environment variables: Check Vercel dashboard
   - Fix issues and push again

5. **Verify Production**:
   - Visit https://aipowerrankings.com
   - Check new features are working
   - Monitor error logs in Vercel dashboard

### 🔄 Automated Deployment Recovery

If a deployment fails, the check-deployment script will:

1. Show the exact error from Vercel build logs
2. Provide specific commands to debug locally
3. Suggest fixes based on error type

**Automatic Error Fixing**:

```bash
npm run fix-deployment   # Automatically fix common deployment errors
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
npm run fix-deployment && npm run pre-deploy

# 2. Commit and push if all checks pass
git add . && git commit -m "fix: deployment issues" && git push

# 3. Monitor deployment
npm run check-deployment
```

---

## 📚 10. Quick Reference

### Common Commands

```bash
# Data collection
npm run extract-metrics [URL]          # Extract from article
npm run collect:github                 # Update GitHub metrics
npm run collect:all                    # Run all collectors

# Rankings
npm run generate-rankings              # Calculate new rankings
npm run preview-rankings               # Preview without saving
npm run export-rankings                # Export for publication

# Database
npm run db:migrate                     # Run migrations
npm run db:backup                      # Backup database
npm run db:restore [file]              # Restore from backup

# Exports
npm run export-by-date                 # Organized by month
npm run export-showcase                # Top tools summary
npm run export-all                     # Complete export
```

### Environment Variables

```bash
# Required for metrics extraction
OPENAI_API_KEY=your-key-here

# Required for database
SUPABASE_URL=your-url
SUPABASE_SERVICE_ROLE_KEY=your-key

# Optional
GITHUB_TOKEN=your-token
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

## 🌐 11. Translation Management

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

## 👁️ Final Note

Quality over quantity. Every metric should tell a story, backed by evidence.

The goal is to provide developers with trustworthy, actionable intelligence about AI coding tools. Maintain high standards for data quality and transparency in methodology.
