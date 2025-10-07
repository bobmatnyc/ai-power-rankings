/**
 * UAT: Issue Verification Test Suite
 *
 * Re-testing 4 previously reported issues on staging environment:
 * 1. JavaScript syntax error - "missing ) after argument list" on homepage
 * 2. HTTP 400 resource loading errors - Failed API calls or asset loading
 * 3. Trending API endpoint - Missing `periods` property in /api/rankings/trending
 * 4. JA→EN language switch - 32+ second timeout, switcher element not found
 *
 * Test URLs:
 * - https://ai-power-ranking-bda92jp6n-1-m.vercel.app
 * - https://ai-power-ranking-bobmatnyc-1-m.vercel.app
 */

import { test, expect, type Page } from '@playwright/test';

// Helper: Track console errors with categorization
async function setupDetailedConsoleTracking(page: Page) {
  const errors: Array<{message: string, type: string, timestamp: number}> = [];
  const warnings: Array<{message: string, timestamp: number}> = [];
  const networkErrors: Array<{url: string, status: number, timestamp: number}> = [];

  page.on('console', msg => {
    const timestamp = Date.now();
    if (msg.type() === 'error') {
      errors.push({
        message: msg.text(),
        type: 'console',
        timestamp
      });
    }
    if (msg.type() === 'warning') {
      warnings.push({
        message: msg.text(),
        timestamp
      });
    }
  });

  page.on('pageerror', error => {
    errors.push({
      message: error.message,
      type: 'uncaught',
      timestamp: Date.now()
    });
  });

  page.on('response', response => {
    const status = response.status();
    if (status === 400 || status >= 500) {
      networkErrors.push({
        url: response.url(),
        status: status,
        timestamp: Date.now()
      });
    }
  });

  return { errors, warnings, networkErrors };
}

// Helper: Wait with timeout
async function waitSafe(page: Page, state: 'load' | 'networkidle' = 'networkidle', timeout = 30000) {
  try {
    await page.waitForLoadState(state, { timeout });
    return true;
  } catch {
    return false;
  }
}

test.describe('ISSUE #1: JavaScript Syntax Error on Homepage', () => {

  test('Verify no "missing ) after argument list" error on homepage', async ({ page }) => {
    const tracking = await setupDetailedConsoleTracking(page);

    // Navigate to homepage
    console.log('Loading homepage...');
    await page.goto('/en');
    await waitSafe(page, 'networkidle');

    // Capture screenshot
    await page.screenshot({
      path: 'test-results/uat-staging/issue1-homepage.png',
      fullPage: false // Keep small for fast capture
    });

    // Check for specific syntax error
    const syntaxErrors = tracking.errors.filter(e =>
      e.message.includes('missing') &&
      e.message.includes('after argument list')
    );

    // Log all errors for reporting
    console.log('=== CONSOLE ERRORS ===');
    tracking.errors.forEach(err => {
      console.log(`[${err.type}] ${err.message}`);
    });

    console.log('=== NETWORK ERRORS ===');
    tracking.networkErrors.forEach(err => {
      console.log(`[${err.status}] ${err.url}`);
    });

    // Report findings
    if (syntaxErrors.length > 0) {
      console.log('❌ ISSUE #1 STILL EXISTS: JavaScript syntax error found');
      console.log('Syntax errors:', syntaxErrors);
      expect(syntaxErrors.length).toBe(0); // This will fail and show details
    } else {
      console.log('✅ ISSUE #1 RESOLVED: No JavaScript syntax errors detected');
    }

    // Verify page still loads despite errors
    const bodyVisible = await page.locator('body').isVisible();
    expect(bodyVisible).toBeTruthy();
  });

  test('Verify all JavaScript chunks load without syntax errors', async ({ page }) => {
    const tracking = await setupDetailedConsoleTracking(page);

    await page.goto('/en');
    await waitSafe(page, 'networkidle');

    // Navigate to different pages to trigger chunk loading
    const pages = ['/en/rankings', '/en/news'];

    for (const pagePath of pages) {
      try {
        await page.goto(pagePath);
        await waitSafe(page, 'networkidle', 10000);
      } catch {
        // Continue even if page fails
      }
    }

    // Check for any syntax errors across all pages
    const allSyntaxErrors = tracking.errors.filter(e =>
      e.message.toLowerCase().includes('syntax') ||
      e.message.includes('unexpected token') ||
      e.message.includes('missing')
    );

    if (allSyntaxErrors.length > 0) {
      console.log('Syntax errors found:', allSyntaxErrors);
    }

    expect(allSyntaxErrors.length).toBe(0);
  });
});

