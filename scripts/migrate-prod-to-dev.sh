#!/bin/bash

# Database Migration Script: Production to Development
# This script dumps the production database and imports it into development

set -e  # Exit on error

echo "🔄 Starting database migration from Production to Development..."

# Database connection strings
PROD_DB="postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-wispy-fog-ad8d4skz.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
DEV_DB="postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-bold-sunset-adneqlo6.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Temporary dump file
DUMP_FILE="/tmp/prod_dump_$(date +%Y%m%d_%H%M%S).sql"

echo "📥 Step 1: Dumping production database..."
pg_dump "$PROD_DB" --no-owner --no-privileges --clean --if-exists > "$DUMP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Production database dumped successfully to $DUMP_FILE"
    echo "📊 Dump file size: $(du -h "$DUMP_FILE" | cut -f1)"
else
    echo "❌ Failed to dump production database"
    exit 1
fi

echo ""
echo "📤 Step 2: Importing to development database..."
echo "⚠️  WARNING: This will REPLACE all data in the development database!"
echo ""

# Import to development
psql "$DEV_DB" < "$DUMP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Data imported successfully to development database"
else
    echo "❌ Failed to import data to development database"
    exit 1
fi

echo ""
echo "🧹 Step 3: Cleaning up..."
rm -f "$DUMP_FILE"
echo "✅ Temporary dump file removed"

echo ""
echo "🔍 Step 4: Verifying migration..."
# Count tables in dev database
TABLE_COUNT=$(psql "$DEV_DB" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "📊 Tables in development database: $TABLE_COUNT"

echo ""
echo "🎉 Migration completed successfully!"
echo "🔗 Development database is now a copy of production"
echo ""
echo "📝 Next steps:"
echo "  1. Restart your local development server: pnpm run dev:pm2 restart"
echo "  2. Access the app at: http://localhost:3004"