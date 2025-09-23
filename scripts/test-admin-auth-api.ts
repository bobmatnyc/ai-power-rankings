#!/usr/bin/env tsx
/**
 * Script to test the admin API authentication flow
 *
 * This script tests:
 * 1. API returns JSON errors (not HTML) when auth fails
 * 2. Proper error messages for different auth scenarios
 * 3. Successful API calls when auth is configured
 *
 * Usage:
 *   pnpm tsx scripts/test-admin-auth-api.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });

const BASE_URL = process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3001";
const IS_AUTH_DISABLED = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  response?: {
    status: number;
    contentType: string | null;
    body: any;
  };
}

async function testApiEndpoint(
  url: string,
  options: RequestInit = {}
): Promise<{
  status: number;
  contentType: string | null;
  body: any;
  isJson: boolean;
}> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
    });

    const contentType = response.headers.get("Content-Type");
    const isJson = contentType?.includes("application/json") ?? false;

    let body: any;
    const responseText = await response.text();

    if (isJson) {
      try {
        body = JSON.parse(responseText);
      } catch {
        body = responseText;
      }
    } else {
      body = responseText;
    }

    return {
      status: response.status,
      contentType,
      body,
      isJson,
    };
  } catch (error) {
    throw error;
  }
}

async function runTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  console.log("🔍 Testing Admin API Authentication\n");
  console.log("=".repeat(60));
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`Auth Disabled: ${IS_AUTH_DISABLED}\n`);

  // Test 1: Check if API returns JSON for unauthenticated requests
  console.log("Test 1: API returns JSON for unauthenticated requests...");
  try {
    const result = await testApiEndpoint(`${BASE_URL}/api/admin/articles`);

    if (IS_AUTH_DISABLED) {
      // With auth disabled, should return successful response
      results.push({
        name: "API with auth disabled",
        passed: result.status === 200 && result.isJson,
        details:
          result.status === 200
            ? "✅ API accessible with auth disabled"
            : `❌ Unexpected status: ${result.status}`,
        response: result,
      });
    } else {
      // With auth enabled, should return JSON error
      const isProperError = (result.status === 401 || result.status === 403) && result.isJson;

      results.push({
        name: "API returns JSON error for unauthenticated request",
        passed: isProperError,
        details: isProperError
          ? "✅ Returns proper JSON error"
          : result.isJson
            ? `⚠️ Returns JSON but wrong status: ${result.status}`
            : "❌ Returns HTML instead of JSON (authentication redirect issue)",
        response: result,
      });

      // Check error message structure
      if (result.isJson && typeof result.body === "object") {
        const hasProperStructure =
          result.body.error && (result.body.message || result.body.details);

        results.push({
          name: "Error response has proper structure",
          passed: hasProperStructure,
          details: hasProperStructure
            ? "✅ Error has proper structure (error, message/details)"
            : "❌ Error missing required fields",
          response: result,
        });
      }
    }
  } catch (error) {
    results.push({
      name: "API endpoint is reachable",
      passed: false,
      details: `❌ Failed to reach API: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }

  // Test 2: Check response headers
  console.log("\nTest 2: Checking response headers...");
  try {
    const result = await testApiEndpoint(`${BASE_URL}/api/admin/articles`);

    const hasContentTypeHeader = result.contentType !== null;
    const isJsonContentType = result.contentType?.includes("application/json") ?? false;

    results.push({
      name: "Response includes Content-Type header",
      passed: hasContentTypeHeader && isJsonContentType,
      details: hasContentTypeHeader
        ? isJsonContentType
          ? "✅ Content-Type: application/json"
          : `⚠️ Wrong Content-Type: ${result.contentType}`
        : "❌ Missing Content-Type header",
    });
  } catch (error) {
    results.push({
      name: "Response headers check",
      passed: false,
      details: `❌ Failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }

  // Test 3: Check if development server is running
  console.log("\nTest 3: Checking if development server is running...");
  try {
    const healthResult = await testApiEndpoint(`${BASE_URL}/api/health`);
    const isServerRunning = healthResult.status === 200;

    results.push({
      name: "Development server is running",
      passed: isServerRunning,
      details: isServerRunning
        ? "✅ Server is responding"
        : `❌ Server not responding (status: ${healthResult.status})`,
    });
  } catch (error) {
    results.push({
      name: "Development server check",
      passed: false,
      details: "❌ Server is not running. Start it with: pnpm run dev:pm2 start",
    });
  }

  return results;
}

async function main() {
  console.log("🚀 Starting Admin API Authentication Tests\n");

  try {
    const results = await runTests();

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 Test Results Summary\n");

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    results.forEach((result, index) => {
      const icon = result.passed ? "✅" : "❌";
      console.log(`${index + 1}. ${icon} ${result.name}`);
      console.log(`   ${result.details}`);

      if (result.response && !result.passed) {
        console.log(`   Status: ${result.response.status}`);
        console.log(`   Content-Type: ${result.response.contentType || "none"}`);
        if (result.response.isJson) {
          console.log(
            "   Response:",
            JSON.stringify(result.response.body, null, 2).substring(0, 200)
          );
        } else {
          console.log(
            `   Response (first 200 chars): ${String(result.response.body).substring(0, 200)}`
          );
        }
      }
      console.log("");
    });

    console.log("=".repeat(60));
    console.log(`\nTotal: ${passed} passed, ${failed} failed\n`);

    // Provide recommendations based on results
    if (failed > 0) {
      console.log("📝 Recommendations:\n");

      const hasHtmlRedirect = results.some(
        (r) => !r.passed && r.details.includes("HTML instead of JSON")
      );

      if (hasHtmlRedirect) {
        console.log("1. ❌ API is returning HTML (sign-in page) instead of JSON");
        console.log("   This has been fixed in the middleware. Restart your dev server:");
        console.log("   pnpm run dev:pm2 restart\n");
      }

      const serverNotRunning = results.some(
        (r) => r.name === "Development server check" && !r.passed
      );

      if (serverNotRunning) {
        console.log("2. ❌ Development server is not running");
        console.log("   Start the server with:");
        console.log("   pnpm run dev:pm2 start\n");
      }

      if (!IS_AUTH_DISABLED && !hasHtmlRedirect && !serverNotRunning) {
        console.log("3. ℹ️ For local development without auth, add to .env.local:");
        console.log("   NEXT_PUBLIC_DISABLE_AUTH=true\n");
        console.log("   Or configure Clerk authentication:");
        console.log("   pnpm tsx scripts/verify-admin-auth.ts\n");
      }
    } else {
      console.log("🎉 All tests passed! Authentication is working correctly.\n");

      if (IS_AUTH_DISABLED) {
        console.log("ℹ️ Note: Authentication is disabled for development.");
        console.log("  This is fine for local development but should be enabled in production.\n");
      }
    }
  } catch (error) {
    console.error("\n❌ Test suite failed:");
    console.error(error);
    process.exit(1);
  }
}

// Run the tests
main();
