#!/usr/bin/env node

/**
 * Deployment script with automatic cache clearing
 *
 * WHY: This script ensures fresh cache on every deployment by:
 * - Clearing Next.js build cache before building
 * - Purging Vercel CDN cache after deployment
 * - Regenerating static cache files
 *
 * DESIGN DECISION: Combined cache clearing with deployment to ensure
 * data consistency and prevent stale cache issues in production
 */

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const CACHE_DIRS = [".next", "node_modules/.cache"];
const VERCEL_PROJECT_ID = process.env["VERCEL_PROJECT_ID"];
const VERCEL_TOKEN = process.env["VERCEL_TOKEN"];

/**
 * Clear local build caches
 *
 * WHY: Ensures clean build environment to prevent inconsistent builds
 * caused by stale cache data
 */
function clearLocalCaches() {
  console.log("🧹 Clearing local caches...");

  CACHE_DIRS.forEach((dir) => {
    const cachePath = path.join(process.cwd(), dir);
    if (fs.existsSync(cachePath)) {
      try {
        fs.rmSync(cachePath, { recursive: true, force: true });
        console.log(`✅ Cleared: ${dir}`);
      } catch (error) {
        console.warn(`⚠️  Failed to clear ${dir}:`, error.message);
      }
    }
  });
}

/**
 * Regenerate static cache files
 *
 * WHY: Ensures latest data is included in the build
 */
function regenerateCacheFiles() {
  console.log("📦 Regenerating cache files...");

  try {
    execSync("npm run cache:generate", { stdio: "inherit" });
    console.log("✅ Cache files regenerated");
  } catch (error) {
    console.error("❌ Failed to regenerate cache files:", error.message);
    process.exit(1);
  }
}

/**
 * Run pre-deployment checks
 *
 * WHY: Validates code quality before deployment to prevent
 * production issues
 */
function runPreDeployChecks() {
  console.log("🔍 Running pre-deployment checks...");

  try {
    execSync("npm run pre-deploy", { stdio: "inherit" });
    console.log("✅ Pre-deployment checks passed");
  } catch (_error) {
    console.error("❌ Pre-deployment checks failed");
    process.exit(1);
  }
}

/**
 * Deploy to Vercel
 *
 * @param {boolean} production - Deploy to production or preview
 */
function deployToVercel(production = false) {
  const env = production ? "production" : "preview";
  console.log(`🚀 Deploying to ${env}...`);

  try {
    const command = production ? "vercel --prod" : "vercel";
    const output = execSync(command, { encoding: "utf8" });
    console.log("✅ Deployment successful");

    // Extract deployment URL from output
    const urlMatch = output.match(/https:\/\/[^\s]+/);
    return urlMatch ? urlMatch[0] : null;
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    process.exit(1);
  }
}

/**
 * Purge Vercel CDN cache
 *
 * WHY: Forces CDN to fetch fresh data after deployment
 *
 * @param {string} deploymentUrl - The deployment URL
 */
async function purgeVercelCache(_deploymentUrl) {
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    console.warn("⚠️  Vercel credentials not found, skipping CDN purge");
    return;
  }

  console.log("🔄 Purging Vercel CDN cache...");

  try {
    // Purge specific cache tags
    const cacheTags = ["rankings-data", "tools-data", "news-data"];

    for (const tag of cacheTags) {
      const response = await fetch(
        `https://api.vercel.com/v1/projects/${VERCEL_PROJECT_ID}/purge?tags=${tag}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${VERCEL_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        console.log(`✅ Purged cache tag: ${tag}`);
      } else {
        console.warn(`⚠️  Failed to purge cache tag: ${tag}`);
      }
    }

    // Also purge by URL patterns
    const urlPatterns = ["/api/rankings", "/api/tools", "/api/news", "/data/cache/*"];

    for (const pattern of urlPatterns) {
      const response = await fetch(
        `https://api.vercel.com/v1/projects/${VERCEL_PROJECT_ID}/purge?url=${encodeURIComponent(pattern)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${VERCEL_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        console.log(`✅ Purged URL pattern: ${pattern}`);
      }
    }
  } catch (error) {
    console.error("❌ Failed to purge CDN cache:", error.message);
  }
}

/**
 * Verify deployment health
 *
 * @param {string} deploymentUrl - The deployment URL
 */
async function verifyDeployment(deploymentUrl) {
  if (!deploymentUrl) return;

  console.log("🏥 Verifying deployment health...");

  const endpoints = ["/api/health", "/api/rankings", "/api/tools", "/api/cache/stats"];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${deploymentUrl}${endpoint}`);
      if (response.ok) {
        console.log(`✅ ${endpoint} - OK`);
      } else {
        console.warn(`⚠️  ${endpoint} - Status: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ ${endpoint} - Failed:`, error.message);
    }
  }
}

/**
 * Main deployment process
 */
async function main() {
  const args = process.argv.slice(2);
  const isProduction = args.includes("--prod") || args.includes("--production");

  console.log("🚀 AI Power Rankings Deployment Script");
  console.log("=====================================");
  console.log(`Environment: ${isProduction ? "PRODUCTION" : "PREVIEW"}`);
  console.log("");

  try {
    // Step 1: Clear caches
    clearLocalCaches();

    // Step 2: Regenerate cache files
    regenerateCacheFiles();

    // Step 3: Run pre-deployment checks
    runPreDeployChecks();

    // Step 4: Deploy to Vercel
    const deploymentUrl = deployToVercel(isProduction);

    // Step 5: Purge CDN cache (async)
    if (deploymentUrl) {
      await purgeVercelCache(deploymentUrl);

      // Step 6: Verify deployment
      await verifyDeployment(deploymentUrl);
    }

    console.log("");
    console.log("✅ Deployment completed successfully!");
    if (deploymentUrl) {
      console.log(`🌐 Deployment URL: ${deploymentUrl}`);
    }
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { clearLocalCaches, regenerateCacheFiles, purgeVercelCache };
