# Vercel Database Setup

## Important: Use Connection Pooler for Supabase

When deploying to Vercel, you MUST use the **Connection Pooler** URL from Supabase, not the direct connection string.

### Why?

- Vercel runs in a serverless environment where connections are short-lived
- Direct PostgreSQL connections (port 5432) will fail with "Tenant or user not found" errors
- The pooler connection (port 6543) is designed for serverless environments

### How to get the correct connection string:

1. Go to your Supabase project dashboard
2. Navigate to Settings → Database
3. Find the "Connection string" section
4. Select **"Connection Pooler"** tab (NOT "Direct Connection")
5. Copy the connection string from "Transaction" mode
6. The URL should contain `:6543` (pooler port) not `:5432` (direct port)

### Setting in Vercel:

```bash
# Set for all environments
vercel env add SUPABASE_DATABASE_URL

# Or update existing variable
vercel env rm SUPABASE_DATABASE_URL production
vercel env add SUPABASE_DATABASE_URL production
```

### Example URLs:

- ❌ Direct (will fail): `postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:5432/postgres`
- ✅ Pooler (correct): `postgresql://postgres.xxxxx:password@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true`

### Troubleshooting:

If you see "Tenant or user not found" errors:

1. Check that you're using port 6543, not 5432
2. Ensure `?pgbouncer=true` is in the connection string
3. Verify the connection string is from the "Connection Pooler" tab in Supabase
