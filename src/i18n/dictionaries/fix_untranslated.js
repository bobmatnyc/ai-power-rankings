const fs = require('fs');
const path = require('path');

// This script identifies and fixes untranslated strings in dictionary files
// It's an internal tool for managing the translation workflow

function getNestedValue(obj, path) {
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((curr, key) => {
    if (!curr[key]) curr[key] = {};
    return curr[key];
  }, obj);
  target[lastKey] = value;
}

function findUntranslatedStrings(dict, prefix = '') {
  const untranslated = [];
  
  Object.keys(dict).forEach(key => {
    const value = dict[key];
    const currentPath = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'string') {
      if (value.startsWith('[TRANSLATE]')) {
        untranslated.push({
          path: currentPath,
          value: value
        });
      }
    } else if (typeof value === 'object' && value !== null) {
      untranslated.push(...findUntranslatedStrings(value, currentPath));
    }
  });
  
  return untranslated;
}

function fixUntranslatedStrings() {
  const LANGUAGES = ['de', 'fr', 'hr', 'it', 'jp', 'ko', 'uk', 'zh'];
  const DICTIONARIES_PATH = __dirname;
  
  console.log('🔍 Checking for untranslated strings...\n');
  
  LANGUAGES.forEach(lang => {
    const dictPath = path.join(DICTIONARIES_PATH, `${lang}.json`);
    
    try {
      const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
      const untranslated = findUntranslatedStrings(dict);
      
      if (untranslated.length > 0) {
        console.log(`📝 ${lang}.json has ${untranslated.length} untranslated strings`);
        
        // Create a file with untranslated strings for easy translation
        const untranslatedFile = path.join(DICTIONARIES_PATH, `translate_${lang}_needed.json`);
        const untranslatedDict = {};
        
        untranslated.forEach(({ path, value }) => {
          setNestedValue(untranslatedDict, path, value);
        });
        
        fs.writeFileSync(untranslatedFile, JSON.stringify(untranslatedDict, null, 2) + '\n');
        console.log(`   Created ${untranslatedFile}`);
      } else {
        console.log(`✅ ${lang}.json is fully translated`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${lang}.json:`, error.message);
    }
  });
  
  console.log('\n✨ Untranslated string check complete!');
}

// Run the script
fixUntranslatedStrings();