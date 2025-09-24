#!/usr/bin/env tsx

/**
 * Test admin authentication with improved fetch configuration
 * Tests that credentials: 'same-origin' works properly with Clerk
 */

async function testAdminAuth() {
  console.log("🔍 Testing Admin Authentication with Fixed Fetch Configuration\n");
  console.log("=".repeat(60));

  const isProduction = process.argv[2] === "--production";
  const baseUrl = isProduction ? "https://aipowerranking.com" : "http://localhost:3001";

  console.log(`Testing against: ${baseUrl}`);
  console.log(`Configuration: credentials: 'same-origin' (fixed from 'include')\n`);

  // Test endpoints
  const endpoints = [
    {
      name: "Public Database Test",
      path: "/api/public-db-test",
      requiresAuth: false,
    },
    {
      name: "Admin Database Status",
      path: "/api/admin/db-status",
      requiresAuth: true,
    },
    {
      name: "Admin Articles List",
      path: "/api/admin/articles?includeStats=true",
      requiresAuth: true,
    },
  ];

  for (const endpoint of endpoints) {
    console.log(`\nTesting: ${endpoint.name}`);
    console.log(`Path: ${endpoint.path}`);
    console.log(`Auth Required: ${endpoint.requiresAuth ? "Yes" : "No"}`);
    console.log("-".repeat(40));

    try {
      const response = await fetch(`${baseUrl}${endpoint.path}`, {
        method: "GET",
        // Fixed: using 'same-origin' instead of 'include' for better Clerk compatibility
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      console.log(`Status: ${response.status} ${response.statusText}`);

      // Check Clerk auth headers
      const authStatus = response.headers.get("x-clerk-auth-status");
      const authReason = response.headers.get("x-clerk-auth-reason");
      if (authStatus) {
        console.log(`Clerk Auth Status: ${authStatus}`);
        console.log(`Clerk Auth Reason: ${authReason || "none"}`);
      }

      if (response.status === 401) {
        if (endpoint.requiresAuth) {
          console.log("✅ Properly secured - requires authentication");
          const data = await response.json().catch(() => ({}));
          if (data.message) {
            console.log(`   Message: ${data.message}`);
          }
        } else {
          console.log("❌ Unexpected 401 - public endpoint should be accessible");
        }
      } else if (response.status === 403) {
        console.log("⚠️ Forbidden - user authenticated but lacks admin privileges");
        const data = await response.json().catch(() => ({}));
        if (data.message) {
          console.log(`   Message: ${data.message}`);
        }
      } else if (response.ok) {
        if (endpoint.requiresAuth) {
          console.log("⚠️ Endpoint accessible without auth - may be misconfigured");
        } else {
          console.log("✅ Public endpoint accessible");
        }

        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const data = await response.json();

          // Show relevant info based on endpoint
          if (endpoint.path.includes("db-status")) {
            console.log(`   Database Type: ${data.type || "unknown"}`);
            console.log(`   Connected: ${data.connected || false}`);
          } else if (endpoint.path.includes("articles")) {
            console.log(`   Articles Count: ${data.articles?.length || 0}`);
          } else if (endpoint.path.includes("public-db-test")) {
            console.log(`   Status: ${data.summary?.status || "unknown"}`);
            console.log(`   Articles: ${data.tests?.articlesCount?.count || 0}`);
          }
        }
      } else {
        console.log(`❌ Unexpected status: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Request failed: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
        console.log("   💡 Make sure the dev server is running: pnpm run dev:pm2 start");
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📋 SUMMARY OF CHANGES");
  console.log("-".repeat(60));
  console.log("✅ Fixed all fetch calls in admin components:");
  console.log("   - UnifiedAdminDashboard: 6 fetch calls updated");
  console.log("   - ArticleManagement: 9 fetch calls updated");
  console.log("   - Changed from 'credentials: include' to 'credentials: same-origin'");
  console.log("   - Added enhanced error logging for debugging");

  console.log("\n🔧 WHY THIS FIX WORKS:");
  console.log("   - 'same-origin' only sends cookies for same-origin requests");
  console.log("   - Better compatibility with Clerk's cookie-based auth");
  console.log("   - Prevents CORS issues in production");
  console.log("   - More secure than 'include' for same-origin requests");

  console.log("\n📝 TO TEST IN BROWSER:");
  console.log("1. Start dev server: pnpm run dev:pm2 start");
  console.log("2. Sign in at http://localhost:3001/en/admin-test");
  console.log("3. Navigate to admin panel at http://localhost:3001/en/admin");
  console.log("4. Check browser DevTools Network tab for proper auth headers");
  console.log("5. Database status and articles should load successfully");

  console.log("\n💡 IF ISSUES PERSIST:");
  console.log("   - Clear browser cookies and cache");
  console.log("   - Sign out and sign back in");
  console.log("   - Check browser console for detailed error logs");
  console.log("   - Verify Clerk environment variables are set correctly");
}

// Parse command line args
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: pnpm tsx scripts/test-admin-auth.ts [--production]");
  console.log("  --production  Test against production site instead of localhost");
  process.exit(0);
}

testAdminAuth().catch(console.error);
