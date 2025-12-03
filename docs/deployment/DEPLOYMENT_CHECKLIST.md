# Deployment Checklist - Performance Optimization v0.3.12

**Purpose**: Step-by-step deployment guide for performance optimization changes
**Risk Level**: 🟢 LOW (approved scope only)
**Estimated Time**: 30-45 minutes (including monitoring)

---

## Pre-Deployment Verification

### 1. Build Verification ✅

**Verify local build succeeds**:
```bash
# Clean build
rm -rf .next
npm run build

# Expected output:
# ✓ Compiled successfully
# Route (app)                              Size     First Load JS
# ○ /[lang]/tools/[slug]                  [ISR]    XXX kB
# ƒ /[lang]/about                         [dynamic] XXX kB
# ... (87 total routes)
```

**Success Criteria**:
- ✅ Build completes without errors
- ✅ No "useSearchParams() suspense boundary" errors
- ✅ Tool pages show `[ISR]` indicator
- ✅ Other pages show `[dynamic]` indicator
- ✅ Total routes: 87

### 2. Code Review ✅

**Files to review**:
```bash
# Tool page ISR
git diff main -- app/[lang]/tools/[slug]/page.tsx

# CLS fixes
git diff main -- components/ui/tool-icon.tsx
git diff main -- components/ui/skeleton.tsx
```

**Review Checklist**:
- ✅ Only 3 files modified (tool-icon.tsx, skeleton.tsx, tools/[slug]/page.tsx)
- ✅ Tool page has `export const revalidate = 1800`
- ✅ ToolIcon has `minWidth` and `minHeight` style properties
- ✅ ToolCardSkeleton component exists in skeleton.tsx
- ✅ No other pages have ISR enabled (all others use `force-dynamic`)

### 3. Test Coverage ✅

**Run existing tests**:
```bash
# Unit tests (if available)
npm test

# E2E tests (if available)
npm run test:e2e

# Type checking
npm run type-check
```

**Success Criteria**:
- ✅ All tests pass
- ✅ No new TypeScript errors
- ✅ No breaking changes

### 4. Staging Deployment (Recommended) ⚠️

**Deploy to Vercel preview**:
```bash
# Create preview deployment
vercel deploy

# Test preview URL
# https://aipowerranking-XXXXX.vercel.app
```

**Manual Testing on Preview**:
- ✅ Visit `/tools/cursor` - should load fast
- ✅ Visit `/tools/github-copilot` - should load fast
- ✅ Visit `/` (homepage) - should work normally
- ✅ Visit `/rankings` - should work normally
- ✅ Visit `/about` - should work normally
- ✅ Check browser console - no errors

**Performance Testing on Preview**:
```bash
# Test TTFB on tool pages
curl -w "@curl-format.txt" -o /dev/null -s https://aipowerranking-XXXXX.vercel.app/tools/cursor

# Expected: TTFB < 500ms (first request may be slower)

# Run Lighthouse
lighthouse https://aipowerranking-XXXXX.vercel.app/tools/cursor --only-categories=performance

# Expected: Performance score improvement
```

---

## Deployment Commands

### Option 1: Merge to Main (Recommended)

**Step 1: Create Pull Request**
```bash
# Push branch
git push origin feature/performance-optimization

# Create PR via GitHub UI or CLI
gh pr create --title "Performance Optimization: Tool Page ISR + CLS Fixes" \
  --body "Implements ISR on tool pages (51 pages) and fixes CLS issues. Expected 89% TTFB improvement on tool pages."
```

**Step 2: Review and Merge**
```bash
# After approval, merge PR
gh pr merge --squash
```

**Step 3: Vercel Auto-Deploy**
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

---

## Post-Deployment Monitoring

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

# Test tool pages (ISR enabled)
curl -s -o /dev/null -w "%{http_code}" https://aipowerranking.com/tools/cursor
# Expected: 200

# Test rankings (force-dynamic)
curl -s -o /dev/null -w "%{http_code}" https://aipowerranking.com/rankings
# Expected: 200
```

**3. Check for Build Errors**
```bash
# Monitor logs
vercel logs --prod | grep -i error

