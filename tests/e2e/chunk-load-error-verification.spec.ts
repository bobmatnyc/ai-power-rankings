import { test, expect } from '@playwright/test';

/**
 * ChunkLoadError Verification Test
 *
 * Verifies that the clean rebuild resolved HMR cache corruption
 * and eliminated ChunkLoadError timeout issues.
 *
 * Previous Issue: vendor.tailwind-merge chunk timeout (120 seconds)
 * Fix Applied: Clean rebuild - deleted .next/ and restarted dev server
 */

test.describe('ChunkLoadError Resolution Verification', () => {
  const BASE_URL = 'http://localhost:3007';
  const LOAD_TIMEOUT = 10000; // 10 seconds to allow all chunks to load

  let allConsoleMessages: Array<{type: string, text: string, timestamp: number}> = [];
  let consoleErrors: string[] = [];
  let chunkLoadErrors: string[] = [];
  let tailwindMergeErrors: string[] = [];
  let clerkProviderErrors: string[] = [];
  let networkRequests: Array<{url: string, status: number, resourceType: string}> = [];

  test.beforeEach(async ({ page }) => {
    // Reset trackers
    allConsoleMessages = [];
    consoleErrors = [];
    chunkLoadErrors = [];
    tailwindMergeErrors = [];
    clerkProviderErrors = [];
    networkRequests = [];

    const startTime = Date.now();

    // Capture ALL console messages
    page.on('console', msg => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now() - startTime
      };
      allConsoleMessages.push(logEntry);

      // Track errors specifically
      if (msg.type() === 'error') {
        const errorText = msg.text();
        consoleErrors.push(errorText);

        // ChunkLoadError detection
        if (errorText.includes('ChunkLoadError') || errorText.includes('Loading chunk')) {
          chunkLoadErrors.push(errorText);
        }

        // Tailwind-merge specific errors
        if (errorText.includes('tailwind-merge') || errorText.includes('vendor.tailwind-merge')) {
          tailwindMergeErrors.push(errorText);
        }

        // ClerkProvider errors
        if (errorText.includes('ClerkProvider') || errorText.includes('UserButton can only be used')) {
          clerkProviderErrors.push(errorText);
        }
      }
    });

    // Track network requests for chunk loading verification
    page.on('response', async response => {
      const url = response.url();
      const request = response.request();

      // Track all requests, especially vendor chunks
      if (url.includes('/_next/') || url.includes('vendor') || url.includes('.js')) {
        networkRequests.push({
          url,
          status: response.status(),
          resourceType: request.resourceType()
        });
      }
    });
  });

  test('PRIMARY: No ChunkLoadError after clean rebuild', async ({ page }) => {
    console.log('\n=== TEST 1: ChunkLoadError Verification ===');

    const startTime = Date.now();

    // Navigate to application
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for chunks to load
    await page.waitForTimeout(LOAD_TIMEOUT);

    const loadTime = Date.now() - startTime;
    console.log(`Page load time: ${loadTime}ms`);

    // PRIMARY ASSERTION: Zero ChunkLoadErrors
    console.log(`\nChunkLoadError count: ${chunkLoadErrors.length}`);
    if (chunkLoadErrors.length > 0) {
      console.log('ChunkLoadErrors found:');
      chunkLoadErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }
    expect(chunkLoadErrors, 'CRITICAL: ChunkLoadError must be 0').toHaveLength(0);

    // Tailwind-merge specific check
    console.log(`\nTailwind-merge errors: ${tailwindMergeErrors.length}`);
    if (tailwindMergeErrors.length > 0) {
      console.log('Tailwind-merge errors found:');
      tailwindMergeErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }
    expect(tailwindMergeErrors, 'No tailwind-merge errors expected').toHaveLength(0);

    // ClerkProvider verification (previous fix should still work)
    console.log(`\nClerkProvider errors: ${clerkProviderErrors.length}`);
    expect(clerkProviderErrors, 'ClerkProvider fix should still work').toHaveLength(0);

    // Overall error summary
    console.log(`\nTotal console errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0 && consoleErrors.length <= 10) {
      console.log('Console errors:');
      consoleErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err.substring(0, 100)}...`));
    } else if (consoleErrors.length > 10) {
      console.log('First 10 console errors:');
      consoleErrors.slice(0, 10).forEach((err, i) => console.log(`  ${i + 1}. ${err.substring(0, 100)}...`));
    }

    // Page should load reasonably fast
    expect(loadTime, 'Page should load within 15 seconds').toBeLessThan(15000);
  });

  test('Chunk Loading Verification', async ({ page }) => {
    console.log('\n=== TEST 2: Chunk Loading Verification ===');

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(LOAD_TIMEOUT);

    // Find vendor chunk requests
    const vendorChunks = networkRequests.filter(req =>
      req.url.includes('vendor') || req.url.includes('tailwind-merge')
    );

    console.log(`\nVendor chunk requests: ${vendorChunks.length}`);
    vendorChunks.forEach(chunk => {
      const status = chunk.status === 200 ? '✓' : '✗';
      console.log(`  ${status} [${chunk.status}] ${chunk.url.split('/').pop()?.substring(0, 60)}`);
    });

    // Check for failed chunks
    const failedChunks = networkRequests.filter(req =>
      (req.url.includes('/_next/') || req.url.includes('.js')) &&
      req.status !== 200 &&
      req.status !== 304
    );

    console.log(`\nFailed chunk requests: ${failedChunks.length}`);
    if (failedChunks.length > 0) {
      failedChunks.forEach(chunk => {
        console.log(`  ✗ [${chunk.status}] ${chunk.url}`);
      });
    }

    // Verify vendor.tailwind-merge loads successfully
    const tailwindChunk = networkRequests.find(req =>
      req.url.includes('tailwind-merge')
    );

    if (tailwindChunk) {
      console.log(`\nTailwind-merge chunk: [${tailwindChunk.status}] ${tailwindChunk.url.split('/').pop()}`);
      expect([200, 304], 'Tailwind-merge chunk should load successfully').toContain(tailwindChunk.status);
    } else {
      console.log('\nNote: tailwind-merge chunk not found in network requests (may be bundled differently)');
    }

    // All critical chunks should succeed
    expect(failedChunks.filter(c => c.status === 404 || c.status >= 500),
      'No critical chunk failures (404/5xx)').toHaveLength(0);
  });

  test('Navigation Stability Test', async ({ page }) => {
    console.log('\n=== TEST 3: Navigation Stability ===');

    // Home page
    console.log('\n1. Loading home page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const homeErrors = chunkLoadErrors.length;
    console.log(`   ChunkLoadErrors: ${homeErrors}`);

    // Sign-in page
    console.log('2. Navigating to sign-in...');
    const signInErrorsBefore = chunkLoadErrors.length;
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const signInErrorsAfter = chunkLoadErrors.length;
    console.log(`   ChunkLoadErrors: ${signInErrorsAfter - signInErrorsBefore}`);

    // Back to home
    console.log('3. Navigating back to home...');
    const backErrorsBefore = chunkLoadErrors.length;
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const backErrorsAfter = chunkLoadErrors.length;
    console.log(`   ChunkLoadErrors: ${backErrorsAfter - backErrorsBefore}`);

    // No chunk errors during any navigation
    console.log(`\nTotal ChunkLoadErrors during navigation: ${chunkLoadErrors.length}`);
    expect(chunkLoadErrors, 'No chunk errors during navigation').toHaveLength(0);
  });

  test('ClerkProvider Functionality Verification', async ({ page }) => {
    console.log('\n=== TEST 4: ClerkProvider Functionality ===');

    // Test sign-in page (uses Clerk components)
    console.log('\nLoading sign-in page with Clerk components...');
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

    console.log(`ClerkProvider errors: ${clerkProviderErrors.length}`);
    if (clerkProviderErrors.length > 0) {
      console.log('ClerkProvider errors found:');
      clerkProviderErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }

    // Previous fix should still work
    expect(clerkProviderErrors, 'ClerkProvider fix must still be working').toHaveLength(0);

    // Check for Clerk-related elements on page
    const hasClerkElements = await page.locator('[data-clerk-id]').count() > 0 ||
                             await page.locator('.cl-component').count() > 0 ||
                             await page.locator('#clerk-signin').count() > 0;

    console.log(`Clerk elements detected: ${hasClerkElements ? 'Yes' : 'No'}`);
  });

  test.afterEach(async () => {
    // Summary report after each test
    console.log('\n=== Test Summary ===');
    console.log(`Total console messages: ${allConsoleMessages.length}`);
    console.log(`Total errors: ${consoleErrors.length}`);
    console.log(`ChunkLoadErrors: ${chunkLoadErrors.length}`);
    console.log(`Tailwind-merge errors: ${tailwindMergeErrors.length}`);
    console.log(`ClerkProvider errors: ${clerkProviderErrors.length}`);
    console.log(`Network requests tracked: ${networkRequests.length}`);
  });
});
