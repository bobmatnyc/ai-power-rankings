# POC1 Database Setup - Complete Guide

## ✅ What's Ready

### 1. Database Schema (`/database/schema-complete.sql`)

- 20+ tables matching the POPULATE.sql structure
- Views for easy querying
- Helper functions for calculations
- All indexes for performance

### 2. Research Data (`/docs/data/POPULATE.sql`)

- **14 AI Coding Tools**: Cursor, GitHub Copilot, Claude Code, Devin, Jules, Windsurf, etc.
- **14 Companies**: With real funding data and valuations
- **500+ Historical Metrics**: Showing realistic growth from Jan 2024 to June 2025
- **84 Pre-calculated Rankings**: Across 7 time periods
- **Real Events**: Funding rounds, acquisitions, product launches

### 3. Validation Queries (`/database/validation-queries.sql`)

- 10+ queries to verify rankings make sense
- Score breakdown analysis
- Growth trajectory validation
- Category comparisons
- Anomaly detection

## 🚀 How to Load the Data

### Quickest Method: Supabase SQL Editor

1. **Open Supabase SQL Editor**

   - Go to your project: https://app.supabase.com/project/_/sql

2. **Create Schema** (5 minutes)

   - Copy entire contents of `/database/schema-complete.sql`
   - Paste in SQL Editor
   - Click "Run"

3. **Load Data** (5 minutes)

   - Copy entire contents of `/docs/data/POPULATE.sql`
   - Paste in SQL Editor
   - Click "Run"

4. **Verify Success**
   ```sql
   SELECT
       (SELECT COUNT(*) FROM tools) as tools,
       (SELECT COUNT(*) FROM ranking_cache) as rankings,
       (SELECT COUNT(*) FROM metrics_history) as metrics;
   ```
   Should show: tools: 14, rankings: 84+, metrics: 497+

## 📊 Expected Rankings (June 2025)

```
1. Cursor         - 9.45 ($9.9B valuation, $500M+ ARR)
2. GitHub Copilot - 9.10 (15M users, $400M ARR)
3. Claude Code    - 8.95 (72.7% SWE-bench)
4. Windsurf       - 8.70 ($3B OpenAI acquisition)
5. Jules          - 8.20 (52.2% SWE-bench)
6. Devin          - 8.15 ($4B valuation)
7. Bolt.new       - 8.05 ($40M ARR)
8. Lovable        - 7.85 (800K users)
9. v0             - 7.80 (Vercel)
10. Aider         - 7.75 (Top open source)
```

## 🔍 Key Validation Queries

### 1. See Current Rankings with Scores

```sql
SELECT * FROM latest_rankings LIMIT 20;
```

### 2. Check Cursor's Meteoric Rise

```sql
SELECT
    rp.display_name,
    rc.position,
    rc.score,
    COALESCE(mh.value_integer/1000000000, 0) as valuation_b
FROM ranking_cache rc
JOIN ranking_periods rp ON rc.period = rp.period
LEFT JOIN metrics_history mh ON mh.tool_id = 'cursor'
    AND mh.metric_key = 'valuation_latest'
    AND mh.recorded_at <= rp.end_date
WHERE rc.tool_id = 'cursor'
ORDER BY rp.calculation_date;
```

### 3. Category Analysis

```sql
SELECT
    t.category,
    COUNT(*) as tools,
    ROUND(AVG(rc.score), 2) as avg_score
FROM ranking_cache rc
JOIN tools t ON rc.tool_id = t.id
WHERE rc.period = 'june-2025'
GROUP BY t.category
ORDER BY avg_score DESC;
```

## ✅ POC1 Success Criteria

The rankings should show:

1. **Market Leaders**: Cursor and GitHub Copilot battling for #1
2. **Technical Excellence**: Claude Code high due to 72.7% SWE-bench
3. **Category Balance**: Different tool types represented in top 10
4. **Funding Correlation**: High valuations generally = higher rankings
5. **Open Source Presence**: Aider, Cline, OpenHands in rankings

## 🎯 What Makes Rankings "Pass the Sniff Test"

- **Cursor at #1**: Makes sense given $9.9B valuation and explosive growth
- **GitHub Copilot #2**: Massive user base (15M) keeps it competitive
- **Claude Code #3**: Best-in-class technical performance
- **Devin at #6**: Pioneer but lower technical scores
- **Open source tools**: Present but not dominating (realistic)

## 📈 Historical Progression

The data shows realistic market evolution:

- **Jan 2024**: GitHub Copilot dominates
- **Mar 2024**: Devin launch creates buzz
- **Sep 2024**: Cursor begins meteoric rise
- **Dec 2024**: Windsurf emerges as competitor
- **Jun 2025**: Current state with Cursor leading

## 🚨 Common Issues

### If rankings seem off:

1. Check algorithm weights are loaded correctly
2. Verify all metrics_history data loaded
3. Ensure funding_rounds data is complete
4. Check that company relationships are set

### To reset and retry:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
-- Then reload both SQL files
```

## ✨ POC1 Complete!

Your database now contains comprehensive AI tool rankings with:

- Real market data
- Transparent algorithm
- Historical progression
- Validation queries

The rankings should intuitively make sense while being backed by data!
