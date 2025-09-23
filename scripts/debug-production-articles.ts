#!/usr/bin/env npx tsx
/**
 * Production Articles API Debugging Script
 *
 * This script helps identify the root cause of why articles fail to load
 * in production even though:
 * 1. Middleware allows Clerk auth for API routes
 * 2. User has isAdmin: true in Clerk public metadata
 * 3. User can access the /admin page
 *
 * Run with: npx tsx scripts/debug-production-articles.ts
 */

import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

// Configuration
const PRODUCTION_URL = process.env["NEXT_PUBLIC_BASE_URL"] || "https://ai-power-ranking.vercel.app";
const CLERK_SESSION_TOKEN = process.env["DEBUG_CLERK_SESSION_TOKEN"] || "";
const CLERK_SESSION_COOKIE = process.env["DEBUG_CLERK_SESSION_COOKIE"] || "";

// Utility functions
function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function section(title: string) {
  console.log("\n" + "=".repeat(80));
  log(`${title}`, colors.bright + colors.cyan);
  console.log("=".repeat(80));
}

function success(message: string) {
  log(`✅ ${message}`, colors.green);
}

function error(message: string) {
  log(`❌ ${message}`, colors.red);
}

function warning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

function debug(label: string, value: any) {
  log(`${label}:`, colors.dim);
  console.log(value);
}

// Test functions
async function testBasicConnectivity() {
  section("1. BASIC CONNECTIVITY TEST");

  try {
    info("Testing basic HTTPS connection to production...");
    const response = await fetch(`${PRODUCTION_URL}/api/health`, {
      method: "GET",
    });

    if (response.ok) {
      success(`Connected to ${PRODUCTION_URL} (Status: ${response.status})`);
      const data = await response.text();
      debug("Health check response", data);
      return true;
    } else {
      error(`Failed to connect (Status: ${response.status})`);
      const errorText = await response.text();
      debug("Error response", errorText);
      return false;
    }
  } catch (err) {
    error(`Network error: ${err}`);
    return false;
  }
}

async function testPublicAPI() {
  section("2. PUBLIC API TEST");

  try {
    info("Testing public API endpoint without authentication...");
    const response = await fetch(`${PRODUCTION_URL}/api/rankings`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (response.ok) {
      success(`Public API accessible (Status: ${response.status})`);
      const data = await response.json();
      debug("Sample response", {
        hasData: !!data,
        dataType: typeof data,
        keys: Object.keys(data || {}).slice(0, 5),
      });
      return true;
    } else {
      warning(`Public API returned status: ${response.status}`);
      const errorText = await response.text();
      debug("Response", errorText.substring(0, 200));
      return false;
    }
  } catch (err) {
    error(`API error: ${err}`);
    return false;
  }
}

async function testAdminAPIWithoutAuth() {
  section("3. ADMIN API WITHOUT AUTHENTICATION");

  try {
    info("Testing admin API without authentication (should fail)...");
    const response = await fetch(`${PRODUCTION_URL}/api/admin/articles?includeStats=true`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 401 || response.status === 403) {
      success(`Correctly blocked unauthorized access (Status: ${response.status})`);
      const data = await response.json().catch(() => null);
      debug("Auth error", data);
      return true;
    } else if (response.ok) {
      error(`SECURITY ISSUE: Admin API accessible without auth! (Status: ${response.status})`);
      return false;
    } else {
      warning(`Unexpected status: ${response.status}`);
      const errorText = await response.text();
      debug("Response", errorText.substring(0, 200));
      return false;
    }
  } catch (err) {
    error(`API error: ${err}`);
    return false;
  }
}

async function testAdminAPIWithCookie() {
  section("4. ADMIN API WITH SESSION COOKIE");

  if (!CLERK_SESSION_COOKIE) {
    warning("No session cookie provided. Set DEBUG_CLERK_SESSION_COOKIE in .env.local");
    info("To get the cookie:");
    info("1. Log into production site");
    info("2. Open DevTools > Application > Cookies");
    info("3. Copy the __session cookie value");
    return false;
  }

  try {
    info("Testing admin API with session cookie...");
    const response = await fetch(`${PRODUCTION_URL}/api/admin/articles?includeStats=true`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: `__session=${CLERK_SESSION_COOKIE}`,
      },
      credentials: "include",
    });

    debug("Response status", response.status);
    debug("Response headers", Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      success("Admin API accessible with cookie authentication!");
      const data = await response.json();
      debug("Articles data", {
        articlesCount: data.articles?.length || 0,
        hasStats: !!data.stats,
        firstArticle: data.articles?.[0]?.title || "No articles",
      });
      return true;
    } else {
      error(`Failed with cookie auth (Status: ${response.status})`);
      const errorData = await response.json().catch(() => null);
      debug("Error response", errorData);

      if (response.status === 401) {
        info("Cookie may be expired or invalid");
      } else if (response.status === 403) {
        info("User authenticated but not admin");
      }
      return false;
    }
  } catch (err) {
    error(`API error: ${err}`);
    return false;
  }
}