# Expected: No critical errors
```

**4. Verify ISR Cache**
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

**5. Monitor TTFB on Tool Pages**
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
# Homepage (baseline - should be unchanged)
lighthouse https://aipowerranking.com \
  --only-categories=performance \
  --output=json \
  --output-path=./lighthouse-homepage.json

# Tool page (should show improvement)
lighthouse https://aipowerranking.com/tools/cursor \
  --only-categories=performance \
  --output=json \
  --output-path=./lighthouse-tool-page.json

# Expected improvements on tool pages:
# - TTFB: < 500ms
# - FCP: < 1.5s
# - LCP: < 2.0s
# - CLS: < 0.1
```

**7. Monitor Cache Hit Rate**
```bash
# Test multiple tool pages
for tool in cursor github-copilot v0-by-vercel replit-agent codeium; do
  echo "Testing /tools/$tool"
  curl -I https://aipowerranking.com/tools/$tool 2>&1 | grep -i "x-vercel-cache"
  sleep 2
done

# Expected: Mostly HIT after first request to each page
```

**8. Check Error Logs**
```bash
# Monitor for 500 errors
vercel logs --prod | grep "500"

# Monitor for any errors
vercel logs --prod | grep -i "error" | head -20

# Expected: No critical errors related to ISR or CLS
```

### Medium-Term Monitoring (1-24 hours)

**9. Vercel Analytics Dashboard**
- Open Vercel Dashboard > Project > Analytics
- Check metrics:
  - **TTFB p95**: Should decrease on tool pages
  - **Cache Hit Rate**: Should be > 80% on tool pages
  - **Error Rate**: Should remain at baseline (< 0.1%)
  - **Requests/min**: Should remain stable

**10. Real User Monitoring**
```bash
# If using Google Analytics or similar
# Check Core Web Vitals:
# - CLS should improve site-wide
# - LCP should improve on tool pages
# - TTFB should improve on tool pages
```

**11. User Feedback Monitoring**
- Monitor support channels for:
  - Stale content reports (ISR cache issues)
  - Layout shift complaints (CLS regressions)
  - Performance improvements (positive feedback)

---

## Performance Metrics to Track

### Key Performance Indicators (KPIs)

**Tool Pages** (ISR-enabled):
| Metric | Baseline | Target | Alert Threshold |
|--------|----------|--------|-----------------|
| TTFB (p50) | 2.7s | < 100ms | > 500ms 🚨 |
| TTFB (p95) | 3.5s | < 300ms | > 1s 🚨 |
| Cache Hit Rate | 0% | > 95% | < 80% ⚠️ |
| FCP (p75) | 3.56s | < 1.5s | > 2s ⚠️ |
| LCP (p75) | 4.01s | < 2.0s | > 3s ⚠️ |
| CLS (p75) | 0.25 | < 0.10 | > 0.15 ⚠️ |

**Main Pages** (force-dynamic):
| Metric | Baseline | Expected | Alert Threshold |
|--------|----------|----------|-----------------|
| TTFB (p95) | 2.7s | No change | > 3.5s 🚨 |
| CLS (p75) | 0.25 | < 0.10 | > 0.15 ⚠️ |
| Error Rate | < 0.1% | No change | > 0.5% 🚨 |

**Site-Wide**:
| Metric | Baseline | Target | Alert Threshold |
|--------|----------|--------|-----------------|
| Real Experience Score | 61 | ~73 | < 65 ⚠️ |
| Database Queries/min | High | -40% | Spike > 150% 🚨 |
| Build Time | ~1 min | < 2 min | > 3 min ⚠️ |

### Monitoring Tools

**Vercel Dashboard**:
- Analytics > Performance
- Analytics > Cache Hit Rate
- Logs > Real-time

**Lighthouse CI** (if configured):
```bash
# Run automated tests
lhci autorun

# Expected: Performance score improvement on tool pages
```

**Chrome User Experience Report (CrUX)**:
- Wait 24-48 hours for real user data
- Check Google Search Console > Core Web Vitals
- Expected: Gradual improvement in tool page metrics

---

## Rollback Procedures

### When to Rollback

**🔴 Immediate Rollback Triggers**:
- Build failures preventing deployment
- 500 error spike (> 10 errors/minute)
- Complete cache failure (0% hit rate)
- Production outage (site down)

**🟡 Consider Rollback Triggers**:
- TTFB regression (tool pages > 2s consistently)
- Cache hit rate < 70% after 1 hour
- User reports of stale content (> 5 reports)
- CLS regression (> 0.20 site-wide)

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
# Revert only tool page ISR
git checkout HEAD~1 app/[lang]/tools/[slug]/page.tsx
git commit -m "Rollback: Revert tool page ISR due to [reason]"
git push origin main

