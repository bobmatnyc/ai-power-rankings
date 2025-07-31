#!/usr/bin/env node

/**
 * Script to test CSS optimization effectiveness
 *
 * WHY: This script helps verify that our CSS optimization strategies are working
 * by building the project and analyzing the resulting CSS bundle size.
 *
 * DESIGN DECISION: We use a separate script instead of modifying the build
 * process because we want to test optimization without affecting normal builds.
 */

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

console.log("🚀 Testing CSS optimization...\n");

// Clean previous build
console.log("1. Cleaning previous build...");
execSync("rm -rf .next", { stdio: "inherit" });

// Build in production mode
console.log("\n2. Building in production mode...");
try {
  execSync("NODE_ENV=production npm run build", { stdio: "inherit" });
} catch (error) {
  console.error("Build failed:", error.message);
  process.exit(1);
}

// Find and analyze CSS files
console.log("\n3. Analyzing CSS bundle sizes...");
const buildDir = path.join(process.cwd(), ".next");
const cssFiles = [];

function findCSSFiles(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !file.startsWith("cache")) {
      findCSSFiles(filePath);
    } else if (file.endsWith(".css")) {
      const size = stat.size;
      cssFiles.push({
        path: filePath.replace(buildDir, ""),
        size: size,
        sizeKB: (size / 1024).toFixed(2),
      });
    }
  }
}

if (fs.existsSync(path.join(buildDir, "static/css"))) {
  findCSSFiles(path.join(buildDir, "static/css"));
}

console.log("\n📊 CSS Bundle Analysis:");
console.log("=======================");

let totalSize = 0;
cssFiles.forEach((file) => {
  console.log(`📄 ${file.path}`);
  console.log(`   Size: ${file.sizeKB} KB`);
  totalSize += file.size;
});

console.log("\n📈 Summary:");
console.log(`Total CSS files: ${cssFiles.length}`);
console.log(`Total CSS size: ${(totalSize / 1024).toFixed(2)} KB`);

// Check if optimization is working
if (totalSize > 20 * 1024) {
  // More than 20KB
  console.log("\n⚠️  Warning: CSS bundle is larger than expected!");
  console.log("   Target: < 20 KB");
  console.log("   Actual:", (totalSize / 1024).toFixed(2), "KB");
  console.log("\n   Optimization strategies may need adjustment.");
} else {
  console.log("\n✅ CSS optimization is working effectively!");
  console.log("   Bundle size is within target range.");
}

console.log("\n💡 Tips for further optimization:");
console.log("   - Review PurgeCSS safelist patterns");
console.log("   - Check for unused Tailwind utilities");
console.log("   - Consider splitting CSS by route");
console.log("   - Enable CSS code splitting in Next.js");
