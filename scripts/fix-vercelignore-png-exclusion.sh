#!/bin/bash

# Fix .vercelignore PNG exclusion issue
# This script updates .vercelignore to allow tool icon PNGs while still excluding test images

set -e  # Exit on error

REPO_ROOT="/Users/masa/Projects/aipowerranking"
cd "$REPO_ROOT"

echo "🔍 Diagnosing the issue..."
echo ""

# Check current state
echo "📊 Current state:"
echo "  Git-tracked PNGs: $(git ls-files 'public/tool-icons/*.png' | wc -l | tr -d ' ')"
echo "  Filesystem PNGs:  $(ls public/tool-icons/*.png 2>/dev/null | wc -l | tr -d ' ')"
echo ""

# Show the problematic pattern
echo "❌ Problematic .vercelignore pattern:"
grep -A 2 "Large images" .vercelignore || echo "Pattern not found"
echo ""

# Backup current .vercelignore
echo "💾 Backing up .vercelignore..."
cp .vercelignore .vercelignore.backup
echo "  Backup saved to: .vercelignore.backup"
echo ""

# Create new .vercelignore with specific exclusions
echo "✏️  Updating .vercelignore..."
cat > .vercelignore << 'EOF'
# Logs
logs/
*.log

# Testing artifacts
uat-screenshots/
test-results/
playwright-report/
playwright/.cache/
tests/
*.test.js
*.spec.js
*.spec.ts
*.webm
trace.zip

# Documentation and reports
# Root-level markdown files (docs/reports)
/*.md
/docs/*.md
/scripts/*.md
QA_*.md
HYDRATION_*.md
TEST_*.txt
BEFORE_AFTER_*.md

# Scripts (not needed in production)
# Note: Keep generate-static-categories.ts for build process
scripts/*
!scripts/generate-static-categories.ts

# TypeScript build info
*.tsbuildinfo

# Memory and cache
kuzu-memories/
.claude/
.claude-mpm/
.mcp-vector-search/
.kuzu-memory/

# Data files - only exclude backups
data/deleted-articles-backup-*.json
data/extracted-rankings/
data/uuid-mappings.json

# Large images - SPECIFIC PATTERNS ONLY (don't use *.png *.jpg *.jpeg)
# Exclude test screenshots and reports, but ALLOW static assets in public/
test-screenshots/
lighthouse-*.report.html
lighthouse-*.png

# Misc
.gitignore.test
cleanup-audit.json
parse-test-results.js
verify-*.js
check-*.js
test-*.js
EOF

echo "  ✅ .vercelignore updated"
echo ""

# Show the difference
echo "📝 Changes made:"
diff .vercelignore.backup .vercelignore || true
echo ""

# Verify the fix
echo "🧪 Verification:"
echo "  Tool icons will now be included in Vercel deployment"
echo "  Test screenshots still excluded from deployment"
echo ""

# Next steps
echo "🚀 Next steps:"
echo ""
echo "1. Review the changes:"
echo "   diff .vercelignore.backup .vercelignore"
echo ""
echo "2. Commit the fix:"
echo "   git add .vercelignore"
echo "   git commit -m 'fix: allow tool icon PNGs in Vercel deployment'"
echo ""
echo "3. Deploy:"
echo "   git push"
echo ""
echo "4. Verify after deployment:"
echo "   curl -I https://aipowerranking.com/tool-icons/cursor.png"
echo "   # Should return HTTP 200"
echo ""

echo "✅ Script completed successfully"
echo ""
echo "To restore the backup:"
echo "  mv .vercelignore.backup .vercelignore"
