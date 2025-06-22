#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

// Define the base path for dictionaries
const DICTIONARIES_PATH = join(__dirname, "../../../i18n/dictionaries");

// List of language codes (excluding English)
const LANGUAGES = ["de", "fr", "hr", "it", "ja", "ko", "uk", "zh"];

// Translation placeholder prefix
const TRANSLATE_PREFIX = "[TRANSLATE] ";

interface TranslationObject {
  [key: string]: string | TranslationObject;
}

/**
 * Deep merge two objects, preserving existing translations and adding missing keys
 */
function deepMerge(
  target: TranslationObject,
  source: TranslationObject,
  path: string = ""
): TranslationObject {
  const result: TranslationObject = { ...target };

  for (const key in source) {
    const currentPath = path ? `${path}.${key}` : key;

    if (typeof source[key] === "object" && source[key] !== null) {
      // Recursive merge for nested objects
      if (typeof result[key] === "object" && result[key] !== null) {
        result[key] = deepMerge(
          result[key] as TranslationObject,
          source[key] as TranslationObject,
          currentPath
        );
      } else {
        // Target doesn't have this nested object, create it
        result[key] = deepMerge({}, source[key] as TranslationObject, currentPath);
      }
    } else {
      // It's a string value
      if (!(key in result)) {
        // Add missing translation with placeholder
        result[key] = `${TRANSLATE_PREFIX}${source[key]}`;
        console.log(`  Added missing key: ${currentPath}`);
      }
    }
  }

  return result;
}

/**
 * Count total keys in a translation object
 */
function countKeys(obj: TranslationObject): number {
  let count = 0;

  for (const key in obj) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      count += countKeys(obj[key] as TranslationObject);
    } else {
      count++;
    }
  }

  return count;
}

/**
 * Count keys that need translation (have the prefix)
 */
function countKeysNeedingTranslation(obj: TranslationObject): number {
  let count = 0;

  for (const key in obj) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      count += countKeysNeedingTranslation(obj[key] as TranslationObject);
    } else if (typeof obj[key] === "string" && obj[key].startsWith(TRANSLATE_PREFIX)) {
      count++;
    }
  }

  return count;
}

/**
 * Main function to sync translations
 */
function syncTranslations() {
  console.log("🌐 Starting translation synchronization...\n");

  // Read the English reference file
  const enPath = join(DICTIONARIES_PATH, "en.json");
  if (!existsSync(enPath)) {
    console.error("❌ English reference file not found at:", enPath);
    process.exit(1);
  }

  let enTranslations: TranslationObject;
  try {
    const enContent = readFileSync(enPath, "utf8");
    enTranslations = JSON.parse(enContent);
    console.log(`✅ Loaded English reference file with ${countKeys(enTranslations)} keys\n`);
  } catch (error) {
    console.error("❌ Failed to parse English reference file:", error);
    process.exit(1);
  }

  // Process each language file
  for (const lang of LANGUAGES) {
    console.log(`📝 Processing ${lang.toUpperCase()}...`);

    const langPath = join(DICTIONARIES_PATH, `${lang}.json`);

    if (!existsSync(langPath)) {
      console.log(`  ⚠️  File not found, creating new file`);
      // Create new file with all English keys as placeholders
      const newTranslations = deepMerge({}, enTranslations);
      writeFileSync(langPath, JSON.stringify(newTranslations, null, 2) + "\n");
      console.log(`  ✅ Created new file with ${countKeys(newTranslations)} keys\n`);
      continue;
    }

    try {
      // Read existing translations
      const langContent = readFileSync(langPath, "utf8");
      const langTranslations = JSON.parse(langContent);
      const originalKeyCount = countKeys(langTranslations);

      // Merge with English reference
      const updatedTranslations = deepMerge(langTranslations, enTranslations);
      const updatedKeyCount = countKeys(updatedTranslations);
      const keysAdded = updatedKeyCount - originalKeyCount;

      if (keysAdded > 0) {
        // Write updated translations
        writeFileSync(langPath, JSON.stringify(updatedTranslations, null, 2) + "\n");
        const needsTranslation = countKeysNeedingTranslation(updatedTranslations);
        console.log(
          `  ✅ Updated: ${keysAdded} keys added, ${needsTranslation} keys need translation\n`
        );
      } else {
        console.log(`  ✅ Already in sync, no updates needed\n`);
      }
    } catch (error) {
      console.error(`  ❌ Failed to process ${lang}:`, error);
      console.log("");
    }
  }

  console.log("✨ Translation synchronization complete!\n");

  // Summary report
  console.log("📊 Summary Report:");
  console.log("==================");

  for (const lang of LANGUAGES) {
    const langPath = join(DICTIONARIES_PATH, `${lang}.json`);
    if (existsSync(langPath)) {
      try {
        const langContent = readFileSync(langPath, "utf8");
        const langTranslations = JSON.parse(langContent);
        const totalKeys = countKeys(langTranslations);
        const needsTranslation = countKeysNeedingTranslation(langTranslations);
        const translated = totalKeys - needsTranslation;
        const percentage = Math.round((translated / totalKeys) * 100);

        console.log(
          `${lang.toUpperCase()}: ${translated}/${totalKeys} translated (${percentage}%)`
        );
      } catch {
        console.log(`${lang.toUpperCase()}: Error reading file`);
      }
    } else {
      console.log(`${lang.toUpperCase()}: File not found`);
    }
  }

  console.log('\n💡 Look for keys starting with "[TRANSLATE] " to find untranslated content');
}

// Run the script if called directly
syncTranslations();

export { syncTranslations };
