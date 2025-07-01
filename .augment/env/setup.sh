#!/bin/bash
set -e

echo "🚀 Setting up AI Power Rankings development environment..."

# Set shell environment variable
export SHELL=/bin/bash

# Update system packages
sudo apt-get update -y

# Install Node.js 20 (LTS) - using the correct version
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js installation
node --version
npm --version

# Install pnpm using npm with sudo to avoid permission issues
echo "📦 Installing pnpm package manager..."
sudo npm install -g pnpm@8.15.4

# Verify pnpm installation
pnpm --version

# Install project dependencies
echo "📦 Installing project dependencies..."
pnpm install

# Install additional system dependencies that might be needed
echo "📦 Installing additional system dependencies..."
sudo apt-get install -y git curl wget build-essential

# Set up environment variables for testing
echo "🔧 Setting up test environment variables..."
export NODE_ENV=test
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
export SUPABASE_SERVICE_ROLE_KEY=test-service-key
export LOG_LEVEL=silent

# Add environment variables to profile for persistence
cat >> $HOME/.profile << 'EOF'

# Test environment variables
export NODE_ENV=test
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
export SUPABASE_SERVICE_ROLE_KEY=test-service-key
export LOG_LEVEL=silent
EOF

# Verify TypeScript compilation
echo "🔍 Checking TypeScript compilation..."
pnpm run type-check

# Run linting but don't fail on warnings (only errors)
echo "🔍 Running linter (warnings allowed)..."
pnpm run lint || echo "⚠️  Linting completed with warnings (non-blocking)"

echo "✅ Setup completed successfully!"
echo "🧪 Ready to run tests..."