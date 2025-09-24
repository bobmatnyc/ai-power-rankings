#!/usr/bin/env node
/**
 * Vercel build wrapper that selects the appropriate build script
 * based on the deployment environment
 */

const { execSync } = require("node:child_process");

const vercelEnv = process.env.VERCEL_ENV || "development";
const gitBranch = process.env.VERCEL_GIT_COMMIT_REF || "main";

console.log(`🔧 Vercel build wrapper - Environment: ${vercelEnv}, Branch: ${gitBranch}`);

// Use staging build for staging environment or staging branch
if (vercelEnv === "staging" || gitBranch === "staging") {
  console.log("📦 Using staging build script (database-free)...");
  execSync("node scripts/build-staging.js", { stdio: "inherit" });
} else {
  console.log("🚀 Using production build script (full features)...");
  execSync("node scripts/build-production.js", { stdio: "inherit" });
}

console.log("✅ Vercel build wrapper completed successfully!");
