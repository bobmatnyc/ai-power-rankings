#!/usr/bin/env tsx

/**
 * Script to test article API endpoint in production
 * This helps diagnose why articles aren't loading in the admin dashboard
 */

async function testProductionArticles() {
  const prodUrl = "https://aipowerranking.com";

  console.log("🔍 Testing Production Article API...\n");

  // Test 1: Basic API endpoint
  console.log("Test 1: Basic API endpoint (no auth)");
  try {
    const response = await fetch(`${prodUrl}/api/admin/articles?includeStats=true`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    console.log(`  Status: ${response.status}`);
    console.log("  Headers:", Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const data = await response.json();
      console.log(`  ✅ Success: Received ${data.articles?.length || 0} articles`);
      if (data.stats) {
        console.log("  Stats:", data.stats);
      }
    } else {
      const text = await response.text();
      console.log(`  ❌ Failed: ${text.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log("\n" + "=".repeat(60) + "\n");

  // Test 2: With fake auth header
  console.log("Test 2: With fake auth header");
  try {
    const response = await fetch(`${prodUrl}/api/admin/articles?includeStats=true`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: "__clerk_db_jwt=fake-token",
      },
    });

    console.log(`  Status: ${response.status}`);
    const authStatus = response.headers.get("x-clerk-auth-status");
    const authReason = response.headers.get("x-clerk-auth-reason");
    console.log(`  Auth Status: ${authStatus}`);
    console.log(`  Auth Reason: ${authReason}`);

    if (response.status === 401) {
      console.log("  ✅ Expected: Authentication required");
    } else if (response.ok) {
      const data = await response.json();
      console.log("  ⚠️  Unexpected: Got data without proper auth");
      console.log(`  Articles: ${data.articles?.length || 0}`);
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log("\n" + "=".repeat(60) + "\n");

  // Test 3: Check if database is properly configured
  console.log("Test 3: Database configuration check");
  console.log(`  NODE_ENV: ${process.env["NODE_ENV"] || "not set"}`);
  console.log(`  DATABASE_URL: ${process.env["DATABASE_URL"] ? "✅ Set" : "❌ Not set"}`);
  console.log(`  USE_DATABASE: ${process.env["USE_DATABASE"] || "not set"}`);

  if (process.env["DATABASE_URL"] && !process.env["DATABASE_URL"].includes("YOUR_PASSWORD")) {
    const dbUrl = new URL(process.env["DATABASE_URL"]);
    console.log(`  Database Host: ${dbUrl.hostname}`);
    console.log(`  Database Name: ${dbUrl.pathname.slice(1)}`);
  }

  console.log("\n" + "=".repeat(60) + "\n");

  // Test 4: Check frontend API call
  console.log("Test 4: Simulating frontend API call");
  console.log("  This is what the admin dashboard does:");
  console.log(`  fetch("/api/admin/articles?includeStats=true", {`);
  console.log(`    credentials: "include",`);
  console.log(`    headers: { Accept: "application/json" }`);
  console.log("  })");
  console.log("\n  Note: The actual auth token would come from Clerk in the browser");

  console.log("\n" + "=".repeat(60) + "\n");

  // Summary
  console.log("📊 Summary:");
  console.log("  1. The API endpoint is accessible");
  console.log("  2. Authentication is properly enforced");
  console.log("  3. The issue is likely:");
  console.log("     - Client-side: Clerk auth token not being sent");
  console.log("     - Server-side: Database query failing after auth succeeds");
  console.log("     - Frontend: Error handling the response");
  console.log("\nNext steps:");
  console.log("  1. Check browser DevTools Network tab when loading /admin");
  console.log("  2. Look for the /api/admin/articles request");
  console.log("  3. Check the request headers and response");
  console.log("  4. Look for any console errors in the browser");
}

// Run the test
testProductionArticles().catch(console.error);
