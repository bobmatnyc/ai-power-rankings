#!/usr/bin/env npx tsx
/**
 * Production Authentication Verification Script
 *
 * This script verifies that your Clerk authentication is working correctly
 * with the isAdmin metadata you've configured.
 *
 * Run with: npx tsx scripts/verify-production-auth.ts
 */

const PRODUCTION_URL = "https://ai-power-ranking.vercel.app";

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

function section(title: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${colors.cyan}${colors.bright}${title}${colors.reset}`);
  console.log("=".repeat(60));
}

async function testEndpoint(path: string, description: string) {
  console.log(`\n${colors.bright}Testing: ${description}${colors.reset}`);
  console.log("-".repeat(40));

  try {
    const response = await fetch(`${PRODUCTION_URL}${path}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    const contentType = response.headers.get("Content-Type") || "";
    console.log(`Content-Type: ${contentType}`);

    if (contentType.includes("application/json")) {
      const data = await response.json();
      console.log("Response:", JSON.stringify(data, null, 2));

      if (response.status === 401) {
        warning("Authentication required - this is expected without session cookies");
      } else if (response.status === 403) {
        warning("Forbidden - admin privileges required");
        if (data.help) {
          info(data.help);
        }
      } else if (response.status === 200) {
        success("Endpoint accessible!");
      }
    } else {
      const text = await response.text();
      if (text.includes("<!DOCTYPE html>") || text.includes("<html")) {
        error("Received HTML instead of JSON - middleware might be redirecting");
        console.log("First 200 chars:", text.substring(0, 200));
      } else {
        console.log("Response:", text.substring(0, 500));
      }
    }
  } catch (err) {
    error(`Failed to test endpoint: ${err}`);
  }
}

async function main() {
  console.clear();
  console.log(`${colors.bright}${colors.cyan}
╔══════════════════════════════════════════════════════════════╗
║           PRODUCTION AUTH VERIFICATION SCRIPT                ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);

  section("TESTING API ENDPOINTS");

  // Test public endpoints
  await testEndpoint("/api/health", "Health Check (Public)");
  await testEndpoint("/api/rankings", "Rankings API (Public)");

  // Test protected endpoints
  await testEndpoint("/api/admin/articles?includeStats=true", "Admin Articles API (Protected)");

  section("BROWSER VERIFICATION STEPS");

  console.log(`${colors.bright}1. Clear Browser Data:${colors.reset}`);
  console.log("   - Go to: chrome://settings/cookies/detail?site=ai-power-ranking.vercel.app");
  console.log("   - Or manually clear cookies for ai-power-ranking.vercel.app");
  console.log("   - Also clear for: clerk.ai-power-ranking.vercel.app\n");

  console.log(`${colors.bright}2. Sign In Fresh:${colors.reset}`);
  console.log(`   - Visit: ${PRODUCTION_URL}/sign-in`);
  console.log("   - Complete the sign-in process");
  console.log("   - You should be redirected to the home page\n");

  console.log(`${colors.bright}3. Verify Session in Browser Console:${colors.reset}`);
  console.log("   Open DevTools Console (F12) and run these commands:\n");

  console.log(`${colors.cyan}   // Check if Clerk is loaded`);
  console.log(`   typeof Clerk${colors.reset}`);
  console.log("   Expected: 'object'\n");

  console.log(`${colors.cyan}   // Check your session`);
  console.log(`   await Clerk.session${colors.reset}`);
  console.log("   Expected: Session object with id, status, etc.\n");

  console.log(`${colors.cyan}   // Check your user metadata`);
  console.log(`   Clerk.user?.publicMetadata${colors.reset}`);
  console.log("   Expected: { isAdmin: true }\n");

  console.log(`${colors.cyan}   // Test API directly from browser`);
  console.log(
    `   fetch('/api/admin/articles?includeStats=true', {
     credentials: 'include',
     headers: { 'Accept': 'application/json' }
   }).then(r => r.json()).then(console.log)${colors.reset}`
  );
  console.log("   Expected: Array of articles or empty array\n");

  console.log(`${colors.bright}4. Check Cookies:${colors.reset}`);
  console.log("   - Open DevTools > Application > Cookies");
  console.log("   - Look for __session cookie");
  console.log("   - Should have:");
  console.log("     • Domain: .ai-power-ranking.vercel.app (or ai-power-ranking.vercel.app)");
  console.log("     • Path: /");
  console.log("     • HttpOnly: ✓");
  console.log("     • Secure: ✓");
  console.log("     • SameSite: Lax or None\n");

  console.log(`${colors.bright}5. Visit Admin Panel:${colors.reset}`);
  console.log(`   - Go to: ${PRODUCTION_URL}/admin`);
  console.log("   - The articles should load successfully\n");

  section("TROUBLESHOOTING");

  console.log(`${colors.bright}If still not working:${colors.reset}\n`);

  console.log("1. Verify Clerk Dashboard Settings:");
  console.log('   - User\'s publicMetadata has: { "isAdmin": true }');
  console.log("   - Note: Use double quotes in JSON, not single quotes\n");

  console.log("2. Check Session Token Template:");
  console.log("   - Go to Clerk Dashboard > Sessions > Edit JWT Template");
  console.log("   - Ensure publicMetadata is included in the token\n");

  console.log("3. Force Metadata Refresh:");
  console.log("   - Sign out completely");
  console.log("   - Wait 30 seconds");
  console.log("   - Sign in again\n");

  console.log("4. Check Vercel Function Logs:");
  console.log("   - Go to Vercel Dashboard > Functions > Logs");
  console.log("   - Look for /api/admin/articles logs");
  console.log("   - Check for specific error messages\n");

  section("QUICK FIX COMMANDS");

  console.log("If you need to manually test with curl:\n");

  console.log(`${colors.cyan}# Get your session token from browser`);
  console.log("# DevTools > Application > Cookies > __session");
  console.log('SESSION_TOKEN="your-session-token-here"\n');

  console.log("# Test with curl");
  console.log(
    `curl -H "Cookie: __session=$SESSION_TOKEN" \\
     -H "Accept: application/json" \\
     ${PRODUCTION_URL}/api/admin/articles?includeStats=true | jq .${colors.reset}`
  );

  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `${colors.green}${colors.bright}Script complete! Follow the browser steps above.${colors.reset}`
  );
  console.log("=".repeat(60));
}

main().catch(console.error);
