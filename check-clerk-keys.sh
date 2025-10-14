#!/bin/bash

# Clerk Keys Verification Script
echo "🔐 Checking Clerk API Keys Configuration"
echo "=========================================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ ERROR: .env.local file not found!"
    exit 1
fi

# Extract keys
PUB_KEY=$(grep "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" .env.local | cut -d'=' -f2)
SECRET_KEY=$(grep "CLERK_SECRET_KEY" .env.local | cut -d'=' -f2)

# Check if keys exist
if [ -z "$PUB_KEY" ]; then
    echo "❌ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not found in .env.local"
    exit 1
fi

if [ -z "$SECRET_KEY" ]; then
    echo "❌ CLERK_SECRET_KEY not found in .env.local"
    exit 1
fi

echo "✅ Both keys found in .env.local"
echo ""

# Check key formats
echo "📋 Key Format Check:"
echo "-------------------"

if [[ $PUB_KEY == pk_test_* ]]; then
    echo "✅ Publishable Key: TEST environment (pk_test_***)"
elif [[ $PUB_KEY == pk_live_* ]]; then
    echo "✅ Publishable Key: PRODUCTION environment (pk_live_***)"
else
    echo "❌ Publishable Key: Invalid format"
    exit 1
fi

if [[ $SECRET_KEY == sk_test_* ]]; then
    echo "✅ Secret Key: TEST environment (sk_test_***)"
elif [[ $SECRET_KEY == sk_live_* ]]; then
    echo "✅ Secret Key: PRODUCTION environment (sk_live_***)"
else
    echo "❌ Secret Key: Invalid format"
    exit 1
fi

echo ""

# Check if both keys are from same environment
echo "🔍 Environment Match Check:"
echo "--------------------------"

PUB_ENV=$(echo $PUB_KEY | cut -d'_' -f2)
SECRET_ENV=$(echo $SECRET_KEY | cut -d'_' -f2)

if [ "$PUB_ENV" = "$SECRET_ENV" ]; then
    echo "✅ Both keys are from the SAME environment: $PUB_ENV"
else
    echo "❌ MISMATCH! Keys are from DIFFERENT environments:"
    echo "   Publishable: $PUB_ENV"
    echo "   Secret: $SECRET_ENV"
    echo ""
    echo "⚠️  This will cause authentication to fail!"
    echo "   Fix: Get both keys from the same Clerk application"
    exit 1
fi

echo ""

# Extract instance IDs (the part after pk_test_ or sk_test_)
echo "🔑 Application ID Check:"
echo "-----------------------"

# Get the instance identifier (everything between second and third underscore/dot)
PUB_INSTANCE=$(echo $PUB_KEY | sed 's/pk_[^_]*_\([^.]*\).*/\1/')
SECRET_INSTANCE=$(echo $SECRET_KEY | sed 's/sk_[^_]*_\([^.]*\).*/\1/')

echo "Publishable Key Instance ID: ${PUB_INSTANCE:0:12}..."
echo "Secret Key Instance ID:      ${SECRET_INSTANCE:0:12}..."

if [ "$PUB_INSTANCE" = "$SECRET_INSTANCE" ]; then
    echo ""
    echo "✅ SUCCESS! Both keys appear to be from the SAME Clerk application"
    echo ""
    echo "📊 Summary:"
    echo "  Environment: $PUB_ENV"
    echo "  Instance ID: ${PUB_INSTANCE:0:16}..."
    echo "  Status: Keys are correctly matched"
    echo ""
    echo "🎯 Next Steps:"
    echo "  1. Restart your dev server (if not already running)"
    echo "  2. Clear browser cookies for localhost"
    echo "  3. Sign in at: http://localhost:3000/en/sign-in"
    echo "  4. Try accessing: http://localhost:3000/en/admin"
    echo "  5. Check terminal for middleware logs"
    echo ""
else
    echo ""
    echo "⚠️  WARNING: Instance IDs appear DIFFERENT"
    echo ""
    echo "This likely means your keys are from DIFFERENT Clerk applications!"
    echo ""
    echo "🔧 How to Fix:"
    echo "  1. Go to: https://dashboard.clerk.com"
    echo "  2. Select your AI Power Ranking application"
    echo "  3. Go to: Configure → API Keys"
    echo "  4. Copy BOTH the Publishable Key AND Secret Key"
    echo "  5. Update .env.local with BOTH new keys"
    echo "  6. Restart dev server"
    echo ""
    exit 1
fi
