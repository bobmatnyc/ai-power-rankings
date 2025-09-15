# Production Database Local Testing Setup

This guide provides safe methods to test new code changes against the production database locally.

## 🔴 CRITICAL SAFETY WARNINGS

**DANGER**: This setup connects your local development environment to the **PRODUCTION DATABASE**.

- **Only use for READ-ONLY testing of new code changes**
- **Never run migrations or write operations against production**
- **Monitor your database usage carefully**
- **Always have a backup plan**

## Quick Setup Commands

### 1. Switch to Production Database

```bash
# Switch to production database with safety measures
pnpm run db:switch-prod
```

This command:
- Creates a timestamped backup of your current `.env.local`
- Tests the production database connection
- Sets up safety measures (`DATABASE_MIGRATION_MODE="dry-run"`)
- Displays critical warnings

### 2. Start Development Server

```bash
# Start the development server (on port 3001)
pnpm run dev:pm2 start

# Access your application at:
# http://localhost:3001
```

### 3. Monitor Server Logs

```bash
# View server logs
pnpm run dev:pm2 logs

# Monitor server status
pnpm run dev:pm2 status
```

### 4. Switch Back to Development Database

```bash
# Switch back to development database
pnpm run db:switch-dev
```

This restores your original configuration from the backup.

## Manual Setup (Alternative)

If you prefer manual setup:

### 1. Backup Current Configuration

```bash
# Create timestamped backup
cp .env.local .env.local.backup.$(date +%Y%m%d_%H%M%S)
```

### 2. Configure Production Database

```bash
# Copy production database configuration
cp .env.local.production-db .env.local
```

### 3. Verify Configuration

```bash
# Test production database connection
pnpm run db:test
```

Expected output should show:
- Connection to `ep-wispy-fog-ad8d4skz-pooler` (production)
- Found ~42 tools (production data count)
- All tests passing

## Safety Measures Implemented

### Environment Variables
- `USE_DATABASE="true"` - Enables PostgreSQL connection
- `DATABASE_MIGRATION_MODE="dry-run"` - **CRITICAL**: Prevents write operations
- Production database URLs are configured but marked as read-only

### Database URLs
- **Production Primary**: `ep-wispy-fog-ad8d4skz-pooler` (connection pooling)
- **Production Direct**: `ep-wispy-fog-ad8d4skz` (direct connection)
- **Development**: `ep-bold-sunset-adneqlo6` (for comparison)

### Connection Pooling
All production connections use Neon's connection pooling to minimize impact.

## Testing Your Code Changes

Once connected to production database:

1. **Test API Endpoints**:
   ```bash
   # Test tools API (should return production data)
   curl http://localhost:3001/api/tools | jq '.tools | length'

   # Test news API
   curl http://localhost:3001/api/news | jq '.articles | length'

   # Test rankings API
   curl http://localhost:3001/api/rankings | jq '.data | length'
   ```

2. **Test Admin Panel**:
   - Navigate to http://localhost:3001/admin
   - Verify data loads correctly
   - Test read-only operations

3. **Monitor Database Status**:
   ```bash
   curl http://localhost:3001/api/admin/db-status | jq
   ```

## Troubleshooting

### Connection Issues

If you can't connect to production database:

```bash
# Test connection directly
pnpm run db:test

# Check environment variables
grep "DATABASE_URL" .env.local

# Verify Next.js is using correct environment
curl -s http://localhost:3001/api/admin/db-status | jq '.host'
```

### Environment Loading Issues

Next.js loads environment files in this order:
1. `.env.local` (highest priority)
2. `.env.development` (in development mode)
3. `.env`

If your changes aren't taking effect:
```bash
# Stop and restart server completely
pnpm run dev:pm2 stop
rm -rf .next  # Clear Next.js cache
pnpm run dev:pm2 start
```

### Revert to Development

If something goes wrong:

```bash
# Quick revert using script
pnpm run db:switch-dev

# Manual revert (if script fails)
cp .env.local.backup.TIMESTAMP .env.local
pnpm run dev:pm2 restart
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm run db:switch-prod` | Switch to production database with safety checks |
| `pnpm run db:switch-dev` | Switch back to development database |
| `pnpm run db:test` | Test current database connection |
| `pnpm run dev:pm2 start` | Start development server |
| `pnpm run dev:pm2 stop` | Stop development server |
| `pnpm run dev:pm2 restart` | Restart development server |
| `pnpm run dev:pm2 logs` | View server logs |
| `pnpm run dev:pm2 status` | Check server status |

## Files Created/Modified

- **`.env.local.production-db`** - Production database configuration template
- **`scripts/switch-to-production-db.js`** - Safe switching script
- **`scripts/switch-to-dev-db.js`** - Restore development database script
- **`package.json`** - Added db:switch-* commands

## Security Considerations

1. **Credentials**: All production database credentials are in environment files
2. **Access Control**: Only read operations should be performed
3. **Monitoring**: Monitor your database usage in Neon dashboard
4. **Time Limits**: Don't leave production connection active longer than necessary
5. **Team Coordination**: Inform team when using production database

## Emergency Procedures

### If You Accidentally Modify Production Data

1. **Stop all operations immediately**:
   ```bash
   pnpm run dev:pm2 stop
   ```

2. **Switch back to development**:
   ```bash
   pnpm run db:switch-dev
   ```

3. **Report the incident** to the team with:
   - What operations were performed
   - Timestamp of actions
   - Potential data affected

### If Connection is Stuck

```bash
# Force stop all PM2 processes
pm2 kill

# Remove any cached connections
rm -rf .next

# Restart fresh
pnpm run db:switch-dev
pnpm run dev:pm2 start
```

## Production Database Schema

The production database contains:
- **Tools**: ~42 AI coding tools
- **Rankings**: Monthly ranking data
- **News**: AI industry news articles
- **Companies**: Tool company information

All data is structured using Drizzle ORM with PostgreSQL backend hosted on Neon.

---

**Remember**: With great power comes great responsibility. Always treat production data with extreme care.