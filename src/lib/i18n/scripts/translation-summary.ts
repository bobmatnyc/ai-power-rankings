#!/usr/bin/env node

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const DICTIONARIES_PATH = join(__dirname, "../../../i18n/dictionaries");
const LANGUAGES = ["de", "fr", "hr", "it", "jp", "ko", "uk", "zh"];
const TRANSLATE_PREFIX = "[TRANSLATE] ";

interface TranslationObject {
  [key: string]: string | TranslationObject;
}

function findUntranslatedKeys(obj: TranslationObject, path: string = ""): string[] {
  const untranslated: string[] = [];

  for (const key in obj) {
    const currentPath = path ? `${path}.${key}` : key;

    if (typeof obj[key] === "object" && obj[key] !== null) {
      untranslated.push(...findUntranslatedKeys(obj[key] as TranslationObject, currentPath));
    } else if (typeof obj[key] === "string" && obj[key].startsWith(TRANSLATE_PREFIX)) {
      untranslated.push(currentPath);
    }
  }

  return untranslated;
}

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

console.log("📊 Translation Summary Report");
console.log("============================\n");

// Get English reference count
const enPath = join(DICTIONARIES_PATH, "en.json");
const enContent = readFileSync(enPath, "utf8");
const enTranslations = JSON.parse(enContent);
const totalKeys = countKeys(enTranslations);

console.log(`Total translation keys: ${totalKeys}\n`);

const summaryData: {
  lang: string;
  translated: number;
  percentage: number;
  untranslated: string[];
}[] = [];

for (const lang of LANGUAGES) {
  const langPath = join(DICTIONARIES_PATH, `${lang}.json`);

  if (existsSync(langPath)) {
    try {
      const langContent = readFileSync(langPath, "utf8");
      const langTranslations = JSON.parse(langContent);
      const untranslatedKeys = findUntranslatedKeys(langTranslations);
      const translatedCount = totalKeys - untranslatedKeys.length;
      const percentage = Math.round((translatedCount / totalKeys) * 100);

      summaryData.push({
        lang: lang.toUpperCase(),
        translated: translatedCount,
        percentage,
        untranslated: untranslatedKeys,
      });
    } catch (error) {
      console.error(`Error reading ${lang}:`, error);
    }
  }
}

// Sort by percentage (highest first)
summaryData.sort((a, b) => b.percentage - a.percentage);

// Display summary
console.log("Language | Progress | Status");
console.log("---------|----------|-------");
summaryData.forEach(({ lang, translated, percentage }) => {
  const progressBar =
    "█".repeat(Math.floor(percentage / 10)) + "░".repeat(10 - Math.floor(percentage / 10));
  console.log(`${lang.padEnd(8)} | ${progressBar} | ${translated}/${totalKeys} (${percentage}%)`);
});

console.log("\n📝 Sample of untranslated keys (first 5 per language):");
console.log("================================================\n");

summaryData.forEach(({ lang, untranslated }) => {
  if (untranslated.length > 0) {
    console.log(`${lang}:`);
    untranslated.slice(0, 5).forEach((key) => {
      console.log(`  - ${key}`);
    });
    if (untranslated.length > 5) {
      console.log(`  ... and ${untranslated.length - 5} more\n`);
    } else {
      console.log("");
    }
  }
});

console.log("💡 Use the sync-translations.ts script to keep translations in sync");
console.log('🔍 Search for "[TRANSLATE] " in language files to find untranslated content');
