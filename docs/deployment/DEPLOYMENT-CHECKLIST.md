# Deployment Checklist - AI Power Ranking

**Purpose**: Comprehensive deployment guide for all performance optimizations and feature releases
**Last Updated**: 2026-02-03
**Version**: v0.3.14+

---

## 📋 Table of Contents

1. [Pre-Deployment Verification](#pre-deployment-verification)
2. [Database Migration](#database-migration)
3. [Deployment Steps](#deployment-steps)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Monitoring](#monitoring)
6. [Rollback Procedures](#rollback-procedures)
7. [Performance Optimization History](#performance-optimization-history)

---

## Pre-Deployment Verification

### 1. Build Success ✅

**Verify local build completes**:
```bash
# Clean build
rm -rf .next
npm run build

# Expected output:
# ✓ Compiled successfully
# Route (app)                              Size     First Load JS
# ○ /[lang]/tools/[slug]                  [ISR]    XXX kB
# ƒ /[lang]/about                         [dynamic] XXX kB
```

**Success Criteria**:
- ✅ Build completes without errors
- ✅ No TypeScript errors: `npm run type-check`
- ✅ No ESLint warnings
- ✅ All pages generated successfully
- ✅ No "useSearchParams() suspense boundary" errors

### 2. Code Review ✅

**Review all modified files**:
```bash
# Show all changed files
git status

# Review diffs
git diff main
```

**Review Checklist**:
- ✅ Changes match approved scope
- ✅ No unintended file modifications
- ✅ Comments and documentation updated
- ✅ No debug code or console.logs left behind
- ✅ Environment variables properly configured

### 3. Test Coverage ✅

**Run all tests**:
```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Type checking
npm run type-check

# Linting
npm run lint
```

**Success Criteria**:
- ✅ All tests pass
- ✅ No new TypeScript errors
- ✅ No breaking changes
- ✅ Code coverage maintained or improved

### 4. Staging Deployment (Recommended) ⚠️

**Deploy to Vercel preview**:
```bash
# Create preview deployment
vercel deploy

# Test preview URL
# https://aipowerranking-XXXXX.vercel.app
```

**Manual Testing on Preview**:
- ✅ Homepage loads correctly
- ✅ Tool pages load correctly (`/tools/cursor`, `/tools/github-copilot`)
- ✅ Rankings page works (`/rankings`)
- ✅ News page works (`/news`)
- ✅ About page works (`/about`)
- ✅ Browser console - no errors
- ✅ Mobile responsiveness verified

**Performance Testing on Preview**:
```bash
# Test TTFB
curl -w "@curl-format.txt" -o /dev/null -s https://aipowerranking-XXXXX.vercel.app/tools/cursor

# Run Lighthouse
lighthouse https://aipowerranking-XXXXX.vercel.app --only-categories=performance
```

---

## Database Migration

### For Database Schema Changes

**Step 1: Review Migration Files**
```bash
# List migration files
ls -la lib/db/migrations/

# Review migration SQL
cat lib/db/migrations/XXXX_description.sql
```

**Step 2: Apply to Production Database**
```bash
# Set production database URL
export DATABASE_URL="$PRODUCTION_DATABASE_URL"

# Run migration script
npx tsx scripts/apply-performance-indexes.ts

# OR use migration tool
npm run migrate:production
```

**Expected Output**:
```
⚙️  Executing: idx_rankings_is_current
   ✅ Success
⚙️  Executing: idx_rankings_period
   ✅ Success
```

**Step 3: Verify Migration**
```sql
-- Verify indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('rankings', 'tools')
  AND indexname LIKE 'idx_%';

-- Verify table structure
\d+ rankings
\d+ tools
```

**Migration Checklist**:
- [ ] Migration SQL syntax verified
- [ ] Backup created before migration
- [ ] Migration applied successfully
- [ ] Database indexes verified
- [ ] No data corruption
- [ ] Application can connect to database

---

## Deployment Steps

### Option 1: Merge to Main (Recommended)

**Step 1: Create Pull Request**
```bash
# Push branch
git push origin feature/your-feature-name

# Create PR
gh pr create --title "Your Feature Title" \
  --body "## Summary

[Brief description of changes]

## Changes
- Change 1
- Change 2

## Performance Impact
[Expected improvements]

## Testing
[Testing performed]

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

**Step 2: Review and Merge**
```bash
# After approval, merge PR
gh pr merge --squash
```

**Step 3: Monitor Vercel Auto-Deploy**
- Vercel automatically deploys on push to main
- Monitor deployment in Vercel dashboard
- Deployment takes ~1-2 minutes

### Option 2: Direct Deployment (Alternative)

**Deploy directly to production**:
```bash
# Deploy to production
vercel --prod

# Monitor deployment
vercel logs --prod --follow
```

### Commit Message Format

Use descriptive commit messages:
```bash
git commit -m "feat: Add feature description

- Detailed change 1
- Detailed change 2
- Performance improvement: X% faster

Performance Impact:
- Metric 1: Before → After
- Metric 2: Before → After

Files:
- Created: path/to/file
- Modified: path/to/file

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Post-Deployment Verification

### Immediate Checks (0-5 minutes)

**1. Verify Deployment Success**
```bash
# Check deployment status
vercel ls --prod

# Expected: ● Ready (green dot)
```

**2. Smoke Test Critical Pages**
```bash
# Test homepage
curl -s -o /dev/null -w "%{http_code}" https://aipowerranking.com
# Expected: 200 or 307 (redirect to /en)

# Test tool pages
curl -s -o /dev/null -w "%{http_code}" https://aipowerranking.com/tools/cursor
# Expected: 200

# Test rankings
curl -s -o /dev/null -w "%{http_code}" https://aipowerranking.com/rankings
# Expected: 200

# Test news
curl -s -o /dev/null -w "%{http_code}" https://aipowerranking.com/news
# Expected: 200
```

**3. Check for Build Errors**
```bash
# Monitor logs
vercel logs --prod | grep -i error

# Expected: No critical errors
```

**4. Verify ISR Cache (if ISR enabled)**
```bash
# First request (may be MISS)
curl -I https://aipowerranking.com/tools/cursor | grep -i cache

# Wait 5 seconds, second request (should be HIT)
sleep 5
curl -I https://aipowerranking.com/tools/cursor | grep -i cache

# Expected:
# x-vercel-cache: HIT (or STALE if revalidating)
# age: > 0
```

### Short-Term Monitoring (5-60 minutes)

**5. Monitor TTFB**
```bash
# Create curl timing format file
cat > curl-format.txt << 'EOF'
    time_namelookup:  %{time_namelookup}s\n
       time_connect:  %{time_connect}s\n
    time_appconnect:  %{time_appconnect}s\n
   time_pretransfer:  %{time_pretransfer}s\n
      time_redirect:  %{time_redirect}s\n
 time_starttransfer:  %{time_starttransfer}s (TTFB)\n
                    ----------\n
         time_total:  %{time_total}s\n
EOF

# Test TTFB
curl -w "@curl-format.txt" -o /dev/null -s https://aipowerranking.com/tools/cursor

# Expected TTFB: < 500ms (cached), < 2s (first request)
```

**6. Run Lighthouse Tests**
```bash
# Homepage
lighthouse https://aipowerranking.com \
  --only-categories=performance \
  --output=json \
  --output-path=./lighthouse-homepage.json

# Tool page
lighthouse https://aipowerranking.com/tools/cursor \
  --only-categories=performance \
  --output=json \
  --output-path=./lighthouse-tool-page.json
```

**7. Check Error Logs**
```bash
# Monitor for 500 errors
vercel logs --prod | grep "500"

# Monitor for any errors
vercel logs --prod | grep -i "error" | head -20

# Expected: No critical errors
```

### Medium-Term Monitoring (1-24 hours)

**8. Vercel Analytics Dashboard**
- Open Vercel Dashboard > Project > Analytics
- Check metrics:
  - **TTFB p95**: Should be within targets
  - **Cache Hit Rate**: Should be > 80% (if ISR enabled)
  - **Error Rate**: Should remain at baseline (< 0.1%)
  - **Requests/min**: Should remain stable

**9. Database Performance (if applicable)**
```sql
-- Monitor index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_%'
ORDER BY idx_scan DESC;

-- Monitor query performance
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%rankings%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Monitoring

### Performance Metrics to Track

**Tool Pages** (if ISR-enabled):
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| TTFB (p50) | < 100ms | > 500ms 🚨 |
| TTFB (p95) | < 300ms | > 1s 🚨 |
| Cache Hit Rate | > 95% | < 80% ⚠️ |
| FCP (p75) | < 1.5s | > 2s ⚠️ |
| LCP (p75) | < 2.0s | > 3s ⚠️ |
| CLS (p75) | < 0.10 | > 0.15 ⚠️ |

**Main Pages** (force-dynamic):
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| TTFB (p95) | < 2.7s | > 3.5s 🚨 |
| CLS (p75) | < 0.10 | > 0.15 ⚠️ |
| Error Rate | < 0.1% | > 0.5% 🚨 |

**Database Queries**:
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Query Time (p95) | < 100ms | > 500ms 🚨 |
| Connection Pool | < 80% | > 90% 🚨 |
| Slow Queries/min | < 5 | > 20 🚨 |

### Monitoring Tools

**Vercel Dashboard**:
- Analytics > Performance
- Analytics > Cache Hit Rate
- Logs > Real-time

**Database Monitoring** (Neon/Supabase):
- Dashboard > Monitoring
- Query performance
- Connection statistics

**Google Search Console**:
- Core Web Vitals
- Page Experience report
- Wait 24-48 hours for real user data

---

## Rollback Procedures

### When to Rollback

**🔴 Immediate Rollback Triggers**:
- Build failures preventing deployment
- 500 error spike (> 10 errors/minute)
- Complete cache failure (0% hit rate)
- Production outage (site down)
- Database connection failures

**🟡 Consider Rollback Triggers**:
- TTFB regression (> 2x baseline)
- Cache hit rate < 70% after 1 hour
- User reports of stale content (> 5 reports)
- CLS regression (> 0.20 site-wide)
- Error rate increase (> 2x baseline)

### Rollback Commands

**Option 1: Revert Git Commit (Fast)**
```bash
# Revert the merge commit
git revert HEAD --no-edit

# Push to trigger auto-deploy
git push origin main

# Vercel auto-deploys in ~1-2 minutes
```

**Option 2: Selective File Rollback (Targeted)**
```bash
# Revert specific files
git checkout HEAD~1 path/to/file1 path/to/file2
git commit -m "Rollback: Revert changes due to [reason]"
git push origin main
```

**Option 3: Deploy Previous Version (Nuclear)**
```bash
# Find previous production deployment
vercel ls --prod

# Promote previous deployment
vercel promote <previous-deployment-url>

# This instantly switches to previous version
```

**Option 4: Database Rollback (if needed)**
```sql
-- Remove indexes (only if they cause issues)
DROP INDEX IF EXISTS idx_rankings_is_current;
DROP INDEX IF EXISTS idx_rankings_period;
DROP INDEX IF EXISTS idx_rankings_current_period;
DROP INDEX IF EXISTS idx_tools_id;

-- Revert schema changes
-- Apply rollback migration
```

### Post-Rollback Verification

**1. Verify Rollback Successful**
```bash
# Check deployment status
vercel ls --prod

# Test critical pages
curl -s -o /dev/null -w "%{http_code}" https://aipowerranking.com
curl -s -o /dev/null -w "%{http_code}" https://aipowerranking.com/tools/cursor
curl -s -o /dev/null -w "%{http_code}" https://aipowerranking.com/rankings

# All should return 200 or 307
```

**2. Monitor Error Rate**
```bash
# Check for errors
vercel logs --prod | grep -i error

# Should decrease after rollback
```

**3. Verify Baseline Metrics**
```bash
# Run Lighthouse
lighthouse https://aipowerranking.com --only-categories=performance

# Should match pre-deployment baseline
```

---

## Performance Optimization History

### ISR Optimization (v0.1.3)

**Issue**: 3.3s TTFB from blocking database query in layout
**Solution**: Static categories with build-time generation
**Result**: 90-96% TTFB reduction (3300ms → 50-300ms)

**Key Changes**:
- Created `/lib/data/static-categories.ts`
- Created `/scripts/generate-static-categories.ts`
- Modified `app/[lang]/layout.tsx` to use static categories
- Enabled ISR with 5-minute revalidation

### Tool Page ISR + CLS Fixes (v0.3.12)

**Issue**: Slow tool page load times and layout shifts
**Solution**: ISR on tool pages + CLS fixes
**Result**: 89% TTFB improvement on tool pages

**Key Changes**:
- Added `export const revalidate = 1800` to tool pages
- Added `minWidth` and `minHeight` to ToolIcon component
- Created ToolCardSkeleton component

### Phase 2A: Database Query Optimization (v0.3.13)

**Issue**: N+1 query pattern in rankings API
**Solution**: Batch queries with database indexes
**Result**: 48% TTFB reduction (1.41s → 0.73s)

**Key Changes**:
- Added `findBySlugs()` batch query method
- Added database indexes for rankings and tools tables
- Reduced query count: 46+ queries → 2-3 queries (-93%)

---

## Automated Testing Script

Save as `test-deployment.sh`:
```bash
#!/bin/bash
# test-deployment.sh - Automated deployment testing

echo "=== Deployment Testing Script ==="
echo "Testing deployment at: $(date)"
echo ""

# Test homepage
echo "1. Testing Homepage..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://aipowerranking.com)
echo "   Status: $STATUS (expected: 200 or 307)"

# Test tool pages (ISR)
echo "2. Testing Tool Pages (ISR)..."
for tool in cursor github-copilot v0-by-vercel; do
  echo "   Testing /tools/$tool..."
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://aipowerranking.com/tools/$tool)
  CACHE=$(curl -sI https://aipowerranking.com/tools/$tool | grep -i "x-vercel-cache" | awk '{print $2}')
  echo "     Status: $STATUS, Cache: $CACHE"
done

# Test main pages
echo "3. Testing Main Pages..."
for page in rankings news about; do
  echo "   Testing /$page..."
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://aipowerranking.com/$page)
  echo "     Status: $STATUS"
done

# Check for errors
echo "4. Checking for Errors..."
ERROR_COUNT=$(vercel logs --prod --since 5m 2>/dev/null | grep -i error | wc -l)
echo "   Error count (last 5 min): $ERROR_COUNT (expected: 0)"

echo ""
echo "=== Testing Complete ==="
```

Make executable:
```bash
chmod +x test-deployment.sh
```

---

## Checklist Summary

### Pre-Deployment ✓
- [ ] Local build succeeds
- [ ] Code review completed
- [ ] All tests pass
- [ ] Staging tested (recommended)
- [ ] Database migration plan (if applicable)
- [ ] Stakeholders notified

### Deployment ✓
- [ ] PR created and approved (or direct deploy)
- [ ] Database migrations applied (if applicable)
- [ ] Code deployed successfully
- [ ] Deployment status: Ready

### Post-Deployment ✓
- [ ] Smoke tests passed
- [ ] ISR cache verified (if applicable)
- [ ] TTFB measured and within targets
- [ ] Lighthouse tests run
- [ ] Error logs checked (no critical errors)
- [ ] Database indexes verified (if applicable)

### Monitoring (24 hours) ✓
- [ ] Vercel Analytics reviewed
- [ ] Performance metrics tracked
- [ ] Database performance monitored (if applicable)
- [ ] User feedback monitored
- [ ] No rollback triggers

### Success Criteria Met ✓
- [ ] All critical pages accessible
- [ ] Performance targets met
- [ ] Error rate within baseline
- [ ] Cache hit rate acceptable (if ISR)
- [ ] No data corruption
- [ ] Documentation updated
- [ ] Team notified of success

---

**Document Status**: ✅ READY FOR USE
**Created**: 2026-02-03
**Consolidates**: ISR Optimization, Performance Optimization v0.3.12, Phase 2A checklists
**Next Review**: After each deployment
