# Supabase Connection Guide

## Summary

This guide documents the correct way to connect to the Supabase database for the AI Power Rankings project.

## Key Findings

### 1. Database Location

- **Project ID**: `iupygejzjkwyxtitescy`
- **Region**: `us-east-2` (NOT us-west-1 as initially tried)

### 2. Connection Methods

#### ✅ Working: REST API

- **URL**: `https://iupygejzjkwyxtitescy.supabase.co`
- **Authentication**: Anon Key / Service Role Key
- **Use Case**: Application queries, frontend

#### ✅ Working: Session Pooler

- **Host**: `aws-0-us-east-2.pooler.supabase.com`
- **Port**: `5432`
- **Username**: `postgres.iupygejzjkwyxtitescy`
- **Password**: Database password from Supabase dashboard
- **Use Case**: Payload CMS, ORMs requiring prepared statements

#### ❌ Not Working: Transaction Pooler

- **Port**: `6543`
- **Issue**: Doesn't support prepared statements
- **Error**: Will cause issues with Payload CMS

#### ❌ Not Available: Direct Connection

- **Host**: `db.iupygejzjkwyxtitescy.supabase.co`
- **Issue**: Hostname not publicly resolvable

### 3. Common Errors and Solutions

#### "Tenant or user not found"

**Causes:**

1. Wrong region in pooler URL (e.g., using us-west-1 instead of us-east-2)
2. Incorrect username format
3. Wrong password

**Solution:**

- Use the correct region: `aws-0-us-east-2.pooler.supabase.com`
- Username must include project ID: `postgres.iupygejzjkwyxtitescy`

#### "getaddrinfo ENOTFOUND"

**Cause:** Trying to use direct connection which is not publicly accessible
**Solution:** Use the pooler connection instead

### 4. Payload CMS Configuration

```bash
# .env.local
SUPABASE_DATABASE_URL=postgresql://postgres.iupygejzjkwyxtitescy:[PASSWORD]@aws-0-us-east-2.pooler.supabase.com:5432/postgres
```

**Important:**

- Must use session pooler (port 5432)
- Cannot use transaction pooler (port 6543)
- SSL is handled automatically by the pooler

### 5. Testing Connection

```javascript
const { Client } = require("pg");
const client = new Client({
  connectionString:
    "postgresql://postgres.iupygejzjkwyxtitescy:[PASSWORD]@aws-0-us-east-2.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function test() {
  try {
    await client.connect();
    console.log("✅ Connected!");
    await client.end();
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}
```

## Key Takeaways

1. Always check the Supabase dashboard for the correct connection details
2. The region is crucial - wrong region = "Tenant not found" error
3. Use session pooler for ORMs and applications requiring prepared statements
4. Direct database connection is typically not exposed for security
5. REST API remains the most reliable method for application queries
