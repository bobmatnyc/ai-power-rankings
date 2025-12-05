# Release Deployment Checklist

General deployment checklist for all releases of AI Power Ranking.

## Pre-Deployment

### Code Quality
- [ ] All TypeScript/ESLint errors resolved
- [ ] All tests passing (unit, integration, e2e)
- [ ] No console errors in browser
- [ ] Build succeeds locally (`npm run build`)

### Git Status
- [ ] All changes committed
- [ ] On `main` branch
- [ ] Synced with remote (`git pull`)
- [ ] No uncommitted changes (`git status`)

### Version Decision
- [ ] Determined version type (patch/minor/major)
- [ ] Prepared changelog message
- [ ] Reviewed breaking changes (if major)

### Environment Verification
- [ ] `.env.local` configured correctly
- [ ] Database migrations tested
- [ ] API keys valid and not expired

## Deployment

### Test Deployment
```bash
# 1. Run dry run
./scripts/deploy.sh --dry-run patch "Your message"

# 2. Review output
# - Check version bump is correct
# - Verify CHANGELOG.md format
# - Confirm git operations
```

- [ ] Dry run completed successfully
- [ ] Version increment is correct
- [ ] CHANGELOG message is accurate

### Execute Deployment
```bash
# Deploy for real
./scripts/deploy.sh patch "Your changelog message"
```

- [ ] Script completed without errors
- [ ] Git commit created
- [ ] Git tag created
- [ ] Changes pushed to remote

## Post-Deployment

### Vercel Verification
- [ ] Visit https://vercel.com/dashboard
- [ ] Verify build started
- [ ] Build completed successfully
- [ ] No build warnings or errors
- [ ] Deployment shows "Ready"

### Production Testing
- [ ] Homepage loads: https://aipowerranking.com
- [ ] Sitemap accessible: https://aipowerranking.com/sitemap.xml
- [ ] API endpoints responding
- [ ] No console errors
- [ ] Performance acceptable (Lighthouse/WebPageTest)

### Critical Paths
Test these core features:

- [ ] **Rankings Page**
  - Tools list loads
  - Sorting works
  - Filtering works
  - Individual tool pages load

- [ ] **Search**
  - Search functionality works
  - Results are relevant
  - No errors

- [ ] **Navigation**
  - All menu items work
  - Footer links work
  - Mobile navigation works

- [ ] **SEO**
  - Meta tags present
  - Open Graph tags correct
  - Sitemap valid XML
  - Robots.txt accessible

### GitHub Release
- [ ] Visit: https://github.com/bobmatnyc/ai-power-rankings/releases
- [ ] Click "Draft a new release"
- [ ] Select tag: `v{version}`
- [ ] Add release title: `v{version}`
- [ ] Copy changelog from CHANGELOG.md
- [ ] Publish release

### Monitoring
First Hour:
- [ ] Monitor error rates (if applicable)
- [ ] Check analytics for traffic drop
- [ ] Verify Google Search Console (no new errors)
- [ ] Monitor Vercel logs for errors

First 24 Hours:
- [ ] Review analytics daily active users
- [ ] Check for user-reported issues
- [ ] Monitor performance metrics
- [ ] Verify rankings update correctly

### Documentation Updates
- [ ] Update version in README (if needed)
- [ ] Add migration guide (if breaking changes)
- [ ] Update API documentation (if API changes)
- [ ] Notify team of deployment

## Rollback Plan

If issues are detected:

### Quick Rollback (git)
```bash
# 1. Revert commit
git revert HEAD

# 2. Push revert
git push origin main

# 3. Vercel will auto-deploy revert
```

### Full Rollback (Vercel)
1. Go to Vercel Dashboard
2. Find previous deployment
3. Click "Promote to Production"
4. Confirm rollback

### Cleanup After Rollback
```bash
# Delete tag locally
git tag -d v{version}

# Delete tag remotely
git push origin :refs/tags/v{version}

# Update package.json version
npm version {previous-version} --no-git-tag-version

# Commit version fix
git add package.json
git commit -m "chore: revert version to {previous-version}"
git push
```

## Sign-Off

### Deployment Information
- **Version:** `v______`
- **Type:** `[ ] patch [ ] minor [ ] major`
- **Date:** `____-__-__`
- **Deployed By:** `___________`

### Verification
- **Build Status:** `[ ] Success [ ] Failed`
- **Tests Status:** `[ ] Passed [ ] Failed`
- **Production:** `[ ] Verified [ ] Issues`

### Notes
```
[Add any deployment notes, issues encountered, or follow-up items]
```

---

**Template Version:** 1.0.0
**Last Updated:** 2025-12-05
