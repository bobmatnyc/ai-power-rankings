#!/bin/bash

echo "🎯 I18n Quality Improvement Workflow"
echo "Goal: Get all languages to 60%+ quality (preferably 100%)"
echo ""

# Step 1: Current status
echo "📊 CURRENT STATUS:"
node monitor_i18n.js | grep -E "(📊|Summary:|🎉|✅|❌)"
echo ""

# Step 2: Priority order (fewest issues first)
echo "🎯 PRIORITY ORDER (tackle easiest first):"
echo "1. ✅ KO (Korean) - PERFECT (0 issues)"
echo "2. ✅ ZH (Chinese) - PERFECT (0 issues)" 
echo "3. 🟡 HR (Croatian) - 63 issues (template ready)"
echo "4. 🟡 UK (Ukrainian) - 91 issues"
echo "5. 🔴 DE (German) - 212 issues"
echo "6. 🔴 JP (Japanese) - 226 issues"
echo "7. 🔴 FR (French) - 236 issues"
echo "8. 🔴 IT (Italian) - 242 issues"
echo ""

echo "📋 NEXT STEPS:"
echo "1. Translate Croatian (hr): Edit translate_hr.json with Croatian translations"
echo "2. Run: node apply_translations.js"
echo "3. Generate template for Ukrainian: node fix_untranslated.js (focus on uk)"
echo "4. Repeat for remaining languages"
echo ""

echo "🛠️ COMMANDS:"
echo "   node monitor_i18n.js          # Check current status"
echo "   node fix_untranslated.js      # Generate translation templates"
echo "   node apply_translations.js    # Apply completed translations"
echo "   ./quality_workflow.sh         # Run this summary"

# Show template files
echo ""
echo "📁 Available templates:"
ls -la translate_*.json 2>/dev/null || echo "   No templates found"
