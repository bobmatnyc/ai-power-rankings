#!/bin/bash

echo "🎯 AI Power Rankings i18n Translation Workflow"
echo "============================================="

echo ""
echo "🔍 Step 1: Current Status Check"
node validate_translations.js

echo ""
echo "📊 Step 2: Priority Analysis"
node extract_for_translation.js

echo ""
echo "📁 Step 3: High-Priority Batch Summary"
if [ -f "high_priority_translation_batch.json" ]; then
  echo "✅ High-priority batch ready:"
  node -e "
  const batch = JSON.parse(require('fs').readFileSync('high_priority_translation_batch.json', 'utf8'));
  console.log(\`  • \${batch.metadata.total_items} items\`);
  console.log(\`  • Categories: \${batch.metadata.categories.join(', ')}\`);
  console.log(\`  • Priority: \${batch.metadata.priority}\`);
  "
else
  echo "❌ High-priority batch file not found"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Translate high-priority batch (111 items)"
echo "2. Apply translations to language files"
echo "3. Validate translation quality"
echo "4. Continue with medium-priority items"
echo "5. Complete with remaining items"

echo ""
echo "🛠️  Available Tools:"
echo "• node validate_translations.js  - Check translation quality"
echo "• node extract_for_translation.js - Analyze categories"
echo "• node verify_i18n.js           - Check key coverage"
echo "• node sync_structure.js        - Sync file structures"
