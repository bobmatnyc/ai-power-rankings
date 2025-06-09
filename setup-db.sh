#!/bin/bash

# AI Power Rankings - Database Setup Script
# This script uses Supabase CLI to set up the database

set -e

echo "🚀 AI Power Rankings - Database Setup"
echo "===================================="

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found!"
    echo ""
    echo "Install with one of these methods:"
    echo "  brew install supabase/tap/supabase"
    echo "  npm install -g supabase"
    echo ""
    exit 1
fi

echo "✅ Supabase CLI found"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Initialize Supabase if not already done
if [ ! -d "supabase" ]; then
    echo "📁 Initializing Supabase..."
    supabase init
fi

# Check if we're linked
if ! supabase status &> /dev/null; then
    echo "🔗 Linking to Supabase project..."
    echo "Using project ref: fukdwnsvjdgyakdvtdin"
    supabase link --project-ref fukdwnsvjdgyakdvtdin
fi

# Create migrations directory if it doesn't exist
mkdir -p supabase/migrations

# Copy SQL files to migrations
echo "📄 Preparing migration files..."
cp database/schema-complete.sql "supabase/migrations/20240609000001_initial_schema.sql"
cp docs/data/POPULATE.sql "supabase/migrations/20240609000002_seed_data.sql"

echo "🔄 Running migrations..."
echo "This will create all tables and load the research data."
echo ""

# Ask for confirmation
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Run migrations
    supabase db push
    
    echo ""
    echo "✅ Database setup complete!"
    echo ""
    echo "📊 Verifying data..."
    
    # Run verification query
    supabase db query "SELECT 'Data Count' as check_type, 'Tools: ' || COUNT(*) FROM tools UNION ALL SELECT 'Rankings', 'Rankings: ' || COUNT(*) FROM ranking_cache UNION ALL SELECT 'Metrics', 'Metrics: ' || COUNT(*) FROM metrics_history"
    
    echo ""
    echo "🏆 Top 5 Current Rankings:"
    supabase db query "SELECT rc.position, t.name, rc.score FROM ranking_cache rc JOIN tools t ON rc.tool_id = t.id WHERE rc.period = 'june-2025' ORDER BY rc.position LIMIT 5"
    
    echo ""
    echo "✨ Setup complete! Your database is ready for POC1 validation."
    echo ""
    echo "Next steps:"
    echo "1. Generate TypeScript types: supabase gen types typescript --linked > src/types/database.types.ts"
    echo "2. Run validation queries: npm run validate-rankings"
    echo "3. Check the Supabase dashboard: supabase db ui"
else
    echo "❌ Setup cancelled"
    exit 1
fi