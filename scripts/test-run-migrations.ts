#!/usr/bin/env tsx

/**
 * Test script for the run-migrations API endpoint
 *
 * Usage:
 *   pnpm tsx scripts/test-run-migrations.ts
 *
 * This script tests the /api/admin/run-migrations endpoint
 * to ensure it can properly apply database migrations.
 */

import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });
config({ path: ".env" });

async function testRunMigrations() {
  console.log("🔄 Testing run-migrations endpoint...\n");

  // Get the base URL from environment or use localhost
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3001";
  const endpoint = `${baseUrl}/api/admin/run-migrations`;

  // You'll need to get a valid session token from Clerk
  // For production testing, you can get this from browser DevTools
  const authToken = process.env["TEST_CLERK_SESSION_TOKEN"];

  if (!authToken) {
    console.error("❌ Error: TEST_CLERK_SESSION_TOKEN not set in environment variables");
    console.log("\nTo get a session token:");
    console.log("1. Log in to the admin panel in your browser");
    console.log("2. Open DevTools → Application → Cookies");
    console.log("3. Find the '__session' cookie value");
    console.log("4. Set TEST_CLERK_SESSION_TOKEN in your .env.local file");
    process.exit(1);
  }

  try {
    console.log(`📡 Calling: ${endpoint}`);
    console.log(`🔑 Using auth token: ${authToken.substring(0, 20)}...`);

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Cookie: `__session=${authToken}`,
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`\n❌ Error: ${response.status} ${response.statusText}`);
      console.error("Response:", JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log("\n✅ Migrations endpoint called successfully!");
    console.log("\n📊 Summary:");
    console.log(`- Status: ${data.status}`);
    console.log(`- Total migrations: ${data.summary?.totalMigrations || 0}`);
    console.log(`- Executed: ${data.summary?.executed || 0}`);
    console.log(`- Skipped: ${data.summary?.skipped || 0}`);
    console.log(`- Failed: ${data.summary?.failed || 0}`);
    console.log(`- Execution time: ${data.summary?.totalExecutionTime || 0}ms`);

    console.log("\n🗄️ Database Info:");
    console.log(`- Connected: ${data.database?.connected || false}`);
    console.log(`- PostgreSQL: ${data.database?.postgresVersion?.split(",")[0] || "Unknown"}`);

    console.log("\n📋 Migration Results:");
    for (const migration of data.migrations || []) {
      const icon =
        migration.status === "success" ? "✅" : migration.status === "skipped" ? "⏭️" : "❌";
      console.log(`${icon} ${migration.name}: ${migration.status}`);
      if (migration.message) {
        console.log(`   → ${migration.message}`);
      }
      if (migration.error) {
        console.log(`   ❌ Error: ${migration.error}`);
      }
      if (migration.statementsExecuted !== undefined) {
        console.log(`   → Statements executed: ${migration.statementsExecuted}`);
      }
    }

    console.log("\n📊 Table Status:");
    console.log("- Tables before:", data.tables?.before?.join(", ") || "None");
    console.log(
      "- Tables after:",
      data.tables?.after?.map((t: any) => t.name).join(", ") || "None"
    );

    if (data.tables?.rowCounts) {
      console.log("\n📈 Row Counts:");
      for (const [table, count] of Object.entries(data.tables.rowCounts)) {
        if (count === -1) {
          console.log(`  - ${table}: Error reading`);
        } else {
          console.log(`  - ${table}: ${count} rows`);
        }
      }
    }

    console.log("\n✅ Test completed successfully!");
  } catch (error) {
    console.error("\n❌ Failed to test migrations endpoint:", error);
    process.exit(1);
  }
}

// Run the test
testRunMigrations().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
