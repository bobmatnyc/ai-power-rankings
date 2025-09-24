#!/usr/bin/env tsx

/**
 * Script to update Vercel environment variables
 * Updates DATABASE_URL to use the correct production database
 */

import { execSync } from "child_process";

async function updateVercelEnv() {
  console.log("🚀 Updating Vercel environment variables...\n");

  // The correct production database URL (bold-sunset branch with 79 articles)
  const PRODUCTION_DATABASE_URL =
    "postgresql://neondb_owner:npg_3oQsxj0FcfKY@ep-bold-sunset-adneqlo6-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

  try {
    // First, check if we're logged into Vercel CLI
    console.log("📋 Checking Vercel CLI authentication...");
    try {
      execSync("vercel whoami", { stdio: "pipe" });
      console.log("✅ Authenticated with Vercel CLI\n");
    } catch {
      console.log("⚠️  Not authenticated. Running 'vercel login'...");
      execSync("vercel login", { stdio: "inherit" });
    }

    // List current environment variables to see what we have
    console.log("📊 Checking current DATABASE_URL in production...");
    try {
      const currentEnv = execSync("vercel env ls production", { encoding: "utf-8" });
      console.log("Current production environment variables:");
      const dbUrlLines = currentEnv.split("\n").filter((line) => line.includes("DATABASE_URL"));
      dbUrlLines.forEach((line) => console.log("  ", line));
    } catch (error) {
      console.log("⚠️  Could not list current environment variables");
    }

    // Remove existing DATABASE_URL if it exists
    console.log("\n🗑️  Removing existing DATABASE_URL...");
    try {
      execSync("vercel env rm DATABASE_URL production -y", { stdio: "pipe" });
      console.log("✅ Removed existing DATABASE_URL");
    } catch {
      console.log("ℹ️  No existing DATABASE_URL to remove (or removal failed)");
    }

    // Add the correct DATABASE_URL
    console.log("\n📝 Adding correct DATABASE_URL for production...");

    // Create a temporary file with the DATABASE_URL value
    const fs = require("fs");
    const tmpFile = "/tmp/vercel-db-url.txt";
    fs.writeFileSync(tmpFile, PRODUCTION_DATABASE_URL);

    try {
      // Add the environment variable for production
      execSync(`cat ${tmpFile} | vercel env add DATABASE_URL production`, {
        stdio: ["pipe", "inherit", "inherit"],
      });
      console.log("✅ Added DATABASE_URL for production");
    } finally {
      // Clean up temp file
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    }

    // Also ensure USE_DATABASE is set to true
    console.log("\n📝 Ensuring USE_DATABASE is set to true...");
    try {
      execSync("vercel env rm USE_DATABASE production -y", { stdio: "pipe" });
    } catch {
      // Ignore if it doesn't exist
    }
    execSync('echo "true" | vercel env add USE_DATABASE production', {
      stdio: ["pipe", "inherit", "inherit"],
    });
    console.log("✅ USE_DATABASE set to true");

    // Ensure NEXT_PUBLIC_USE_DATABASE is also set
    console.log("\n📝 Ensuring NEXT_PUBLIC_USE_DATABASE is set to true...");
    try {
      execSync("vercel env rm NEXT_PUBLIC_USE_DATABASE production -y", { stdio: "pipe" });
    } catch {
      // Ignore if it doesn't exist
    }
    execSync('echo "true" | vercel env add NEXT_PUBLIC_USE_DATABASE production', {
      stdio: ["pipe", "inherit", "inherit"],
    });
    console.log("✅ NEXT_PUBLIC_USE_DATABASE set to true");

    // Trigger a redeployment to apply the new environment variables
    console.log("\n🔄 Triggering redeployment with new environment variables...");
    console.log("This will redeploy the production site with the updated DATABASE_URL.\n");

    const redeployOutput = execSync("vercel --prod --yes", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "inherit"],
    });

    // Extract the deployment URL from the output
    const urlMatch = redeployOutput.match(/https:\/\/[^\s]+/);
    const deploymentUrl = urlMatch ? urlMatch[0] : "deployment URL not found";

    console.log("\n✅ Deployment triggered successfully!");
    console.log(`📍 Deployment URL: ${deploymentUrl}`);
    console.log("\n⏳ Wait 1-2 minutes for the deployment to complete.");
    console.log("Then check: https://aipowerranking.com/admin");

    // Show what was updated
    console.log("\n📊 Summary of changes:");
    console.log("DATABASE_URL updated to use:");
    console.log("  - Host: ep-bold-sunset-adneqlo6-pooler.c-2.us-east-1.aws.neon.tech");
    console.log("  - Branch: bold-sunset (production branch with 79 articles)");
    console.log("  - This is the correct production database");
  } catch (error) {
    console.error("\n❌ Error updating Vercel environment:", error);
    console.log("\n📝 Manual steps:");
    console.log("1. Go to: https://vercel.com/dashboard");
    console.log("2. Select your project: ai-power-ranking");
    console.log("3. Go to Settings → Environment Variables");
    console.log("4. Update DATABASE_URL to:");
    console.log(`   ${PRODUCTION_DATABASE_URL}`);
    console.log("5. Ensure USE_DATABASE = true");
    console.log("6. Ensure NEXT_PUBLIC_USE_DATABASE = true");
    console.log("7. Redeploy the project");
    process.exit(1);
  }
}

// Run the update
updateVercelEnv().catch(console.error);
