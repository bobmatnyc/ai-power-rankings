#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

/**
 * Clear Next.js cache directories
 */
function clearNextCache() {
  const cacheDir = path.join(process.cwd(), ".next");

  console.log("🧹 Clearing Next.js cache...");

  if (fs.existsSync(cacheDir)) {
    try {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      console.log("✅ Next.js cache cleared successfully");
    } catch (error) {
      console.error("❌ Failed to clear Next.js cache:", error.message);
      process.exit(1);
    }
  } else {
    console.log("ℹ️  No Next.js cache found");
  }
}

// Run the cache clearing
clearNextCache();
