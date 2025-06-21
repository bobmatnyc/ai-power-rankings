const fs = require('fs');
const path = require('path');

// This script monitors the translation status and quality of dictionary files
// It's an internal tool for managing the translation workflow

const LANGUAGES = ['de', 'fr', 'hr', 'it', 'jp', 'ko', 'uk', 'zh'];
const DICTIONARIES_PATH = __dirname;

function countStrings(obj) {
  let count = 0;
  
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (typeof value === 'string') {
      count++;
    } else if (typeof value === 'object' && value !== null) {
      count += countStrings(value);
    }
  });
  
  return count;
}

function countUntranslatedStrings(obj) {
  let count = 0;
  
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (typeof value === 'string' && value.startsWith('[TRANSLATE]')) {
      count++;
    } else if (typeof value === 'object' && value !== null) {
      count += countUntranslatedStrings(value);
    }
  });
  
  return count;
}

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return (stats.size / 1024).toFixed(2) + ' KB';
  } catch {
    return 'N/A';
  }
}

function monitorTranslations() {
  console.log('📊 Translation Status Report\n');
  console.log('Language | Total Strings | Translated | Untranslated | Completion | File Size');
  console.log('---------|---------------|------------|--------------|------------|----------');
  
  const stats = [];
  
  LANGUAGES.forEach(lang => {
    const dictPath = path.join(DICTIONARIES_PATH, `${lang}.json`);
    
    try {
      const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
      const totalStrings = countStrings(dict);
      const untranslatedStrings = countUntranslatedStrings(dict);
      const translatedStrings = totalStrings - untranslatedStrings;
      const completion = totalStrings > 0 ? ((translatedStrings / totalStrings) * 100).toFixed(1) : 0;
      const fileSize = getFileSize(dictPath);
      
      stats.push({
        lang,
        totalStrings,
        translatedStrings,
        untranslatedStrings,
        completion: parseFloat(completion),
        fileSize
      });
      
      const completionBar = completion == 100 ? '✅' : completion >= 90 ? '🟨' : '🟥';
      
      console.log(
        `${lang.toUpperCase().padEnd(8)} | ${totalStrings.toString().padStart(13)} | ${translatedStrings.toString().padStart(10)} | ${untranslatedStrings.toString().padStart(12)} | ${completionBar} ${completion.padStart(5)}% | ${fileSize.padStart(9)}`
      );
    } catch (error) {
      console.log(`${lang.toUpperCase().padEnd(8)} | Error: ${error.message}`);
    }
  });
  
  // Summary statistics
  const avgCompletion = stats.reduce((sum, s) => sum + s.completion, 0) / stats.length;
  const totalUntranslated = stats.reduce((sum, s) => sum + s.untranslatedStrings, 0);
  
  console.log('\n📈 Summary:');
  console.log(`- Average completion: ${avgCompletion.toFixed(1)}%`);
  console.log(`- Total untranslated strings: ${totalUntranslated}`);
  
  // Check for pending translation files
  const translationFiles = fs.readdirSync(DICTIONARIES_PATH)
    .filter(file => file.startsWith('translate_') && file.endsWith('.json'));
  
  if (translationFiles.length > 0) {
    console.log(`\n⚠️  Pending translation files to apply:`);
    translationFiles.forEach(file => {
      console.log(`   - ${file}`);
    });
  }
  
  console.log('\n✨ Monitoring complete!');
}

// Run the script
monitorTranslations();