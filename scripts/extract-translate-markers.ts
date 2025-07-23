#!/usr/bin/env tsx

import * as fs from "node:fs";
import * as path from "node:path";

interface TranslationNeeded {
  key: string;
  englishValue: string;
  currentValue: string;
}

function extractTranslateMarkers(obj: Record<string, unknown>, prefix = ""): TranslationNeeded[] {
  const results: TranslationNeeded[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string" && value.startsWith("[TRANSLATE]")) {
      results.push({
        key: fullKey,
        englishValue: value.replace("[TRANSLATE] ", ""),
        currentValue: value,
      });
    } else if (typeof value === "object" && value !== null) {
      results.push(...extractTranslateMarkers(value, fullKey));
    }
  }

  return results;
}

// Process each language
const languages = ["de", "fr", "hr", "it", "ja", "ko", "uk", "zh"];
const report: Record<string, TranslationNeeded[]> = {};

for (const lang of languages) {
  const langPath = path.join(process.cwd(), `src/i18n/dictionaries/${lang}.json`);
  const langDict = JSON.parse(fs.readFileSync(langPath, "utf-8"));

  const markers = extractTranslateMarkers(langDict);
  if (markers.length > 0) {
    report[lang] = markers;
  }
}

// Save detailed report
const reportPath = path.join(process.cwd(), "scripts/translate-markers-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

// Create summary report
let summaryMd = "# Translation Markers Report\n\n";
summaryMd += `Generated on: ${new Date().toLocaleString()}\n\n`;
summaryMd += "## Summary\n\n";
summaryMd += "| Language | Markers to Translate |\n";
summaryMd += "|----------|--------------------|\n";

for (const [lang, markers] of Object.entries(report)) {
  summaryMd += `| ${lang} | ${markers.length} |\n`;
}

summaryMd += "\n## Sample Keys Needing Translation\n\n";

// Show first 5 keys for each language
for (const [lang, markers] of Object.entries(report)) {
  summaryMd += `### ${lang.toUpperCase()}\n\n`;
  const sample = markers.slice(0, 5);
  for (const marker of sample) {
    summaryMd += `- **${marker.key}**: "${marker.englishValue}"\n`;
  }
  if (markers.length > 5) {
    summaryMd += `- ... and ${markers.length - 5} more\n`;
  }
  summaryMd += "\n";
}

const summaryPath = path.join(process.cwd(), "scripts/translate-markers-summary.md");
fs.writeFileSync(summaryPath, summaryMd);

console.log("Translation markers report generated:");
console.log(`- Detailed JSON: ${reportPath}`);
console.log(`- Summary MD: ${summaryPath}`);
console.log("\nMarkers by language:");
for (const [lang, markers] of Object.entries(report)) {
  console.log(`  ${lang}: ${markers.length} markers`);
}
