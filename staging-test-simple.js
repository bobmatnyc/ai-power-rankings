const { chromium } = require("playwright");
const fs = require("fs");

async function testStagingSiteSimple() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Console monitoring
  const consoleMessages = [];
  const networkErrors = [];

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
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const loadTime = Date.now() - startTime;
    console.log(`✅ Page loaded successfully in ${loadTime}ms`);

    // Take initial screenshot
    await page.screenshot({
      path: "/Users/masa/Projects/managed/ai-power-ranking/test-screenshots/staging-initial.png",
      fullPage: true,
    });
    console.log("📸 Initial screenshot captured");

    // Wait a bit more for dynamic content
    await page.waitForTimeout(3000);

    // 2. Check page content without strict selectors
    console.log("\n2. 🏆 Content Analysis");

    const pageContent = await page.content();
    console.log(`Page content length: ${pageContent.length} characters`);

    // Look for any numbered lists or ranking indicators
    const numberedElements = await page.$$eval("*", (elements) => {
      const numbered = [];
      elements.forEach((el) => {
        const text = el.textContent || "";
        // Look for patterns like "#1", "1.", etc.
        if (text.match(/^\s*#?\d+\.?\s/) || text.match(/rank\s*#?\d+/i)) {
          numbered.push({
            tagName: el.tagName,
            text: text.substring(0, 100),
            className: el.className,
          });
        }
      });
      return numbered.slice(0, 10); // First 10 matches
    });

    console.log(`Found ${numberedElements.length} potentially ranked elements:`);
    numberedElements.forEach((el, i) => {
      console.log(`  ${i + 1}. ${el.tagName}.${el.className}: ${el.text.trim()}`);
    });

    // Look for any repeated card-like structures
    const cardStructures = await page.$$eval("div, article, section", (elements) => {
      const structures = {};
      elements.forEach((el) => {
        const classes = el.className || "no-class";
        if (
          classes.includes("card") ||
          classes.includes("item") ||
          classes.includes("tool") ||
          classes.includes("ranking")
        ) {
          structures[classes] = (structures[classes] || 0) + 1;
        }
      });
      return Object.entries(structures).filter(([_, count]) => count > 5);
    });

    console.log("Repeated card-like structures:", cardStructures);

    // Screenshot after content analysis
    await page.screenshot({
      path: "/Users/masa/Projects/managed/ai-power-ranking/test-screenshots/staging-content.png",
      fullPage: true,
    });

    // 3. API Endpoint Tests
    console.log("\n3. 🔌 API Endpoint Tests");

    const apiTests = [
      { endpoint: "/api/rankings", name: "Rankings API" },
      { endpoint: "/api/news/recent?days=7", name: "Recent News API" },
      { endpoint: "/api/tools", name: "Tools API" },
    ];

    for (const test of apiTests) {
      try {
        console.log(`Testing ${test.name}...`);
        const response = await page.request.get(
          `https://staging.aipowerranking.com${test.endpoint}`
        );

        console.log(`  Status: ${response.status()}`);

        if (response.ok()) {
          const data = await response.json();

          if (Array.isArray(data)) {
            console.log(`  ✅ Array response with ${data.length} items`);
            if (data.length > 0) {
              console.log(`  Sample item keys: ${Object.keys(data[0] || {}).join(", ")}`);
            }
          } else if (typeof data === "object") {
            console.log(`  ✅ Object response with keys: ${Object.keys(data).join(", ")}`);

            // Check for common data properties
            ["tools", "rankings", "articles", "data"].forEach((prop) => {
              if (data[prop] && Array.isArray(data[prop])) {
                console.log(`    ${prop}: ${data[prop].length} items`);
              }
            });
          }
        } else {
          console.log(`  ❌ Failed with status ${response.status()}: ${response.statusText()}`);
        }
      } catch (error) {
        console.log(`  ❌ Error testing ${test.name}: ${error.message}`);
      }
    }

    // 4. Look for any text mentioning tools or rankings
    console.log("\n4. 📊 Text Content Analysis");

    const textContent = await page.evaluate(() => {
      const text = document.body.textContent || "";
      const words = text.toLowerCase();

      return {
        hasRankings: words.includes("ranking") || words.includes("rank"),
        hasTools: words.includes("tool") || words.includes("ai"),
        hasNews: words.includes("news") || words.includes("article"),
        hasScores: words.includes("score") || words.includes("rating"),
        totalLength: text.length,
        preview: text.substring(0, 500),
      };
    });

    console.log("Text content analysis:", {
      hasRankings: textContent.hasRankings,
      hasTools: textContent.hasTools,
      hasNews: textContent.hasNews,
      hasScores: textContent.hasScores,
      totalLength: textContent.totalLength,
    });

    console.log("Page preview:", textContent.preview);

    // 5. Authentication Check
    console.log("\n5. 🔐 Authentication Check");

    const authElements = await page.$$eval("*", (elements) => {
      const authRelated = [];
      elements.forEach((el) => {
        const text = el.textContent || "";
        const attrs = Array.from(el.attributes || [])
          .map((attr) => attr.name + "=" + attr.value)
          .join(" ");

        if (
          text.toLowerCase().includes("sign") ||
          text.toLowerCase().includes("login") ||
          text.toLowerCase().includes("auth") ||
          attrs.includes("clerk") ||
          attrs.includes("auth")
        ) {
          authRelated.push({
            tagName: el.tagName,
            text: text.substring(0, 50),
            hasClerk: attrs.includes("clerk"),
          });
        }
      });
      return authRelated.slice(0, 10);
    });

    console.log(`Found ${authElements.length} authentication-related elements:`);
    authElements.forEach((el, i) => {
      console.log(`  ${i + 1}. ${el.tagName}: ${el.text.trim()} ${el.hasClerk ? "(Clerk)" : ""}`);
    });

    // 6. Performance and Console Analysis
    console.log("\n6. ⚡ Performance and Console Analysis");
    console.log(`Page load time: ${loadTime}ms`);
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
      errors.slice(0, 10).forEach((error) => {
        console.log(`  - ${error.text}`);
      });
    }

    // Show warnings
    const warnings = consoleMessages.filter((msg) => msg.type === "warning");
    if (warnings.length > 0) {
      console.log("\n⚠️  Console Warnings:");
      warnings.slice(0, 5).forEach((warning) => {
        console.log(`  - ${warning.text}`);
      });
    }

    // Show network errors
    if (networkErrors.length > 0) {
      console.log("\n🌐 Network Errors:");
      networkErrors.slice(0, 10).forEach((error) => {
        console.log(`  - ${error.status} ${error.statusText}: ${error.url}`);
      });
    }

    // Final page screenshot
    await page.screenshot({
      path: "/Users/masa/Projects/managed/ai-power-ranking/test-screenshots/staging-final.png",
      fullPage: true,
    });

    // Generate simplified test report
    const report = {
      testDate: new Date().toISOString(),
      url: "https://staging.aipowerranking.com/en",
      results: {
        pageLoad: {
          success: true,
          loadTime: loadTime,
          status: "PASS",
        },
        content: {
          hasRankingContent: textContent.hasRankings,
          hasToolContent: textContent.hasTools,
          hasNewsContent: textContent.hasNews,
          rankedElements: numberedElements.length,
          status: textContent.hasRankings && textContent.hasTools ? "PASS" : "PARTIAL",
        },
        authentication: {
          elementsFound: authElements.length,
          hasClerkElements: authElements.some((el) => el.hasClerk),
          status: authElements.length > 0 ? "PASS" : "FAIL",
        },
        console: {
          totalMessages: consoleMessages.length,
          errors: errors.length,
          warnings: warnings.length,
          status: errors.length === 0 ? "PASS" : "FAIL",
        },
        network: {
          errors: networkErrors.length,
          status: networkErrors.length === 0 ? "PASS" : "FAIL",
        },
      },
      consoleMessages: consoleMessages,
      networkErrors: networkErrors,
      contentAnalysis: textContent,
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

    console.log("\n✅ Test completed successfully!");
    console.log("📁 Screenshots saved to: test-screenshots/");
    console.log("📄 Detailed report saved to: staging-test-report.json");
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

testStagingSiteSimple();
