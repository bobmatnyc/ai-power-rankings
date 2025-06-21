const fs = require('fs');

const en = JSON.parse(fs.readFileSync('en.json', 'utf8'));
const languageFiles = fs.readdirSync('.').filter(f => f.endsWith('.json') && f !== 'en.json' && !f.includes('batch') && !f.includes('translate'));

function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else if (!target[key]) {
      target[key] = source[key]; // Use English as fallback
    }
  }
}

languageFiles.forEach(langFile => {
  try {
    const existing = JSON.parse(fs.readFileSync(langFile, 'utf8'));
    const synced = JSON.parse(JSON.stringify(en)); // Deep copy English structure
    deepMerge(synced, existing); // Overlay existing translations
    
    fs.writeFileSync(langFile, JSON.stringify(synced, null, 2));
    console.log(`🔄 Synced ${langFile}`);
  } catch (e) {
    console.log(`❌ Error syncing ${langFile}: ${e.message}`);
  }
});