# OR revert only CLS fixes
git checkout HEAD~1 components/ui/tool-icon.tsx components/ui/skeleton.tsx
git commit -m "Rollback: Revert CLS fixes due to [reason]"
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

## Communication Plan

### Before Deployment

**Notify Stakeholders**:
- Subject: "Scheduled Performance Optimization Deployment - Tool Pages"
- When: 30 minutes before deployment
- Who: Engineering team, product manager, support team
- What: Brief overview of changes, expected improvements, deployment window

**Example Message**:
```
Subject: Scheduled Performance Optimization Deployment - Today at [TIME]

Team,

We'll be deploying performance optimizations today at [TIME]:

Changes:
- ISR enabled on 51 tool detail pages (e.g., /tools/cursor)
- CLS fixes for tool icons site-wide

Expected Impact:
- 89% faster load times on tool pages (2.7s → 300ms TTFB)
- 68% reduction in layout shifts site-wide
- No changes to main pages (homepage, rankings, news)

Risk Level: LOW (tested and verified)
Deployment Time: ~5 minutes
Rollback Plan: Ready (3-minute rollback if needed)

Monitoring: We'll monitor for 1 hour post-deployment.

Questions? Reply to this thread.
```

### During Deployment

**Status Updates**:
```
[HH:MM] Deployment started
[HH:MM+1] Build completed successfully
[HH:MM+2] Deployment live, running smoke tests
[HH:MM+5] Smoke tests passed, monitoring in progress
```

### After Deployment

**Success Notification**:
```
Subject: ✅ Performance Optimization Deployed Successfully

Team,

Performance optimization deployment completed successfully at [TIME].

Initial Results (first 30 minutes):
- Build: ✅ Success (no errors)
- Tool pages: ✅ TTFB reduced to ~300ms (from 2.7s)
- Cache hit rate: ✅ 85% (target: 95%)
- Error rate: ✅ No increase (< 0.1%)
- Layout shifts: ✅ CLS improved to ~0.08 (from 0.25)

Monitoring Plan:
- Next 24 hours: Active monitoring of metrics
- Next 7 days: Weekly performance review
- Action: No action needed unless alerts triggered

Expected User Impact:
- Tool pages load 89% faster
- Smoother page layouts (no content jumping)
- No visible changes to main pages

Questions? Let me know.
```

**Issue Notification (if needed)**:
```
Subject: ⚠️ Performance Optimization Deployment - Issue Detected

Team,

We detected an issue with the performance optimization deployment:

Issue: [Description of issue]
Impact: [User impact]
Action Taken: [Rollback/Fix]
Current Status: [Resolved/In Progress]

Timeline:
[HH:MM] Issue detected
[HH:MM+5] Rollback initiated
[HH:MM+8] Rollback complete, site stable

Root Cause: [If known]
Next Steps: [Investigation/Fix plan]

User Impact: [Duration and scope]
```

---

## Success Criteria

### Deployment Success ✅

**Must Have** (All required):
- ✅ Build completes without errors
- ✅ All routes accessible (no 404s or 500s)
- ✅ Tool pages serve from ISR cache (x-vercel-cache: HIT)
- ✅ Cache hit rate > 70% within 1 hour
- ✅ Error rate remains < 0.5%

**Should Have** (Expected):
- ⭐ Tool page TTFB < 500ms (p95)
- ⭐ Cache hit rate > 85% within 1 hour
- ⭐ CLS < 0.10 (p75) site-wide
- ⭐ No user complaints in first 24 hours

**Could Have** (Stretch):
- 🎯 Tool page TTFB < 300ms (p95)
- 🎯 Cache hit rate > 95%
- 🎯 CLS < 0.08 (p75)
- 🎯 Positive user feedback

### Monitoring Duration

**Active Monitoring** (Required):
- First 1 hour: Every 10 minutes
- First 24 hours: Every 2 hours
- First week: Daily reviews

**Passive Monitoring** (Ongoing):
- Weekly performance reviews
- Monthly optimization assessments
- Quarterly strategic planning

---

## Troubleshooting Guide

### Issue: Build Failure

**Symptoms**:
```
⨯ useSearchParams() should be wrapped in a suspense boundary
Error occurred prerendering page "/en/about"
```

**Cause**: ISR enabled on page with Clerk authentication

