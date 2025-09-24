#!/usr/bin/env tsx

/**
 * Script to verify that the article loading issue has been fixed in production
 * Run this after deployment to check if the fix is working
 */

import * as readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function verifyArticleFix() {
  console.log("🔍 Article Loading Fix Verification\n");
  console.log("=".repeat(60));

  console.log("\n📋 MANUAL VERIFICATION STEPS:\n");

  console.log("1. Open your browser and go to: https://aipowerranking.com/admin");
  console.log("2. Sign in with your admin account if not already signed in");
  console.log("3. Look at the 'News Article Management' section");
  console.log("4. Open the browser DevTools (F12) and go to the Console tab");
  console.log("5. Refresh the page and watch for any errors");

  console.log(`\n${"=".repeat(60)}`);
  console.log("\n🔎 WHAT TO CHECK:\n");

  console.log("✅ SUCCESS INDICATORS:");
  console.log("  - You should see article stats (Total Articles, This Month, etc.)");
  console.log("  - The 'Edit / Delete Articles' tab should show your articles");
  console.log("  - No 'Failed to load articles' error message");
  console.log("  - Console shows: '[ArticleManagement] Articles received: [number]'");

  console.log("\n❌ IF IT'S STILL BROKEN:");
  console.log("  - You'll see 'Authentication required. Please sign in again.'");
  console.log("  - Or 'Failed to load articles'");
  console.log("  - Console shows 401 errors or authentication failures");

  console.log(`\n${"=".repeat(60)}`);
  console.log("\n📊 AUTOMATED CHECK:\n");

  const answer = await question("Do you have a Clerk session token to test with? (y/n): ");

  if (answer.toLowerCase() === "y") {
    const token = await question("Paste your __clerk_db_jwt cookie value: ");

    console.log("\nTesting API with your session...");

    try {
      const response = await fetch(
        "https://aipowerranking.com/api/admin/articles?includeStats=true",
        {
          headers: {
            Accept: "application/json",
            Cookie: `__clerk_db_jwt=${token}`,
          },
        }
      );

      console.log(`\nAPI Response Status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log("✅ SUCCESS! Articles loaded successfully");
        console.log(`  - Total articles: ${data.articles?.length || 0}`);
        console.log(`  - Has stats: ${!!data.stats}`);
        if (data.stats) {
          console.log(`  - Total in database: ${data.stats.totalArticles}`);
          console.log(`  - This month: ${data.stats.articlesThisMonth}`);
        }
      } else {
        const error = await response.json();
        console.log("❌ Failed to load articles");
        console.log(`  Error: ${error.error || "Unknown error"}`);
        console.log(`  Details: ${error.details || "No details"}`);
      }
    } catch (error) {
      console.log("❌ Request failed:", error instanceof Error ? error.message : String(error));
    }
  } else {
    console.log("\nTo get your session token:");
    console.log("1. Go to https://aipowerranking.com/admin");
    console.log("2. Open DevTools (F12) → Application tab → Cookies");
    console.log("3. Look for '__clerk_db_jwt' cookie");
    console.log("4. Copy its value and run this script again");
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("\n📝 TROUBLESHOOTING NOTES:\n");

  console.log("The fix addressed:");
  console.log("  1. Better error handling in the API route");
  console.log("  2. More informative error messages in the UI");
  console.log("  3. Proper authentication check for production");

  console.log("\nIf still not working, check:");
  console.log("  1. Clerk authentication is properly configured");
  console.log("  2. Database connection is active (Neon)");
  console.log("  3. Environment variables are set in Vercel");

  rl.close();
}

// Run verification
verifyArticleFix().catch(console.error);
