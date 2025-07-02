#!/usr/bin/env tsx
/**
 * Test script to validate i18n imports are working correctly
 * This prevents future breakages by catching import issues early
 */

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REQUIRED_IMPORTS = [
  // Server-side imports that need .js extension
  { file: "src/middleware.ts", imports: [
    { from: "./i18n/config", expected: true, noExtension: true },
    { from: "@/auth", expected: true, noExtension: true },
    { from: "@/lib/auth-config", expected: true, noExtension: true }
  ]},
  { file: "src/auth.ts", imports: [
    { from: "@/lib/auth-config", expected: true, noExtension: true }
  ]},
  // Client-side imports that should NOT have .js extension
  { file: "src/app/[lang]/page.tsx", imports: [
    { from: "@/i18n/config", expected: true, noExtension: true },
    { from: "@/i18n/get-dictionary", expected: true, noExtension: true }
  ]}
];

async function checkImports() {
  console.log("🔍 Checking i18n imports...\n");
  
  let hasErrors = false;
  
  for (const fileConfig of REQUIRED_IMPORTS) {
    const filePath = path.join(__dirname, "..", fileConfig.file);
    
    try {
      const content = await fs.readFile(filePath, "utf-8");
      console.log(`📄 Checking ${fileConfig.file}:`);
      
      for (const importCheck of fileConfig.imports) {
        const hasJsExtension = importCheck.from.endsWith(".js");
        const baseImport = hasJsExtension 
          ? importCheck.from.slice(0, -3) 
          : importCheck.from;
        
        // Check both with and without .js extension
        const importWithJs = `from "${baseImport}.js"`;
        const importWithoutJs = `from "${baseImport}"`;
        
        const hasImportWithJs = content.includes(importWithJs);
        const hasImportWithoutJs = content.includes(importWithoutJs);
        
        if (importCheck.noExtension) {
          // Client-side imports should NOT have .js extension
          if (hasImportWithJs) {
            console.error(`  ❌ Import "${importCheck.from}" should NOT have .js extension`);
            hasErrors = true;
          } else if (hasImportWithoutJs) {
            console.log(`  ✅ Import "${baseImport}" correctly has no .js extension`);
          } else {
            console.error(`  ❌ Import "${baseImport}" not found`);
            hasErrors = true;
          }
        } else {
          // Server-side imports should have .js extension
          if (hasImportWithJs) {
            console.log(`  ✅ Import "${importCheck.from}" correctly has .js extension`);
          } else if (hasImportWithoutJs) {
            console.error(`  ❌ Import "${baseImport}" is missing .js extension`);
            hasErrors = true;
          } else {
            console.error(`  ❌ Import "${importCheck.from}" not found`);
            hasErrors = true;
          }
        }
      }
      
      console.log();
    } catch (error) {
      console.error(`❌ Error reading ${fileConfig.file}:`, error);
      hasErrors = true;
    }
  }
  
  // Additional check: Ensure i18n config exports are correct
  try {
    const configPath = path.join(__dirname, "..", "src/i18n/config.ts");
    const configContent = await fs.readFile(configPath, "utf-8");
    
    console.log("📄 Checking i18n config exports:");
    
    if (configContent.includes("export const locales")) {
      console.log("  ✅ 'locales' is exported");
    } else {
      console.error("  ❌ 'locales' export not found");
      hasErrors = true;
    }
    
    if (configContent.includes("export type Locale")) {
      console.log("  ✅ 'Locale' type is exported");
    } else {
      console.error("  ❌ 'Locale' type export not found");
      hasErrors = true;
    }
    
    console.log();
  } catch (error) {
    console.error("❌ Error checking i18n config:", error);
    hasErrors = true;
  }
  
  // Check if dictionary files exist
  console.log("📄 Checking dictionary files:");
  const locales = ["en", "de", "fr", "it", "ja", "ko", "uk", "hr", "zh"];
  
  for (const locale of locales) {
    const dictPath = path.join(__dirname, "..", "src/i18n/dictionaries", `${locale}.json`);
    try {
      await fs.access(dictPath);
      console.log(`  ✅ ${locale}.json exists`);
    } catch {
      console.error(`  ❌ ${locale}.json not found`);
      hasErrors = true;
    }
  }
  
  console.log("\n" + "=".repeat(50));
  
  if (hasErrors) {
    console.error("\n❌ Import validation failed! Fix the issues above.");
    process.exit(1);
  } else {
    console.log("\n✅ All imports are correctly configured!");
    process.exit(0);
  }
}

// Run the test
checkImports().catch((error) => {
  console.error("Failed to run import checks:", error);
  process.exit(1);
});