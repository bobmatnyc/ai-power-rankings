# Algorithm v7.3 Deployment - Quick Reference

**Quick access guide for deploying Algorithm v7.3 rankings to production.**

---

## TL;DR - Critical Discovery

**DATABASE_URL and DATABASE_URL_DEVELOPMENT point to the same database endpoint.**

This means:
- ✅ Development and production share the same database
- ✅ If you've run `generate-v73-rankings.ts` locally, rankings are already in production
- ⚠️ Any script execution directly affects the live database

**Recommended Action:** Run verification first, then decide if re-deployment is needed.

---

## Quick Commands

### 1. Verify Current State (RECOMMENDED FIRST STEP)
```bash
npx tsx scripts/verify-v73-deployment.ts
```

**What it checks:**
- Rankings exist for period 2025-11
- Algorithm version is 7.3
- Score distribution meets criteria (<20% duplicates)
- Top 10 tools have unique scores
- Previous rankings correctly unmarked

**Exit codes:**
- `0` = All checks passed, v7.3 is deployed
- `1` = Checks failed, deployment needed or issues detected

---

### 2. Backup Current Rankings (Before Any Changes)
```bash
npx tsx scripts/backup-current-rankings.ts
```

**Output:**
- Creates backup in `.ranking-backups/`
- Filename includes timestamp and version
- Creates `latest-backup.json` symlink

**Use when:**
- Before running generation script
- Before any database modifications
- As safety measure for rollback

---

### 3. Generate v7.3 Rankings (If Needed)
```bash
NODE_ENV=production npx tsx scripts/generate-v73-rankings.ts
```

**What it does:**
- Loads all active tools from database
- Calculates scores with Algorithm v7.3
- Unsets previous `is_current = true` rankings
- Inserts new rankings for period 2025-11
- Marks as `is_current = true`

**Duration:** ~30-60 seconds

**Database operations:**
- UPDATE rankings SET is_current = false
- INSERT INTO rankings (new period 2025-11)

---

### 4. Restore from Backup (If Issues)
```bash
npx tsx scripts/restore-rankings-backup.ts .ranking-backups/latest-backup.json
```

**What it does:**
- Creates pre-restore backup automatically
- Clears existing rankings
- Restores all periods from backup
- Sets correct period as current

**Safety:**
- Prompts for confirmation before restore
- Creates backup of current state first
- Validates restoration success

---

## Decision Tree

```
START
  |
  v
Run verify-v73-deployment.ts
  |
  ├─> All checks pass? ──> ✅ DONE - Already deployed!
  |                         │
  |                         └─> Announce to users
  |
  └─> Checks fail? ──> Create backup
       |                   |
       |                   v
       |             Run generate-v73-rankings.ts
       |                   |
       |                   v
       |             Verify deployment again
       |                   |
       |                   ├─> Pass? ──> ✅ DONE!
       |                   |
       |                   └─> Fail? ──> Restore from backup
       |                                      |
       |                                      v
       |                                  Investigate issues
```

---

## File Locations

### Scripts
- **Verification:** `/scripts/verify-v73-deployment.ts`
- **Generation:** `/scripts/generate-v73-rankings.ts`
- **Backup:** `/scripts/backup-current-rankings.ts`
- **Restore:** `/scripts/restore-rankings-backup.ts`

### Documentation
- **Full Plan:** `/docs/research/V73_PRODUCTION_DEPLOYMENT_PLAN.md`
- **Quick Reference:** `/docs/research/V73_DEPLOYMENT_QUICK_REFERENCE.md` (this file)

### Algorithm Implementation
- **Algorithm v7.3:** `/lib/ranking-algorithm-v73.ts`
- **Weights Config:** `ALGORITHM_V73_WEIGHTS` constant

### Backups
- **Directory:** `.ranking-backups/`
- **Latest Symlink:** `.ranking-backups/latest-backup.json`
- **Naming:** `rankings-backup-{period}-v{version}-{timestamp}.json`

---

## Environment Configuration

### Current Setup (.env.local)
```env
DATABASE_URL=postgresql://...@ep-dark-firefly-adp1p3v8-pooler...
DATABASE_URL_DEVELOPMENT=postgresql://...@ep-dark-firefly-adp1p3v8-pooler...
```

**Database Endpoint:** `ep-dark-firefly-adp1p3v8`
**Status:** Both variables point to same database

### How Scripts Select Database

**Via lib/db/connection.ts:**
```typescript
// Development mode
if (NODE_ENV === "development") {
  const devUrl = process.env.DATABASE_URL_DEVELOPMENT;
  const fallbackUrl = process.env.DATABASE_URL;
  // Uses DATABASE_URL_DEVELOPMENT if available
}

// Production mode
if (NODE_ENV === "production") {
  const prodUrl = process.env.DATABASE_URL;
  // Uses DATABASE_URL only
}
```

**Script execution:**
- Without `NODE_ENV=production` → Uses development logic
- With `NODE_ENV=production` → Uses production logic
- **Result:** Both connect to same database currently

