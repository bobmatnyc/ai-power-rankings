#!/usr/bin/env npx tsx
/**
 * Live Production Authentication Test
 * Tests the actual production site at aipowerranking.com
 */

const PRODUCTION_URL = "https://aipowerranking.com";

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

async function testEndpoint(path: string, description: string) {
  console.log(`\n${colors.bright}Testing: ${description}${colors.reset}`);
  console.log(`URL: ${PRODUCTION_URL}${path}`);
  console.log("-".repeat(50));

  try {
    const response = await fetch(`${PRODUCTION_URL}${path}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      redirect: "manual", // Don't follow redirects automatically
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    const contentType = response.headers.get("Content-Type") || "";
    console.log(`Content-Type: ${contentType}`);

    // Check for redirects
    const location = response.headers.get("Location");
    if (location) {
      console.log(`Redirect to: ${location}`);
    }

    if (contentType.includes("application/json")) {
      const data = await response.json();
      console.log("Response:", JSON.stringify(data, null, 2));

      if (response.status === 200) {
        success("Endpoint accessible!");
      } else if (response.status === 401) {
        info("Authentication required (expected for protected routes)");
      } else if (response.status === 403) {
        warning("Admin privileges required");
      }
    } else if (contentType.includes("text/html")) {
      error("Received HTML instead of JSON");
      const text = await response.text();
      if (text.includes("sign-in") || text.includes("Sign In")) {
        info("Redirecting to sign-in page");
      }
    }
  } catch (err) {
    error(`Failed: ${err}`);
  }
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}
╔══════════════════════════════════════════════════════════════╗
║              LIVE PRODUCTION AUTH TEST                       ║
║                  ${PRODUCTION_URL}                  ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);

  // Test endpoints
  await testEndpoint("/api/health", "Health Check (Public)");
  await testEndpoint("/api/rankings", "Rankings API (Public)");
  await testEndpoint("/api/admin/articles?includeStats=true", "Admin Articles (Protected)");

  console.log(`\n${colors.cyan}${"=".repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}BROWSER TEST INSTRUCTIONS:${colors.reset}\n`);

  console.log("1. Visit: " + colors.cyan + PRODUCTION_URL + "/admin" + colors.reset);
  console.log("2. Sign in if prompted");
  console.log("3. Check if articles load\n");

  console.log(`${colors.bright}Browser Console Commands:${colors.reset}\n`);

  console.log("Test your session:");
  console.log(colors.cyan + "Clerk.user?.publicMetadata" + colors.reset);
  console.log("Should show: { isAdmin: true }\n");

  console.log("Test API directly:");
  console.log(
    colors.cyan +
      `fetch('/api/admin/articles?includeStats=true', {
  credentials: 'include',
  headers: { 'Accept': 'application/json' }
}).then(r => r.json()).then(console.log)` +
      colors.reset
  );

  console.log(`\n${colors.green}Test complete!${colors.reset}`);
}

main().catch(console.error);
