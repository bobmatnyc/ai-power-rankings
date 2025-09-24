#!/usr/bin/env tsx

/**
 * Test script for debug-auth endpoint
 * Usage: pnpm tsx scripts/test-debug-auth.ts [base-url]
 *
 * Examples:
 *   pnpm tsx scripts/test-debug-auth.ts                          # Test local development
 *   pnpm tsx scripts/test-debug-auth.ts https://aipowerranking.com  # Test production
 */

const DEFAULT_BASE_URL = "http://localhost:3001";

async function testDebugAuth(baseUrl: string) {
  console.log("\n🔍 Testing Debug Auth Endpoint");
  console.log("================================");
  console.log(`📍 Base URL: ${baseUrl}`);
  console.log(`🔗 Endpoint: ${baseUrl}/api/admin/debug-auth`);
  console.log();

  try {
    console.log("📡 Sending request...");
    const response = await fetch(`${baseUrl}/api/admin/debug-auth`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      credentials: "include", // Include cookies for authentication
    });

    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log();

    if (!response.ok) {
      console.error("❌ Request failed");
      const text = await response.text();
      console.error("Response:", text);
      return;
    }

    const data = await response.json();

    // Display authentication status
    console.log("🔐 Authentication Status");
    console.log("------------------------");
    if (data.authentication?.currentUser) {
      console.log("✅ User authenticated");
      console.log(`   ID: ${data.authentication.currentUser.id}`);
      console.log(
        `   Email: ${data.authentication.currentUser.emailAddresses?.[0]?.emailAddress || "N/A"}`
      );
      console.log(`   Admin: ${data.authentication.isAdmin ? "✅ Yes" : "❌ No"}`);
      if (data.authentication.currentUser.publicMetadata) {
        console.log(
          `   Metadata: ${JSON.stringify(data.authentication.currentUser.publicMetadata, null, 2)}`
        );
      }
    } else {
      console.log("❌ User not authenticated");
      if (data.authentication?.error) {
        console.log(`   Error: ${data.authentication.error.message}`);
      }
    }
    console.log();

    // Display environment status
    console.log("🌍 Environment Status");
    console.log("---------------------");
    console.log(`   Node Environment: ${data.environment}`);
    console.log(`   Vercel Environment: ${data.vercelEnv}`);
    console.log(
      `   Auth Disabled: ${data.environmentVariables?.auth?.NEXT_PUBLIC_DISABLE_AUTH || "false"}`
    );
    console.log(
      `   Clerk Keys: ${data.environmentVariables?.auth?.CLERK_SECRET_KEY || "❌ Not set"}`
    );
    console.log();

    // Display database status
    console.log("💾 Database Status");
    console.log("------------------");
    if (data.database?.hasConnection) {
      console.log("✅ Database connected");
      if (data.database.queryTest?.success) {
        console.log("✅ Query test passed");
      } else {
        console.log("❌ Query test failed:", data.database.queryTest?.error);
      }
    } else {
      console.log("❌ Database not connected");
      if (data.database?.error) {
        console.log(`   Error: ${data.database.error.message}`);
      }
    }
    console.log();

    // Display repository status
    console.log("📚 Articles Repository Status");
    console.log("-----------------------------");
    if (data.articlesRepository?.success) {
      console.log("✅ Repository accessible");
      if (data.articlesRepository.stats) {
        console.log(`   Total articles: ${data.articlesRepository.stats.totalArticles || 0}`);
        console.log(`   This month: ${data.articlesRepository.stats.articlesThisMonth || 0}`);
      }
    } else {
      console.log("❌ Repository not accessible");
      if (data.articlesRepository?.error) {
        console.log(`   Error: ${data.articlesRepository.error.message}`);
      }
    }
    console.log();

    // Display endpoint simulation
    console.log("🎯 Admin Endpoint Simulation");
    console.log("----------------------------");
    console.log(
      `   Would authenticate: ${data.adminEndpointSimulation?.wouldAuthenticate ? "✅" : "❌"}`
    );
    console.log(
      `   Would authorize: ${data.adminEndpointSimulation?.wouldAuthorize ? "✅" : "❌"}`
    );
    console.log(
      `   Would fetch articles: ${data.adminEndpointSimulation?.wouldFetchArticles ? "✅" : "❌"}`
    );
    console.log(
      `   Expected response: ${data.adminEndpointSimulation?.details?.wouldReturn || "Unknown"}`
    );
    if (data.adminEndpointSimulation?.details?.reason) {
      console.log(`   Reason: ${data.adminEndpointSimulation.details.reason}`);
    }
    console.log();

    // Display summary
    console.log("📊 Summary");
    console.log("----------");
    console.log(`   ${data.summary?.authenticationStatus || "Unknown"}`);
    console.log(`   ${data.summary?.adminStatus || "Unknown"}`);
    console.log(`   ${data.summary?.databaseStatus || "Unknown"}`);
    console.log();

    // Display recommendations
    if (data.summary?.recommendations && data.summary.recommendations.length > 0) {
      console.log("💡 Recommendations");
      console.log("------------------");
      data.summary.recommendations.forEach((rec: string) => {
        console.log(`   • ${rec}`);
      });
      console.log();
    }

    // Save full response for debugging
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `/tmp/debug-auth-${timestamp}.json`;
    const fs = await import("fs");
    await fs.promises.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`💾 Full response saved to: ${filename}`);
  } catch (error) {
    console.error("❌ Error testing debug endpoint:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
      console.error("   Stack:", error.stack);
    }
  }
}

// Main execution
async function main() {
  const baseUrl = process.argv[2] || DEFAULT_BASE_URL;
  await testDebugAuth(baseUrl);
}

main().catch(console.error);
