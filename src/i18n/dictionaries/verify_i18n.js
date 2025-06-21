const fs = require('fs');
const path = require('path');

// This script verifies the consistency and completeness of translation files
// It's an internal tool for managing the translation workflow

const LANGUAGES = ['de', 'fr', 'hr', 'it', 'jp', 'ko', 'uk', 'zh'];
const DICTIONARIES_PATH = __dirname;

function getAllKeys(obj, prefix = '') {
  const keys = [];
  
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    const currentPath = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'string') {
      keys.push(currentPath);
    } else if (typeof value === 'object' && value !== null) {
      keys.push(...getAllKeys(value, currentPath));
    }
  });
  
  return keys;
}

function verifyTranslations() {
  console.log('🔍 Verifying translation consistency...\n');
  
  // Load English as the reference
  const enPath = path.join(DICTIONARIES_PATH, 'en.json');
  let enDict;
  let enKeys;
  
  try {
    enDict = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    enKeys = new Set(getAllKeys(enDict));
    console.log(`📘 Reference (en.json): ${enKeys.size} keys\n`);
  } catch (error) {
    console.error('❌ Error loading en.json:', error.message);
    return;
  }
  
  const issues = [];
  
  LANGUAGES.forEach(lang => {
    const dictPath = path.join(DICTIONARIES_PATH, `${lang}.json`);
    
    try {
      const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
      const langKeys = new Set(getAllKeys(dict));
      
      // Find missing keys
      const missingKeys = [...enKeys].filter(key => !langKeys.has(key));
      const extraKeys = [...langKeys].filter(key => !enKeys.has(key));
      
      console.log(`📗 ${lang}.json:`);
      console.log(`   - Total keys: ${langKeys.size}`);
      
      if (missingKeys.length > 0) {
        console.log(`   - ❌ Missing keys: ${missingKeys.length}`);
        issues.push({ lang, type: 'missing', keys: missingKeys });
      } else {
        console.log(`   - ✅ No missing keys`);
      }
      
      if (extraKeys.length > 0) {
        console.log(`   - ⚠️  Extra keys: ${extraKeys.length}`);
        issues.push({ lang, type: 'extra', keys: extraKeys });
      } else {
        console.log(`   - ✅ No extra keys`);
      }
      
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error processing ${lang}.json:`, error.message);
      issues.push({ lang, type: 'error', message: error.message });
    }
  });
  
  // Generate report if there are issues
  if (issues.length > 0) {
    const reportPath = path.join(DICTIONARIES_PATH, 'i18n-issues-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2) + '\n');
    console.log(`\n📋 Detailed issues report saved to: ${reportPath}`);
  } else {
    console.log('\n✅ All translations are consistent!');
  }
  
  console.log('\n✨ Verification complete!');
}

// Run the script
verifyTranslations();