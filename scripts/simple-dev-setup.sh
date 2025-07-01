#!/bin/bash

# Simple approach: Setup development environment with API keys
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🎯 Simple Development Database Setup${NC}"
echo "============================================"

# Development project details
DEV_PROJECT_ID="gqucazglcjgvnzycwwia"
DEV_PROJECT_URL="https://$DEV_PROJECT_ID.supabase.co"

echo -e "${YELLOW}📋 Development Project Created:${NC}"
echo "  Project ID: $DEV_PROJECT_ID"
echo "  URL: $DEV_PROJECT_URL"
echo "  Dashboard: https://supabase.com/dashboard/project/$DEV_PROJECT_ID"

echo ""
echo -e "${YELLOW}📝 Creating development environment file...${NC}"

# Create environment file for development
cat > .env.local.dev << EOF
# DEVELOPMENT ENVIRONMENT - Safe Development Database
# Generated on $(date)
# Development Project: $DEV_PROJECT_ID

# SUPABASE - Development Database
NEXT_PUBLIC_SUPABASE_URL=$DEV_PROJECT_URL
SUPABASE_PROJECT_ID=$DEV_PROJECT_ID
SUPABASE_DATABASE_PASSWORD=DevPassword123!

# TODO: Get these from https://supabase.com/dashboard/project/$DEV_PROJECT_ID/settings/api
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

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
EOF

echo -e "${GREEN}✅ Development environment file created: .env.local.dev${NC}"

echo ""
echo -e "${GREEN}🎉 Development Database Setup Summary${NC}"
echo "=================================================="
echo ""
echo -e "${YELLOW}✅ What's Done:${NC}"
echo "  • Created new Supabase development project"
echo "  • Generated development environment file"
echo "  • Set up safe development configuration"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "  1. Get API keys from: https://supabase.com/dashboard/project/$DEV_PROJECT_ID/settings/api"
echo "  2. Update .env.local.dev with the anon key and service role key"
echo "  3. Set up database schema using one of these options:"
echo ""
echo -e "${YELLOW}     Option A - Copy Schema from Production:${NC}"
echo "     • Go to https://supabase.com/dashboard/project/fukdwnsvjdgyakdvtdin/sql/new"
echo "     • Copy your existing schema SQL and run it in development project"
echo ""
echo -e "${YELLOW}     Option B - Use Migration Files:${NC}"
echo "     • Run existing migration files in development database"
echo "     • Use: database/schema-complete.sql"
echo ""
echo -e "${YELLOW}     Option C - Use Supabase CLI:${NC}"
echo "     • Link to development project: supabase link --project-ref $DEV_PROJECT_ID"
echo "     • Push migrations: supabase db push"
echo ""
echo -e "${YELLOW}🔄 To Switch to Development:${NC}"
echo "  • Copy .env.local.dev to .env.local"
echo "  • Run: npm run dev"
echo "  • Your app will now use the development database safely!"
echo ""
echo -e "${YELLOW}🔄 To Switch Back to Production:${NC}"
echo "  • Copy your original .env.local back"
echo "  • Your production data remains completely safe"