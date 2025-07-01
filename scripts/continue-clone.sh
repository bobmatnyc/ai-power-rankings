#!/bin/bash

# Continue the database cloning process for existing dev project
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Set access token
export SUPABASE_ACCESS_TOKEN=sbp_8afd1fd0a066eb290efa43e2f1a560d2ae576151

# Development project details
DEV_PROJECT_ID="gqucazglcjgvnzycwwia"
DEV_DB_PASSWORD="DevPassword123!"

echo -e "${GREEN}✅ Using development project: $DEV_PROJECT_ID${NC}"

# Dump production database schema and data
echo -e "${YELLOW}📦 Dumping production database...${NC}"
DUMP_FILE="prod-db-dump-$(date +%Y%m%d_%H%M%S).sql"

# Use pg_dump to create a complete backup
pg_dump "postgresql://postgres:gjx9uxg-UEH1vpa3jtn@db.fukdwnsvjdgyakdvtdin.supabase.co:5432/postgres" \
    --verbose \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --exclude-schema=information_schema \
    --exclude-schema=pg_* \
    --exclude-schema=supabase_* \
    --exclude-schema=auth \
    --exclude-schema=storage \
    --exclude-schema=realtime \
    --exclude-schema=vault \
    --exclude-schema=extensions \
    --exclude-table-data=auth.* \
    --exclude-table-data=storage.* \
    --exclude-table-data=realtime.* \
    > "$DUMP_FILE"

echo -e "${GREEN}✅ Database dumped to $DUMP_FILE${NC}"

# Construct development database URL
DEV_DB_CONNECTION="postgresql://postgres:$DEV_DB_PASSWORD@db.$DEV_PROJECT_ID.supabase.co:5432/postgres"

# Restore to development database
echo -e "${YELLOW}🔄 Restoring to development database...${NC}"
psql "$DEV_DB_CONNECTION" < "$DUMP_FILE"

echo -e "${GREEN}✅ Database successfully cloned to development environment!${NC}"

# Create environment file for development
echo ""
echo -e "${YELLOW}📝 Creating development environment file...${NC}"

cat > .env.local.dev << EOF
# DEVELOPMENT ENVIRONMENT - CLONED FROM PRODUCTION
# Generated on $(date)

# SUPABASE - Development Database
NEXT_PUBLIC_SUPABASE_URL=https://$DEV_PROJECT_ID.supabase.co
SUPABASE_PROJECT_ID=$DEV_PROJECT_ID
SUPABASE_DATABASE_PASSWORD=$DEV_DB_PASSWORD

# Note: You'll need to get the anon key and service role key from:
# https://supabase.com/dashboard/project/$DEV_PROJECT_ID/settings/api

# GITHUB
GITHUB_TOKEN=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
GITHUB_OWNER=bobmatnyc

# NGROK
NGROK_API_KEY=2yI1vV9BmusHGEvcxzNDpNIBnBN_7QQioQmneHdXjpMH8CvLC
NGROK_DOMAIN_ID=rd_2yI2Xi7oebU5yemMWBFCgeEoKJl
NGROK_DOMAIN=1mbot.ngrok.app

# AI SERVICES
OPENAI_API_KEY=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
OPENAI_MODEL=gpt-4-turbo

# MCP
MCP_API_KEY=06b15371e08e3a8c2b358c92c8f1e47f0c27e58593bef9e6401fca5bff211b0d
ENABLE_DEV_MODE=true
# DEV: Use localhost for development
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Vercel
CRON_SECRET=08a14c44c5991669da84d677ad6e5a4f57cc223e4805d8da30552ae843af6e2a

# AI Code Review Keys
AI_CODE_REVIEW_GOOGLE_API_KEY=AIzaSyDkdOniO07apsRpMatbzprT-2PmK91sg6M
AI_CODE_REVIEW_OPENROUTER_API_KEY=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
AI_CODE_REVIEW_OPENAI_API_KEY=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
AI_CODE_REVIEW_MODEL=gemini:gemini-2.5-pro
AI_CODE_REVIEW_WRITER_MODEL=openrouter:anthropic/claude-3-haiku
AI_CODE_REVIEW_LOG_LEVEL=debug

# RESEND
RESEND_API_KEY=re_ePEpxnvT_Fv3tSDdBbyXMsgkoHLpm4xGf

# TURNSTILE
TURNSTILE_SITE_KEY=0x4AAAAAABglXFXbgAmdRz-H
TURNSTILE_SECRET_KEY=0x4AAAAAABglXGY3T71yxKc-TecL57J52M4

# Add the API keys from dashboard here:
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
EOF

echo -e "${GREEN}✅ Development environment file created: .env.local.dev${NC}"

# Cleanup
echo ""
echo -e "${YELLOW}🧹 Cleaning up...${NC}"
rm "$DUMP_FILE"

echo ""
echo -e "${GREEN}🎉 Development database setup complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Go to https://supabase.com/dashboard/project/$DEV_PROJECT_ID/settings/api"
echo "2. Copy the anon key and service role key"
echo "3. Update .env.local.dev with these keys"
echo "4. Copy .env.local.dev to .env.local when working on development"
echo "5. Test your development environment with: npm run dev"