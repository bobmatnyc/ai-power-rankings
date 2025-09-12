#!/bin/bash

# Vercel Environment Variables Setup Script
# ==========================================
# This script sets up all required environment variables for production database

echo "🚀 Setting up Vercel Environment Variables for Production Database"
echo "================================================================"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI is not installed. Please install it first:"
    echo "   npm i -g vercel"
    exit 1
fi

# Check if logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo "❌ Not logged in to Vercel. Please login first:"
    echo "   vercel login"
    exit 1
fi

echo ""
echo "⚠️  IMPORTANT: You need to replace the password in .env.production.local first!"
echo "   The current password placeholder needs to be updated with your actual Neon password."
echo ""
read -p "Have you updated the password in .env.production.local? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please update the password in .env.production.local first, then run this script again."
    exit 1
fi

# Load environment variables from .env.production.local
if [ -f .env.production.local ]; then
    export $(cat .env.production.local | grep -v '^#' | xargs)
else
    echo "❌ .env.production.local not found!"
    exit 1
fi

echo ""
echo "📝 Setting up environment variables..."
echo ""

# Set database URLs (encrypted/sensitive)
echo "Setting DATABASE_URL (encrypted)..."
echo "$DATABASE_URL" | vercel env add DATABASE_URL production --force

echo "Setting DATABASE_URL_UNPOOLED (encrypted)..."
echo "$DATABASE_URL_UNPOOLED" | vercel env add DATABASE_URL_UNPOOLED production --force

echo "Setting DIRECT_DATABASE_URL (encrypted)..."
echo "$DIRECT_DATABASE_URL" | vercel env add DIRECT_DATABASE_URL production --force

# Set feature flags (plain text)
echo "Setting USE_DATABASE..."
echo "$USE_DATABASE" | vercel env add USE_DATABASE production --force

echo "Setting DATABASE_MIGRATION_MODE..."
echo "$DATABASE_MIGRATION_MODE" | vercel env add DATABASE_MIGRATION_MODE production --force

echo ""
echo "✅ Environment variables have been set up successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Verify the variables in Vercel dashboard:"
echo "   https://vercel.com/[your-team]/ai-power-rankings/settings/environment-variables"
echo ""
echo "2. Push your database schema (if not already done):"
echo "   npm run db:push"
echo ""
echo "3. Run database migrations (if needed):"
echo "   DATABASE_MIGRATION_MODE=migrate npm run db:migrate:json"
echo ""
echo "4. Deploy to production:"
echo "   vercel --prod"
echo ""
echo "5. Monitor the deployment:"
echo "   vercel logs --prod"