#!/usr/bin/env node

/**
 * Post-Build CSS Optimization Script - AGGRESSIVE VERSION
 * Target: <20KB total CSS bundle size
 */

const fs = require("node:fs");
const path = require("node:path");
const { PurgeCSS } = require("purgecss");
const postcss = require("postcss");
const cssnano = require("cssnano");
const { glob } = require("glob");

const BUILD_DIR = ".next/static/css";
const SOURCE_DIRS = ["src/**/*.{js,jsx,ts,tsx}", "app/**/*.{js,jsx,ts,tsx}"];

// ULTRA-MINIMAL safelist - only absolutely critical classes
const CRITICAL_CLASSES = [
  // Next.js essentials
  "__next",
  "__next-route-announcer__",

  // Only the most essential that can't be statically analyzed
  "dark", // Dark mode toggle
];

async function optimizeCSS() {
  console.log("🎯 Starting AGGRESSIVE CSS optimization (target: <20KB)...\n");

  // Find CSS files
  const cssFiles = await glob(`${BUILD_DIR}/*.css`);

  if (cssFiles.length === 0) {
    console.log("❌ No CSS files found in build directory");
    return;
  }

  console.log(`📂 Found ${cssFiles.length} CSS files:`);
  let totalOriginalSize = 0;
  cssFiles.forEach((file) => {
    const size = fs.statSync(file).size;
    totalOriginalSize += size;
    console.log(`   ${path.basename(file)} (${(size / 1024).toFixed(1)} KB)`);
  });
  console.log(`   Total original: ${(totalOriginalSize / 1024).toFixed(1)} KB\n`);

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
    const status = size < 10240 ? "✅" : size < 20480 ? "🟡" : "❌";
    console.log(`   ${status} ${path.basename(cssFile)}: ${sizeKB} KB`);
  }

  const totalKB = (totalSize / 1024).toFixed(1);
  const reduction = (((totalOriginalSize - totalSize) / totalOriginalSize) * 100).toFixed(1);
  const targetMet = totalSize < 20480;

  console.log(`\n📉 Reduction: ${reduction}%`);
  console.log(`🎯 Total CSS size: ${totalKB} KB (Target: <20 KB) ${targetMet ? "✅" : "❌"}`);

  if (targetMet) {
    console.log("🎉 CSS optimization target achieved!");
  } else {
    console.log("⚠️  Consider removing Tailwind Typography plugin or further reducing components");
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

    // Step 1: AGGRESSIVE PurgeCSS
    console.log("   1️⃣ Applying AGGRESSIVE PurgeCSS...");
    const purgeResult = await new PurgeCSS().purge({
      content: SOURCE_DIRS,
      css: [{ raw: css, extension: "css" }],
      safelist: {
        standard: CRITICAL_CLASSES,
        deep: [
          // Only keep dynamic theme colors
          /^(text|bg|border)-(primary|secondary|accent|destructive|muted)(-foreground)?$/,
        ],
      },
      // More aggressive extraction
      defaultExtractor: (content) => {
        // Extract classes more precisely
        const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [];
        const innerMatches = content.match(/[^<>"'`\s.()]*[^<>"'`\s.():]/g) || [];
        // Filter out non-class matches
        const filtered = [...new Set([...broadMatches, ...innerMatches])].filter(
          (match) => !match.startsWith("/") && !match.includes("=") && match.length > 1
        );
        return filtered;
      },
      // Remove all unused keyframes
      keyframes: true,
      // Remove all unused font-face rules
      fontFace: true,
      // Remove unused CSS variables
      variables: true,
    });

    const purgedCSS = purgeResult[0].css;
    const purgedSize = Buffer.byteLength(purgedCSS, "utf8");
    const purgeReduction = (((originalSize - purgedSize) / originalSize) * 100).toFixed(1);
    console.log(`   📉 PurgeCSS: ${(purgedSize / 1024).toFixed(1)} KB (-${purgeReduction}%)`);

    // Step 2: MAXIMUM cssnano minification
    console.log("   2️⃣ Applying MAXIMUM cssnano minification...");
    const minifyResult = await postcss([
      cssnano({
        preset: [
          "default", // Use default preset with aggressive options
          {
            discardComments: { removeAll: true },
            normalizeWhitespace: true,
            discardDuplicates: true,
            discardEmpty: true,
            minifyFontValues: true,
            minifyGradients: true,
            minifyParams: true,
            minifySelectors: true,
            calc: { precision: 2 },
            colormin: true,
            convertValues: true,
            mergeLonghand: true,
            mergeRules: true,
            uniqueSelectors: true,
            // Aggressive optimizations
            reduceIdents: false, // Keep false for safety
            mergeIdents: false,
            autoprefixer: false, // Remove vendor prefixes for modern browsers
            discardUnused: true,
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
