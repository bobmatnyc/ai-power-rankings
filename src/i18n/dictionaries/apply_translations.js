const fs = require('fs');
const path = require('path');

// This script applies translations from translation files to the main dictionary files
// It's an internal tool for managing the translation workflow

const LANGUAGES = ['de', 'fr', 'hr', 'it', 'jp', 'ko', 'uk', 'zh'];
const DICTIONARIES_PATH = __dirname;

function applyTranslations() {
  console.log('🔄 Applying translations to dictionary files...\n');

  LANGUAGES.forEach(lang => {
    // Check for translation files
    const translationFiles = fs.readdirSync(DICTIONARIES_PATH)
      .filter(file => file.startsWith(`translate_${lang}`) && file.endsWith('.json'));

    if (translationFiles.length === 0) {
      console.log(`⏭️  No translation files found for ${lang}`);
      return;
    }

    // Load the main dictionary
    const mainDictPath = path.join(DICTIONARIES_PATH, `${lang}.json`);
    let mainDict = {};
    
    try {
      mainDict = JSON.parse(fs.readFileSync(mainDictPath, 'utf8'));
    } catch (error) {
      console.error(`❌ Error loading ${lang}.json:`, error.message);
      return;
    }

    // Apply each translation file
    translationFiles.forEach(file => {
      console.log(`📝 Applying ${file} to ${lang}.json`);
      
      try {
        const translations = JSON.parse(fs.readFileSync(path.join(DICTIONARIES_PATH, file), 'utf8'));
        
        // Deep merge translations
        Object.keys(translations).forEach(section => {
          if (!mainDict[section]) {
            mainDict[section] = {};
          }
          
          Object.keys(translations[section]).forEach(key => {
            // Only apply if the translation doesn't have [TRANSLATE] prefix
            const value = translations[section][key];
            if (typeof value === 'string' && !value.startsWith('[TRANSLATE]')) {
              mainDict[section][key] = value;
            } else if (typeof value === 'object') {
              // Handle nested objects
              if (!mainDict[section][key]) {
                mainDict[section][key] = {};
              }
              Object.assign(mainDict[section][key], value);
            }
          });
        });
        
        // Archive the translation file
        const archivePath = path.join(DICTIONARIES_PATH, 'applied', file);
        if (!fs.existsSync(path.join(DICTIONARIES_PATH, 'applied'))) {
          fs.mkdirSync(path.join(DICTIONARIES_PATH, 'applied'));
        }
        fs.renameSync(path.join(DICTIONARIES_PATH, file), archivePath);
        console.log(`✅ Applied and archived ${file}`);
        
      } catch (error) {
        console.error(`❌ Error applying ${file}:`, error.message);
      }
    });

    // Save the updated dictionary
    fs.writeFileSync(mainDictPath, JSON.stringify(mainDict, null, 2) + '\n');
    console.log(`✅ Updated ${lang}.json\n`);
  });

  console.log('✨ Translation application complete!');
}

// Run the script
applyTranslations();