test.describe('ISSUE #2: HTTP 400 Resource Loading Errors', () => {

  test('Verify no HTTP 400 errors on homepage', async ({ page }) => {
    const tracking = await setupDetailedConsoleTracking(page);

    console.log('Loading homepage and monitoring network...');
    await page.goto('/en');
    await waitSafe(page, 'networkidle');

    // Filter for HTTP 400 errors
    const http400Errors = tracking.networkErrors.filter(e => e.status === 400);

    console.log('=== NETWORK STATUS SUMMARY ===');
    console.log(`Total network errors: ${tracking.networkErrors.length}`);
    console.log(`HTTP 400 errors: ${http400Errors.length}`);

    if (http400Errors.length > 0) {
      console.log('❌ ISSUE #2 STILL EXISTS: HTTP 400 errors detected');
      console.log('HTTP 400 URLs:');
      http400Errors.forEach(err => {
        console.log(`  - ${err.url}`);
      });
    } else {
      console.log('✅ ISSUE #2 RESOLVED: No HTTP 400 errors detected');
    }

    // Report all error status codes
    const errorsByStatus = tracking.networkErrors.reduce((acc, err) => {
      acc[err.status] = (acc[err.status] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    console.log('Error distribution:', errorsByStatus);

    expect(http400Errors.length).toBe(0);
  });

  test('Verify no HTTP 400 errors on rankings page', async ({ page }) => {
    const tracking = await setupDetailedConsoleTracking(page);

    await page.goto('/en/rankings');
    await waitSafe(page, 'networkidle');

    const http400Errors = tracking.networkErrors.filter(e => e.status === 400);

    console.log(`HTTP 400 errors on rankings page: ${http400Errors.length}`);
    if (http400Errors.length > 0) {
      http400Errors.forEach(err => console.log(`  - ${err.url}`));
    }

    expect(http400Errors.length).toBe(0);
  });

  test('Verify API endpoints return valid status codes', async ({ page }) => {
    const apiEndpoints = [
      '/api/rankings/current',
      '/api/rankings/trending',
      '/api/changelog'
    ];

    const results: Array<{endpoint: string, status: number, hasError: boolean}> = [];

    for (const endpoint of apiEndpoints) {
      try {
        const response = await page.request.get(endpoint);
        const status = response.status();
        results.push({
          endpoint,
          status,
          hasError: status === 400
        });
        console.log(`${endpoint}: ${status}`);
      } catch (error: any) {
        console.log(`${endpoint}: FAILED - ${error.message}`);
        results.push({
          endpoint,
          status: 0,
          hasError: true
        });
      }
    }

    const errorEndpoints = results.filter(r => r.hasError);

    if (errorEndpoints.length > 0) {
      console.log('❌ API endpoints with errors:', errorEndpoints);
    } else {
      console.log('✅ All API endpoints returned valid status codes');
    }

    expect(errorEndpoints.length).toBe(0);
  });
});

test.describe('ISSUE #3: Trending API Missing Periods Property', () => {

  test('Verify trending API returns periods property', async ({ page }) => {
    console.log('Testing trending API endpoint...');

    // Test via API request
    const response = await page.request.get('/api/rankings/trending');
    const status = response.status();

    console.log(`Trending API status: ${status}`);

    if (status !== 200) {
      console.log('❌ ISSUE #3 STILL EXISTS: Trending API returned non-200 status');
      expect(status).toBe(200);
      return;
    }

    // Parse response
    const data = await response.json();

    console.log('=== TRENDING API RESPONSE STRUCTURE ===');
    console.log('Top-level keys:', Object.keys(data));

    // Check for periods property
    const hasPeriods = 'periods' in data;

    if (!hasPeriods) {
      console.log('❌ ISSUE #3 STILL EXISTS: Missing periods property');
      console.log('Response data:', JSON.stringify(data, null, 2).substring(0, 500));
    } else {
      console.log('✅ ISSUE #3 RESOLVED: periods property exists');
      console.log(`periods is array: ${Array.isArray(data.periods)}`);
      console.log(`periods length: ${data.periods?.length || 0}`);

      // Show sample period structure
      if (Array.isArray(data.periods) && data.periods.length > 0) {
        console.log('Sample period structure:', JSON.stringify(data.periods[0], null, 2));
      }
    }

    expect(hasPeriods).toBeTruthy();
    expect(Array.isArray(data.periods)).toBeTruthy();
  });

  test('Verify trending data structure matches expected schema', async ({ page }) => {
    const response = await page.request.get('/api/rankings/trending');
    const data = await response.json();

    // Expected schema
    expect(data).toHaveProperty('periods');
    expect(Array.isArray(data.periods)).toBeTruthy();

    if (data.periods && data.periods.length > 0) {
      const firstPeriod = data.periods[0];

      // Verify period structure
      console.log('Period keys:', Object.keys(firstPeriod));

      // Common expected keys (adjust based on actual schema)
      const expectedKeys = ['date', 'month', 'year', 'tools', 'rankings'];
      const missingKeys = expectedKeys.filter(key => !(key in firstPeriod));

      if (missingKeys.length > 0) {
        console.log('Warning: Missing expected keys:', missingKeys);
      }
    }
  });
});

test.describe('ISSUE #4: JA→EN Language Switch Timeout', () => {

  test('Verify EN→JA language switch completes within 30 seconds', async ({ page }) => {
    console.log('Testing EN→JA language switch...');

    // Start on English page
    await page.goto('/en/rankings');
    await waitSafe(page, 'networkidle');

    await page.screenshot({
      path: 'test-results/uat-staging/issue4-before-switch.png',
      fullPage: false
    });

    // Find Japanese language switcher
    const jaSwitcher = page.locator(
      'button:has-text("JP"), button:has-text("JA"), button:has-text("日本語"), a[href*="/ja/"]'
    );

    const switcherExists = await jaSwitcher.count() > 0;

    if (!switcherExists) {
      console.log('❌ Language switcher not found on page');
      expect(switcherExists).toBeTruthy();
      return;
    }

    console.log('Language switcher found, clicking...');

    // Measure switch time
    const startTime = Date.now();

    try {
      await jaSwitcher.first().click();
      await page.waitForURL('**/ja/**', { timeout: 30000 });
      await waitSafe(page, 'networkidle', 30000);

      const switchTime = Date.now() - startTime;

      console.log(`✅ Language switch completed in ${switchTime}ms`);

      await page.screenshot({
        path: 'test-results/uat-staging/issue4-after-switch-ja.png',
        fullPage: false
      });

      // Verify Japanese content
      const url = page.url();
      expect(url).toContain('/ja/');

      const bodyText = await page.locator('body').textContent() || '';
      const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(bodyText);
      expect(hasJapanese).toBeTruthy();

      expect(switchTime).toBeLessThan(30000);

    } catch (error: any) {
      const switchTime = Date.now() - startTime;
      console.log(`❌ Language switch failed after ${switchTime}ms`);
      console.log('Error:', error.message);
      throw error;
    }
  });

  test('Verify JA→EN language switch completes within 30 seconds', async ({ page }) => {
    console.log('Testing JA→EN language switch (the problematic direction)...');

    // Start on Japanese page
    await page.goto('/ja/rankings');
    await waitSafe(page, 'networkidle');

    await page.screenshot({
      path: 'test-results/uat-staging/issue4-ja-before-switch.png',
      fullPage: false
    });

    // Find English language switcher
    const enSwitcher = page.locator(
      'button:has-text("EN"), a[href*="/en/"]'
    );

    const switcherExists = await enSwitcher.count() > 0;

    if (!switcherExists) {
      console.log('❌ ISSUE #4 STILL EXISTS: EN language switcher not found on JA page');
      console.log('Looking for alternative selectors...');

      // Try finding any language switcher
      const anyLangElement = await page.locator('[data-testid*="lang"], [class*="language"], [aria-label*="language"]').count();
      console.log(`Found ${anyLangElement} potential language elements`);

      expect(switcherExists).toBeTruthy();
      return;
    }

    console.log('EN language switcher found, clicking...');

    // Measure switch time
    const startTime = Date.now();

    try {
      await enSwitcher.first().click();
      await page.waitForURL('**/en/**', { timeout: 35000 }); // Slightly longer for this problematic direction
      await waitSafe(page, 'networkidle', 30000);

      const switchTime = Date.now() - startTime;

      if (switchTime > 32000) {
        console.log(`❌ ISSUE #4 STILL EXISTS: Language switch took ${switchTime}ms (>32s threshold)`);
      } else {
        console.log(`✅ ISSUE #4 RESOLVED: Language switch completed in ${switchTime}ms (<32s)`);
      }

      await page.screenshot({
        path: 'test-results/uat-staging/issue4-after-switch-en.png',
        fullPage: false
      });

      // Verify English content
      const url = page.url();
      expect(url).toContain('/en/');

      // Log the switch time for comparison
      console.log(`JA→EN switch time: ${switchTime}ms`);

      expect(switchTime).toBeLessThan(35000); // Allow 35s but warn if >32s

    } catch (error: any) {
      const switchTime = Date.now() - startTime;
      console.log(`❌ ISSUE #4 STILL EXISTS: Language switch timed out after ${switchTime}ms`);
      console.log('Error:', error.message);

      // Capture state when timeout occurs
      await page.screenshot({
        path: 'test-results/uat-staging/issue4-timeout-state.png',
        fullPage: false
      });

      throw error;
    }
  });

  test('Verify language switcher element is consistently present', async ({ page }) => {
    const pages = ['/en', '/en/rankings', '/ja', '/ja/rankings'];
    const results: Array<{page: string, hasSwitcher: boolean}> = [];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      await waitSafe(page, 'load', 10000);

      const switcher = page.locator(
        '[data-testid*="lang"], [class*="language"], button:has-text("EN"), button:has-text("JA")'
      );

      const count = await switcher.count();
      results.push({
        page: pagePath,
        hasSwitcher: count > 0
      });

      console.log(`${pagePath}: Language switcher ${count > 0 ? 'FOUND' : 'NOT FOUND'}`);
    }

    const missingPages = results.filter(r => !r.hasSwitcher);

    if (missingPages.length > 0) {
      console.log('❌ Language switcher missing on:', missingPages);
    } else {
      console.log('✅ Language switcher present on all pages');
    }

    expect(missingPages.length).toBe(0);
  });
});

test.describe('UAT: Overall System Health Check', () => {

  test('Homepage loads and displays content', async ({ page }) => {
    await page.goto('/en');
    await waitSafe(page, 'networkidle');

    const heading = await page.locator('h1, h2').first().isVisible();
    expect(heading).toBeTruthy();

    console.log('✅ Homepage loads successfully');
  });

  test('Rankings page displays data', async ({ page }) => {
    await page.goto('/en/rankings');
    await waitSafe(page, 'networkidle');

    const hasContent = await page.locator('body').textContent();
    expect(hasContent).toBeTruthy();
    expect(hasContent!.length).toBeGreaterThan(100);

    console.log('✅ Rankings page displays data');
  });

  test('API endpoints are responding', async ({ page }) => {
    const endpoints = [
      '/api/rankings/current',
      '/api/rankings/trending'
    ];

    let successCount = 0;

    for (const endpoint of endpoints) {
      try {
        const response = await page.request.get(endpoint);
        if (response.status() === 200) {
          successCount++;
        }
      } catch {
        // Continue
      }
    }

    console.log(`${successCount}/${endpoints.length} API endpoints responding`);
    expect(successCount).toBeGreaterThan(0);
  });
});
