#!/bin/bash

# Cache Implementation Verification Script
# Verifies that all components of the caching strategy are properly implemented

echo "🔍 Verifying Cache Implementation..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track pass/fail
CHECKS_PASSED=0
CHECKS_FAILED=0

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} File exists: $1"
        ((CHECKS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} File missing: $1"
        ((CHECKS_FAILED++))
        return 1
    fi
}

check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Found in $1: $3"
        ((CHECKS_PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} Missing in $1: $3"
        ((CHECKS_FAILED++))
        return 1
    fi
}

echo "📦 Checking Core Files..."
check_file "lib/cache/invalidation.service.ts"
check_file "docs/architecture/CACHING_STRATEGY.md"
check_file "docs/development/CACHE_IMPLEMENTATION_SUMMARY.md"
echo ""

echo "📄 Checking ISR Configuration..."
check_content "app/[lang]/tools/page.tsx" "export const revalidate = 3600" "ISR on tools page"
check_content "app/[lang]/page.tsx" "export const revalidate = 300" "ISR on homepage"
check_content "app/[lang]/whats-new/page.tsx" "revalidate: 1800" "ISR on what's new page"
echo ""

echo "🔄 Checking Cache Invalidation Imports..."
check_content "app/api/admin/articles/[id]/route.ts" "invalidateArticleCache" "Article endpoint imports"
check_content "app/api/admin/articles/[id]/recalculate/route.ts" "invalidateArticleCache" "Recalculate endpoint imports"
check_content "app/api/admin/articles/ingest/route.ts" "invalidateArticleCache" "Ingest endpoint imports"
check_content "app/api/admin/rankings/commit/route.ts" "invalidateRankingsCache" "Rankings endpoint imports"
echo ""

echo "🎯 Checking Cache Invalidation Calls..."
check_content "app/api/admin/articles/[id]/route.ts" "invalidateArticleCache()" "Article PATCH invalidation"
check_content "app/api/admin/articles/[id]/route.ts" "invalidateArticleCache()" "Article DELETE invalidation"
check_content "app/api/admin/articles/[id]/recalculate/route.ts" "!dryRun" "Recalculate dry-run check"
check_content "app/api/admin/articles/ingest/route.ts" "invalidateArticleCache()" "Ingest invalidation"
check_content "app/api/admin/rankings/commit/route.ts" "invalidateRankingsCache()" "Rankings commit invalidation"
echo ""

echo "🏷️  Checking Cache Service Exports..."
check_content "lib/cache/invalidation.service.ts" "export const CACHE_TAGS" "Cache tags export"
check_content "lib/cache/invalidation.service.ts" "export const CACHE_PATHS" "Cache paths export"
check_content "lib/cache/invalidation.service.ts" "export async function invalidateArticleCache" "Article invalidation function"
check_content "lib/cache/invalidation.service.ts" "export async function invalidateRankingsCache" "Rankings invalidation function"
echo ""

echo "═══════════════════════════════════════════════════"
echo "📊 Verification Summary"
echo "═══════════════════════════════════════════════════"
echo -e "${GREEN}✓ Passed: ${CHECKS_PASSED}${NC}"
echo -e "${RED}✗ Failed: ${CHECKS_FAILED}${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! Cache implementation is complete.${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some checks failed. Please review the implementation.${NC}"
    exit 1
fi
