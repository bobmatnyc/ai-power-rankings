#!/usr/bin/env tsx

/**
 * Script to update Vercel DATABASE_URL to the correct primary database
 * Primary: ep-wispy-fog-ad8d4skz
 * Development: ep-bold-sunset-adneqlo6
 */

import { execSync } from "child_process";
import { existsSync, unlinkSync, writeFileSync } from "fs";

async function updateVercelDatabase() {
  console.log("🚀 Updating Vercel DATABASE_URL to correct primary database...\n");

  // The CORRECT primary database URL (ep-wispy-fog-ad8d4skz)
  // This is the production database with the actual data
  const CORRECT_PRIMARY_DATABASE_URL =
    "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-wispy-fog-ad8d4skz-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

  console.log("📍 Correct database endpoints:");
  console.log("   Primary (Production): ep-wispy-fog-ad8d4skz");
  console.log("   Development: ep-bold-sunset-adneqlo6");
  console.log("");

  try {
    // Remove the incorrect DATABASE_URL
    console.log("🗑️  Removing incorrect DATABASE_URL...");
    try {
      execSync("vercel env rm DATABASE_URL production -y", { stdio: "pipe" });
      console.log("✅ Removed existing DATABASE_URL");
    } catch {
      console.log("ℹ️  No existing DATABASE_URL to remove");
    }

    // Add the CORRECT DATABASE_URL
    console.log("\n📝 Adding CORRECT PRIMARY DATABASE_URL for production...");
    console.log("   Using: ep-wispy-fog-ad8d4skz (the actual primary database)");

    const tmpFile = "/tmp/vercel-correct-db-url.txt";
    writeFileSync(tmpFile, CORRECT_PRIMARY_DATABASE_URL);

    try {
      execSync(`cat ${tmpFile} | vercel env add DATABASE_URL production`, {
        stdio: ["pipe", "inherit", "inherit"],
      });
      console.log("✅ Added CORRECT DATABASE_URL for production");
    } finally {
      if (existsSync(tmpFile)) {
        unlinkSync(tmpFile);
      }
    }

    // Trigger a new deployment
    console.log("\n🔄 Triggering redeployment with CORRECT database...");
    console.log("This will redeploy with the primary database (ep-wispy-fog-ad8d4skz).\n");

    const redeployOutput = execSync("vercel --prod --yes", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "inherit"],
    });

    const urlMatch = redeployOutput.match(/https:\/\/[^\s]+/);
    const deploymentUrl = urlMatch ? urlMatch[0] : "deployment URL not found";

    console.log("\n✅ Deployment triggered successfully!");
    console.log(`📍 Deployment URL: ${deploymentUrl}`);
    console.log("\n⏳ Wait 1-2 minutes for the deployment to complete.");

    console.log("\n📊 Summary:");
    console.log("✅ DATABASE_URL now points to PRIMARY database:");
    console.log("   - Host: ep-wispy-fog-ad8d4skz-pooler.c-2.us-east-1.aws.neon.tech");
    console.log("   - This is the CORRECT production database");
    console.log("\n🎯 Once deployed, the admin panel will work at:");
    console.log("   https://aipowerranking.com/admin");
  } catch (error) {
    console.error("\n❌ Error:", error);
    console.log("\n📝 Please update manually in Vercel Dashboard:");
    console.log("DATABASE_URL should be:");
    console.log(CORRECT_PRIMARY_DATABASE_URL);
    process.exit(1);
  }
}

updateVercelDatabase().catch(console.error);
