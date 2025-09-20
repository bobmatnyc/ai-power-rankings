#!/usr/bin/env tsx

/**
 * Test script to verify i18n imports in middleware.ts
 * This ensures that middleware doesn't accidentally import heavy i18n dictionaries
 */

import * as fs from "fs";
import * as path from "path";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Please provide a file path to test");
  process.exit(1);
}

const fileContent = fs.readFileSync(filePath, "utf-8");

// Check for problematic imports
const problematicPatterns = [
  /import.*getDictionary/,
  /from\s+["']@\/i18n\/dictionaries/,
  /require\(.*dictionaries.*\)/,
];

let hasProblematicImports = false;
const issues: string[] = [];

for (const pattern of problematicPatterns) {
  if (pattern.test(fileContent)) {
    hasProblematicImports = true;
    const match = fileContent.match(pattern);
    if (match) {
      issues.push(`Found problematic import: ${match[0]}`);
    }
  }
}

if (hasProblematicImports) {
  console.error("❌ Middleware contains problematic i18n imports:");
  for (const issue of issues) {
    console.error(`   - ${issue}`);
  }
  console.error("\n⚠️  Middleware should not import heavy i18n dictionaries.");
  console.error("   This causes performance issues and build problems.");
  process.exit(1);
}

console.log("✅ Middleware i18n imports are valid");
process.exit(0);
