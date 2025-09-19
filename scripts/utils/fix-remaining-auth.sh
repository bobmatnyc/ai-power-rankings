#!/bin/bash

# Fix remaining files that still use old auth

echo "Fixing remaining auth imports..."

# List of files to fix
FILES=(
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/articles/[id]/recalculate/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/articles/[id]/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/articles/ingest/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/articles/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/db-status/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/news/analyze/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/rankings/commit/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/rankings/preview/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/rankings/rollback/[id]/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/rankings/versions/route.ts"
)

# Fix imports and function calls in these specific files
for FILE in "${FILES[@]}"; do
  echo "Processing: $FILE"

  # Replace import statements
  sed -i '' 's/import { withAdminAuth.* } from "@\/lib\/admin-auth";/import { withAuth } from "@\/lib\/clerk-auth";/g' "$FILE"
  sed -i '' 's/import { isAdminAuthenticated.* } from "@\/lib\/admin-auth";/import { isAuthenticated } from "@\/lib\/clerk-auth";/g' "$FILE"

  # Replace function calls
  sed -i '' 's/withAdminAuth(/withAuth(/g' "$FILE"
  sed -i '' 's/isAdminAuthenticated(/isAuthenticated(/g' "$FILE"
done

# Now handle files that don't have any auth wrapper
echo "Adding auth to files without any wrapper..."

# Files that need withAuth wrapper added
NO_AUTH_FILES=(
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/update-site-settings/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/update-missing-company-data/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/test-metrics/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/subscribers/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/remove-data/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/preview-rankings-json/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/rate-limit/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/fix-orphaned-metrics/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/fix-orphaned-data/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/create-user/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/check-ranking-periods/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/check-orphaned-metrics/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/subscribers/export/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/rankings/set-current/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/rankings/periods/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/rankings/build/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/rankings/[period]/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/seo/submit-sitemap/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/rankings/all/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/subscribers/[id]/test-email/route.ts"
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/rankings/[period]/delete/route.ts"
)

for FILE in "${NO_AUTH_FILES[@]}"; do
  echo "Adding auth to: $FILE"

  # Check if the file already imports from clerk-auth
  if ! grep -q "@/lib/clerk-auth" "$FILE"; then
    # Add import at the beginning of the file (after the first import statement)
    sed -i '' '1,/^import/{ /^import/a\
import { withAuth } from "@/lib/clerk-auth";
}' "$FILE"
  fi

  # Wrap async function bodies with withAuth
  # This is complex, so we'll need to handle it file by file
done

echo "Done!"