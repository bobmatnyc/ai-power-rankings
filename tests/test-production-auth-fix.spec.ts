import { test, expect } from '@playwright/test';

test.describe('Production Authentication Fix Verification', () => {
  const baseUrl = 'https://aipowerranking.com';
  const consoleMessages: Array<{ type: string; text: string; location?: string }> = [];
  const networkErrors: Array<{ url: string; error: string }> = [];

  test.beforeEach(async ({ page }) => {
    // Reset arrays
    consoleMessages.length = 0;
    networkErrors.length = 0;

    // Monitor console messages
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      const location = msg.location();

      consoleMessages.push({
        type,
        text,
        location: location ? `${location.url}:${location.lineNumber}:${location.columnNumber}` : undefined
      });

      // Log to terminal for real-time monitoring
      if (type === 'error') {
        console.error(`[BROWSER ERROR] ${text}`, location);
      } else if (type === 'warning') {
        console.warn(`[BROWSER WARNING] ${text}`);
      }
    });

    // Monitor page errors
    page.on('pageerror', error => {
      consoleMessages.push({
        type: 'pageerror',
        text: error.message,
        location: error.stack
      });
      console.error(`[PAGE ERROR] ${error.message}`);
    });

    // Monitor network failures
    page.on('requestfailed', request => {
      networkErrors.push({
        url: request.url(),
        error: request.failure()?.errorText || 'Unknown error'
      });
    });
  });

  test('1. Homepage loads without syntax errors', async ({ page }) => {
    console.log('\n=== Test 1: Homepage Load ===');

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Check for critical syntax errors
    const syntaxErrors = consoleMessages.filter(msg =>
      msg.text.includes('SyntaxError') ||
      msg.text.includes('Uncaught SyntaxError')
    );

    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Syntax errors found: ${syntaxErrors.length}`);

    expect(syntaxErrors).toHaveLength(0);

    // Verify page title
    const title = await page.title();
    expect(title).toContain('AI Power Rankings');
  });

  test('2. Preload tag has correct attributes', async ({ page }) => {
    console.log('\n=== Test 2: Preload Tag Verification ===');

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    // Get the preload tag for crown-of-technology.webp
    const preloadTag = await page.locator('link[rel="preload"][href*="crown-of-technology"]').first();

    // Should exist
    await expect(preloadTag).toBeAttached();

    // Get all attributes
    const rel = await preloadTag.getAttribute('rel');
    const as = await preloadTag.getAttribute('as');
    const type = await preloadTag.getAttribute('type');
    const href = await preloadTag.getAttribute('href');
    const imageSrcSet = await preloadTag.getAttribute('imageSrcSet');
    const imageSizes = await preloadTag.getAttribute('imageSizes');

    console.log('Preload tag attributes:');
    console.log(`  rel: ${rel}`);
    console.log(`  as: ${as}`);
    console.log(`  type: ${type}`);
    console.log(`  href: ${href}`);
    console.log(`  imageSrcSet: ${imageSrcSet}`);
    console.log(`  imageSizes: ${imageSizes}`);

    // Verify correct attributes
    expect(rel).toBe('preload');
    expect(as).toBe('image');
    expect(type).toBe('image/webp');
    expect(href).toContain('crown-of-technology');

    // Verify invalid attributes are NOT present
    expect(imageSrcSet).toBeNull();
    expect(imageSizes).toBeNull();
  });

  test('3. Public tools page loads without errors', async ({ page }) => {
    console.log('\n=== Test 3: Public Tools Page ===');

    await page.goto(`${baseUrl}/en/tools`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Check for JavaScript errors
    const jsErrors = consoleMessages.filter(msg => msg.type === 'error' || msg.type === 'pageerror');

    console.log(`Total errors found: ${jsErrors.length}`);
    if (jsErrors.length > 0) {
      console.log('Errors:', JSON.stringify(jsErrors, null, 2));
    }

    // Should have minimal or no errors
    const criticalErrors = jsErrors.filter(err =>
      !err.text.includes('favicon') &&
      !err.text.includes('analytics') &&
      !err.text.includes('third-party')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('4. Check for preload warnings', async ({ page }) => {
    console.log('\n=== Test 4: Preload Warnings Check ===');

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Look for preload-related warnings
    const preloadWarnings = consoleMessages.filter(msg =>
      msg.text.toLowerCase().includes('preload') ||
      msg.text.toLowerCase().includes('imagesrcset') ||
      msg.text.toLowerCase().includes('imagesizes')
    );

    console.log(`Preload-related warnings: ${preloadWarnings.length}`);
    if (preloadWarnings.length > 0) {
      console.log('Warnings:', JSON.stringify(preloadWarnings, null, 2));
    }

    // Check specifically for the fixed attribute warnings
    const attributeWarnings = preloadWarnings.filter(w =>
      w.text.includes('imageSrcSet') || w.text.includes('imageSizes')
    );

    expect(attributeWarnings).toHaveLength(0);
  });

  test('5. Network resource loading', async ({ page }) => {
    console.log('\n=== Test 5: Network Resource Loading ===');

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    console.log(`Network errors: ${networkErrors.length}`);
    if (networkErrors.length > 0) {
      console.log('Network errors:', JSON.stringify(networkErrors, null, 2));
    }

    // Filter out expected failures (analytics, etc.)
    const criticalNetworkErrors = networkErrors.filter(err =>
      !err.url.includes('analytics') &&
      !err.url.includes('gtag') &&
      !err.url.includes('tracking')
    );

    console.log(`Critical network errors: ${criticalNetworkErrors.length}`);
    expect(criticalNetworkErrors).toHaveLength(0);
  });

  test('6. Console error summary', async ({ page }) => {
    console.log('\n=== Test 6: Console Error Summary ===');

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Categorize messages
    const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'pageerror');
    const warnings = consoleMessages.filter(m => m.type === 'warning');
    const info = consoleMessages.filter(m => m.type === 'info' || m.type === 'log');

    console.log('\n--- Console Summary ---');
    console.log(`Total messages: ${consoleMessages.length}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);
    console.log(`Info/Log: ${info.length}`);

    if (errors.length > 0) {
      console.log('\nError details:');
      errors.forEach((err, idx) => {
        console.log(`${idx + 1}. [${err.type}] ${err.text}`);
        if (err.location) console.log(`   Location: ${err.location}`);
      });
    }

    if (warnings.length > 0) {
      console.log('\nWarning details:');
      warnings.slice(0, 5).forEach((warn, idx) => {
        console.log(`${idx + 1}. ${warn.text}`);
      });
      if (warnings.length > 5) {
        console.log(`   ... and ${warnings.length - 5} more warnings`);
      }
    }

    // The critical check: no syntax errors
    const syntaxErrors = errors.filter(e => e.text.includes('SyntaxError'));
    expect(syntaxErrors).toHaveLength(0);
  });

  test.afterAll(() => {
    console.log('\n=== Final Report ===');
    console.log('Test suite completed');
  });
});
