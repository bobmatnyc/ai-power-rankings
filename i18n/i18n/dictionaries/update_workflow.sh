#!/bin/bash

echo "🔍 Step 1: Git status check"
git status --porcelain

echo ""
echo "🔍 Step 2: Verification"
node verify_i18n.js

echo ""
echo "🔄 Step 3: Structure sync"
node sync_structure.js

echo ""
echo "📏 Step 4: Size check"
node check_sizes.js

echo ""
echo "✅ Step 5: JSON validation"
for file in *.json; do
  if [[ "$file" == en.json ]] || [[ "$file" == de.json ]] || [[ "$file" == fr.json ]] || [[ "$file" == hr.json ]] || [[ "$file" == it.json ]] || [[ "$file" == jp.json ]] || [[ "$file" == ko.json ]] || [[ "$file" == uk.json ]] || [[ "$file" == zh.json ]]; then
    if ! node -e "JSON.parse(require('fs').readFileSync('$file', 'utf8'))" 2>/dev/null; then
      echo "❌ Invalid JSON in $file"
      exit 1
    else
      echo "✅ Valid JSON in $file"
    fi
  fi
done

echo ""
echo "📊 Step 6: Final verification"
node verify_i18n.js

echo ""
echo "📝 Step 7: Git commit (if changes detected)"
if [[ -n $(git status --porcelain) ]]; then
  git add -A
  git commit -m "feat(i18n): update translations and cleanup - $(date '+%Y-%m-%d %H:%M')"
  echo "✅ Changes committed to git"
else
  echo "ℹ️  No changes to commit"
fi

echo ""
echo "🎉 Update workflow complete"
