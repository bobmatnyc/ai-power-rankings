const { chromium } = require("playwright");

async function verifyStagingDeployment() {
  console.log("🚀 Starting staging deployment verification...");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  // Enable console logging
  const consoleMessages = [];
  const errors = [];

  page.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });
    if (type === "error") {
      console.log(`❌ Console Error: ${text}`);
      errors.push(text);
    } else if (type === "warning") {
      console.log(`⚠️  Console Warning: ${text}`);
    }
  });

  page.on("pageerror", (error) => {
    console.log(`💥 Page Error: ${error.message}`);
    errors.push(`Page Error: ${error.message}`);
  });

  try {
    console.log("📍 Navigating to staging URL...");
    const response = await page.goto("https://ai-power-ranking-4uyqy6ja2-1-m.vercel.app", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    console.log(`✅ Response status: ${response.status()}`);

    // Wait for page to load
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Check for error page content
    const errorText = await page.textContent("body").catch(() => "");
    if (errorText.includes("Something went wrong") || errorText.includes("Error 310")) {
      errors.push("Error page detected: Something went wrong or Error 310");
    }

    // Verify main content elements
    console.log("🔍 Verifying page content...");

    // Check for main heading
    const heading = await page
      .locator("h1")
      .first()
      .textContent()
      .catch(() => "");
    console.log(`📝 Main heading: "${heading}"`);

    // Check for navigation sidebar
    const sidebarExists = await page
      .locator('[data-sidebar="sidebar"]')
      .isVisible()
      .catch(() => false);
    console.log(`📋 Sidebar visible: ${sidebarExists}`);

    // Check for Claude Code #1 ranking
    const claudeCodeExists = await page
      .locator('text="Claude Code"')
      .isVisible()
      .catch(() => false);
    console.log(`🏆 Claude Code found: ${claudeCodeExists}`);

    // Check for #1 ranking badge
    const rankingBadge = await page
      .locator('text="#1"')
      .isVisible()
      .catch(() => false);
    console.log(`🥇 #1 ranking badge: ${rankingBadge}`);

    // Check for Explore Tools button
    const exploreButton = await page
      .locator('text="Explore All Tools"')
      .isVisible()
      .catch(() => false);
    console.log(`🔍 Explore Tools button: ${exploreButton}`);

    // Test navigation
    console.log("🧭 Testing navigation...");
    if (
      await page
        .locator('a[href*="/rankings"]')
        .isVisible()
        .catch(() => false)
    ) {
      await page.locator('a[href*="/rankings"]').first().click();
      await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
      console.log("✅ Rankings navigation works");
    }

    // Take screenshot
    console.log("📸 Taking homepage screenshot...");
    await page.goto("https://ai-power-ranking-4uyqy6ja2-1-m.vercel.app");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    await page.screenshot({
      path: "/Users/masa/Projects/managed/ai-power-ranking/staging-verification-screenshot.png",
      fullPage: true,
    });

    // Check Clerk headers for production keys
    const clerkHeaders = response.headers();
    const clerkAuthStatus = clerkHeaders["x-clerk-auth-status"] || "missing";
    console.log(`🔐 Clerk auth status: ${clerkAuthStatus}`);

    // Summary
    console.log("\n📊 VERIFICATION SUMMARY:");
    console.log(`✅ Site loads: ${response.status() === 200}`);
    console.log(`✅ No error page: ${!errorText.includes("Something went wrong")}`);
    console.log(`✅ Heading present: ${heading.includes("AI Power Ranking")}`);
    console.log(`✅ Sidebar visible: ${sidebarExists}`);
    console.log(`✅ Claude Code found: ${claudeCodeExists}`);
    console.log(`✅ #1 badge present: ${rankingBadge}`);
    console.log(`✅ Explore button present: ${exploreButton}`);
    console.log(`✅ Clerk configured: ${clerkAuthStatus === "signed-out"}`);
    console.log(`❌ Console errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log("\n🚨 CRITICAL ISSUES FOUND:");
      errors.forEach((error) => console.log(`  - ${error}`));
    }

    const success =
      response.status() === 200 &&
      !errorText.includes("Something went wrong") &&
      heading.includes("AI Power Ranking") &&
      sidebarExists &&
      claudeCodeExists &&
      rankingBadge &&
      exploreButton &&
      errors.length === 0;

    console.log(`\n🎯 FINAL VERDICT: ${success ? "✅ SUCCESS" : "❌ FAILURE"}`);

    return { success, errors, consoleMessages };
  } catch (error) {
    console.log(`💥 Test failed: ${error.message}`);
    errors.push(`Test execution error: ${error.message}`);
    return { success: false, errors, consoleMessages };
  } finally {
    await browser.close();
  }
}

// Run the verification
verifyStagingDeployment().then((result) => {
  process.exit(result.success ? 0 : 1);
});
