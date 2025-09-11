# Vercel Database Environment Variables Setup Guide

## Overview
This guide provides step-by-step instructions for configuring Neon PostgreSQL database environment variables in Vercel for production deployment.

## Required Environment Variables

The following environment variables must be configured in Vercel:

### Database Connection URLs

1. **DATABASE_URL** (Required)
   - **Type**: Sensitive (Encrypted)
   - **Value**: `postgresql://neondb_owner:[PASSWORD]@ep-wispy-fog-ad8d4skz-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require`
   - **Description**: Primary database URL with connection pooling for general application use
   - **Note**: Replace `[PASSWORD]` with your actual database password

2. **DATABASE_URL_UNPOOLED** (Required)
   - **Type**: Sensitive (Encrypted)
   - **Value**: `postgresql://neondb_owner:[PASSWORD]@ep-wispy-fog-ad8d4skz.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require`
   - **Description**: Direct database URL without pooling for migrations and schema operations
   - **Note**: Replace `[PASSWORD]` with your actual database password

3. **DIRECT_DATABASE_URL** (Optional)
   - **Type**: Sensitive (Encrypted)
   - **Value**: Same as DATABASE_URL_UNPOOLED
   - **Description**: Alias for DATABASE_URL_UNPOOLED (some ORMs expect this name)

### Database Feature Flags

4. **USE_DATABASE** (Required)
   - **Type**: Plain Text
   - **Value**: `true`
   - **Description**: Enables PostgreSQL database in production

5. **DATABASE_MIGRATION_MODE** (Required)
   - **Type**: Plain Text
   - **Value**: `migrate`
   - **Description**: Sets migration mode for production (options: dry-run, migrate, sync)

## Setup Methods

### Method 1: Vercel Dashboard (Recommended)

1. **Navigate to Project Settings**
   ```
   https://vercel.com/[your-team]/ai-power-rankings/settings/environment-variables
   ```

2. **Add Each Variable**
   - Click "Add New" button
   - Enter the Key (e.g., `DATABASE_URL`)
   - Enter the Value (with actual password)
   - Select Environment: ✅ Production, ✅ Preview, ❌ Development
   - Toggle "Sensitive" ON for database URLs
   - Click "Save"

3. **Verify All Variables**
   After adding all variables, you should see:
   - DATABASE_URL (Encrypted)
   - DATABASE_URL_UNPOOLED (Encrypted)
   - USE_DATABASE
   - DATABASE_MIGRATION_MODE

### Method 2: Vercel CLI

1. **Install Vercel CLI** (if not already installed)
   ```bash
   pnpm i -g vercel
   ```

2. **Link Project** (if not already linked)
   ```bash
   vercel link
   ```

3. **Add Environment Variables**
   ```bash
   # Add DATABASE_URL (sensitive)
   vercel env add DATABASE_URL production
   # When prompted, paste: postgresql://neondb_owner:[PASSWORD]@ep-wispy-fog-ad8d4skz-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
   
   # Add DATABASE_URL_UNPOOLED (sensitive)
   vercel env add DATABASE_URL_UNPOOLED production
   # When prompted, paste: postgresql://neondb_owner:[PASSWORD]@ep-wispy-fog-ad8d4skz.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
   
   # Add USE_DATABASE
   vercel env add USE_DATABASE production
   # When prompted, enter: true
   
   # Add DATABASE_MIGRATION_MODE
   vercel env add DATABASE_MIGRATION_MODE production
   # When prompted, enter: migrate
   ```

4. **Verify Configuration**
   ```bash
   vercel env ls production
   ```

### Method 3: Using .env File Upload (Alternative)

1. **Create a temporary env file** (DO NOT COMMIT)
   ```bash
   # Create file with actual passwords
   cat > .env.vercel.temp << 'EOF'
   DATABASE_URL="postgresql://neondb_owner:[PASSWORD]@ep-wispy-fog-ad8d4skz-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
   DATABASE_URL_UNPOOLED="postgresql://neondb_owner:[PASSWORD]@ep-wispy-fog-ad8d4skz.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
   USE_DATABASE="true"
   DATABASE_MIGRATION_MODE="migrate"
   EOF
   ```

2. **Pull and merge with existing variables**
   ```bash
   vercel env pull .env.vercel.existing
   cat .env.vercel.temp >> .env.vercel.existing
   ```

3. **Push to Vercel**
   ```bash
   vercel env add < .env.vercel.existing --environment production
   ```

4. **Clean up temporary files**
   ```bash
   rm .env.vercel.temp .env.vercel.existing
   ```

## Verification Steps

### 1. Check Environment Variables in Vercel Dashboard
- Go to: https://vercel.com/[your-team]/ai-power-rankings/settings/environment-variables
- Verify all 4-5 variables are present
- Ensure DATABASE_URL variables show as "Encrypted"

### 2. Test Deployment
```bash
# Trigger a new deployment
vercel --prod

# Or via git push
git push origin main
```

### 3. Monitor Deployment Logs
- Check Function logs in Vercel Dashboard
- Look for successful database connection messages
- Verify no connection errors

### 4. Test Database Connection
After deployment, you can verify the connection:
- Check your application's health endpoint (if available)
- Review Function logs for database queries
- Test features that require database access

## Security Best Practices

1. **Never commit passwords** to version control
2. **Use encrypted/sensitive** flag for all database URLs
3. **Rotate passwords** periodically
4. **Use different passwords** for development and production
5. **Enable IP allowlisting** in Neon dashboard if possible
6. **Monitor database access** logs regularly

## Troubleshooting

### Common Issues and Solutions

1. **Connection Timeout**
   - Verify the database URL is correct
   - Check if Neon database is active (not suspended)
   - Ensure SSL mode is set to `require`

2. **Authentication Failed**
   - Double-check the password
   - Verify username is correct (`neondb_owner`)
   - Ensure no special characters need escaping in URL

3. **SSL Connection Error**
   - Confirm `?sslmode=require` is in the URL
   - Check if your Neon project requires specific SSL settings

4. **Pool Connection Issues**
   - Use pooled URL for application queries
   - Use unpooled URL for migrations only
   - Check Neon connection pool settings

### Debug Commands

```bash
# View current environment variables (names only)
vercel env ls production

# Pull environment variables locally for testing
vercel env pull .env.production.local

# Check deployment logs
vercel logs --prod

# Redeploy with fresh environment
vercel --prod --force
```

## Migration Checklist

Before running migrations in production:

1. ✅ Backup existing data (if any)
2. ✅ Test migrations locally with production-like data
3. ✅ Verify DATABASE_URL_UNPOOLED is set (for migrations)
4. ✅ Ensure DATABASE_MIGRATION_MODE is set to "migrate"
5. ✅ Check if shadow database is needed for zero-downtime migrations
6. ✅ Review migration scripts for destructive changes
7. ✅ Have rollback plan ready

## Contact for Issues

If you encounter issues:
1. Check Vercel deployment logs
2. Review Neon database dashboard for connection metrics
3. Verify all environment variables are correctly set
4. Test with local production configuration first

## Next Steps

After setting up environment variables:

1. Deploy to Vercel: `vercel --prod`
2. Run database migrations (if needed)
3. Verify application connects successfully
4. Test database-dependent features
5. Monitor performance and connection pool usage