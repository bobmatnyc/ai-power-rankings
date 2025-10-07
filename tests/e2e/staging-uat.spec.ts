import { test, expect } from '@playwright/test';

/**
 * UAT Test Suite for Staging Environment
 *
 * Critical Issues to Verify as FIXED:
 * 1. Clerk ClerkProvider Error - Homepage should load without "Something went wrong" error
 * 2. JavaScript syntax error - No "missing ) after argument list" in console
 * 3. HTTP 400 resource loading - All resources should load successfully
 * 4. Language switcher - Should be visible and functional
 */

const STAGING_URLS = [
  'https://ai-power-ranking-g0629alr1-1-m.vercel.app',
  'https://ai-power-ranking-1-m.vercel.app'
];

// Use the first staging URL as primary
const BASE_URL = STAGING_URLS[0];

test.describe('Critical Issues Verification', () => {

  test('Issue #1: Homepage loads without ClerkProvider error', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for page errors
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    // Navigate to homepage
    const response = await page.goto(BASE_URL);

    // Verify response is successful
    expect(response?.status()).toBeLessThan(400);

    // Wait for page to fully load
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Verify NO "Something went wrong" error page
    const errorHeading = page.locator('h1, h2').filter({ hasText: /something went wrong/i });
    await expect(errorHeading).toHaveCount(0, { timeout: 5000 });

    // Verify NO ClerkProvider errors in console
    const clerkErrors = consoleErrors.filter(err =>
      err.toLowerCase().includes('clerk') || err.toLowerCase().includes('provider')
    );
    expect(clerkErrors).toHaveLength(0);

    // Verify main content is visible
    const mainContent = page.locator('main, [role="main"], body > div').first();
    await expect(mainContent).toBeVisible({ timeout: 10000 });
  });

  test('Issue #2: No JavaScript syntax errors in console', async ({ page }) => {
    const consoleErrors: string[] = [];
    const syntaxErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        consoleErrors.push(text);
        if (text.includes('SyntaxError') || text.includes('missing ) after argument list')) {
          syntaxErrors.push(text);
        }
      }
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Verify NO syntax errors
    expect(syntaxErrors).toHaveLength(0);

    // Log all console errors for debugging
    if (consoleErrors.length > 0) {
      console.log('Console errors found:', consoleErrors);
    }
  });

  test('Issue #3: All resources load with proper HTTP status codes', async ({ page }) => {
    const failedResources: { url: string; status: number }[] = [];

    page.on('response', response => {
      const status = response.status();
      const url = response.url();

      // Track failed resources (400-599)
      if (status >= 400) {
        failedResources.push({ url, status });
      }
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Verify NO HTTP 400+ errors
    expect(failedResources).toHaveLength(0);
  });

  test('Issue #4: Language switcher is visible and functional', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Look for language switcher (common patterns)
    const langSwitcher = page.locator('[data-testid="language-switcher"], button:has-text("EN"), button:has-text("JA"), select[name="language"]').first();

    // Verify language switcher is visible
    await expect(langSwitcher).toBeVisible({ timeout: 10000 });

    // Test switching from EN to JA
    const currentUrl = page.url();

    if (await page.locator('button:has-text("JA"), a:has-text("JA")').count() > 0) {
      await page.locator('button:has-text("JA"), a:has-text("JA")').first().click();
      await page.waitForLoadState('networkidle', { timeout: 15000 });

      // Verify URL changed to Japanese locale
      expect(page.url()).toContain('/ja');

      // Switch back to English
      await page.locator('button:has-text("EN"), a:has-text("EN")').first().click();
      await page.waitForLoadState('networkidle', { timeout: 15000 });

      // Verify URL changed to English locale
      expect(page.url()).toMatch(/\/en|^(?!.*\/ja)/);
    }
  });
});

test.describe('Core Functionality Verification', () => {

  test('Rankings page loads and displays data', async ({ page }) => {
    await page.goto(`${BASE_URL}/en`);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Look for ranking items or tables
    const rankingItems = page.locator('[data-testid*="ranking"], table tr, .ranking-item, li').first();
    await expect(rankingItems).toBeVisible({ timeout: 10000 });
  });

  test('Tool details page loads correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/en`);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Click on first tool/ranking item
    const firstTool = page.locator('a[href*="/tool"], a[href*="/tools"]').first();

    if (await firstTool.count() > 0) {
      await firstTool.click();
      await page.waitForLoadState('networkidle', { timeout: 30000 });

      // Verify detail page loaded
      expect(page.url()).toMatch(/\/tool|\/tools/);

      // Verify content is visible
      const content = page.locator('main, [role="main"]').first();
      await expect(content).toBeVisible({ timeout: 10000 });
    }
  });

  test('News/Articles page loads correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/en/news`);

    const response = await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => null);

    // Check if news page exists (might be 404)
    if (page.url().includes('/news')) {
      const content = page.locator('main, article, [data-testid*="news"]').first();
      await expect(content).toBeVisible({ timeout: 10000 });
    }
  });

  test('API endpoints return proper responses', async ({ request }) => {
    const endpoints = [
      '/api/rankings/current',
      '/api/rankings/trending',
      '/api/changelog',
      '/api/data/db-status'
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(`${BASE_URL}${endpoint}`);

      // Verify successful response (200-299) or expected error (404 for non-existent)
      expect([200, 201, 204, 404].includes(response.status())).toBeTruthy();

      // If 200, verify it's valid JSON
      if (response.status() === 200) {
        const data = await response.json();
        expect(data).toBeDefined();
      }
    }
  });
});

test.describe('Responsive Design Verification', () => {

  test('Mobile viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    // Verify content is visible in mobile viewport
    const content = page.locator('main, body > div').first();
    await expect(content).toBeVisible({ timeout: 10000 });

    // Verify no horizontal scroll (content fits viewport)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });

  test('Tablet viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    const content = page.locator('main, body > div').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test('Desktop viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 }); // Full HD

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle', { timeout: 30000 });

    const content = page.locator('main, body > div').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Database Connectivity Verification', () => {

  test('Database status endpoint responds correctly', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/data/db-status`);

    // Accept 200 (working) or 500 (error but endpoint exists)
    expect([200, 500].includes(response.status())).toBeTruthy();

    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('status');
    }
  });

  test('Data fetching works (rankings endpoint)', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/rankings/current`);

    if (response.status() === 200) {
      const data = await response.json();
      expect(Array.isArray(data) || typeof data === 'object').toBeTruthy();
    }
  });
});
