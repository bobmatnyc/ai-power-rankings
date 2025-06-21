const fs = require('fs');

function setNestedProperty(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = value;
}

function applyTranslations(langCode, sourceFile) {
  console.log(`🌍 Processing ${langCode.toUpperCase()}...`);
  
  if (!fs.existsSync(sourceFile)) {
    console.log(`❌ Source file ${sourceFile} not found`);
    return false;
  }
  
  const targetFile = `${langCode}.json`;
  if (!fs.existsSync(targetFile)) {
    console.log(`❌ Target file ${targetFile} not found`);
    return false;
  }
  
  const translations = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const langData = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
  
  let updated = 0;
  Object.entries(translations).forEach(([path, translation]) => {
    if (translation && typeof translation === 'string' && translation.trim() !== '') {
      setNestedProperty(langData, path, translation);
      updated++;
    }
  });
  
  fs.writeFileSync(targetFile, JSON.stringify(langData, null, 2));
  console.log(`✅ Updated ${targetFile} with ${updated} translations`);
  return true;
}

console.log('🎯 BATCH APPLYING TRANSLATIONS TO REACH 80% TARGET');
console.log('===================================================');

// Apply translations for all three target languages
const languages = [
  { code: 'jp', file: 'batch_80_jp_translated.json', name: 'Japanese' },
  { code: 'fr', file: 'batch_80_fr_translated.json', name: 'French' },
  { code: 'it', file: 'batch_80_it_translated.json', name: 'Italian' }
];

languages.forEach(lang => {
  console.log(`\n📊 ${lang.name} (${lang.code.toUpperCase()}):`);
  applyTranslations(lang.code, lang.file);
});

console.log('\n🔄 Run status check to verify 80% target achievement...');
