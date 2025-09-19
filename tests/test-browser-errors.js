const { chromium } = require('playwright');

async function testBrowserErrors() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console logs and errors
  const consoleMessages = [];
  const errors = [];

  page.on('console', (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
    console.log(`Console [${msg.type()}]:`, msg.text());
  });

  page.on('pageerror', (error) => {
    errors.push({
      message: error.message,
      stack: error.stack
    });
    console.log('Page Error:', error.message);
    console.log('Stack:', error.stack);
  });

  // Monitor network requests for failed chunks
  page.on('response', (response) => {
    if (!response.ok()) {
      console.log(`Failed request: ${response.url()} - Status: ${response.status()}`);
    }
  });

  try {
    console.log('🌐 Navigating to http://localhost:3001...');
    await page.goto('http://localhost:3001', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for any dynamic imports to load
    await page.waitForTimeout(5000);

    console.log('\n📊 Summary:');
    console.log(`Console messages: ${consoleMessages.length}`);
    console.log(`Errors: ${errors.length}`);

    // Look for the specific error pattern
    const callErrors = consoleMessages.filter(msg =>
      msg.text.includes("Cannot read properties of undefined (reading 'call')")
    );

    if (callErrors.length > 0) {
      console.log('\n🔴 Found "call" errors:');
      callErrors.forEach((error, index) => {
        console.log(`Error ${index + 1}:`, error);
      });
    }

    // Check for any chunk loading errors
    const chunkErrors = consoleMessages.filter(msg =>
      msg.text.includes('Loading chunk') ||
      msg.text.includes('Loading CSS chunk') ||
      msg.text.includes('ChunkLoadError')
    );

    if (chunkErrors.length > 0) {
      console.log('\n🟡 Chunk loading issues:');
      chunkErrors.forEach((error, index) => {
        console.log(`Chunk Error ${index + 1}:`, error);
      });
    }

    // Take a screenshot
    await page.screenshot({ path: '/Users/masa/Projects/managed/ai-power-ranking/browser-test-screenshot.png' });
    console.log('\n📸 Screenshot saved as browser-test-screenshot.png');

    // Return results
    return {
      success: errors.length === 0 && callErrors.length === 0,
      consoleMessages,
      errors,
      callErrors,
      chunkErrors
    };

  } catch (error) {
    console.error('Test failed:', error);
    return { success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

testBrowserErrors().then(results => {
  console.log('\n✅ Test completed');
  if (!results.success) {
    process.exit(1);
  }
}).catch(console.error);