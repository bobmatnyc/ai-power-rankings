import { NextResponse } from "next/server";

/**
 * Diagnostic endpoint to capture the exact errors happening in admin routes
 * This endpoint mimics the same logic as the failing endpoints but with extensive logging
 */

export async function GET() {
  const logs: string[] = [];
  const addLog = (message: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    logs.push(logMessage);
    console.log(logMessage);
  };

  try {
    addLog("🔍 Starting diagnostic for admin API errors");

    // Test 1: Environment variables
    addLog("📊 Environment variables:");
    addLog(`  NODE_ENV: ${process.env["NODE_ENV"] || "undefined"}`);
    addLog(`  USE_DATABASE: ${process.env["USE_DATABASE"] || "undefined"}`);
    addLog(`  NEXT_PUBLIC_DISABLE_AUTH: ${process.env["NEXT_PUBLIC_DISABLE_AUTH"] || "undefined"}`);
    addLog(
      `  DATABASE_URL configured: ${!!process.env["DATABASE_URL"] && !process.env["DATABASE_URL"]?.includes("YOUR_PASSWORD")}`
    );

    // Test 2: Import auth modules
    addLog("🔐 Testing auth imports...");
    try {
      await import("@clerk/nextjs/server");
      addLog("  ✅ Clerk currentUser import successful");

      await import("@/lib/clerk-auth");
      addLog("  ✅ clerk-auth import successful");

      await import("@/lib/auth-helper");
      addLog("  ✅ auth-helper import successful");
    } catch (importError) {
      addLog(
        `  ❌ Auth import error: ${importError instanceof Error ? importError.message : String(importError)}`
      );
      addLog(`  Stack: ${importError instanceof Error ? importError.stack : "No stack"}`);
    }

    // Test 3: Database imports
    addLog("💾 Testing database imports...");
    try {
      const { getDb, testConnection } = await import("@/lib/db/connection");
      addLog("  ✅ Database connection import successful");

      const db = getDb();
      addLog(`  Database instance: ${db ? "Available" : "Null"}`);

      if (db) {
        const connectionTest = await testConnection();
        addLog(`  Connection test: ${connectionTest ? "Connected" : "Failed"}`);
      }
    } catch (dbError) {
      addLog(
        `  ❌ Database import error: ${dbError instanceof Error ? dbError.message : String(dbError)}`
      );
      addLog(`  Stack: ${dbError instanceof Error ? dbError.stack : "No stack"}`);
    }

    // Test 4: Repository imports
    addLog("📁 Testing repository imports...");
    try {
      const { ArticlesRepository } = await import("@/lib/db/repositories/articles.repository");
      addLog("  ✅ ArticlesRepository import successful");

      new ArticlesRepository();
      addLog("  ✅ ArticlesRepository instantiation successful");
    } catch (repoError) {
      addLog(
        `  ❌ Repository error: ${repoError instanceof Error ? repoError.message : String(repoError)}`
      );
      addLog(`  Stack: ${repoError instanceof Error ? repoError.stack : "No stack"}`);
    }

    // Test 5: Simulate the actual failing endpoint logic
    addLog("🎯 Simulating /api/admin/articles endpoint...");
    try {
      // Import everything needed for articles endpoint
      const { currentUser } = await import("@clerk/nextjs/server");
      const { getDb } = await import("@/lib/db/connection");
      const { ArticlesRepository } = await import("@/lib/db/repositories/articles.repository");

      addLog("  All imports successful, checking auth...");

      // Check auth (same logic as articles endpoint)
      const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
      addLog(`  Auth disabled mode: ${isAuthDisabled}`);

      if (!isAuthDisabled) {
        addLog("  Checking authentication...");
        const user = await currentUser();
        addLog(`  Current user ID: ${user?.id || "null"}`);
        addLog(`  User publicMetadata: ${JSON.stringify(user?.publicMetadata || {})}`);

        if (!user) {
          addLog("  ❌ No authenticated user found");
        } else {
          const isAdmin = user.publicMetadata?.isAdmin === true;
          addLog(`  User isAdmin: ${isAdmin}`);

          if (!isAdmin) {
            addLog("  ❌ User lacks admin privileges");
          } else {
            addLog("  ✅ Authentication successful - user is admin");
          }
        }
      } else {
        addLog("  ✅ Skipping authentication - auth is disabled");
      }

      // Test database
      addLog("  Getting database connection...");
      const db = getDb();
      addLog(`  Database connection available: ${!!db}`);

      if (db) {
        addLog("  Creating ArticlesRepository...");
        const articlesRepo = new ArticlesRepository();
        addLog("  ✅ ArticlesRepository created successfully");

        // Try to get articles
        addLog("  Calling articlesRepo.getArticles...");
        const articles = await articlesRepo.getArticles({ limit: 1 });
        addLog(`  ✅ Found ${articles.length} articles`);
      }
    } catch (endpointError) {
      addLog(
        `  ❌ Endpoint simulation error: ${endpointError instanceof Error ? endpointError.message : String(endpointError)}`
      );
      addLog(`  Stack: ${endpointError instanceof Error ? endpointError.stack : "No stack"}`);
    }

    addLog("🎉 Diagnostic complete");

    return NextResponse.json({
      status: "success",
      logs,
      summary: {
        timestamp: new Date().toISOString(),
        environment: process.env["NODE_ENV"],
        runtime: "nodejs",
        authDisabled: process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true",
        databaseConfigured:
          !!process.env["DATABASE_URL"] && !process.env["DATABASE_URL"]?.includes("YOUR_PASSWORD"),
      },
    });
  } catch (error) {
    addLog(`🚨 CRITICAL ERROR: ${error instanceof Error ? error.message : String(error)}`);
    addLog(`Stack: ${error instanceof Error ? error.stack : "No stack"}`);

    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        logs,
      },
      { status: 500 }
    );
  }
}
