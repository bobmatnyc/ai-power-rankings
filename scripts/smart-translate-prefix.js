#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Path to the zh.json file
const zhFilePath = path.join(__dirname, '../src/i18n/dictionaries/zh.json');

// Read the zh.json file
const zhContent = JSON.parse(fs.readFileSync(zhFilePath, 'utf8'));

// Function to detect if a string is primarily English
function isPrimarilyEnglish(str) {
  // Remove [TRANSLATE] prefix if it exists for checking
  const cleanStr = str.replace(/^\[TRANSLATE\]\s*/, '');
  
  // If string is empty or just whitespace, skip
  if (!cleanStr.trim()) return false;
  
  // Count English characters (letters, numbers, common punctuation)
  const englishChars = cleanStr.match(/[a-zA-Z0-9\s.,!?;:()\-"'/]/g) || [];
  
  // Count Chinese characters (CJK Unified Ideographs)
  const chineseChars = cleanStr.match(/[\u4e00-\u9fff]/g) || [];
  
  // If it has Chinese characters, it's likely already translated
  if (chineseChars.length > 0) return false;
  
  // If it's mostly English characters and no Chinese, it needs translation
  return englishChars.length > cleanStr.length * 0.7;
}

// Function to add [TRANSLATE] prefix only to English strings
function addTranslatePrefixToEnglish(obj) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Only add [TRANSLATE] if it's primarily English and doesn't already have the prefix
      if (isPrimarilyEnglish(obj[key]) && !obj[key].startsWith('[TRANSLATE]')) {
        obj[key] = '[TRANSLATE] ' + obj[key];
      }
      // Remove [TRANSLATE] from already-translated Chinese content
      else if (!isPrimarilyEnglish(obj[key]) && obj[key].startsWith('[TRANSLATE]')) {
        obj[key] = obj[key].replace(/^\[TRANSLATE\]\s*/, '');
      }
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      // Recursively process nested objects
      addTranslatePrefixToEnglish(obj[key]);
    }
  }
  return obj;
}

// Process the content
const updatedContent = addTranslatePrefixToEnglish(zhContent);

// Write the updated content back to the file
fs.writeFileSync(zhFilePath, JSON.stringify(updatedContent, null, 2));

console.log('✅ Successfully updated zh.json with smart [TRANSLATE] prefixes');
console.log('   - Added [TRANSLATE] to English strings that need translation');
console.log('   - Removed [TRANSLATE] from already-translated Chinese strings');
console.log(`📁 File updated: ${zhFilePath}`);
