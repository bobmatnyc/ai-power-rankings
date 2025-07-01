#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DICTIONARIES_PATH = path.join(__dirname, '../../../i18n/dictionaries');
const REFERENCE_LANG = 'en';
const LANGUAGES = ['de', 'fr', 'hr', 'it', 'ja', 'ko', 'uk', 'zh'];

// Load translation file
function loadTranslation(lang) {
  const filePath = path.join(DICTIONARIES_PATH, `${lang}.json`);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading ${lang}.json:`, error.message);
    return null;
  }
}

// Recursively get all keys from an object
function getAllKeys(obj, prefix = '') {
  let keys = [];
  
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}

// Get value from object using dot notation
function getValue(obj, keyPath) {
  const keys = keyPath.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  
  return current;
}

// Compare translations
function compareTranslations() {
  const report = {
    timestamp: new Date().toISOString(),
    reference: REFERENCE_LANG,
    results: {}
  };

  // Load reference translation
  const referenceData = loadTranslation(REFERENCE_LANG);
  if (!referenceData) {
    console.error('Failed to load reference translation');
    return;
  }

  const referenceKeys = getAllKeys(referenceData);
  console.log(`\nReference language (${REFERENCE_LANG}) has ${referenceKeys.length} keys\n`);

  // Check each language
  for (const lang of LANGUAGES) {
    console.log(`Checking ${lang}...`);
    const langData = loadTranslation(lang);
    
    if (!langData) {
      report.results[lang] = {
        error: 'Failed to load translation file',
        missingKeys: [],
        emptyKeys: []
      };
      continue;
    }

    const missingKeys = [];
    const emptyKeys = [];

    // Check each reference key
    for (const key of referenceKeys) {
      const value = getValue(langData, key);
      
      if (value === undefined) {
        missingKeys.push(key);
      } else if (value === '' || (typeof value === 'string' && value.trim() === '')) {
        emptyKeys.push(key);
      }
    }

    report.results[lang] = {
      totalKeys: getAllKeys(langData).length,
      missingKeys: missingKeys,
      emptyKeys: emptyKeys,
      missingCount: missingKeys.length,
      emptyCount: emptyKeys.length,
      completeness: ((referenceKeys.length - missingKeys.length - emptyKeys.length) / referenceKeys.length * 100).toFixed(2) + '%'
    };

    console.log(`  - Total keys: ${report.results[lang].totalKeys}`);
    console.log(`  - Missing keys: ${missingKeys.length}`);
    console.log(`  - Empty keys: ${emptyKeys.length}`);
    console.log(`  - Completeness: ${report.results[lang].completeness}`);
  }

  // Generate summary
  console.log('\n=== SUMMARY ===\n');
  console.log(`Reference: ${REFERENCE_LANG} (${referenceKeys.length} keys)\n`);
  
  for (const lang of LANGUAGES) {
    const result = report.results[lang];
    if (result.error) {
      console.log(`${lang}: ERROR - ${result.error}`);
    } else {
      console.log(`${lang}: ${result.completeness} complete (${result.missingCount} missing, ${result.emptyCount} empty)`);
    }
  }

  // Save detailed report
  const reportPath = path.join(__dirname, '../translation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nDetailed report saved to: ${reportPath}`);

  // Generate human-readable report
  const readableReportPath = path.join(__dirname, '../translation-report.md');
  let readableReport = `# Translation Report\n\n`;
  readableReport += `Generated on: ${new Date().toLocaleString()}\n\n`;
  readableReport += `## Summary\n\n`;
  readableReport += `Reference language: **${REFERENCE_LANG}** (${referenceKeys.length} keys)\n\n`;
  readableReport += `| Language | Completeness | Missing Keys | Empty Keys |\n`;
  readableReport += `|----------|-------------|-------------|------------|\n`;
  
  for (const lang of LANGUAGES) {
    const result = report.results[lang];
    if (!result.error) {
      readableReport += `| ${lang} | ${result.completeness} | ${result.missingCount} | ${result.emptyCount} |\n`;
    }
  }

  readableReport += `\n## Detailed Missing Keys\n\n`;
  
  for (const lang of LANGUAGES) {
    const result = report.results[lang];
    if (!result.error && (result.missingCount > 0 || result.emptyCount > 0)) {
      readableReport += `### ${lang.toUpperCase()}\n\n`;
      
      if (result.missingCount > 0) {
        readableReport += `**Missing keys (${result.missingCount}):**\n`;
        result.missingKeys.forEach(key => {
          readableReport += `- ${key}\n`;
        });
        readableReport += `\n`;
      }
      
      if (result.emptyCount > 0) {
        readableReport += `**Empty keys (${result.emptyCount}):**\n`;
        result.emptyKeys.forEach(key => {
          readableReport += `- ${key}\n`;
        });
        readableReport += `\n`;
      }
    }
  }

  fs.writeFileSync(readableReportPath, readableReport);
  console.log(`Human-readable report saved to: ${readableReportPath}\n`);
}

// Run the comparison
compareTranslations();