---

## Success Criteria

### Algorithm v7.3 Goals
- ✅ Reduce duplicate scores from 72.5% (v7.2) to <20%
- ✅ All top 10 tools have unique scores
- ✅ Top 20 tools ideally have unique scores
- ✅ Deterministic and reproducible scoring
- ✅ Better differentiation through tiebreakers

### Verification Must Pass
1. Period is `2025-11`
2. Algorithm version is `7.3`
3. Rankings marked as `is_current = true`
4. Duplicate percentage < 20%
5. Top 10 all unique scores
6. Previous rankings unmarked (`is_current = false`)
7. Movement data present and valid

---

## Common Issues & Solutions

### Issue: "No current rankings found"
**Cause:** No rankings with `is_current = true` in database
**Solution:** Run `generate-v73-rankings.ts` to create rankings

### Issue: "Wrong algorithm version"
**Cause:** Different algorithm version deployed than expected
**Solution:** Verify which version is deployed, re-run if needed

### Issue: "High duplicate percentage"
**Cause:** Algorithm calculation issue or data quality problems
**Solution:**
1. Check tool data in database for completeness
2. Verify algorithm v7.3 implementation
3. Review tiebreaker logic

### Issue: "Previous rankings still marked current"
**Cause:** Generation script didn't unset previous rankings
**Solution:**
1. Manually unset: `UPDATE rankings SET is_current = false WHERE period != '2025-11'`
2. Or re-run generation script

### Issue: "Restore backup not found"
**Cause:** Backup file path incorrect or doesn't exist
**Solution:**
1. List backups: `ls -la .ranking-backups/`
2. Use full path or check filename
3. Use symlink: `.ranking-backups/latest-backup.json`

---

## Safety Checklist

Before deploying to production:
- [ ] Verify current database state
- [ ] Create backup of current rankings
- [ ] Review generation script for any hardcoded values
- [ ] Confirm algorithm v7.3 implementation is correct
- [ ] Test in low-traffic period (optional but recommended)
- [ ] Have rollback contact available
- [ ] Monitor application logs during deployment

After deployment:
- [ ] Run verification script
- [ ] Check rankings API endpoint
- [ ] Verify frontend displays correctly
- [ ] Test tool detail pages
- [ ] Monitor error logs for 1 hour
- [ ] Keep backup for at least 7 days

---

## Emergency Contacts

**If deployment fails:**
1. Run verification to understand issue
2. Restore from backup if critical
3. Review error logs
4. Check database connection status
5. Verify tool data integrity

**Rollback decision criteria:**
- Rankings not displaying correctly
- API errors on rankings endpoints
- Data integrity issues
- User-facing errors
- Calculation errors in scores

**When in doubt:** Restore from backup and investigate offline

---

## Monitoring After Deployment

### Immediate (First 5 minutes)
```bash
# Check API response
curl https://aipowerranking.com/api/rankings/current | jq '.period, .algorithm_version'

# Check logs
# (View application logs for errors)
```

### Short-term (First hour)
- Monitor error rates
- Check rankings page load times
- Verify tool detail pages
- Review user feedback channels

### Medium-term (First 24 hours)
- Analytics on rankings page traffic
- User engagement metrics
- Database performance
- Cache effectiveness

---

## Version History

**v7.3 Changes:**
- Better defaults when metrics missing
- Improved tiebreakers (feature count → description → pricing → alphabetical)
- Enhanced category differentiation with subcategory scoring
- Data-driven adjustments from available tool data
- Target: <20% duplicate scores (vs 72.5% in v7.2)

**Previous Versions:**
- v7.2: Increased agentic capability weight to 35%
- v7.1: Initial production algorithm
- v7.0: Development/testing version

---

## Quick Tips

1. **Always verify first** - Don't assume rankings need re-deployment
2. **Backup before changes** - Safety net for rollback
3. **Use verification script** - Automated checks catch issues
4. **Monitor after deployment** - Early detection of problems
5. **Keep backups** - Retain for at least one week
6. **Document changes** - Track what was done and when
7. **Low-traffic deployment** - Minimize user impact if issues occur

---

## Next Steps After Successful Deployment

1. **Update What's New modal** with v7.3 improvements
2. **Consider blog post** about algorithm enhancements
3. **Monitor user feedback** on ranking changes
4. **Track success metrics** (duplicate %, top 10 uniqueness)
5. **Plan next iteration** based on v7.3 results
6. **Archive deployment docs** for future reference

---

## Support Resources

- **Full Deployment Plan:** `V73_PRODUCTION_DEPLOYMENT_PLAN.md`
- **Algorithm Documentation:** `lib/ranking-algorithm-v73.ts` (comments)
- **Database Schema:** `lib/db/schema.ts`
- **Connection Logic:** `lib/db/connection.ts`

---

**Last Updated:** 2025-11-01
**Document Version:** 1.0
**Algorithm Version:** v7.3
**Target Period:** 2025-11
