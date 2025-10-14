#!/bin/bash

# Script to update Clerk production environment variables in Vercel
# Run this after completing 'vercel login'

set -e  # Exit on error

echo "🔗 Linking to Vercel project..."
vercel link --yes

echo ""
echo "🗑️  Removing old Clerk keys from production..."
vercel env rm NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production --yes 2>/dev/null || echo "   (Key didn't exist, skipping)"
vercel env rm CLERK_SECRET_KEY production --yes 2>/dev/null || echo "   (Key didn't exist, skipping)"

echo ""
echo "➕ Adding new Clerk LIVE keys to production..."

# Add publishable key
echo "pk_live_Y2xlcmsuYWlwb3dlcnJhbmtpbmcuY29tJA" | vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production

# Add secret key
echo "sk_live_ckkPNjau1etDPUFu9ugPORqBSDBCOPY2aVKsj4z2xK" | vercel env add CLERK_SECRET_KEY production

echo ""
echo "✅ Clerk live keys added to production!"

echo ""
echo "📋 Verifying environment variables..."
vercel env ls production | grep CLERK

echo ""
echo "🚀 Triggering production deployment..."
vercel --prod

echo ""
echo "✨ Done! Your production deployment is building with the new Clerk live keys."
echo "   Visit https://vercel.com/dashboard to monitor the deployment."
