# Database Environment Update Commands

## Issue Summary
- Production is correctly using: `ep-wispy-fog-ad8d4skz-pooler` (production database)
- Staging is incorrectly using: `ep-bold-sunset-adneqlo6-pooler` (development database)
- Both should use the same production database

## Required Commands

### 1. Update Staging Environment

```bash
# Remove existing staging DATABASE_URL
vercel env rm DATABASE_URL
# When prompted:
# - Select "staging" from the environment list
# - Confirm with "y"

# Add production DATABASE_URL to staging
vercel env add DATABASE_URL staging
# When prompted for value, paste:
postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-wispy-fog-ad8d4skz-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### 2. Verify Changes

```bash
# Pull updated environment variables
vercel env pull .env.staging.updated --environment=preview

# Check the updated value
grep "DATABASE_URL=" .env.staging.updated
# Should show: ep-wispy-fog-ad8d4skz-pooler (production database)

# Check production (should remain unchanged)
vercel env pull .env.production.check --environment=production
grep "DATABASE_URL=" .env.production.check
# Should show: ep-wispy-fog-ad8d4skz-pooler (same as staging now)
```

### 3. Trigger Redeployment

```bash
# Trigger staging redeployment to pick up new database
vercel deploy --prebuilt

# Trigger production redeployment if needed
vercel deploy --prod --prebuilt
```

### 4. Verification

After deployment, both environments should show:
- Database: Production (not "Development")
- Same database endpoint: ep-wispy-fog-ad8d4skz-pooler
- Connected status

## Expected Result

Both staging and production will display:
```
Database: Production | neondb | ep-wispy-fog-ad8d4skz-pooler.c-2.us-east-1.aws.neon.tech | Connected | neon
```

Instead of the current staging showing:
```
Database: Development | neondb | ep-bold-sunset-adneqlo6-pooler.c-2.us-east-1.aws.neon.tech | Connected | neon
```

## Safety Notes

- The production database `ep-wispy-fog-ad8d4skz` is the correct production database per documentation
- Both staging and production will now share the same database as requested
- All existing data will remain intact
- No data migration is needed - this is just an environment configuration change