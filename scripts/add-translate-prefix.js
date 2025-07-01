#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Path to the zh.json file
const zhFilePath = path.join(__dirname, '../src/i18n/dictionaries/zh.json');

// Read the zh.json file
const zhContent = JSON.parse(fs.readFileSync(zhFilePath, 'utf8'));

// Function to add [TRANSLATE] prefix to all string values recursively
function addTranslatePrefix(obj) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Add [TRANSLATE] prefix only if it doesn't already have it
      if (!obj[key].startsWith('[TRANSLATE]')) {
        obj[key] = '[TRANSLATE] ' + obj[key];
      }
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      // Recursively process nested objects
      addTranslatePrefix(obj[key]);
    }
  }
  return obj;
}

// Process the content
const updatedContent = addTranslatePrefix(zhContent);

// Write the updated content back to the file
fs.writeFileSync(zhFilePath, JSON.stringify(updatedContent, null, 2));

console.log('✅ Successfully added [TRANSLATE] prefix to all string values in zh.json');
console.log(`📁 File updated: ${zhFilePath}`);