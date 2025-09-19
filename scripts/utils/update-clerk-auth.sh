#!/bin/bash

# Update all admin API routes to use Clerk authentication

echo "Updating admin API routes to use Clerk authentication..."

# Find all TypeScript files in admin API directory
FILES=$(find /Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin -name "*.ts" -type f)

for FILE in $FILES; do
  echo "Processing: $FILE"

  # Replace the import statement
  sed -i '' 's/import { withAdminAuth } from "@\/lib\/admin-auth";/import { withAuth } from "@\/lib\/clerk-auth";/g' "$FILE"
  sed -i '' 's/import { isAdminAuthenticated, withAdminAuth } from "@\/lib\/admin-auth";/import { isAuthenticated, withAuth } from "@\/lib\/clerk-auth";/g' "$FILE"
  sed -i '' 's/import { isAdminAuthenticated, withAdminAuth, unauthorizedResponse } from "@\/lib\/admin-auth";/import { isAuthenticated, withAuth, unauthorizedResponse } from "@\/lib\/clerk-auth";/g' "$FILE"
  sed -i '' 's/import { isAdminAuthenticated, unauthorizedResponse } from "@\/lib\/admin-auth";/import { isAuthenticated, unauthorizedResponse } from "@\/lib\/clerk-auth";/g' "$FILE"
  sed -i '' 's/import { unauthorizedResponse } from "@\/lib\/admin-auth";/import { unauthorizedResponse } from "@\/lib\/clerk-auth";/g' "$FILE"

  # Replace function calls
  sed -i '' 's/withAdminAuth/withAuth/g' "$FILE"
  sed -i '' 's/isAdminAuthenticated(/isAuthenticated(/g' "$FILE"
done

echo "All admin API routes have been updated!"