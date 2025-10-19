#!/bin/bash
# Quick Fix: Secure Environment File Permissions
# Run this script to fix .env file permissions to owner-only (600)
# Author: Security Audit Recommendations
# Date: 2025-10-17

set -e

echo "🔒 Securing environment file permissions..."
echo ""

# Change to project root
cd "$(dirname "$0")/../.." || exit 1

# Fix permissions for all .env files
echo "Applying 600 permissions to environment files..."
chmod 600 .env.local 2>/dev/null && echo "  ✓ .env.local secured" || echo "  ℹ .env.local not found (skipped)"
chmod 600 .env.production 2>/dev/null && echo "  ✓ .env.production secured" || echo "  ℹ .env.production not found (skipped)"
chmod 600 .env.production.local 2>/dev/null && echo "  ✓ .env.production.local secured" || echo "  ℹ .env.production.local not found (skipped)"
chmod 600 .env.local.backup 2>/dev/null && echo "  ✓ .env.local.backup secured" || echo "  ℹ .env.local.backup not found (skipped)"

echo ""
echo "Verification:"
ls -la .env* 2>/dev/null | grep -E '\.(local|production)' || echo "  ℹ No .env files found to verify"

echo ""
echo "✅ Environment file permissions secured!"
echo ""
echo "Expected permissions: -rw------- (600)"
echo "See /docs/security/FIX-ENV-PERMISSIONS.md for details"
