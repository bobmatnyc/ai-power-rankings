#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

// List of files with unused withAuth imports
const filesToFix = [
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/check-orphaned-metrics/route.ts",
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/create-user/route.ts",
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/fix-orphaned-data/route.ts",
  "/Users/masa/Projects/managed/ai-power-ranking/src/app/api/admin/fix-orphaned-metrics/route.ts",
];

filesToFix.forEach((filePath) => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, "utf8");

    // Remove the unused import line
    content = content.replace(
      /import\s+{\s*withAuth\s*}\s+from\s+["']@\/lib\/clerk-auth["'];\s*\n/g,
      ""
    );

    fs.writeFileSync(filePath, content, "utf8");
    console.log(`Fixed: ${path.basename(filePath)}`);
  } else {
    console.log(`File not found: ${filePath}`);
  }
});

console.log("Done!");
