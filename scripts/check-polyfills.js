#!/usr/bin/env node

/**
 * Script to check if polyfills are included in the production bundle.
 *
 * WHY: We want to ensure that unnecessary polyfills are not included in the
 * production bundle since we're targeting modern browsers that have native
 * support for ES6+ features.
 *
 * USAGE: Run after building: pnpm build && node scripts/check-polyfills.js
 */

const fs = require("node:fs");
const path = require("node:path");
const glob = require("glob");

console.log("Checking for polyfills in production bundle...\n");

const buildDir = path.join(__dirname, "..", ".next");
const polyfillPatterns = [
  "core-js",
  "regenerator-runtime",
  "whatwg-fetch",
  "es6-promise",
  "es5-shim",
  "es6-shim",
  "babel-polyfill",
];

if (!fs.existsSync(buildDir)) {
  console.error('Build directory not found. Please run "pnpm build" first.');
  process.exit(1);
}

// Check JavaScript files in the build output
const jsFiles = glob.sync(path.join(buildDir, "static", "chunks", "**/*.js"));

let foundPolyfills = false;
const results = {};

for (const file of jsFiles) {
  const content = fs.readFileSync(file, "utf8");
  const fileName = path.relative(buildDir, file);

  for (const pattern of polyfillPatterns) {
    if (content.includes(pattern)) {
      if (!results[pattern]) {
        results[pattern] = [];
      }
      results[pattern].push(fileName);
      foundPolyfills = true;
    }
  }
}

if (foundPolyfills) {
  console.log("❌ Found polyfills in the bundle:\n");
  for (const [polyfill, files] of Object.entries(results)) {
    console.log(`  ${polyfill}:`);
    files.forEach((file) => console.log(`    - ${file}`));
  }
  console.log("\nConsider updating the webpack configuration to exclude these polyfills.");
} else {
  console.log("✅ No polyfills found in the production bundle!");
  console.log("The bundle is optimized for modern browsers.");
}

// Also check bundle size
const totalSize = jsFiles.reduce((sum, file) => {
  return sum + fs.statSync(file).size;
}, 0);

console.log(`\nTotal JS bundle size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
