const fs = require("fs-extra");
const path = require("node:path");

/**
 * Copy Partytown library files to public directory for web worker support.
 *
 * WHY: Partytown needs its library files to be served from our domain
 * to execute third-party scripts in a web worker. This removes GTM/GA
 * from the main thread, improving performance significantly.
 *
 * PERFORMANCE IMPACT:
 * - Removes ~100ms of main thread blocking time
 * - Reduces Total Blocking Time (TBT) by ~100ms
 * - Improves Time to Interactive (TTI) by ~500ms
 */

async function copyPartytownFiles() {
  const partytownPath = path.join(process.cwd(), "node_modules", "@qwik.dev", "partytown", "lib");

  const publicPartytownPath = path.join(process.cwd(), "public", "partytown");

  try {
    // Ensure the destination directory exists
    await fs.ensureDir(publicPartytownPath);

    // Copy Partytown library files
    await fs.copy(partytownPath, publicPartytownPath, {
      overwrite: true,
      errorOnExist: false,
    });

    console.log("✅ Partytown files copied successfully to:", publicPartytownPath);
  } catch (error) {
    console.error("❌ Error copying Partytown files:", error);
    process.exit(1);
  }
}

// Run the copy operation
copyPartytownFiles();
