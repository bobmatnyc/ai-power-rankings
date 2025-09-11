# Production Database Migration Checklist

## Pre-Migration Checklist

### 1. Environment Preparation ✅

- [ ] **Verify Database URLs are configured**
  ```bash
  # Check .env.production has correct DATABASE_URL values
  cat .env.production | grep DATABASE_URL
  ```

- [ ] **Ensure Vercel environment variables are set**
  - DATABASE_URL (with pooling)
  - DATABASE_URL_UNPOOLED (without pooling)
  - USE_DATABASE="true"
  - DATABASE_MIGRATION_MODE="migrate"

- [ ] **Backup current JSON data**
  ```bash
  pnpm run backup:create
  ```

### 2. Local Testing ✅

- [ ] **Test database connection locally**
  ```bash
  # Set NODE_ENV to production and test
  NODE_ENV=production node -e "require('./src/lib/db/connection').testConnection()"
  ```

- [ ] **Generate migration files**
  ```bash
  # Generate migration SQL from schema
  NODE_ENV=production pnpm drizzle-kit generate
  ```

- [ ] **Review migration SQL**
  ```bash
  # Check generated migrations
  ls -la src/lib/db/migrations/
  cat src/lib/db/migrations/*.sql
  ```

- [ ] **Test migration locally (dry run)**
  ```bash
  # Run migration in dry-run mode
  DATABASE_MIGRATION_MODE=dry-run NODE_ENV=production pnpm drizzle-kit migrate
  ```

### 3. Data Migration Preparation ✅

- [ ] **Verify JSON to DB migration scripts**
  ```bash
  # Check migration script exists
  cat scripts/migrate-json-to-db.ts
  ```

- [ ] **Test data migration locally**
  ```bash
  # Run with test database first
  NODE_ENV=production pnpm tsx scripts/migrate-json-to-db.ts --dry-run
  ```

- [ ] **Validate data integrity**
  - Count records in JSON files
  - Compare with expected database records
  - Verify all required fields are mapped

## Production Migration Steps

### Step 1: Database Schema Migration

1. **Set Vercel to maintenance mode (optional)**
   ```bash
   # If you have a maintenance mode
   vercel env add MAINTENANCE_MODE production
   # Set value to "true"
   ```

2. **Run schema migration**
   ```bash
   # Apply database schema
   NODE_ENV=production pnpm drizzle-kit push
   ```

3. **Verify schema creation**
   - Check Neon dashboard for tables
   - Verify all tables are created
   - Check indexes and constraints

### Step 2: Data Migration

1. **Migrate tools data**
   ```bash
   NODE_ENV=production pnpm tsx scripts/json-migration/migrate-to-json.ts --type tools
   ```

2. **Migrate rankings data**
   ```bash
   NODE_ENV=production pnpm tsx scripts/json-migration/migrate-to-json.ts --type rankings
   ```

3. **Migrate news data**
   ```bash
   NODE_ENV=production pnpm tsx scripts/json-migration/migrate-to-json.ts --type news
   ```

4. **Verify data migration**
   ```sql
   -- Run these queries in Neon SQL Editor
   SELECT COUNT(*) FROM tools;
   SELECT COUNT(*) FROM rankings;
   SELECT COUNT(*) FROM news;
   ```

### Step 3: Application Deployment

1. **Deploy with database enabled**
   ```bash
   # Ensure USE_DATABASE=true is set in Vercel
   vercel --prod
   ```

2. **Monitor deployment**
   - Check Vercel Function logs
   - Watch for database connection errors
   - Verify API endpoints work

3. **Test critical paths**
   - [ ] Homepage loads with rankings
   - [ ] Tool pages display correctly
   - [ ] News section shows articles
   - [ ] Search functionality works
   - [ ] Admin features (if applicable)

### Step 4: Post-Migration Verification

1. **Performance checks**
   ```bash
   # Run performance audit
   pnpm run perf:audit
   ```

2. **Database metrics**
   - Check connection pool usage in Neon
   - Monitor query performance
   - Review slow query logs

3. **Application monitoring**
   - Check error rates in Vercel
   - Monitor response times
   - Verify cache invalidation

## Rollback Plan

### If Migration Fails

1. **Immediate rollback**
   ```bash
   # Disable database in Vercel
   vercel env rm USE_DATABASE production
   vercel env add USE_DATABASE production
   # Set value to "false"
   
   # Redeploy
   vercel --prod --force
   ```

2. **Database cleanup (if needed)**
   ```sql
   -- Drop all tables (CAUTION!)
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```

3. **Restore from backup**
   ```bash
   # If JSON data was modified
   pnpm run backup:restore --date [backup-date]
   ```

## Migration Commands Reference

### Drizzle Commands
```bash
# Generate migration files
pnpm drizzle-kit generate

# Apply migrations
pnpm drizzle-kit migrate

# Push schema directly (development)
pnpm drizzle-kit push

# Drop all migrations
pnpm drizzle-kit drop

# Check migration status
pnpm drizzle-kit check
```

### Custom Migration Scripts
```bash
# Migrate all JSON to database
NODE_ENV=production pnpm tsx scripts/migrate-json-to-db.ts

# Migrate specific data type
NODE_ENV=production pnpm tsx scripts/json-migration/migrate-to-json.ts --type [tools|rankings|news]

# Dry run (no changes)
NODE_ENV=production pnpm tsx scripts/migrate-json-to-db.ts --dry-run
```

### Database Testing
```bash
# Test connection
NODE_ENV=production node -e "require('./src/lib/db/connection').testConnection()"

# Run SQL query
NODE_ENV=production node -e "
  const { getDb } = require('./src/lib/db/connection');
  const db = getDb();
  // Your query here
"
```

## Monitoring Post-Migration

### Key Metrics to Watch

1. **Database Performance**
   - Connection pool utilization (< 80%)
   - Query response time (< 100ms avg)
   - Failed connections (should be 0)

2. **Application Performance**
   - Page load time
   - API response time
   - Error rate

3. **Resource Usage**
   - Database storage
   - Bandwidth usage
   - Function execution time

### Alerts to Set Up

1. **Database Alerts**
   - Connection pool exhaustion
   - Slow queries (> 1s)
   - Failed authentication

2. **Application Alerts**
   - 500 errors spike
   - Response time degradation
   - Memory usage spike

## Success Criteria

The migration is considered successful when:

- ✅ All database tables are created correctly
- ✅ All JSON data is migrated without loss
- ✅ Application connects to database without errors
- ✅ All features work as expected
- ✅ Performance metrics are within acceptable range
- ✅ No data integrity issues reported
- ✅ Monitoring shows stable operation for 24 hours

## Contact for Issues

**During Migration:**
- Monitor Neon dashboard: https://console.neon.tech
- Check Vercel logs: https://vercel.com/[team]/ai-power-rankings/functions
- Review application logs in real-time

**Issue Escalation:**
1. Check this checklist for common issues
2. Review error logs in Vercel/Neon
3. Test with local production configuration
4. Contact database/platform support if needed

## Notes

- Always run migrations during low-traffic periods
- Keep backup of JSON data until confident in database
- Consider running hybrid mode (both JSON and DB) initially
- Document any deviations from this plan