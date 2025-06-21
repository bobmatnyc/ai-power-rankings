#!/bin/bash

echo "🔍 Step 1: Verification"
node verify_i18n.js

echo ""
echo "🔄 Step 2: Structure sync"
node sync_structure.js

echo ""
echo "📏 Step 3: Size check"
node -e "
const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.json') && !f.includes('batch') && !f.includes('translate'));
const sizes = files.map(f => ({
  file: f,
  size: fs.statSync(f).size,
  lines: fs.readFileSync(f, 'utf8').split('\n').length
}));

const avgSize = sizes.reduce((sum, s) => sum + s.size, 0) / sizes.length;

console.log('File size analysis:');
sizes.forEach(s => {
  const deviation = s.file === 'en.json' ? 0 : ((s.size - avgSize) / avgSize * 100).toFixed(1);
  const flag = Math.abs(deviation) > 20 ? '🔴' : Math.abs(deviation) > 10 ? '🟡' : '✅';
  console.log(\`\${flag} \${s.file}: \${s.size}b (\${deviation}%) \${s.lines} lines\`);
});
"

echo ""
echo "✅ Step 4: JSON validation"
for file in *.json; do
  # Skip batch and translate files
  if [[ "$file" == *"batch"* ]] || [[ "$file" == *"translate"* ]]; then
    continue
  fi
  
  if ! node -e "JSON.parse(require('fs').readFileSync('$file', 'utf8'))" 2>/dev/null; then
    echo "❌ Invalid JSON in $file"
    exit 1
  fi
done
echo "✅ All main translation files are valid JSON"

echo ""
echo "📊 Step 5: Final verification"
node verify_i18n.js

echo ""
echo "🎉 Update workflow complete"
