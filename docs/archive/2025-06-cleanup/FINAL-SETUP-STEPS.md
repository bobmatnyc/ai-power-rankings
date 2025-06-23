# 🚀 Final Setup Steps - Choose Your Method

Your Supabase project is linked! Now choose one of these methods to load the data:

## Method 1: Supabase Dashboard (Easiest - 5 minutes)

1. **Open SQL Editor**:
   https://app.supabase.com/project/fukdwnsvjdgyakdvtdin/sql/new

2. **Run Schema** (2 min):

   - Copy entire contents of `/database/schema-complete.sql`
   - Paste in SQL Editor
   - Click "Run"

3. **Run Data** (3 min):

   - Copy entire contents of `/docs/data/POPULATE.sql`
   - Paste in SQL Editor (replace previous)
   - Click "Run"

4. **Verify**:
   ```sql
   SELECT * FROM latest_rankings LIMIT 10;
   ```

## Method 2: Supabase CLI (With Password)

1. **Get your database password**:

   - Go to: https://supabase.com/dashboard/project/fukdwnsvjdgyakdvtdin/settings/database
   - Copy your database password

2. **Run migrations**:
   ```bash
   export SUPABASE_ACCESS_TOKEN=sbp_8afd1fd0a066eb290efa43e2f1a560d2ae576151
   supabase db push
   # Enter password when prompted
   ```

## Method 3: Direct psql Connection

1. **Get connection string**:

   ```bash
   supabase db remote get
   ```

2. **Run SQL files**:
   ```bash
   psql "YOUR_CONNECTION_STRING" -f database/schema-complete.sql
   psql "YOUR_CONNECTION_STRING" -f docs/data/POPULATE.sql
   ```

## 📊 Expected Results

After any method, you should see:

- **14 tools** (Cursor, GitHub Copilot, Claude Code, etc.)
- **84+ rankings** across 7 time periods
- **497+ metrics** showing growth trajectories

Top 5 (June 2025):

1. Cursor - 9.45
2. GitHub Copilot - 9.10
3. Claude Code - 8.95
4. Windsurf - 8.70
5. Jules - 8.20

## ✅ Verify Success

Run this in SQL Editor or CLI:

```sql
SELECT
    rc.position,
    t.name,
    rc.score,
    c.name as company
FROM ranking_cache rc
JOIN tools t ON rc.tool_id = t.id
LEFT JOIN companies c ON t.company_id = c.id
WHERE rc.period = 'june-2025'
ORDER BY rc.position
LIMIT 10;
```

---

**Recommendation**: Use Method 1 (Dashboard) - it's the quickest and doesn't require passwords!
