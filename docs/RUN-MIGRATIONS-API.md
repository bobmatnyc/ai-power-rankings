# Run Migrations API Endpoint

## Overview

The `/api/admin/run-migrations` endpoint allows administrators to apply database migrations to the production database. This is necessary when the database connection is working but the tables don't exist.

## Endpoint

```
GET /api/admin/run-migrations
```

## Authentication

- Requires Clerk authentication
- User must have `isAdmin: true` in their public metadata

## Features

1. **Smart Migration Detection**: Automatically detects which migrations have already been applied
2. **Safe Execution**: Skips migrations if tables already exist
3. **Detailed Reporting**: Returns comprehensive information about each migration
4. **Error Handling**: Gracefully handles partial failures and reports errors

## Response Format

```json
{
  "status": "completed",
  "summary": {
    "totalMigrations": 2,
    "executed": 2,
    "skipped": 0,
    "failed": 0,
    "totalExecutionTime": 1234
  },
  "database": {
    "connected": true,
    "serverTime": "2025-01-23T12:00:00Z",
    "postgresVersion": "PostgreSQL 16.2"
  },
  "migrations": [
    {
      "name": "0000_oval_manta.sql",
      "status": "success",
      "message": "Successfully executed 89 statements",
      "statementsExecuted": 89,
      "executionTime": 500
    },
    {
      "name": "0001_easy_mesmero.sql",
      "status": "success",
      "message": "Successfully executed 17 statements",
      "statementsExecuted": 17,
      "executionTime": 200
    }
  ],
  "tables": {
    "before": [],
    "after": [
      { "name": "companies", "columns": 6 },
      { "name": "tools", "columns": 9 },
      { "name": "news", "columns": 14 },
      { "name": "rankings", "columns": 8 },
      { "name": "articles", "columns": 24 }
    ],
    "rowCounts": {
      "companies": 0,
      "tools": 0,
      "news": 0,
      "rankings": 0,
      "articles": 0
    }
  },
  "timestamp": "2025-01-23T12:00:00Z"
}
```

## Migration Files

The endpoint executes the following migration files in order:

1. **0000_oval_manta.sql**: Creates core tables (companies, tools, news, rankings, migrations)
2. **0001_easy_mesmero.sql**: Creates article management tables (articles, processing logs, ranking changes)

## Usage

### Via cURL

```bash
# Get your session token from the browser after logging in
SESSION_TOKEN="your-clerk-session-token"

curl -X GET https://aipowerranking.com/api/admin/run-migrations \
  -H "Cookie: __session=$SESSION_TOKEN" \
  -H "Accept: application/json"
```

### Via Test Script

```bash
# Set your session token in .env.local
echo "TEST_CLERK_SESSION_TOKEN=your-token-here" >> .env.local

# Run the test script
pnpm tsx scripts/test-run-migrations.ts
```

### Via Browser

1. Log in as an admin at https://aipowerranking.com/admin
2. Open browser console
3. Execute:

```javascript
fetch('/api/admin/run-migrations')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

## Safety Features

1. **Idempotent**: Running multiple times is safe - existing tables are skipped
2. **Transaction-like**: Each statement is executed individually with error handling
3. **Non-destructive**: Only creates tables, never drops or modifies existing ones
4. **Detailed Logging**: All operations are logged with execution times

## Troubleshooting

### "Database is disabled" Error

Ensure `USE_DATABASE=true` is set in production environment variables.

### "DATABASE_URL not configured" Error

Ensure the `DATABASE_URL` environment variable is properly set in Vercel.

### "Unauthorized" Error

Ensure you're logged in as an admin user with `isAdmin: true` in Clerk.

### Tables Already Exist

The endpoint will skip migrations for tables that already exist. This is normal and safe.

## Production Deployment Steps

1. **Deploy the code** with the new endpoint to Vercel
2. **Verify database connection** using `/api/admin/db-test`
3. **Run migrations** using `/api/admin/run-migrations`
4. **Verify tables** by checking the response for created tables
5. **Test functionality** by accessing the main application

## Related Endpoints

- `/api/admin/db-test` - Test database connection
- `/api/admin/db-status` - Check database and table status
- `/api/admin/db-simple-test` - Simple database connectivity test

## Security Notes

- This endpoint is protected by Clerk authentication
- Only users with admin privileges can execute migrations
- The endpoint logs all operations for audit purposes
- Database credentials are never exposed in responses