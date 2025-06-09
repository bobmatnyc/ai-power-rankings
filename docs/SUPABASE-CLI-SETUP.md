# Supabase CLI Setup Guide

## ✅ CLI is Installed!

The Supabase CLI (v2.24.3) is now installed on your system.

## 🔐 Step 1: Login to Supabase

You need to get an access token from your Supabase dashboard:

1. Go to: https://app.supabase.com/account/tokens
2. Click "Generate new token"
3. Give it a name like "AI Power Rankings CLI"
4. Copy the token

Then run:

```bash
supabase login --token YOUR_ACCESS_TOKEN
```

Or set it as an environment variable:

```bash
export SUPABASE_ACCESS_TOKEN=your-token-here
```

## 🔗 Step 2: Link to Your Project

```bash
supabase link --project-ref fukdwnsvjdgyakdvtdin
```

## 🚀 Step 3: Run Migrations

I've already prepared the migration files:

- `supabase/migrations/20240609000001_initial_schema.sql` (schema)
- `supabase/migrations/20240609000002_seed_data.sql` (data)

Run them with:

```bash
# This will apply all migrations
supabase db push

# Or if you want to reset first (WARNING: deletes all data)
supabase db reset
```

## ✅ Step 4: Verify Setup

```bash
# Check migration status
supabase migration list

# Query the database
supabase db query "SELECT COUNT(*) FROM tools"

# View top rankings
supabase db query "SELECT position, t.name, rc.score FROM ranking_cache rc JOIN tools t ON rc.tool_id = t.id WHERE period = 'june-2025' ORDER BY position LIMIT 10"
```

## 📊 Expected Results

After running migrations, you should have:

- 14 tools
- 14 companies
- 84+ rankings
- 497+ metrics

Top 5 should be:

1. Cursor - 9.45
2. GitHub Copilot - 9.10
3. Claude Code - 8.95
4. Windsurf - 8.70
5. Jules - 8.20

## 🔧 Useful Commands

```bash
# Open SQL editor in browser
supabase db ui

# Generate TypeScript types
supabase gen types typescript --linked > src/types/database.types.ts

# View database URL
supabase status

# Check logs
supabase db logs --tail 100
```

## 🎯 Quick Alternative

If you prefer, you can still use the SQL Editor:

1. Go to: https://app.supabase.com/project/fukdwnsvjdgyakdvtdin/sql
2. Run the schema file
3. Run the populate file

The CLI approach is better for:

- Version control (migrations are tracked)
- Reproducibility (easy to reset and rerun)
- CI/CD integration
- Team collaboration
