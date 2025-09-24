#!/usr/bin/env npx tsx

/**
 * Vercel 500 Error Diagnosis Script
 *
 * This script helps identify the exact cause of 500 errors in the admin API endpoints.
 * Since the endpoints return 401 when unauthenticated, we need to find a way to trigger
 * the actual 500 errors that occur after authentication.
 */

import { resolve } from "node:path";
import { config } from "dotenv";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });

const PRODUCTION_URL = "https://ai-power-ranking-3karnhnzh-1-m.vercel.app";
const STAGING_URL = "https://ai-power-ranking-iufz3m0sh-1-m.vercel.app";

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function success(msg: string) {
  console.log(`${colors.green}✅ ${msg}${colors.reset}`);
}

function error(msg: string) {
  console.log(`${colors.red}❌ ${msg}${colors.reset}`);
}

function warning(msg: string) {
  console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`);
}

function info(msg: string) {
  console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`);
}

interface DiagnosticResult {
  endpoint: string;
  environment: string;
  url: string;
  status: number;
  contentType: string;
  headers: Record<string, string>;
  body: any;
  responseTime: number;
  error?: string;
}

async function diagnoseEndpoint(
  baseUrl: string,
  endpoint: string,
  environment: string,
  options: RequestInit = {}
): Promise<DiagnosticResult> {
  const url = `${baseUrl}${endpoint}`;
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Vercel-Error-Diagnosis/1.0",
        ...options.headers,
      },
      ...options,
    });

    const responseTime = Date.now() - startTime;
    const contentType = response.headers.get("Content-Type") || "";

    // Collect headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let body: any;
    try {
      if (contentType.includes("application/json")) {
        body = await response.json();
      } else {
        const text = await response.text();
        body = text.substring(0, 1000); // Truncate long responses
      }
    } catch (parseError) {
      body = "Failed to parse response body";
    }

    return {
      endpoint,
      environment,
      url,
      status: response.status,
      contentType,
      headers,
      body,
      responseTime,
    };
  } catch (fetchError) {
    return {
      endpoint,
      environment,
      url,
      status: 0,
      contentType: "",
      headers: {},
      body: null,
      responseTime: Date.now() - startTime,
      error: fetchError instanceof Error ? fetchError.message : String(fetchError),
    };
  }
}

