# AI Power Rankings Database Setup Guide

## Quick Setup (Recommended)

The easiest way to set up your database is through the Supabase SQL Editor:

### Step 1: Open SQL Editor

Go to: https://supabase.com/dashboard/project/fukdwnsvjdgyakdvtdin/sql/new

### Step 2: Create Schema

1. Copy the entire contents of `database/schema-complete.sql`
2. Paste into the SQL editor
3. Click "Run" and wait for completion (should see "Success" message)

### Step 3: Populate Data

1. Clear the SQL editor
2. Copy the entire contents of `docs/data/POPULATE.sql`
3. Paste into the SQL editor
4. Click "Run" and wait for completion (this takes ~30 seconds)

### Step 4: Verify Setup

Run this query in the SQL editor:

```sql
SELECT
  rc.position,
  t.name as tool_name,
  t.slug,
  rc.score,
  c.name as company_name,
  rc.market_traction_score,
  rc.technical_capability_score,
  rc.developer_adoption_score
FROM ranking_cache rc
JOIN tools t ON t.id = rc.tool_id
JOIN companies c ON c.id = t.company_id
WHERE rc.period = 'june-2025'
ORDER BY rc.position
LIMIT 10;
```

Expected results:

1. Cursor - 9.45 score (Anysphere Inc.)
2. GitHub Copilot - 9.10 score (GitHub/Microsoft)
3. Claude Code - 8.95 score (Anthropic)
4. Windsurf - 8.70 score (Codeium Inc.)
5. Jules - 8.20 score (Google)

## Alternative: Using Scripts

### Option 1: TypeScript Seed Script

```bash
npm install
npm run seed-database
```

### Option 2: Shell Script Check

```bash
./scripts/setup-database.sh
```

## Troubleshooting

### "relation does not exist" Error

The schema hasn't been created yet. Run the schema SQL first.

### "duplicate key" Error

The database already has some data. To reset:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

Then run schema and seed scripts again.

### Connection Issues

Verify your `.env.local` has:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`

## Verification Queries

### Check Tool Count

```sql
SELECT COUNT(*) as tool_count FROM tools;
-- Expected: 14
```

### Check Ranking Periods

```sql
SELECT period, display_name, is_current
FROM ranking_periods
ORDER BY calculation_date DESC;
-- Expected: 7 periods, june-2025 is current
```

### Check Top Rankings History

```sql
SELECT
  rp.display_name as period,
  t.name as tool_name,
  rc.position,
  rc.score
FROM ranking_cache rc
JOIN tools t ON t.id = rc.tool_id
JOIN ranking_periods rp ON rp.period = rc.period
WHERE rc.position <= 3
ORDER BY rp.calculation_date DESC, rc.position;
```

### Run Ranking Algorithm

```sql
SELECT * FROM calculate_zeitgeist_rankings()
ORDER BY score DESC
LIMIT 10;
```

## Data Overview

The seed data includes:

- 14 AI coding tools (Cursor, GitHub Copilot, Claude Code, etc.)
- 14 companies
- 7 ranking periods from January 2024 to June 2025
- 84+ pre-calculated rankings
- 500+ historical metrics
- 50+ funding rounds with real data
- Performance benchmarks (SWE-bench scores)
- Editorial content explaining ranking changes

## Success Criteria

Your database is properly set up when:

1. ✅ 14 tools are loaded
2. ✅ Cursor is ranked #1 in June 2025 with 9.45 score
3. ✅ Historical rankings show progression over time
4. ✅ `latest_rankings` view returns current rankings
5. ✅ `calculate_zeitgeist_rankings()` function works

## Next Steps

Once the database is set up:

1. Run `npm run dev` to start the Next.js app
2. Visit http://localhost:3000 to see the rankings
3. Check http://localhost:3000/api/rankings for the API
4. Explore individual tool pages at /tools/[slug]
