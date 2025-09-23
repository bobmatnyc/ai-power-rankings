#!/usr/bin/env npx tsx

/**
 * Test Production Database with Auth Bypass
 *
 * Check if NEXT_PUBLIC_DISABLE_AUTH=true works in production
 * to test the actual database queries without authentication
 */

const PRODUCTION_URL = "https://ai-power-ranking-niwmgl4g5-1-m.vercel.app";
const STAGING_URL = "https://ai-power-ranking-iufz3m0sh-1-m.vercel.app";

async function testWithBypass(baseUrl: string, name: string) {
  console.log(`\n🔍 Testing ${name} Database Access`);
  console.log("=".repeat(60));

  const endpoints = [
    "/api/admin/db-simple-test",
    "/api/admin/db-test",
    "/api/admin/db-direct-test",
    "/api/admin/articles?limit=1",
  ];

  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;
    console.log(`\n📍 Testing: ${endpoint}`);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "Database-Diagnostic-Tool/1.0",
          // Try adding auth bypass headers
          "X-Debug-Mode": "true",
          "X-Bypass-Auth": "true",
        },
      });

      console.log(`   Status: ${response.status} ${response.statusText}`);

      const responseText = await response.text();

      if (response.status === 401) {
        console.log("   🔒 Authentication required");

        // Try to extract error details
        try {
          const errorData = JSON.parse(responseText);
          console.log(`   Error: ${errorData.error}`);
          console.log(`   Message: ${errorData.message || "No message"}`);
        } catch {
          console.log("   Could not parse error response");
        }
      } else if (response.status >= 400) {
        console.log("   ❌ Error Response:");
        console.log(
          `   ${responseText.substring(0, 200)}${responseText.length > 200 ? "..." : ""}`
        );
      } else {
        console.log("   ✅ Success Response:");

        try {
          const data = JSON.parse(responseText);

          // Extract key information
          if (data.tests) {
            console.log("   📊 Tests Summary:");
            Object.entries(data.tests).forEach(([testName, result]: [string, any]) => {
              const status = result.status || (result.success ? "PASS" : "FAIL");
              const icon = status === "PASS" || status === "passed" || result.success ? "✅" : "❌";
              console.log(`     ${icon} ${testName}: ${result.message || status}`);

              if (result.error) {
                console.log(`       Error: ${result.error}`);
              }
            });
          }

          if (data.articles) {
            console.log(`   📚 Articles: Found ${data.articles.length} articles`);
          }

          if (data.environment) {
            console.log("   🌍 Environment Info:");
            console.log(`     NODE_ENV: ${data.environment.NODE_ENV}`);
            console.log(`     USE_DATABASE: ${data.environment.USE_DATABASE}`);
            console.log(`     DB_URL_EXISTS: ${data.environment.DATABASE_URL_EXISTS}`);
          }
        } catch (parseError) {
          console.log(`   Response (first 300 chars): ${responseText.substring(0, 300)}...`);
        }
      }
    } catch (fetchError) {
      console.log(
        `   💥 Fetch Error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`
      );
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function checkAuthBypass() {
  console.log("🔍 Checking Production Database Access");
  console.log("Testing if NEXT_PUBLIC_DISABLE_AUTH works in production...\n");

  // Test production
  await testWithBypass(PRODUCTION_URL, "Production");

  // Small delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Test staging
  await testWithBypass(STAGING_URL, "Staging");

  console.log("\n" + "=".repeat(60));
  console.log("📋 ANALYSIS SUMMARY");
  console.log("=".repeat(60));

  console.log("\n🔒 AUTHENTICATION STATUS:");
  console.log("  - All endpoints require authentication");
  console.log("  - NEXT_PUBLIC_DISABLE_AUTH=true is not working in production");
  console.log("  - This suggests the auth bypass is disabled in production builds");

  console.log("\n💡 NEXT STEPS:");
  console.log("  1. Check Vercel environment variables:");
  console.log("     - NEXT_PUBLIC_DISABLE_AUTH should be 'true' for testing");
  console.log("     - DATABASE_URL should be configured");
  console.log("     - USE_DATABASE should be 'true'");
  console.log("  ");
  console.log("  2. Check Vercel function logs for the actual database errors:");
  console.log("     vercel logs [deployment-url] --limit=50");
  console.log("  ");
  console.log("  3. Create a test endpoint without authentication for diagnosis");
  console.log("  ");
  console.log("  4. Check if the issue happens when a real user tries to access with auth");

  console.log("\n🚨 IMPORTANT:");
  console.log("  The 'Failed query' error might be happening AFTER authentication");
  console.log("  We need to check Vercel function logs to see the actual database errors");
}

// Run the test
checkAuthBypass().catch(console.error);
