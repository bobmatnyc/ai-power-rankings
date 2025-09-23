#!/usr/bin/env npx tsx
/**
 * CORS and Cookie Configuration Debugging Script
 *
 * This script checks for common CORS and cookie configuration issues
 * that can prevent authentication from working in production.
 *
 * Run with: npx tsx scripts/debug-cors-cookies.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });

const PRODUCTION_URL = process.env["NEXT_PUBLIC_BASE_URL"] || "https://ai-power-ranking.vercel.app";

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

function section(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(`${colors.cyan}${colors.bright}${title}${colors.reset}`);
  console.log("=".repeat(60));
}

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

async function checkCookieConfiguration() {
  section("COOKIE CONFIGURATION ISSUES");

  info("Common cookie problems that break authentication:\n");

  console.log("1. SameSite Attribute Issues:");
  console.log("   Problem: SameSite=Strict prevents cookies in cross-origin requests");
  console.log("   Solution: Clerk should use SameSite=Lax or None (with Secure)");
  console.log("   Check: Look for Set-Cookie headers in login response\n");

  console.log("2. Secure Attribute:");
  console.log("   Problem: Secure cookies only work over HTTPS");
  console.log("   Solution: Ensure production uses HTTPS (Vercel does this automatically)");
  console.log(
    `   Current: ${PRODUCTION_URL.startsWith("https") ? "✅ Using HTTPS" : "❌ Not using HTTPS"}\n`
  );

  console.log("3. Domain Mismatch:");
  console.log("   Problem: Cookie domain doesn't match request domain");
  console.log("   Solution: Check Clerk Dashboard > Settings > Domains");
  console.log(
    `   Required: Cookie domain should match or be parent of ${new URL(PRODUCTION_URL).hostname}\n`
  );

  console.log("4. Path Issues:");
  console.log("   Problem: Cookie path too restrictive");
  console.log("   Solution: Cookies should have Path=/ for API access\n");

  console.log("5. HttpOnly Flag:");
  console.log("   Problem: HttpOnly cookies can't be accessed by JavaScript");
  console.log(
    '   Solution: This is actually good for security - just ensure credentials: "include"\n'
  );
}

async function checkCORSConfiguration() {
  section("CORS CONFIGURATION ANALYSIS");

  info("Testing CORS headers for the admin API...\n");

  try {
    // Test preflight request
    const response = await fetch(`${PRODUCTION_URL}/api/admin/articles`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.com",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Accept, Content-Type, Authorization",
      },
    });

    console.log(`Preflight Response Status: ${response.status}`);

    const corsHeaders = {
      "Access-Control-Allow-Origin": response.headers.get("access-control-allow-origin"),
      "Access-Control-Allow-Methods": response.headers.get("access-control-allow-methods"),
      "Access-Control-Allow-Headers": response.headers.get("access-control-allow-headers"),
      "Access-Control-Allow-Credentials": response.headers.get("access-control-allow-credentials"),
      "Access-Control-Max-Age": response.headers.get("access-control-max-age"),
    };

    console.log("\nCORS Headers Received:");
    Object.entries(corsHeaders).forEach(([header, value]) => {
      if (value) {
        console.log(`  ${header}: ${value}`);
      } else {
        console.log(`  ${header}: ${colors.yellow}(not set)${colors.reset}`);
      }
    });

    console.log("\nCORS Analysis:");

    // Check Allow-Origin
    if (!corsHeaders["Access-Control-Allow-Origin"]) {
      warning("No Access-Control-Allow-Origin header");
      info("This is OK if requests are same-origin (from same domain)");
    } else if (corsHeaders["Access-Control-Allow-Origin"] === "*") {
      warning("Using wildcard origin (*)");
      info("Cannot use credentials with wildcard origin");
    } else {
      success(`Origin allowed: ${corsHeaders["Access-Control-Allow-Origin"]}`);
    }

    // Check Allow-Credentials
    if (corsHeaders["Access-Control-Allow-Credentials"] === "true") {
      success("Credentials are allowed in CORS requests");
    } else {
      warning("Credentials not explicitly allowed");
      info("Add Access-Control-Allow-Credentials: true for cookie auth");
    }
  } catch (err) {
    error(`Failed to test CORS: ${err}`);
  }
}

async function testFetchModes() {
  section("FETCH MODES COMPARISON");

  const endpoints = [
    { path: "/api/health", name: "Health Check (Public)" },
    { path: "/api/rankings", name: "Rankings (Public)" },
    { path: "/api/admin/articles", name: "Admin Articles (Protected)" },
  ];

  for (const endpoint of endpoints) {
    console.log(`\n${colors.bright}Testing: ${endpoint.name}${colors.reset}`);
    console.log("-".repeat(40));

    // Test 1: No credentials
    try {
      const res1 = await fetch(`${PRODUCTION_URL}${endpoint.path}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      console.log(`No credentials: ${res1.status} ${res1.statusText}`);
    } catch (err) {
      console.log(`No credentials: Failed - ${err}`);
    }

    // Test 2: With credentials
    try {
      const res2 = await fetch(`${PRODUCTION_URL}${endpoint.path}`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      console.log(`With credentials: ${res2.status} ${res2.statusText}`);
    } catch (err) {
      console.log(`With credentials: Failed - ${err}`);
    }

    // Test 3: With same-origin
    try {
      const res3 = await fetch(`${PRODUCTION_URL}${endpoint.path}`, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      console.log(`Same-origin mode: ${res3.status} ${res3.statusText}`);
    } catch (err) {
      console.log(`Same-origin mode: Failed - ${err}`);
    }
  }
}

async function suggestFixes() {
  section("RECOMMENDED FIXES");

  console.log(`${colors.bright}1. Frontend Fix (article-management.tsx):${colors.reset}`);
  console.log(`   Current implementation uses credentials: 'include' ✅`);
  console.log("   This is correct for cookie-based authentication\n");

  console.log(`${colors.bright}2. Middleware Fix (middleware.ts):${colors.reset}`);
  console.log("   Ensure API routes are properly protected");
  console.log("   The current middleware correctly protects /api/admin/* routes ✅\n");

  console.log(`${colors.bright}3. Clerk Configuration:${colors.reset}`);
  console.log("   a) Go to Clerk Dashboard > Settings > Domains");
  console.log(`   b) Add production domain: ${PRODUCTION_URL}`);
  console.log(`   c) Ensure "Frontend API" is enabled for the domain`);
  console.log("   d) Check Session Token settings:\n");
  console.log("      - Token lifetime should be reasonable (not too short)");
  console.log("      - Include publicMetadata in session token claims\n");

  console.log(`${colors.bright}4. Vercel Environment Variables:${colors.reset}`);
  console.log("   Ensure these are set in Vercel Dashboard:");
  console.log("   - CLERK_SECRET_KEY (must match Clerk Dashboard)");
  console.log("   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  console.log("   - DATABASE_URL (for storing articles)\n");

  console.log(`${colors.bright}5. User Metadata:${colors.reset}`);
  console.log("   In Clerk Dashboard > Users > [Your User]:");
  console.log(`   Set Public Metadata: { "isAdmin": true }\n`);

  console.log(`${colors.bright}6. Browser Debugging:${colors.reset}`);
  console.log("   a) Open production site and login");
  console.log("   b) Open DevTools > Application > Cookies");
  console.log("   c) Look for __session cookie");
  console.log("   d) Check cookie attributes:");
  console.log("      - Domain should match or be parent of site domain");
  console.log("      - Path should be /");
  console.log("      - SameSite should be Lax or None");
  console.log("      - Secure should be true (for HTTPS)");
  console.log("   e) Open Network tab and find /api/admin/articles request");
  console.log("   f) Check Request Headers > Cookie header is present\n");

  console.log(`${colors.bright}7. Quick Test Commands:${colors.reset}`);
  console.log("   Run these in production browser console:\n");

  console.log(colors.cyan + "   // Check Clerk session");
  console.log("   await Clerk.session" + colors.reset);

  console.log(colors.cyan + "\n   // Check user metadata");
  console.log("   Clerk.user.publicMetadata" + colors.reset);

  console.log(colors.cyan + "\n   // Test API directly");
  console.log(
    `   fetch('/api/admin/articles?includeStats=true', {
     credentials: 'include',
     headers: { 'Accept': 'application/json' }
   }).then(r => r.json()).then(console.log)` + colors.reset
  );
}

async function main() {
  console.clear();
  console.log(`${colors.bright}${colors.cyan}
╔══════════════════════════════════════════════════════════════╗
║            CORS & COOKIE CONFIGURATION DEBUGGER             ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);

  await checkCookieConfiguration();
  await checkCORSConfiguration();
  await testFetchModes();
  await suggestFixes();

  section("NEXT STEPS");

  console.log("1. Run the browser console debug script in production");
  console.log("2. Check Clerk Dashboard configuration");
  console.log("3. Verify Vercel environment variables");
  console.log("4. If still failing, check Vercel Function Logs for server-side errors");
  console.log("\nFor detailed debugging, run:");
  console.log(`${colors.cyan}npx tsx scripts/debug-production-articles.ts${colors.reset}`);
}

main().catch(console.error);
