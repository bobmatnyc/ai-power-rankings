# Production Database Issue Fixes

## 🎯 Quick Verification Commands

### 1. Check Vercel Environment Variables
```bash
# Check if environment variables are set in production
vercel env ls

# If DATABASE_URL is missing, add it:
vercel env add DATABASE_URL production
# Then paste your Neon database URL

# Ensure USE_DATABASE is set to true
vercel env add USE_DATABASE production
# Enter: true
```

### 2. Test Production Endpoints Directly
```bash
# Test the database endpoints that are failing
curl -s "https://ai-power-ranking-niwmgl4g5-1-m.vercel.app/api/admin/db-simple-test" | jq .

# Test the articles endpoint specifically
curl -s "https://ai-power-ranking-niwmgl4g5-1-m.vercel.app/api/admin/articles?limit=1" | jq .
```

### 3. Check Neon Database Status
```bash
# Log into Neon dashboard and check:
# - Database status (running vs paused)
# - Connection count
# - Recent activity logs
echo "Check Neon Dashboard: https://console.neon.tech/"
```

### 4. Test Database Connection from Vercel Functions
```bash
# Deploy our diagnostic script as a Vercel function
vercel deploy
# Then test: https://[deployment-url]/api/admin/db-simple-test
```

## 🔧 Specific Fixes

### Fix 1: Wake Up Neon Database
**If database is paused:**

```bash
# Connect to database directly to wake it up
npm run db:studio
# This will wake up the database if it's sleeping

# Alternative: Run a simple query
npx tsx -e "
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
sql\`SELECT 1\`.then(() => console.log('Database awakened')).catch(console.error);
"
```

### Fix 2: Update Environment Variables
```bash
# Get current DATABASE_URL
echo $DATABASE_URL

# Update in Vercel (replace with your actual URL)
vercel env add DATABASE_URL production
# Paste your URL: postgresql://neondb_owner:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require

# Set USE_DATABASE flag
vercel env add USE_DATABASE production
# Value: true

# Redeploy to apply changes
vercel deploy --prod
```

### Fix 3: Connection Pool Management
**Add to your DATABASE_URL:**
```bash
# Add connection pool parameters to DATABASE_URL
postgresql://user:pass@host/db?sslmode=require&pool_timeout=10&pool_max_conns=1
```

### Fix 4: Database Permissions Check
```sql
-- Run in Neon SQL Editor to check permissions
SELECT current_user, current_database();
SELECT * FROM pg_tables WHERE schemaname = 'public' LIMIT 5;
SELECT COUNT(*) FROM articles;
```

## 🔄 Deployment Fix Process

### Step 1: Verify Environment
```bash
# Check current deployment
vercel ls

# Check environment variables
vercel env ls
```

### Step 2: Update Environment
```bash
# Ensure all required env vars are set
vercel env add DATABASE_URL production
vercel env add USE_DATABASE production
```

### Step 3: Deploy with Verification
```bash
# Run pre-deployment checks
npm run pre-deploy

# Deploy to production
vercel deploy --prod

# Test after deployment
curl -s "https://[your-domain]/api/admin/db-simple-test" | jq .status
```

### Step 4: Monitor and Test
```bash
# Check Vercel function logs
vercel logs [deployment-url]

# Test specific endpoints
curl -s "https://[your-domain]/api/admin/articles?limit=1" | jq .
```

## 🚨 Emergency Troubleshooting

### If Database is Completely Inaccessible:

1. **Check Neon Dashboard**
   - Go to https://console.neon.tech/
   - Verify database status
   - Check connection strings

2. **Reset Database Connection**
   ```bash
   # Get fresh connection string from Neon
   # Update DATABASE_URL in Vercel
   vercel env rm DATABASE_URL production
   vercel env add DATABASE_URL production
   # Redeploy
   vercel deploy --prod
   ```

3. **Fallback to JSON Storage**
   ```bash
   # Temporarily disable database
   vercel env add USE_DATABASE production
   # Value: false
   vercel deploy --prod
   ```

## 📊 Monitoring Commands

### Real-time Monitoring
```bash
# Watch Vercel function logs
vercel logs --follow

# Monitor database connections in Neon dashboard
# Monitor API response times
```

### Health Checks
```bash
# Create a monitoring script
curl -s "https://[domain]/api/admin/db-simple-test" | jq '.tests.envCheck.shouldConnect'
curl -s "https://[domain]/api/admin/articles?limit=1" | jq '.articles | length'
```

## 🎯 Most Likely Solutions (In Order)

1. **Database Sleep Issue**: Wake up Neon database by connecting to it
2. **Missing Environment Variables**: Ensure DATABASE_URL and USE_DATABASE are set in Vercel
3. **Connection Timeout**: Add pool parameters to DATABASE_URL
4. **Deployment Issue**: Redeploy with fresh environment variables

Run these in order until the issue is resolved.