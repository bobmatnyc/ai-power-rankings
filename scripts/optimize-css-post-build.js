#!/usr/bin/env node

/**
 * Post-Build CSS Optimization Script
 *
 * WHY: Next.js 15.3.3 has conflicts with PostCSS plugin loading for PurgeCSS.
 * This script post-processes the built CSS files to apply aggressive optimization.
 *
 * DESIGN DECISION: Run after Next.js build to avoid webpack plugin conflicts
 * while still achieving the target <20KB CSS bundle size.
 */

const fs = require("node:fs");
const path = require("node:path");
const { PurgeCSS } = require("purgecss");
const postcss = require("postcss");
const cssnano = require("cssnano");
const { glob } = require("glob");

const BUILD_DIR = ".next/static/css";
const SOURCE_DIRS = [
  "src/**/*.{js,jsx,ts,tsx}",
  "pages/**/*.{js,jsx,ts,tsx}",
  "components/**/*.{js,jsx,ts,tsx}",
  "app/**/*.{js,jsx,ts,tsx}",
];

// Ultra-minimal critical classes - only the most essential ones
const CRITICAL_CLASSES = [
  // Absolutely essential base elements
  "html",
  "body",
  "main",

  // Core layout (top 10 most used from analysis)
  "flex",
  "items-center",
  "justify-center",
  "grid",
  "container",
  "w-full",

  // Essential typography (top 5)
  "text-sm",
  "text-center",
  "font-bold",

  // Critical custom theme colors
  "text-muted-foreground",
  "text-primary",

  // Next.js essentials
  "__next",
];

async function optimizeCSS() {
  console.log("🎯 Starting aggressive CSS optimization...\n");

  // Find CSS files
  const cssFiles = await glob(`${BUILD_DIR}/*.css`);

  if (cssFiles.length === 0) {
    console.log("❌ No CSS files found in build directory");
    return;
  }

  console.log(`📂 Found ${cssFiles.length} CSS files:`);
  cssFiles.forEach((file) => {
    const size = fs.statSync(file).size;
    console.log(`   ${path.basename(file)} (${(size / 1024).toFixed(1)} KB)`);
  });

  for (const cssFile of cssFiles) {
    await optimizeSingleFile(cssFile);
  }

  // Report final sizes
  console.log("\n📊 Final optimization results:");
  let totalSize = 0;
  for (const cssFile of cssFiles) {
    const size = fs.statSync(cssFile).size;
    totalSize += size;
    const sizeKB = (size / 1024).toFixed(1);
    const status = size < 20480 ? "✅" : size < 51200 ? "⚠️" : "❌";
    console.log(`   ${status} ${path.basename(cssFile)}: ${sizeKB} KB`);
  }

  const totalKB = (totalSize / 1024).toFixed(1);
  const targetMet = totalSize < 20480;
  console.log(`\n🎯 Total CSS size: ${totalKB} KB (Target: <20 KB) ${targetMet ? "✅" : "❌"}`);

  if (targetMet) {
    console.log("🎉 CSS optimization target achieved!");
  } else {
    console.log("⚠️  Still above target - consider more aggressive purging");
  }
}

async function optimizeSingleFile(cssFile) {
  const originalSize = fs.statSync(cssFile).size;
  console.log(
    `\n🔧 Optimizing ${path.basename(cssFile)} (${(originalSize / 1024).toFixed(1)} KB)...`
  );

  try {
    // Read CSS content
    const css = fs.readFileSync(cssFile, "utf8");

    // Step 1: Apply PurgeCSS
    console.log("   1️⃣ Applying PurgeCSS...");
    const purgeResult = await new PurgeCSS().purge({
      content: SOURCE_DIRS,
      css: [{ raw: css, extension: "css" }],
      safelist: {
        standard: CRITICAL_CLASSES,
        deep: [
          // Only essential theme colors
          /^(text|bg)-(primary|muted)(-foreground)?$/,
          // Only essential responsive breakpoints
          /^md:(grid-cols-[2-5]|block|hidden)$/,
          // Essential prose classes only
          /^prose$/,
          /^prose-lg$/,
          /^prose-gray$/,
          /^prose-invert$/,
        ],
        greedy: [
          // Minimal greedy patterns
          /^prose-/,
        ],
      },
      defaultExtractor: (content) => {
        // Enhanced content extraction
        const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [];
        const innerMatches = content.match(/[^<>"'`\s.()]*[^<>"'`\s.():]/g) || [];
        return [...new Set([...broadMatches, ...innerMatches])];
      },
    });

    const purgedCSS = purgeResult[0].css;
    const purgedSize = Buffer.byteLength(purgedCSS, "utf8");
    const purgeReduction = (((originalSize - purgedSize) / originalSize) * 100).toFixed(1);
    console.log(`   📉 PurgeCSS: ${(purgedSize / 1024).toFixed(1)} KB (-${purgeReduction}%)`);

    // Step 2: Apply cssnano minification
    console.log("   2️⃣ Applying cssnano minification...");
    const minifyResult = await postcss([
      cssnano({
        preset: [
          "default",
          {
            discardComments: { removeAll: true },
            normalizeWhitespace: true,
            discardDuplicates: true,
            calc: true,
            colormin: true,
            // Safe optimizations only
            reduceIdents: false,
            zindex: false,
          },
        ],
      }),
    ]).process(purgedCSS, { from: cssFile });

    const finalCSS = minifyResult.css;
    const finalSize = Buffer.byteLength(finalCSS, "utf8");
    const totalReduction = (((originalSize - finalSize) / originalSize) * 100).toFixed(1);

    // Write optimized CSS back to file
    fs.writeFileSync(cssFile, finalCSS);

    console.log(
      `   ✅ Final: ${(finalSize / 1024).toFixed(1)} KB (-${totalReduction}% total reduction)`
    );
  } catch (error) {
    console.error(`   ❌ Error optimizing ${cssFile}:`, error.message);
  }
}

// Run optimization
optimizeCSS().catch(console.error);
