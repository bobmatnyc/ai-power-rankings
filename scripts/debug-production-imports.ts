#!/usr/bin/env tsx

/**
 * Debug script to test production-like imports and environment
 * This helps identify potential issues that might cause 500 errors in Vercel
 */

async function debugImports() {
  console.log("🔍 Debugging production-like imports...\n");

  // Test 1: Environment variables
  console.log("1. Environment Variables:");
  console.log("   NODE_ENV:", process.env["NODE_ENV"] || "undefined");
  console.log("   USE_DATABASE:", process.env["USE_DATABASE"] || "undefined");
  console.log(
    "   DATABASE_URL configured:",
    !!process.env["DATABASE_URL"] && !process.env["DATABASE_URL"].includes("YOUR_PASSWORD")
  );
  console.log(
    "   NEXT_PUBLIC_DISABLE_AUTH:",
    process.env["NEXT_PUBLIC_DISABLE_AUTH"] || "undefined"
  );
  console.log();

  // Test 2: Database connection imports
  console.log("2. Database Connection:");
  try {
    const { getDb, testConnection } = await import("../src/lib/db/connection");
    console.log("   ✅ Database connection import successful");

    const db = getDb();
    console.log("   Database instance:", db ? "✅ Available" : "❌ Null");

    if (db) {
      const connectionTest = await testConnection();
      console.log("   Connection test:", connectionTest ? "✅ Connected" : "❌ Failed");
    }
  } catch (error) {
    console.log("   ❌ Database connection import failed:", (error as Error).message);
    if (error instanceof Error && error.stack) {
      console.log("   Stack:", error.stack.split("\n").slice(0, 3).join("\n"));
    }
  }
  console.log();

  // Test 3: ArticlesRepository import
  console.log("3. ArticlesRepository:");
  try {
    const { ArticlesRepository } = await import("../src/lib/db/repositories/articles.repository");
    console.log("   ✅ ArticlesRepository import successful");

    const repo = new ArticlesRepository();
    console.log("   ✅ ArticlesRepository instantiation successful");

    // Test a simple method that shouldn't require database
    console.log("   Testing generateUniqueSlug method...");
    const slug = await repo.generateUniqueSlug("test-article");
    console.log("   ✅ generateUniqueSlug works, result:", slug);
  } catch (error) {
    console.log("   ❌ ArticlesRepository failed:", (error as Error).message);
    if (error instanceof Error && error.stack) {
      console.log("   Stack:", error.stack.split("\n").slice(0, 3).join("\n"));
    }
  }
  console.log();

  // Test 4: Schema imports
  console.log("4. Database Schema:");
  try {
    const schema = await import("../src/lib/db/article-schema");
    console.log("   ✅ Article schema import successful");
    console.log(
      "   Exported types:",
      Object.keys(schema).filter((k) => k.includes("Type") || k.includes("article"))
    );
  } catch (error) {
    console.log("   ❌ Schema import failed:", (error as Error).message);
  }
  console.log();

  // Test 5: Clerk imports
  console.log("5. Clerk Authentication:");
  try {
    const clerk = await import("@clerk/nextjs/server");
    console.log("   ✅ Clerk import successful");
    console.log("   Available exports:", Object.keys(clerk).slice(0, 10));
  } catch (error) {
    console.log("   ❌ Clerk import failed:", (error as Error).message);
  }
  console.log();

  // Test 6: Auth helpers
  console.log("6. Auth Helpers:");
  try {
    const { getAuth, isAuthenticated } = await import("../src/lib/auth-helper");
    console.log("   ✅ Auth helper imports successful");

    // Test auth in dev mode
    const authResult = await getAuth();
    console.log("   Auth result userId:", authResult.userId);
  } catch (error) {
    console.log("   ❌ Auth helper failed:", (error as Error).message);
  }
  console.log();

  // Test 7: Runtime compatibility
  console.log("7. Runtime Environment:");
  console.log("   Node.js version:", process.version);
  console.log("   Platform:", process.platform);
  console.log("   Architecture:", process.arch);
  console.log("   Memory usage:", Math.round(process.memoryUsage().heapUsed / 1024 / 1024), "MB");
  console.log();

  console.log("🎯 Debug complete. If all tests pass, the 500 error might be:");
  console.log("   - Environment variable differences between local and production");
  console.log("   - Runtime differences in Vercel environment");
  console.log("   - Database connection issues specific to production");
  console.log("   - Authentication context differences");
}

// Run the debug
debugImports().catch(console.error);