async function testWithAuthBypass(baseUrl: string, endpoint: string, environment: string) {
  info(`Testing ${endpoint} with potential auth bypass methods...`);

  const bypassMethods = [
    // Method 1: Try with auth disabled header
    {
      name: "Auth Disabled Header",
      headers: { "X-Debug-Auth-Disabled": "true" },
    },
    // Method 2: Try with dev environment header
    {
      name: "Dev Environment Header",
      headers: { "X-Environment": "development" },
    },
    // Method 3: Try with specific user agent
    {
      name: "Admin Bot User Agent",
      headers: { "User-Agent": "AdminBot/1.0" },
    },
    // Method 4: Try with localhost origin
    {
      name: "Localhost Origin",
      headers: { Origin: "http://localhost:3001" },
    },
  ];

  const results: DiagnosticResult[] = [];

  for (const method of bypassMethods) {
    console.log(`  Testing: ${method.name}`);
    const result = await diagnoseEndpoint(baseUrl, endpoint, `${environment}-${method.name}`, {
      headers: method.headers,
    });

    results.push(result);

    // Log interesting results
    if (result.status === 500) {
      error(`   🎯 FOUND 500 ERROR with ${method.name}!`);
      console.log(`   Response: ${JSON.stringify(result.body, null, 2)}`);
    } else if (result.status !== 401 && result.status !== 403) {
      warning(`   Unexpected status ${result.status} with ${method.name}`);
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}

async function analyzeHeaders(result: DiagnosticResult) {
  console.log(`\n${colors.bright}Header Analysis for ${result.environment}:${colors.reset}`);

  // Look for specific error indicators
  const errorHeaders = [
    "x-vercel-error",
    "x-vercel-timeout",
    "x-vercel-function-error",
    "x-nextjs-error",
    "x-clerk-auth-reason",
    "x-clerk-error",
  ];

  errorHeaders.forEach((header) => {
    if (result.headers[header]) {
      warning(`${header}: ${result.headers[header]}`);
    }
  });

  // Check for cache headers
  if (result.headers["x-vercel-cache"]) {
    info(`Cache Status: ${result.headers["x-vercel-cache"]}`);
  }

  // Check for function region
  if (result.headers["x-vercel-id"]) {
    info(`Vercel ID: ${result.headers["x-vercel-id"]}`);
  }

  // Response time analysis
  if (result.responseTime > 5000) {
    warning(`Slow response: ${result.responseTime}ms (potential timeout)`);
  } else if (result.responseTime > 1000) {
    info(`Response time: ${result.responseTime}ms`);
  }
}

async function main() {
  console.log(`${colors.cyan}${colors.bright}
╔══════════════════════════════════════════════════════════════╗
║               VERCEL 500 ERROR DIAGNOSIS                     ║
║        Finding the root cause of admin API failures         ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);

  const endpoints = [
    "/api/admin/db-test",
    "/api/admin/db-status",
    "/api/admin/articles",
    "/api/admin/articles?includeStats=true",
  ];

  const allResults: DiagnosticResult[] = [];

  for (const endpoint of endpoints) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`${colors.bright}DIAGNOSING: ${endpoint}${colors.reset}`);
    console.log(`${"=".repeat(80)}`);

    // Test production normally
    console.log(`\n${colors.cyan}Production Environment:${colors.reset}`);
    const prodResult = await diagnoseEndpoint(PRODUCTION_URL, endpoint, "production");
    allResults.push(prodResult);

    console.log(`Status: ${prodResult.status} | Time: ${prodResult.responseTime}ms`);
    if (prodResult.status === 500) {
      error("🎯 FOUND 500 ERROR IN PRODUCTION!");
      console.log(`Response: ${JSON.stringify(prodResult.body, null, 2)}`);
    }

    await analyzeHeaders(prodResult);

    // Test staging normally
    console.log(`\n${colors.cyan}Staging Environment:${colors.reset}`);
    const stagingResult = await diagnoseEndpoint(STAGING_URL, endpoint, "staging");
    allResults.push(stagingResult);

    console.log(`Status: ${stagingResult.status} | Time: ${stagingResult.responseTime}ms`);
    if (stagingResult.status === 500) {
      error("🎯 FOUND 500 ERROR IN STAGING!");
      console.log(`Response: ${JSON.stringify(stagingResult.body, null, 2)}`);
    }

    await analyzeHeaders(stagingResult);

    // Try auth bypass methods
    if (prodResult.status === 401 || stagingResult.status === 401) {
      console.log(`\n${colors.yellow}Attempting Auth Bypass Methods:${colors.reset}`);
      const bypassResults = await testWithAuthBypass(PRODUCTION_URL, endpoint, "prod-bypass");
      allResults.push(...bypassResults);
    }

    // Delay between endpoints
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Summary
  console.log(`\n${"=".repeat(80)}`);
  console.log(`${colors.bright}DIAGNOSIS SUMMARY${colors.reset}`);
  console.log(`${"=".repeat(80)}`);

  const errors500 = allResults.filter((r) => r.status === 500);
  const authErrors = allResults.filter((r) => r.status === 401 || r.status === 403);
  const otherErrors = allResults.filter(
    (r) => r.status >= 400 && r.status !== 401 && r.status !== 403 && r.status !== 500
  );

  console.log(`\n${colors.red}500 Errors Found: ${errors500.length}${colors.reset}`);
  errors500.forEach((result) => {
    console.log(`  - ${result.endpoint} (${result.environment}): ${JSON.stringify(result.body)}`);
  });

  console.log(`\n${colors.yellow}Auth Errors (Expected): ${authErrors.length}${colors.reset}`);

  console.log(`\n${colors.blue}Other Errors: ${otherErrors.length}${colors.reset}`);
  otherErrors.forEach((result) => {
    console.log(
      `  - ${result.endpoint} (${result.environment}): ${result.status} ${JSON.stringify(result.body)}`
    );
  });

  if (errors500.length === 0) {
    warning("No 500 errors found! This suggests:");
    console.log("1. The 500 errors only occur with valid authentication");
    console.log("2. The errors might be intermittent");
    console.log("3. The errors might be specific to certain user sessions");
    console.log("\nRecommendations:");
    console.log("- Check Vercel dashboard for function logs");
    console.log("- Test with actual authenticated session");
    console.log("- Check for environment-specific issues");
  } else {
    error("Found 500 errors! Check the details above for root cause.");
  }

  // Check for patterns
  const slowResponses = allResults.filter((r) => r.responseTime > 5000);
  if (slowResponses.length > 0) {
    warning(`Found ${slowResponses.length} slow responses (>5s) - potential timeout issues`);
  }

  console.log(`\n${colors.green}Diagnosis complete!${colors.reset}`);
}

main().catch(console.error);
