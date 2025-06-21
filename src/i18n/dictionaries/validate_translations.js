const fs = require('fs');

const en = JSON.parse(fs.readFileSync('en.json', 'utf8'));
const languageFiles = fs.readdirSync('.').filter(f => f.endsWith('.json') && f !== 'en.json' && !f.includes('batch') && !f.includes('translate'));

function getAllKeyValuePairs(obj, prefix = '') {
  let pairs = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      pairs = pairs.concat(getAllKeyValuePairs(obj[key], fullKey));
    } else {
      pairs.push({ key: fullKey, value: obj[key] });
    }
  }
  return pairs;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current && current[key], obj);
}

function isLikelyPlaceholder(value, originalValue, langCode) {
  if (!value || typeof value !== 'string') return true;
  
  // Check if identical to English
  if (value === originalValue) return true;
  
  // Check for common placeholder patterns
  const placeholderPatterns = [
    /^TODO:/i,
    /^PLACEHOLDER/i,
    /^TRANSLATE/i,
    /^\[.*\]$/,
    /^<.*>$/,
    /^{{.*}}$/,
    /^TBD$/i,
    /^N\/A$/,
    /^$/, // empty string
  ];
  
  for (const pattern of placeholderPatterns) {
    if (pattern.test(value.trim())) return true;
  }
  
  // Language-specific checks
  switch (langCode.toLowerCase()) {
    case 'ko':
      // Korean should have Hangul characters
      return !/[\u3131-\uD79D]/.test(value);
    case 'jp':
      // Japanese should have Hiragana, Katakana, or Kanji
      return !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(value);
    case 'zh':
      // Chinese should have Chinese characters
      return !/[\u4E00-\u9FFF]/.test(value);
    case 'de':
      // German should have German characteristics (umlauts, ß, or German words)
      return !/[äöüÄÖÜß]/.test(value) && 
             !/\b(der|die|das|und|oder|ist|sind|haben|werden|mit|für|auf|von|zu|in|an|bei|nach|vor|über|unter|durch)\b/i.test(value);
    case 'fr':
      // French should have French characteristics (accents or French words)
      return !/[àâäæéèêëïîôöùûüÿç]/.test(value) && 
             !/\b(le|la|les|de|du|des|et|ou|est|sont|avoir|être|avec|pour|sur|dans|par|sans|sous|entre|depuis|pendant)\b/i.test(value);
    case 'it':
      // Italian should have Italian characteristics
      return !/[àèéìíîòóù]/.test(value) && 
             !/\b(il|la|lo|gli|le|di|da|in|con|su|per|tra|fra|è|sono|avere|essere|che|non|come|anche|tutto|quando)\b/i.test(value);
    case 'hr':
      // Croatian should have Croatian characteristics
      return !/[čćžšđČĆŽŠĐ]/.test(value) && 
             !/\b(i|je|se|na|za|od|do|u|s|sa|da|ne|to|kao|ali|jer|ako|kada|gdje|što|koji|koja|koje)\b/i.test(value);
    case 'uk':
      // Ukrainian should have Cyrillic characters
      return !/[\u0400-\u04FF]/.test(value);
    default:
      return false;
  }
}

const englishPairs = getAllKeyValuePairs(en);
console.log(`📊 Validating translations for ${englishPairs.length} keys across ${languageFiles.length} languages\n`);

const results = {};
const issues = {};

languageFiles.forEach(langFile => {
  const langCode = langFile.replace('.json', '');
  
  try {
    const langData = JSON.parse(fs.readFileSync(langFile, 'utf8'));
    
    let placeholders = 0;
    let untranslated = 0;
    let suspiciousEntries = [];
    
    englishPairs.forEach(({ key, value: englishValue }) => {
      const translatedValue = getNestedValue(langData, key);
      
      if (!translatedValue) {
        untranslated++;
        suspiciousEntries.push({ key, issue: 'missing', value: translatedValue });
      } else if (isLikelyPlaceholder(translatedValue, englishValue, langCode)) {
        placeholders++;
        suspiciousEntries.push({ 
          key, 
          issue: translatedValue === englishValue ? 'identical-to-english' : 'placeholder-pattern',
          value: translatedValue 
        });
      }
    });
    
    const translationQuality = ((englishPairs.length - placeholders - untranslated) / englishPairs.length * 100).toFixed(1);
    
    results[langCode] = {
      total: englishPairs.length,
      translated: englishPairs.length - untranslated,
      quality: englishPairs.length - placeholders - untranslated,
      placeholders,
      untranslated,
      qualityPercent: translationQuality
    };
    
    issues[langCode] = suspiciousEntries.slice(0, 10); // Keep first 10 issues for review
    
    const flag = translationQuality >= 90 ? '✅' : translationQuality >= 70 ? '🟡' : '🔴';
    console.log(`${flag} ${langCode.toUpperCase()}: ${translationQuality}% quality (${results[langCode].quality}/${englishPairs.length} properly translated)`);
    
    if (placeholders > 0) {
      console.log(`   📝 ${placeholders} placeholders/untranslated`);
    }
    if (untranslated > 0) {
      console.log(`   ❌ ${untranslated} missing keys`);
    }
    
  } catch (e) {
    console.log(`❌ ${langCode.toUpperCase()}: Error reading file - ${e.message}`);
  }
});

// Show detailed issues for languages with problems
console.log('\n🔍 Detailed Issues (first 10 per language):');
Object.keys(issues).forEach(langCode => {
  if (issues[langCode].length > 0) {
    console.log(`\n${langCode.toUpperCase()}:`);
    issues[langCode].slice(0, 5).forEach(issue => {
      console.log(`  • ${issue.key}: ${issue.issue} - "${issue.value}"`);
    });
    if (issues[langCode].length > 5) {
      console.log(`  ... and ${issues[langCode].length - 5} more issues`);
    }
  }
});

console.log('\n📊 Summary:');
Object.keys(results).forEach(langCode => {
  const r = results[langCode];
  console.log(`${langCode.toUpperCase()}: ${r.qualityPercent}% (${r.quality} good, ${r.placeholders} placeholders, ${r.untranslated} missing)`);
});
