#!/usr/bin/env node

/**
 * Script to test admin API authentication fixes
 * Run with: npx tsx scripts/test-admin-auth.ts
 */

async function testAdminAuth() {
  const baseUrl = process.env["BASE_URL"] || "http://localhost:3001";

  console.log("🔍 Testing Admin API Authentication Fixes");
  console.log("========================================");
  console.log(`Base URL: ${baseUrl}`);
  console.log("");

  // Test 1: db-status endpoint without auth
  console.log("📝 Test 1: /api/admin/db-status without auth");
  try {
    const response = await fetch(`${baseUrl}/api/admin/db-status`, {
      method: "GET",
      credentials: "omit",
    });
    console.log(`   Status: ${response.status} ${response.statusText}`);
    if (response.status === 401) {
      console.log("   ✅ Correctly returns 401 when not authenticated");
    } else {
      console.log(`   ❌ Expected 401, got ${response.status}`);
    }
  } catch (error) {
    console.error("   ❌ Request failed:", error);
  }
  console.log("");

  // Test 2: articles endpoint without auth
  console.log("📝 Test 2: /api/admin/articles without auth");
  try {
    const response = await fetch(`${baseUrl}/api/admin/articles`, {
      method: "GET",
      credentials: "omit",
    });
    console.log(`   Status: ${response.status} ${response.statusText}`);
    if (response.status === 401) {
      console.log("   ✅ Correctly returns 401 when not authenticated");
    } else {
      console.log(`   ❌ Expected 401, got ${response.status}`);
    }
  } catch (error) {
    console.error("   ❌ Request failed:", error);
  }
  console.log("");

  // Test 3: db-status endpoint with auth (assuming local dev mode)
  if (process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true") {
    console.log("📝 Test 3: /api/admin/db-status with auth disabled (dev mode)");
    try {
      const response = await fetch(`${baseUrl}/api/admin/db-status`, {
        method: "GET",
      });
      console.log(`   Status: ${response.status} ${response.statusText}`);
      if (response.status === 200) {
        console.log("   ✅ Correctly returns 200 in dev mode with auth disabled");
        const data = await response.json();
        console.log(`   Database status: ${data.status}`);
      } else {
        console.log(`   ❌ Expected 200, got ${response.status}`);
        const text = await response.text();
        console.log(`   Response: ${text.substring(0, 200)}`);
      }
    } catch (error) {
      console.error("   ❌ Request failed:", error);
    }
    console.log("");

    console.log("📝 Test 4: /api/admin/articles with auth disabled (dev mode)");
    try {
      const response = await fetch(`${baseUrl}/api/admin/articles?limit=1`, {
        method: "GET",
      });
      console.log(`   Status: ${response.status} ${response.statusText}`);
      if (response.status === 200) {
        console.log("   ✅ Correctly returns 200 in dev mode with auth disabled");
        const data = await response.json();
        console.log(`   Articles found: ${data.articles?.length || 0}`);
      } else {
        console.log(`   ❌ Expected 200, got ${response.status}`);
        const text = await response.text();
        console.log(`   Response: ${text.substring(0, 200)}`);
      }
    } catch (error) {
      console.error("   ❌ Request failed:", error);
    }
  } else {
    console.log("⚠️ Skipping authenticated tests - auth is enabled");
    console.log("   To test in dev mode, set NEXT_PUBLIC_DISABLE_AUTH=true");
  }

  console.log("");
  console.log("✅ Authentication fix tests completed!");
  console.log("");
  console.log("Note: The critical fix ensures that:");
  console.log("1. Auth checks are wrapped in try-catch blocks");
  console.log("2. Detailed error logging is added for debugging");
  console.log("3. Routes use the proper auth-helper module");
  console.log("4. Errors are handled gracefully without 500 crashes");
}

// Run the test
testAdminAuth().catch(console.error);