async function testAdminAPIWithBearerToken() {
  section("5. ADMIN API WITH BEARER TOKEN");

  if (!CLERK_SESSION_TOKEN) {
    warning("No session token provided. Set DEBUG_CLERK_SESSION_TOKEN in .env.local");
    info("To get the token:");
    info("1. Log into production site");
    info("2. Open DevTools > Console");
    info("3. Run: await Clerk.session.getToken()");
    return false;
  }

  try {
    info("Testing admin API with bearer token...");
    const response = await fetch(`${PRODUCTION_URL}/api/admin/articles?includeStats=true`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${CLERK_SESSION_TOKEN}`,
      },
    });

    debug("Response status", response.status);

    if (response.ok) {
      success("Admin API accessible with bearer token!");
      const data = await response.json();
      debug("Articles data", {
        articlesCount: data.articles?.length || 0,
        hasStats: !!data.stats,
      });
      return true;
    } else {
      error(`Failed with bearer token (Status: ${response.status})`);
      const errorData = await response.json().catch(() => null);
      debug("Error response", errorData);
      return false;
    }
  } catch (err) {
    error(`API error: ${err}`);
    return false;
  }
}

async function testCORSHeaders() {
  section("6. CORS HEADERS TEST");

  try {
    info("Testing CORS preflight request...");
    const response = await fetch(`${PRODUCTION_URL}/api/admin/articles`, {
      method: "OPTIONS",
      headers: {
        Origin: PRODUCTION_URL,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Accept, Content-Type",
      },
    });

    const corsHeaders = {
      "access-control-allow-origin": response.headers.get("access-control-allow-origin"),
      "access-control-allow-methods": response.headers.get("access-control-allow-methods"),
      "access-control-allow-headers": response.headers.get("access-control-allow-headers"),
      "access-control-allow-credentials": response.headers.get("access-control-allow-credentials"),
    };

    debug("CORS headers", corsHeaders);

    if (corsHeaders["access-control-allow-origin"]) {
      success("CORS headers present");
      return true;
    } else {
      warning("No CORS headers found - this might be normal for same-origin requests");
      return true;
    }
  } catch (err) {
    error(`CORS test error: ${err}`);
    return false;
  }
}

async function simulateBrowserFetch() {
  section("7. SIMULATED BROWSER FETCH");

  info("Simulating the exact fetch from article-management.tsx...");

  const testUrl = `${PRODUCTION_URL}/api/admin/articles?includeStats=true`;

  // Test 1: Without credentials
  try {
    info("Test 1: Fetch without credentials (like initial implementation)");
    const response1 = await fetch(testUrl, {
      headers: {
        Accept: "application/json",
      },
    });

    if (response1.ok) {
      warning("API accessible without credentials - possible security issue");
    } else {
      success(`Correctly blocked (Status: ${response1.status})`);
    }
  } catch (err) {
    error(`Fetch error: ${err}`);
  }

  // Test 2: With credentials: 'include'
  try {
    info('Test 2: Fetch with credentials: "include" (current implementation)');
    const response2 = await fetch(testUrl, {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    debug("Response status", response2.status);

    if (response2.ok) {
      success("Works with credentials: include");
    } else {
      warning(`Failed with credentials: include (Status: ${response2.status})`);
      const errorData = await response2.json().catch(() => null);
      debug("Error", errorData);
    }
  } catch (err) {
    error(`Fetch error: ${err}`);
  }

  return true;
}

async function checkClerkConfiguration() {
  section("8. CLERK CONFIGURATION CHECK");

  info("Checking Clerk environment variables...");

  const clerkVars = {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"],
    CLERK_SECRET_KEY: !!process.env["CLERK_SECRET_KEY"],
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env["NEXT_PUBLIC_CLERK_SIGN_IN_URL"] || "(default)",
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env["NEXT_PUBLIC_CLERK_SIGN_UP_URL"] || "(default)",
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL:
      process.env["NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL"] || "(default)",
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL:
      process.env["NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL"] || "(default)",
  };

  debug("Clerk configuration", clerkVars);

  if (!clerkVars["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]) {
    error("Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
    return false;
  }

  if (!clerkVars["CLERK_SECRET_KEY"]) {
    error("Missing CLERK_SECRET_KEY");
    return false;
  }

  success("Clerk environment variables configured");

  info("\nChecking production domain in Clerk Dashboard:");
  info("1. Go to https://dashboard.clerk.com");
  info("2. Select your application");
  info("3. Go to Settings > Domains");
  info(`4. Ensure ${PRODUCTION_URL} is listed as a production domain`);
  info("5. Check that cookies are configured for production domain");

  return true;
}

async function generateCurlCommands() {
  section("9. CURL COMMANDS FOR MANUAL TESTING");

  console.log("\n" + colors.bright + "Test without authentication:" + colors.reset);
  console.log(
    colors.dim +
      `curl -X GET "${PRODUCTION_URL}/api/admin/articles?includeStats=true" \\
  -H "Accept: application/json" \\
  -v` +
      colors.reset
  );

  if (CLERK_SESSION_COOKIE) {
    console.log("\n" + colors.bright + "Test with session cookie:" + colors.reset);
    console.log(
      colors.dim +
        `curl -X GET "${PRODUCTION_URL}/api/admin/articles?includeStats=true" \\
  -H "Accept: application/json" \\
  -H "Cookie: __session=${CLERK_SESSION_COOKIE}" \\
  -v` +
        colors.reset
    );
  }

  if (CLERK_SESSION_TOKEN) {
    console.log("\n" + colors.bright + "Test with bearer token:" + colors.reset);
    console.log(
      colors.dim +
        `curl -X GET "${PRODUCTION_URL}/api/admin/articles?includeStats=true" \\
  -H "Accept: application/json" \\
  -H "Authorization: Bearer ${CLERK_SESSION_TOKEN}" \\
  -v` +
        colors.reset
    );
  }

  console.log("\n" + colors.bright + "Test CORS preflight:" + colors.reset);
  console.log(
    colors.dim +
      `curl -X OPTIONS "${PRODUCTION_URL}/api/admin/articles" \\
  -H "Origin: ${PRODUCTION_URL}" \\
  -H "Access-Control-Request-Method: GET" \\
  -H "Access-Control-Request-Headers: Accept, Content-Type" \\
  -v` +
      colors.reset
  );
}

async function analyzeProblem(results: Record<string, boolean>) {
  section("DIAGNOSIS AND RECOMMENDATIONS");

  // Analyze results and provide specific recommendations
  if (!results.basic) {
    error("CRITICAL: Cannot connect to production server");
    info("Recommendations:");
    info("1. Check if the production URL is correct");
    info("2. Verify deployment status on Vercel");
    info("3. Check for DNS or SSL issues");
    return;
  }

  if (!results.public) {
    warning("Public API not working properly");
    info("This might indicate a general API issue, not just auth");
  }

  if (!results.adminWithoutAuth) {
    error("Security check failed - admin API might be exposed");
  }

  if (!results.adminWithCookie && !results.adminWithToken) {
    error("ROOT CAUSE: Authentication not working in production");
    info("\nPossible causes:");
    info("1. Clerk session cookies not being sent with fetch requests");
    info("2. Production domain not configured in Clerk");
    info("3. Cookie SameSite or Secure settings preventing transmission");
    info("4. Middleware not correctly handling Clerk auth for API routes");

    info("\nRecommended fixes:");
    info("1. Check Clerk Dashboard > Settings > Domains");
    info(`   - Ensure ${PRODUCTION_URL} is listed`);
    info("   - Check cookie domain settings");
    info("2. In article-management.tsx, ensure fetch uses:");
    info('   credentials: "include" (already present)');
    info("3. Check if Clerk JWT template includes isAdmin claim");
    info("4. Verify CLERK_SECRET_KEY in Vercel environment variables");
    info("5. Check browser DevTools > Network > Request Headers for cookies");
  } else if (results.adminWithCookie && !results.adminWithToken) {
    success("Cookie-based auth works but not bearer token");
    info("The application is correctly using cookie-based authentication");
  } else if (!results.adminWithCookie && results.adminWithToken) {
    warning("Bearer token works but not cookies");
    info("Consider switching to bearer token authentication in the frontend");
  }

  if (!results.clerk) {
    error("Clerk configuration issues detected");
    info("Review the Clerk environment variables above");
  }
}

// Main execution
async function main() {
  console.clear();
  log(
    `
╔══════════════════════════════════════════════════════════════════════════════╗
║                  PRODUCTION ARTICLES API DEBUGGING TOOL                      ║
╚══════════════════════════════════════════════════════════════════════════════╝
`,
    colors.bright + colors.cyan
  );

  log(`Production URL: ${colors.yellow}${PRODUCTION_URL}${colors.reset}`);
  log(
    `Session Cookie: ${CLERK_SESSION_COOKIE ? colors.green + "✓ Provided" : colors.red + "✗ Not provided"}${colors.reset}`
  );
  log(
    `Session Token: ${CLERK_SESSION_TOKEN ? colors.green + "✓ Provided" : colors.red + "✗ Not provided"}${colors.reset}`
  );

  const results: Record<string, boolean> = {};

  // Run all tests
  results.basic = await testBasicConnectivity();
  results.public = await testPublicAPI();
  results.adminWithoutAuth = await testAdminAPIWithoutAuth();
  results.adminWithCookie = await testAdminAPIWithCookie();
  results.adminWithToken = await testAdminAPIWithBearerToken();
  results.cors = await testCORSHeaders();
  await simulateBrowserFetch();
  results.clerk = await checkClerkConfiguration();
  await generateCurlCommands();

  // Provide diagnosis
  await analyzeProblem(results);

  // Summary
  section("TEST SUMMARY");
  Object.entries(results).forEach(([test, passed]) => {
    if (passed) {
      success(`${test}: PASSED`);
    } else {
      error(`${test}: FAILED`);
    }
  });

  console.log("\n" + "=".repeat(80));
  info("For more detailed debugging:");
  info("1. Check browser DevTools > Network tab when loading /admin");
  info("2. Look for the /api/admin/articles request");
  info("3. Check Request Headers for Cookie or Authorization headers");
  info("4. Check Response Headers for any error details");
  info("5. Open Console and check for any JavaScript errors");
  console.log("=".repeat(80) + "\n");
}

// Run the script
main().catch(console.error);
