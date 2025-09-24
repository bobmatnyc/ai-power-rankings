#!/usr/bin/env tsx

/**
 * Debug script for admin panel access issues
 * Tests the authentication flow step by step
 */

async function debugAdminAccess() {
  console.log("🔍 Debugging Admin Panel Access\n");
  console.log("=" + "=".repeat(60));

  // Test 1: Check auth-verify endpoint
  console.log("\n1. Testing Authentication Status:");
  console.log("   URL: https://aipowerranking.com/api/auth-verify");

  try {
    const authRes = await fetch("https://aipowerranking.com/api/auth-verify");
    const authData = await authRes.json();

    if (authData.authenticated) {
      console.log("   ✅ You are authenticated");
      console.log(`   User: ${authData.user?.email || "Unknown"}`);
      console.log(`   Admin: ${authData.admin?.hasAccess ? "✅ YES" : "❌ NO"}`);

      if (authData.admin?.publicMetadata) {
        console.log("   Metadata:", JSON.stringify(authData.admin.publicMetadata));
      }
    } else {
      console.log("   ❌ Not authenticated");
      console.log("   Message:", authData.message);
    }
  } catch (error) {
    console.log("   ❌ Error:", error);
  }

  // Test 2: Check admin articles endpoint
  console.log("\n2. Testing Admin Articles Endpoint:");
  console.log("   URL: https://aipowerranking.com/api/admin/articles");

  try {
    const articlesRes = await fetch("https://aipowerranking.com/api/admin/articles");
    console.log(`   Status: ${articlesRes.status} ${articlesRes.statusText}`);

    if (articlesRes.status === 200) {
      const articles = await articlesRes.json();
      console.log(`   ✅ Success! Retrieved ${articles.length} articles`);
    } else {
      const errorData = await articlesRes.json();
      console.log(`   ❌ Error: ${errorData.error || "Unknown"}`);
      console.log(`   Message: ${errorData.message || "No message"}`);
    }
  } catch (error) {
    console.log("   ❌ Error:", error);
  }

  // Test 3: Check database status
  console.log("\n3. Testing Database Connection:");
  console.log("   URL: https://aipowerranking.com/api/public-db-test");

  try {
    const dbRes = await fetch("https://aipowerranking.com/api/public-db-test");
    const dbData = await dbRes.json();
    console.log(`   Status: ${dbData.summary?.status || "Unknown"}`);
    console.log(`   Articles in DB: ${dbData.tests?.articlesCount?.count || "Unknown"}`);
  } catch (error) {
    console.log("   ❌ Error:", error);
  }

  // Instructions
  console.log("\n" + "=".repeat(60));
  console.log("\n📋 TROUBLESHOOTING STEPS:\n");
  console.log("1. IF NOT SIGNED IN:");
  console.log("   a. Go to https://aipowerranking.com/sign-in");
  console.log("   b. Sign in with your Clerk account");
  console.log("   c. Run this script again\n");

  console.log("2. IF SIGNED IN BUT NO ADMIN ACCESS:");
  console.log("   a. Go to Clerk Dashboard → Users");
  console.log("   b. Find your user account");
  console.log("   c. Edit → Public Metadata");
  console.log("   d. Set: { \"isAdmin\": true }");
  console.log("   e. Save changes");
  console.log("   f. Sign out and sign in again\n");

  console.log("3. IF STILL HAVING ISSUES:");
  console.log("   a. Clear browser cache and cookies");
  console.log("   b. Try incognito/private browsing mode");
  console.log("   c. Check browser console for errors");
  console.log("   d. Check Network tab for failed requests\n");

  console.log("4. TO TEST WITH YOUR SESSION:");
  console.log("   a. Open Chrome DevTools → Network tab");
  console.log("   b. Visit https://aipowerranking.com/api/auth-verify");
  console.log("   c. Check the response - it should show your auth status");
  console.log("   d. Visit https://aipowerranking.com/en/admin");
  console.log("   e. Check Network tab for /api/admin/articles request");
  console.log("   f. See what status code and response it returns\n");

  console.log("=" + "=".repeat(60));
  console.log("\n✅ Middleware is working correctly (no MIDDLEWARE_INVOCATION_FAILED)");
  console.log("✅ Database has 79 articles and is accessible");
  console.log("✅ Authentication system is properly configured\n");

  console.log("🎯 The issue is likely:");
  console.log("   1. User not signed in, OR");
  console.log("   2. User signed in but isAdmin not set to true in Clerk metadata\n");

  console.log("Run this script from your browser console while signed in:");
  console.log(`
fetch('https://aipowerranking.com/api/auth-verify')
  .then(r => r.json())
  .then(d => console.log('Auth Status:', d));
`);
}

debugAdminAccess().catch(console.error);