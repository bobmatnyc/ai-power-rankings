# 🚨 IMMEDIATE ACTION NEEDED: Database Setup

Your Supabase database is currently **EMPTY**. Follow these steps to set it up:

## Step 1: Open Supabase SQL Editor

Go to: https://app.supabase.com/project/fukdwnsvjdgyakdvtdin/sql/new

## Step 2: Create the Schema (2 minutes)

1. Copy ALL contents from: `/database/schema-complete.sql`
2. Paste into SQL Editor
3. Click "Run" button
4. You should see "Success. No rows returned"

## Step 3: Load the Data (3 minutes)

1. Copy ALL contents from: `/docs/data/POPULATE.sql`
2. Paste into SQL Editor (replace previous content)
3. Click "Run" button
4. This will take ~30-60 seconds as it loads 500+ records

## Step 4: Verify Success

Run this query in SQL Editor:

```sql
SELECT
    'Setup Complete!' as status,
    (SELECT COUNT(*) FROM tools) as tools,
    (SELECT COUNT(*) FROM companies) as companies,
    (SELECT COUNT(*) FROM ranking_cache) as rankings,
    (SELECT COUNT(*) FROM metrics_history) as metrics;
```

You should see:

- tools: 14
- companies: 14
- rankings: 84
- metrics: 497

## Step 5: View Rankings

```sql
SELECT * FROM latest_rankings LIMIT 10;
```

## Then Come Back

After completing these steps, I can run all the validation queries to verify your rankings pass the sniff test!

---

⏱️ Total time: ~5 minutes
