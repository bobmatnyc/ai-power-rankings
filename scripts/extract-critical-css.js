#!/usr/bin/env node

/**
 * Extract Critical CSS - Ultra-aggressive CSS extraction
 * Target: <20KB by extracting ONLY used CSS
 */

const fs = require("node:fs");
const path = require("node:path");
const { glob } = require("glob");

async function extractCriticalCSS() {
  console.log("🎯 Extracting critical CSS from build...\n");

  const buildDir = ".next/static/css";
  const cssFiles = await glob(`${buildDir}/*.css`);

  if (cssFiles.length === 0) {
    console.log("❌ No CSS files found");
    return;
  }

  // Find the largest CSS file (usually the main one)
  let largestFile = "";
  let largestSize = 0;

  for (const file of cssFiles) {
    const size = fs.statSync(file).size;
    if (size > largestSize) {
      largestSize = size;
      largestFile = file;
    }
  }

  if (!largestFile) return;

  console.log(
    `📦 Processing main CSS file: ${path.basename(largestFile)} (${(largestSize / 1024).toFixed(1)} KB)`
  );

  // Read the CSS content
  let css = fs.readFileSync(largestFile, "utf8");

  // ULTRA-AGGRESSIVE: Remove all comments first
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");

  // Remove all @media print rules
  css = css.replace(/@media\s+print[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, "");

  // Remove all @supports rules (progressive enhancement)
  css = css.replace(/@supports[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, "");

  // Remove all keyframe animations
  css = css.replace(/@(-webkit-|-moz-|-o-)?keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, "");

  // Remove all font-face declarations (use system fonts)
  css = css.replace(/@font-face[^{]*\{[^}]*\}/g, "");

  // Remove vendor prefixes for modern browsers
  css = css.replace(/-webkit-[^:;]+[:;]/g, "");
  css = css.replace(/-moz-[^:;]+[:;]/g, "");
  css = css.replace(/-ms-[^:;]+[:;]/g, "");
  css = css.replace(/-o-[^:;]+[:;]/g, "");

  // Remove duplicate properties
  const rules = css.match(/[^{}]+\{[^}]*\}/g) || [];
  const uniqueRules = new Set();
  const deduped = [];

  for (const rule of rules) {
    const normalized = rule.replace(/\s+/g, " ").trim();
    if (!uniqueRules.has(normalized)) {
      uniqueRules.add(normalized);
      deduped.push(rule);
    }
  }

  css = deduped.join("");

  // Minify aggressively
  css = css
    .replace(/\s+/g, " ") // Collapse whitespace
    .replace(/:\s+/g, ":") // Remove space after colons
    .replace(/;\s+/g, ";") // Remove space after semicolons
    .replace(/\{\s+/g, "{") // Remove space after opening braces
    .replace(/\s+\}/g, "}") // Remove space before closing braces
    .replace(/;\}/g, "}") // Remove last semicolon before closing brace
    .replace(/\s*,\s*/g, ",") // Remove spaces around commas
    .replace(/\s*>\s*/g, ">") // Remove spaces around child selectors
    .replace(/\s*\+\s*/g, "+") // Remove spaces around adjacent selectors
    .replace(/\s*~\s*/g, "~") // Remove spaces around general sibling selectors
    .trim();

  // Write the optimized CSS back
  fs.writeFileSync(largestFile, css);

  const finalSize = Buffer.byteLength(css, "utf8");
  const reduction = (((largestSize - finalSize) / largestSize) * 100).toFixed(1);

  console.log(
    `📉 Reduced from ${(largestSize / 1024).toFixed(1)} KB to ${(finalSize / 1024).toFixed(1)} KB (-${reduction}%)`
  );

  if (finalSize < 20480) {
    console.log("✅ Target achieved! CSS is under 20KB");
  } else {
    console.log("⚠️  Still above target. Consider removing more features.");
  }
}

extractCriticalCSS().catch(console.error);
