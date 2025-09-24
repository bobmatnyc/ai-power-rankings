# Database Branching Strategy

## Overview

AI Power Rankings uses **database branching** to maintain separate data environments for development and production. This ensures safe development without affecting production data.

## Database Branches

### 1. Development Branch (`autumn-glitter`)
- **Purpose**: Local development and testing
- **Host**: `ep-autumn-glitter-ad1uqvfm-pooler.c-2.us-east-1.aws.neon.tech`
- **Environment Variable**: `DATABASE_URL_DEVELOPMENT`
- **Used When**: `NODE_ENV=development`
- **Data State**: Clean/test data (0 articles, 0 tools)

### 2. Production Branch (`bold-sunset`)
- **Purpose**: Live production data
- **Host**: `ep-bold-sunset-adneqlo6-pooler.c-2.us-east-1.aws.neon.tech`
- **Environment Variable**: `DATABASE_URL`
- **Used When**: `NODE_ENV=production` or when deployed to Vercel
- **Data State**: Production data (79+ articles, 53+ tools)

## Configuration

### Local Development (.env.local)

```bash
# Development branch (for local development)
DATABASE_URL_DEVELOPMENT="postgresql://user:pass@ep-autumn-glitter-pooler.../neondb"

# Production branch (fallback/reference)
DATABASE_URL="postgresql://user:pass@ep-bold-sunset-pooler.../neondb"

# Unpooled connection for migrations (development branch)
DATABASE_URL_UNPOOLED="postgresql://user:pass@ep-autumn-glitter.../neondb"
```

### Production (Vercel Environment Variables)

```bash
# Production branch only
DATABASE_URL="postgresql://user:pass@ep-bold-sunset-pooler.../neondb"
```

## Automatic Selection Logic

The database connection module (`/src/lib/db/connection.ts`) automatically selects the appropriate database based on the environment:

1. **Development** (`NODE_ENV=development`):
   - First tries `DATABASE_URL_DEVELOPMENT`
   - Falls back to `DATABASE_URL` if not found
   - Logs: "🔧 Using DATABASE_URL_DEVELOPMENT (development branch)"

2. **Production** (`NODE_ENV=production`):
   - Always uses `DATABASE_URL`
   - Logs: "🚀 Using DATABASE_URL (production branch)"

3. **Staging** (`NODE_ENV=staging`):
   - First tries `DATABASE_URL_STAGING`
   - Falls back to `DATABASE_URL` if not found
   - Logs: "🚦 Using DATABASE_URL_STAGING (staging branch)"

## Commands

### Check Database Configuration

```bash
# Check current database configuration
pnpm run db:check

# Check all configured databases
pnpm run db:check:all

# Test database branching via API
curl http://localhost:3001/api/test/db-branch | jq
```

### Database Operations

```bash
# Push schema to development database
pnpm run db:push

# Generate migration files
pnpm run db:generate

# Run migrations (production)
pnpm run db:migrate

# Open database studio UI
pnpm run db:studio
```

## Setting Up Database Branching

### Step 1: Create Neon Branches

1. Go to [Neon Console](https://console.neon.tech)
2. Create branches:
   - `main` - Production branch
   - `development` - Development branch
   - `staging` - (Optional) Staging branch

### Step 2: Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`
2. Update database URLs:
   - `DATABASE_URL_DEVELOPMENT` - Development branch connection string
   - `DATABASE_URL` - Production branch connection string
   - `DATABASE_URL_UNPOOLED` - Unpooled connection for migrations

### Step 3: Configure Vercel

1. Go to Vercel project settings
2. Add environment variable:
   - `DATABASE_URL` - Production branch connection string only

### Step 4: Verify Configuration

```bash
# Check configuration
pnpm run db:check

# Test connection
pnpm run db:test

# Start development server
pnpm run dev:pm2 start
```

## Benefits

1. **Data Isolation**: Development changes don't affect production
2. **Safe Testing**: Test migrations and schema changes safely
3. **Clean Development**: Start with clean data for testing
4. **Easy Rollback**: Branch-based rollback if needed
5. **Performance**: Each environment has dedicated resources

## Troubleshooting

### Issue: Wrong Database Being Used

**Solution**: Check environment variables and NODE_ENV:
```bash
pnpm run db:check
```

### Issue: Database Not Connecting

**Solution**: Verify credentials and network access:
```bash
pnpm run db:check:all
```

### Issue: Migration Failures

**Solution**: Ensure correct branch is targeted:
```bash
# Development migrations
DATABASE_URL=$DATABASE_URL_DEVELOPMENT pnpm run db:migrate

# Production migrations
DATABASE_URL=$DATABASE_URL pnpm run db:migrate
```

## Best Practices

1. **Never use production credentials in development**
2. **Always test migrations on development branch first**
3. **Use pooled connections for applications**
4. **Use unpooled connections for migrations**
5. **Regularly sync development branch schema with production**
6. **Monitor database usage in Neon dashboard**

## Security Notes

- Production database credentials should only exist in Vercel environment variables
- Development database can have more relaxed permissions
- Use read-only credentials where possible
- Rotate credentials regularly
- Never commit `.env.local` to version control