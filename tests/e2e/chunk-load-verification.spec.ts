import { test, expect } from '@playwright/test';

/**
 * ChunkLoadError Verification Test
 *
 * Purpose: Verify that the ChunkLoadError issue has been resolved
 * Previous issue: "Loading chunk app/[lang]/page failed" with timeout error
 * Fix applied: Cleared .next build cache and restarted dev server
 */

test.describe('ChunkLoadError Verification', () => {
  let consoleErrors: Array<{ type: string; text: string }> = [];
  let consoleWarnings: Array<{ type: string; text: string }> = [];

  test.beforeEach(async ({ page }) => {
    // Capture all console messages
    consoleErrors = [];
    consoleWarnings = [];

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
      console.log(`[REQUEST FAILED] ${request.url()} - ${failure?.errorText || 'Unknown error'}`);
    });
  });

  test('Homepage loads without ChunkLoadError on localhost:3000', async ({ page }) => {
    console.log('\n=== Testing Homepage Load ===');

    // Navigate to homepage
    const response = await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Verify response status
    expect(response?.status()).toBe(200);
    console.log(`✓ Homepage responded with status ${response?.status()}`);

    // Wait for main content to be visible
    await page.waitForSelector('body', { state: 'visible', timeout: 10000 });
    console.log('✓ Body element is visible');

    // Take screenshot of loaded homepage
    await page.screenshot({
      path: '/Users/masa/Projects/managed/aipowerranking/test-results/homepage-loaded.png',
      fullPage: true
    });
    console.log('✓ Screenshot captured: homepage-loaded.png');

    // Check for ChunkLoadError specifically
    const chunkErrors = consoleErrors.filter(error =>
      error.text.includes('ChunkLoadError') ||
      error.text.includes('Loading chunk') ||
      error.text.includes('chunk') && error.text.includes('failed')
    );

    console.log(`\n=== Console Analysis ===`);
    console.log(`Total console errors: ${consoleErrors.length}`);
    console.log(`Chunk-related errors: ${chunkErrors.length}`);
    console.log(`Console warnings: ${consoleWarnings.length}`);

    if (consoleErrors.length > 0) {
      console.log('\n=== All Console Errors ===');
      consoleErrors.forEach((err, idx) => {
        console.log(`${idx + 1}. [${err.type}] ${err.text}`);
      });
    }

    // Assert no ChunkLoadError
    expect(chunkErrors.length, `ChunkLoadError detected: ${JSON.stringify(chunkErrors)}`).toBe(0);
    console.log('✓ No ChunkLoadError detected');
  });

  test('Language route /en loads without ChunkLoadError', async ({ page }) => {
    console.log('\n=== Testing /en Route Load ===');

    // Navigate to /en route
    const response = await page.goto('http://localhost:3000/en', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Verify response status
    expect(response?.status()).toBe(200);
    console.log(`✓ /en route responded with status ${response?.status()}`);

    // Wait for content
    await page.waitForSelector('body', { state: 'visible', timeout: 10000 });
    console.log('✓ Body element is visible on /en route');

    // Take screenshot
    await page.screenshot({
      path: '/Users/masa/Projects/managed/aipowerranking/test-results/en-route-loaded.png',
      fullPage: true
    });
    console.log('✓ Screenshot captured: en-route-loaded.png');

    // Check for ChunkLoadError
    const chunkErrors = consoleErrors.filter(error =>
      error.text.includes('ChunkLoadError') ||
      error.text.includes('Loading chunk') ||
      error.text.includes('chunk') && error.text.includes('failed')
    );

    console.log(`\n=== Console Analysis (/en route) ===`);
    console.log(`Total console errors: ${consoleErrors.length}`);
    console.log(`Chunk-related errors: ${chunkErrors.length}`);
    console.log(`Console warnings: ${consoleWarnings.length}`);

    if (consoleErrors.length > 0) {
      console.log('\n=== All Console Errors (/en route) ===');
      consoleErrors.forEach((err, idx) => {
        console.log(`${idx + 1}. [${err.type}] ${err.text}`);
      });
    }

    // Assert no ChunkLoadError
    expect(chunkErrors.length, `ChunkLoadError detected on /en: ${JSON.stringify(chunkErrors)}`).toBe(0);
    console.log('✓ No ChunkLoadError detected on /en route');
  });

  test('Static chunks are loading correctly', async ({ page }) => {
    console.log('\n=== Testing Static Chunk Loading ===');

    const loadedChunks: string[] = [];
    const failedChunks: string[] = [];

    // Monitor all resource requests
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/_next/static/chunks/') || url.includes('.js')) {
        if (response.status() === 200) {
          loadedChunks.push(url);
        } else {
          failedChunks.push(`${url} (${response.status()})`);
        }
      }
    });

    // Navigate and let chunks load
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log(`\n=== Chunk Loading Summary ===`);
    console.log(`Successfully loaded chunks: ${loadedChunks.length}`);
    console.log(`Failed chunks: ${failedChunks.length}`);

    if (failedChunks.length > 0) {
      console.log('\n=== Failed Chunks ===');
      failedChunks.forEach((chunk, idx) => {
        console.log(`${idx + 1}. ${chunk}`);
      });
    }

    // Sample of loaded chunks
    if (loadedChunks.length > 0) {
      console.log('\n=== Sample of Successfully Loaded Chunks (first 10) ===');
      loadedChunks.slice(0, 10).forEach((chunk, idx) => {
        console.log(`${idx + 1}. ${chunk.split('/').pop()}`);
      });
    }

    // Assert no failed chunks
    expect(failedChunks.length, `Failed to load chunks: ${JSON.stringify(failedChunks)}`).toBe(0);
    console.log('✓ All static chunks loaded successfully');
  });

  test.afterAll(async () => {
    console.log('\n=== Verification Complete ===');
  });
});
