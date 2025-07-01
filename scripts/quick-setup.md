# Quick Database Setup for AI Power Rankings

## 🚀 Fastest Method: Direct SQL Execution

### Step 1: Create Tables
1. Open your [Supabase SQL Editor](https://app.supabase.com/project/_/sql)
2. Copy the entire contents of `/database/schema-complete.sql`
3. Paste and click "Run"

### Step 2: Load Research Data
1. In the same SQL Editor
2. Copy the entire contents of `/docs/data/POPULATE.sql`
3. Paste and click "Run"

This will take a few minutes as it inserts:
- 14 AI coding tools
- 14 companies
- 500+ metrics
- 80+ rankings
- News, funding rounds, benchmarks, etc.

### Step 3: Verify Success
Run this query to check:

```sql
SELECT 
    'Data loaded successfully!' as status,
    (SELECT COUNT(*) FROM tools) as tools,
    (SELECT COUNT(*) FROM companies) as companies,
    (SELECT COUNT(*) FROM metrics_history) as metrics,
    (SELECT COUNT(*) FROM ranking_cache) as rankings;
```

You should see:
- tools: 14
- companies: 14
- metrics: 497+
- rankings: 84+

### Step 4: View Current Rankings
```sql
-- See June 2025 Top 10
SELECT 
    rc.position,
    t.name,
    rc.score,
    c.name as company,
    CASE 
        WHEN MAX(fr.valuation_usd) > 1000000000 
        THEN CONCAT('$', ROUND(MAX(fr.valuation_usd)/1000000000.0, 1), 'B')
        ELSE 'N/A'
    END as valuation
FROM ranking_cache rc
JOIN tools t ON rc.tool_id = t.id
LEFT JOIN companies c ON t.company_id = c.id
LEFT JOIN funding_rounds fr ON c.id = fr.company_id
WHERE rc.period = 'june-2025'
GROUP BY rc.position, t.name, rc.score, c.name
ORDER BY rc.position
LIMIT 10;
```

## 🎯 Expected Top 5:
1. **Cursor** - 9.45 ($9.9B valuation)
2. **GitHub Copilot** - 9.10 (Microsoft)
3. **Claude Code** - 8.95 (Anthropic)
4. **Windsurf** - 8.70 ($3B acquisition)
5. **Jules** - 8.20 (Google)

## ⚡ Common Issues

### "relation already exists" errors
This means tables already exist. To reset:
```sql
-- WARNING: This deletes everything!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
-- Then re-run both SQL files
```

### Missing data relationships
The POPULATE.sql handles this with UPDATE statements at the end. Make sure to run the entire file.

### Want to see the data?
Check out these queries in `/database/validation-queries.sql`:
- Overall rankings with breakdowns
- Growth trajectories
- Category analysis
- Funding correlations

## 📊 Test the Rankings Algorithm

See how Cursor rose to #1:
```sql
-- Cursor's journey from #2 to #1
SELECT 
    rp.display_name,
    rc.position,
    rc.score,
    COALESCE(mh.value_integer/1000000, 0) as arr_millions
FROM ranking_cache rc
JOIN ranking_periods rp ON rc.period = rp.period
LEFT JOIN LATERAL (
    SELECT value_integer 
    FROM metrics_history 
    WHERE tool_id = 'cursor' 
    AND metric_key = 'monthly_arr'
    AND recorded_at <= rp.end_date
    ORDER BY recorded_at DESC 
    LIMIT 1
) mh ON true
WHERE rc.tool_id = 'cursor'
ORDER BY rp.calculation_date;
```

## ✅ Success!
Your database now contains comprehensive AI tool rankings data from January 2024 to June 2025, ready for analysis and validation.