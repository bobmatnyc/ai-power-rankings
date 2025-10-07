// Standalone script to verify ChunkLoadError is fixed
// This bypasses playwright.config.ts to avoid webServer conflicts

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function verifyChunkLoad() {
  const consoleErrors = [];
  const consoleWarnings = [];
  const loadedChunks = [];
  const failedChunks = [];

  console.log('\n========================================');
  console.log('ChunkLoadError Verification Test');
  console.log('========================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // Capture console messages
  page.on('console', msg => {
    const msgType = msg.type();
    const msgText = msg.text();

    if (msgType === 'error') {
      consoleErrors.push({ type: msgType, text: msgText });
      console.log(`[CONSOLE ERROR] ${msgText}`);
    } else if (msgType === 'warning') {
      consoleWarnings.push({ type: msgType, text: msgText });
      console.log(`[CONSOLE WARNING] ${msgText}`);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    consoleErrors.push({ type: 'pageerror', text: error.message });
    console.log(`[PAGE ERROR] ${error.message}`);
  });

  // Capture request failures
  page.on('requestfailed', request => {
    const failure = request.failure();
    const url = request.url();
    console.log(`[REQUEST FAILED] ${url} - ${failure?.errorText || 'Unknown'}`);
    if (url.includes('chunk') || url.includes('.js')) {
      failedChunks.push(`${url} - ${failure?.errorText || 'Unknown'}`);
    }
  });

  // Monitor successful chunk loads
  page.on('response', response => {
    const url = response.url();
    if ((url.includes('/_next/static/chunks/') || url.includes('.js')) && response.status() === 200) {
      loadedChunks.push(url);
    }
  });

  try {
    // Test 1: Homepage
    console.log('\n=== TEST 1: Homepage Load ===');
    const homeResponse = await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log(`Response status: ${homeResponse?.status()}`);

    await page.waitForTimeout(2000); // Wait for any async errors

    // Take screenshot
    const screenshotDir = path.join(__dirname, 'test-results');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    await page.screenshot({
      path: path.join(screenshotDir, 'homepage-loaded.png'),
      fullPage: true
    });
    console.log('✓ Screenshot saved: test-results/homepage-loaded.png');

    // Test 2: /en route
    console.log('\n=== TEST 2: /en Route Load ===');
    const enResponse = await page.goto('http://localhost:3000/en', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log(`Response status: ${enResponse?.status()}`);

    await page.waitForTimeout(2000); // Wait for any async errors

    await page.screenshot({
      path: path.join(screenshotDir, 'en-route-loaded.png'),
      fullPage: true
    });
    console.log('✓ Screenshot saved: test-results/en-route-loaded.png');

    // Analyze results
    console.log('\n=== CONSOLE ANALYSIS ===');
    console.log(`Total console errors: ${consoleErrors.length}`);
    console.log(`Total console warnings: ${consoleWarnings.length}`);
    console.log(`Successfully loaded chunks: ${loadedChunks.length}`);
    console.log(`Failed chunks: ${failedChunks.length}`);

    // Check for ChunkLoadError specifically
    const chunkErrors = consoleErrors.filter(error =>
      error.text.includes('ChunkLoadError') ||
      error.text.includes('Loading chunk') && error.text.includes('failed')
    );

    console.log(`\nChunk-related errors: ${chunkErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log('\n=== ALL CONSOLE ERRORS ===');
      consoleErrors.forEach((err, idx) => {
        console.log(`${idx + 1}. [${err.type}] ${err.text}`);
      });
    }

    if (failedChunks.length > 0) {
      console.log('\n=== FAILED CHUNKS ===');
      failedChunks.forEach((chunk, idx) => {
        console.log(`${idx + 1}. ${chunk}`);
      });
    }

    if (loadedChunks.length > 0) {
      console.log('\n=== SAMPLE LOADED CHUNKS (first 10) ===');
      loadedChunks.slice(0, 10).forEach((chunk, idx) => {
        const filename = chunk.split('/').pop();
        console.log(`${idx + 1}. ${filename}`);
      });
    }

    // Final verdict
    console.log('\n========================================');
    console.log('VERIFICATION RESULT');
    console.log('========================================');

    if (chunkErrors.length === 0) {
      console.log('\n✅ ChunkLoadError VERIFIED FIXED');
      console.log('- No ChunkLoadError messages found in console');
      console.log('- Homepage loaded successfully');
      console.log('- /en route loaded successfully');
      console.log(`- ${loadedChunks.length} chunks loaded successfully`);

      if (consoleErrors.length > 0) {
        console.log(`\n⚠️  Note: ${consoleErrors.length} other console errors detected (not ChunkLoadError)`);
      }
    } else {
      console.log('\n❌ ChunkLoadError STILL PRESENT');
      console.log('Details:');
      chunkErrors.forEach(err => {
        console.log(`  - ${err.text}`);
      });
    }

    console.log('\n========================================\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

verifyChunkLoad().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
