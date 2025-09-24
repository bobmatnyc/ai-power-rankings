#!/usr/bin/env tsx

/**
 * Test admin endpoints directly to diagnose the issue
 */

console.log("🔍 Testing Admin Endpoints Directly\n");

// Test the endpoints that the admin panel uses
const endpoints = [
  "https://aipowerranking.com/api/auth-verify",
  "https://aipowerranking.com/api/admin/db-status",
  "https://aipowerranking.com/api/admin/articles",
];

async function testEndpoint(url: string) {
  console.log(`\nTesting: ${url}`);
  console.log("-".repeat(50));

  try {
    const response = await fetch(url, {
      credentials: 'omit', // No cookies to simulate curl
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (response.status === 401) {
      console.log("✅ Protected endpoint (requires auth)");
      const data = await response.json().catch(() => ({}));
      console.log(`Message: ${data.error || data.message || 'No message'}`);
    } else if (response.status === 403) {
      console.log("⚠️ Forbidden (authenticated but not admin)");
    } else if (response.ok) {
      console.log("⚠️ PUBLIC ACCESS - This might be a security issue!");
      const data = await response.json();
      console.log("Response preview:", JSON.stringify(data).substring(0, 100));
    }

    // Check headers
    const authStatus = response.headers.get('x-clerk-auth-status');
    if (authStatus) {
      console.log(`Clerk Auth Status Header: ${authStatus}`);
    }

  } catch (error) {
    console.log(`❌ Error: ${error}`);
  }
}

async function main() {
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }

  console.log("\n" + "=".repeat(50));
  console.log("\n📝 WHAT TO CHECK IN YOUR BROWSER:");
  console.log("1. Open DevTools (F12) on the admin page");
  console.log("2. Go to the Network tab");
  console.log("3. Refresh the page");
  console.log("4. Look for 'db-status' and 'articles' requests");
  console.log("5. Check their status codes:");
  console.log("   - If 401: Authentication not working");
  console.log("   - If 403: Not recognized as admin");
  console.log("   - If 200: Should be working!");
  console.log("   - If no request: JavaScript error");
  console.log("\n6. Also check the Console tab for any JavaScript errors");

  console.log("\n🔧 QUICK FIX TO TRY:");
  console.log("1. Sign out completely");
  console.log("2. Clear all cookies for aipowerranking.com");
  console.log("3. Sign in again at /sign-in");
  console.log("4. Visit /en/admin-test to confirm auth");
  console.log("5. Then try /en/admin again");
}

main().catch(console.error);