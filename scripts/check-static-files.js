#!/usr/bin/env node
/**
 * Check and ensure required static files exist for Vercel deployment
 */

const fs = require("node:fs");
const path = require("node:path");

const requiredFiles = [
  "src/data/cache/rankings.json",
  "src/data/cache/rankings-static.json",
  "src/data/cache/tools.json",
  "src/data/cache/news.json",
  "public/data/rankings.json",
];

console.log("🔍 Checking required static files for deployment...\n");

let allFilesExist = true;

for (const filePath of requiredFiles) {
  const fullPath = path.join(process.cwd(), filePath);

  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`✅ ${filePath} (${sizeKB} KB)`);
  } else {
    console.log(`❌ ${filePath} - MISSING!`);
    allFilesExist = false;
  }
}

if (allFilesExist) {
  console.log("\n🎉 All required static files are present!");
  console.log("📦 Vercel deployment can proceed with committed data files.");
} else {
  console.error("\n💥 Some required files are missing!");
  console.error("🚨 Vercel deployment may fail without these files.");
  process.exit(1);
}
