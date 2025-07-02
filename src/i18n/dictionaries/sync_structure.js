/**
 * Safe structure synchronization script for i18n dictionary files
 * 
 * This script:
 * - Creates backups before making any changes
 * - Preserves existing translations (never overwrites with English)
 * - Marks new untranslated keys with [TRANSLATE] prefix
 * - Validates files to prevent corruption
 * 
 * Usage: node sync_structure.js
 */

const fs = require("fs");

const en = JSON.parse(fs.readFileSync("en.json", "utf8"));
const languageFiles = fs
  .readdirSync(".")
  .filter(
    (f) =>
      f.endsWith(".json") &&
      f !== "en.json" &&
      !f.includes("batch") &&
      !f.includes("backup") &&
      !f.includes("translate") &&
      !f.includes("project_summary")
  );

// Create backup before making changes
const backupDir = "./backups";
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
}

const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];

// Improved deep merge that preserves existing translations
function deepMerge(enStructure, existingTranslations) {
  const result = {};

  // First, add all keys from English structure
  for (const key in enStructure) {
    if (enStructure[key] && typeof enStructure[key] === "object" && !Array.isArray(enStructure[key])) {
      // If it's an object, recursively merge
      if (existingTranslations && existingTranslations[key] && typeof existingTranslations[key] === "object") {
        result[key] = deepMerge(enStructure[key], existingTranslations[key]);
      } else {
        // No existing translations for this object, use placeholder
        result[key] = deepMerge(enStructure[key], {});
      }
    } else {
      // For leaf values, prefer existing translation over English
      if (existingTranslations && key in existingTranslations) {
        result[key] = existingTranslations[key];
      } else {
        // Mark untranslated values
        result[key] = `[TRANSLATE] ${enStructure[key]}`;
      }
    }
  }

  return result;
}

// Validate before saving
function validateTranslations(langCode, translations, english) {
  let englishCount = 0;
  let totalStrings = 0;

  function countEnglishValues(obj, enObj, path = []) {
    for (const key in obj) {
      if (typeof obj[key] === "string" && typeof enObj?.[key] === "string") {
        totalStrings++;
        if (obj[key] === enObj[key]) {
          // Some keys are acceptable in English
          const acceptableKeys = ["appName", "url", "email", "github", "API", "SDK"];
          if (!acceptableKeys.some(ak => key.includes(ak))) {
            englishCount++;
          }
        }
      } else if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
        countEnglishValues(obj[key], enObj?.[key], [...path, key]);
      }
    }
  }

  countEnglishValues(translations, english);

  const englishPercentage = (englishCount / totalStrings) * 100;
  
  if (englishPercentage > 50) {
    console.error(`⚠️  WARNING: ${langCode} has ${englishCount}/${totalStrings} (${englishPercentage.toFixed(1)}%) English values!`);
    console.error("This might indicate a translation corruption. Please review carefully.");
    return false;
  }

  return true;
}

console.log("🔄 Starting safe structure sync...\n");

languageFiles.forEach((langFile) => {
  const langCode = langFile.replace(".json", "");
  console.log(`Processing ${langFile}...`);

  // Backup existing file
  const backupPath = `${backupDir}/${langCode}_${timestamp}.json`;
  fs.copyFileSync(langFile, backupPath);
  console.log(`  ✅ Backup created: ${backupPath}`);

  // Load existing translations
  const existing = JSON.parse(fs.readFileSync(langFile, "utf8"));
  
  // Merge with English structure, preserving translations
  const synced = deepMerge(en, existing);

  // Validate before saving
  const isValid = validateTranslations(langCode, synced, en);

  if (isValid) {
    fs.writeFileSync(langFile, JSON.stringify(synced, null, 2));
    console.log(`  ✅ Synced ${langFile} successfully\n`);
  } else {
    console.log(`  ❌ Skipped ${langFile} due to validation warnings\n`);
  }
});

console.log("✨ Sync complete! Check the files and review any [TRANSLATE] markers.");