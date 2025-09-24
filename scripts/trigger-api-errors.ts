#!/usr/bin/env npx tsx

/**
 * Script to trigger API errors for log analysis
 * This helps us observe what errors are happening in production
 */

const PRODUCTION_URL = "https://ai-power-ranking-niwmgl4g5-1-m.vercel.app";
const STAGING_URL = "https://ai-power-ranking-iufz3m0sh-1-m.vercel.app";

async function testEndpoint(url: string, name: string) {
  console.log(`\n🔍 Testing ${name}: ${url}`);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(
      `   Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`
    );

    if (response.status >= 400) {
      const errorText = await response.text();
      console.log("   ❌ Error Response Body:");
      console.log(`   ${errorText.substring(0, 500)}${errorText.length > 500 ? "..." : ""}`);
    } else {
      const successText = await response.text();
      console.log("   ✅ Success Response (first 200 chars):");
      console.log(`   ${successText.substring(0, 200)}${successText.length > 200 ? "..." : ""}`);
    }
  } catch (error) {
    console.log(`   💥 Fetch Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function triggerErrors() {
  console.log("🚀 Triggering API errors to analyze production issues...\n");

  // Test all problematic endpoints mentioned in the issue
  const endpoints = [
    "/api/admin/db-test",
    "/api/admin/db-status",
    "/api/admin/articles",
    "/api/admin/articles?includeStats=true",
  ];

  for (const endpoint of endpoints) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`TESTING ENDPOINT: ${endpoint}`);
    console.log("=".repeat(80));

    // Test production
    await testEndpoint(`${PRODUCTION_URL}${endpoint}`, "Production");

    // Add small delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test staging
    await testEndpoint(`${STAGING_URL}${endpoint}`, "Staging");

    // Add delay between endpoints
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log("✅ Error triggering complete!");
  console.log("Check Vercel dashboard or use 'vercel logs [deployment-url]' to see the errors");
  console.log("=".repeat(80));
}

// Run the test
triggerErrors().catch(console.error);