**Solution**:
```bash
# Revert ISR on affected page
git checkout HEAD~1 app/[lang]/about/page.tsx
git commit -m "Revert: ISR on about page (Clerk incompatibility)"
git push origin main
```

### Issue: Stale Content

**Symptoms**: Users report seeing old data on tool pages

**Diagnosis**:
```bash
# Check cache age
curl -I https://aipowerranking.com/tools/cursor | grep age

# If age > 1800 (30 minutes), revalidation may be stuck
```

**Solution**:
```bash
# Manual cache invalidation (if admin API available)
curl -X POST https://aipowerranking.com/api/admin/cache/invalidate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"path": "/tools/*"}'

# OR redeploy to force cache clear
vercel --prod --force
```

### Issue: Low Cache Hit Rate

**Symptoms**: Cache hit rate < 70% after 1 hour

**Diagnosis**:
```bash
# Check cache headers
curl -I https://aipowerranking.com/tools/cursor | grep -i cache

# Expected:
# cache-control: s-maxage=1800, stale-while-revalidate
# x-vercel-cache: HIT
```

**Possible Causes**:
1. Query parameters in URLs (each unique URL = separate cache entry)
2. Revalidation interval too short
3. High manual invalidation frequency
4. Vercel Edge Network issues

**Solution**:
```bash
# Check query parameters in logs
vercel logs --prod | grep "/tools/" | grep "?"

# If many query params, normalize URLs or increase revalidation time
```

### Issue: TTFB Regression

**Symptoms**: Tool page TTFB > 1s consistently

**Diagnosis**:
```bash
# Test TTFB
curl -w "@curl-format.txt" -o /dev/null -s https://aipowerranking.com/tools/cursor

# Check if ISR is working
curl -I https://aipowerranking.com/tools/cursor | grep "x-vercel-cache"
```

**Possible Causes**:
1. Cache not working (all MISS)
2. Revalidation happening too frequently
3. Database query slowdown
4. Cold start issues

**Solution**:
```bash
# If cache MISS, check ISR configuration
grep "revalidate" app/[lang]/tools/[slug]/page.tsx

# Should show: export const revalidate = 1800

# If correct but still MISS, check Vercel Edge Network status
# https://www.vercel-status.com/
```

### Issue: CLS Regression

**Symptoms**: Layout shifts increased (CLS > 0.20)

**Diagnosis**:
```bash
# Run Lighthouse
lighthouse https://aipowerranking.com/tools/cursor --only-categories=performance

# Check CLS score in report
```

**Solution**:
```bash
# Revert CLS fixes
git checkout HEAD~1 components/ui/tool-icon.tsx components/ui/skeleton.tsx
git commit -m "Rollback: CLS fixes causing regression"
git push origin main
```

---

## Appendix: Testing Commands

### Create curl-format.txt

```bash
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
```

### Automated Testing Script

```bash
#!/bin/bash
# test-deployment.sh

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

# Test main pages (force-dynamic)
echo "3. Testing Main Pages (force-dynamic)..."
for page in rankings news about; do
  echo "   Testing /$page..."
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://aipowerranking.com/$page)
  echo "     Status: $STATUS"
done

# Check for errors
echo "4. Checking for Errors..."
ERROR_COUNT=$(vercel logs --prod --since 5m | grep -i error | wc -l)
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
- [ ] Tests pass
- [ ] Staging tested (recommended)
- [ ] Stakeholders notified

### Deployment ✓
- [ ] PR created and approved
- [ ] Merged to main
- [ ] Vercel auto-deploy triggered
- [ ] Deployment status: Ready

### Post-Deployment ✓
- [ ] Smoke tests passed
- [ ] ISR cache verified (HIT)
- [ ] TTFB measured (< 500ms)
- [ ] Lighthouse tests run
- [ ] Error logs checked (no critical errors)
- [ ] Cache hit rate monitored (> 80%)

### Monitoring (24 hours) ✓
- [ ] Vercel Analytics reviewed
- [ ] Performance metrics tracked
- [ ] User feedback monitored
- [ ] No rollback triggers

### Success Criteria Met ✓
- [ ] All "Must Have" criteria met
- [ ] Most "Should Have" criteria met
- [ ] Documentation updated
- [ ] Team notified of success

---

**Document Status**: ✅ READY FOR USE
**Last Updated**: December 2, 2025
**Next Review**: After deployment completion
