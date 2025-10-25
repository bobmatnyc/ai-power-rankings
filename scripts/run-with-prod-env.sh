#!/bin/bash
# Temporary script to run database scripts with production environment
# This pulls the production DATABASE_URL at runtime and executes the script

set -e

echo "🔄 Setting up production environment access..."

# Pull production environment to temporary file
TEMP_ENV=$(mktemp)
vercel env pull "$TEMP_ENV" --environment=production --yes

echo "✅ Environment loaded"
echo ""
echo "🚀 Running script: $1"
echo ""

# Load environment and run the script with NODE_ENV=production
set -a
source "$TEMP_ENV"
export NODE_ENV=production
set +a

# Execute the provided script
npx tsx "$1"

# Cleanup
rm -f "$TEMP_ENV"
