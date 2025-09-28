const { chromium } = require("playwright");
const fs = require("fs");

async function testStagingSite() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Console monitoring
  const consoleMessages = [];
  const networkErrors = [];
  const performanceMetrics = {};

  page.on("console", (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date().toISOString(),
    });
  });

  page.on("response", (response) => {
    if (response.status() >= 400) {
      networkErrors.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
      });
    }
  });

  try {
    console.log("🚀 Starting staging site test at https://staging.aipowerranking.com/en");

    // Performance timing start
    const startTime = Date.now();

    // 1. Page Load Test
    console.log("\n1. 📄 Page Load Test");
    await page.goto("https://staging.aipowerranking.com/en", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    const loadTime = Date.now() - startTime;
    performanceMetrics.pageLoadTime = loadTime;
    console.log(`✅ Page loaded successfully in ${loadTime}ms`);

    // Take initial screenshot
    await page.screenshot({
      path: "/Users/masa/Projects/managed/ai-power-ranking/test-screenshots/staging-initial.png",
      fullPage: true,
    });
    console.log("📸 Initial screenshot captured");

    // 2. Rankings Display Test
    console.log("\n2. 🏆 Rankings Display Test");

    // Wait for rankings to load
    await page.waitForSelector(
      '[data-testid="rankings-section"], .rankings-container, .tool-card, [class*="ranking"]',
      { timeout: 10000 }
    );

    // Try multiple selectors for tool cards
    const toolSelectors = [
      ".tool-card",
      '[data-testid="tool-card"]',
      ".ranking-item",
      '[class*="tool"]',
      '[class*="ranking"]',
    ];

    let toolElements = [];
    for (const selector of toolSelectors) {
      toolElements = await page.$$(selector);
      if (toolElements.length > 0) {
        console.log(`Found ${toolElements.length} tools using selector: ${selector}`);
        break;
      }
    }

    if (toolElements.length === 0) {
      // Try to find any repeating elements that might be tools
      const allElements = await page.$$("div, article, section");
      console.log(`Found ${allElements.length} div/article/section elements total`);

      // Look for elements with rank-like content
      const potentialRankings = await page.$$eval("*", (elements) => {
        return elements.filter((el) => {
          const text = el.textContent || "";
          return text.match(/^\s*\d+\s*$/) || text.match(/#\d+/) || text.match(/rank\s*\d+/i);
        }).length;
      });
      console.log(`Found ${potentialRankings} elements with rank-like content`);
    }

    // Screenshot rankings section
    await page.screenshot({
      path: "/Users/masa/Projects/managed/ai-power-ranking/test-screenshots/staging-rankings.png",
      fullPage: true,
    });
    console.log("📸 Rankings screenshot captured");

    // 3. API Endpoint Tests
    console.log("\n3. 🔌 API Endpoint Tests");

    const apiTests = [
      { endpoint: "/api/rankings", expectedCount: 54 },
      { endpoint: "/api/news/recent?days=7", expectedProperty: "articles" },
      { endpoint: "/api/tools", expectedProperty: "tools" },
    ];

    for (const test of apiTests) {
      try {
        const response = await page.request.get(
          `https://staging.aipowerranking.com${test.endpoint}`
        );
        const data = await response.json();

        console.log(`${test.endpoint}: Status ${response.status()}`);

        if (test.expectedCount) {
          const count = Array.isArray(data)
            ? data.length
            : (data.tools || data.rankings || []).length;
          console.log(`  Expected ~${test.expectedCount} items, found: ${count}`);
        }

        if (test.expectedProperty && data[test.expectedProperty]) {
          console.log(`  ✅ Property '${test.expectedProperty}' exists`);
        }

        console.log(`  Sample data keys: ${Object.keys(data).slice(0, 5).join(", ")}`);
      } catch (error) {
        console.log(`  ❌ Error testing ${test.endpoint}: ${error.message}`);
      }
    }

    // 4. News Section Test
    console.log("\n4. 📰 News Section Test");

    const newsSelectors = [
      ".news-card",
      '[data-testid="news-card"]',
      ".news-item",
      ".article-card",
      '[class*="news"]',
    ];

    let newsElements = [];
    for (const selector of newsSelectors) {
      newsElements = await page.$$(selector);
      if (newsElements.length > 0) {
        console.log(`Found ${newsElements.length} news items using selector: ${selector}`);
        break;
      }
    }

    if (newsElements.length === 0) {
      console.log("⚠️  No news elements found with standard selectors");
      // Look for date patterns that might indicate news articles
      const dateElements = await page.$$eval("*", (elements) => {
        return elements.filter((el) => {
          const text = el.textContent || "";
          return (
            text.match(/\d{4}-\d{2}-\d{2}/) ||
            text.match(/\d{1,2}\/\d{1,2}\/\d{4}/) ||
            text.match(/\w+\s+\d{1,2},\s+\d{4}/)
          );
        }).length;
      });
      console.log(`Found ${dateElements} elements with date patterns`);
    }

    // 5. Authentication Check
    console.log("\n5. 🔐 Authentication Check");

    const authSelectors = [
      '[data-testid="sign-in"]',
      '[data-testid="sign-up"]',
      ".clerk-button",
      '[class*="auth"]',
      '[class*="sign"]',
      "button[data-clerk-element]",
    ];

    let authElements = 0;
    for (const selector of authSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        authElements += elements.length;
        console.log(`Found ${elements.length} auth elements with selector: ${selector}`);
      }
    }

    console.log(`Total authentication elements found: ${authElements}`);

    // 6. Performance and Console Analysis
    console.log("\n6. ⚡ Performance and Console Analysis");
    console.log(`Page load time: ${performanceMetrics.pageLoadTime}ms`);
    console.log(`Console messages: ${consoleMessages.length}`);
    console.log(`Network errors: ${networkErrors.length}`);

    // Analyze console messages by type
    const messagesByType = consoleMessages.reduce((acc, msg) => {
      acc[msg.type] = (acc[msg.type] || 0) + 1;
      return acc;
    }, {});

    console.log("Console message breakdown:", messagesByType);

    // Show critical errors
    const errors = consoleMessages.filter((msg) => msg.type === "error");
    if (errors.length > 0) {
      console.log("\n❌ Console Errors:");
      errors.slice(0, 5).forEach((error) => {
        console.log(`  - ${error.text}`);
      });
    }

    // Show network errors
    if (networkErrors.length > 0) {
      console.log("\n🌐 Network Errors:");
      networkErrors.slice(0, 5).forEach((error) => {
        console.log(`  - ${error.status} ${error.statusText}: ${error.url}`);
      });
    }

    // Final page screenshot
    await page.screenshot({
      path: "/Users/masa/Projects/managed/ai-power-ranking/test-screenshots/staging-final.png",
      fullPage: true,
    });

    // Generate test report
    const report = {
      testDate: new Date().toISOString(),
      url: "https://staging.aipowerranking.com/en",
      results: {
        pageLoad: {
          success: true,
          loadTime: performanceMetrics.pageLoadTime,
          status: "PASS",
        },
        rankings: {
          toolsFound: toolElements.length,
          expectedTools: 54,
          status: toolElements.length > 30 ? "PASS" : "PARTIAL",
        },
        news: {
          itemsFound: newsElements.length,
          status: newsElements.length > 0 ? "PASS" : "FAIL",
        },
        authentication: {
          elementsFound: authElements,
          status: authElements > 0 ? "PASS" : "FAIL",
        },
        console: {
          totalMessages: consoleMessages.length,
          errors: errors.length,
          status: errors.length === 0 ? "PASS" : "FAIL",
        },
        network: {
          errors: networkErrors.length,
          status: networkErrors.length === 0 ? "PASS" : "FAIL",
        },
      },
      consoleMessages: consoleMessages,
      networkErrors: networkErrors,
    };

    // Save detailed report
    fs.writeFileSync(
      "/Users/masa/Projects/managed/ai-power-ranking/staging-test-report.json",
      JSON.stringify(report, null, 2)
    );

    console.log("\n📊 Test Summary:");
    Object.entries(report.results).forEach(([test, result]) => {
      console.log(`${test}: ${result.status}`);
    });
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    await page.screenshot({
      path: "/Users/masa/Projects/managed/ai-power-ranking/test-screenshots/staging-error.png",
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
}

testStagingSite();
