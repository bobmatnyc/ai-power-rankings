import { test, expect } from '@playwright/test';

test.describe('Changelog Fix Verification', () => {
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleWarnings = [];

    // Monitor console for errors and warnings
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });
  });

  test('Homepage (/) loads successfully without 500 errors', async ({ page }) => {
    const response = await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });

    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/AI Power Ranking/);

    await page.screenshot({ path: 'tests/screenshots/homepage-root.png', fullPage: true });

    console.log('Console Errors:', consoleErrors.length);
    console.log('Console Warnings:', consoleWarnings.length);
  });

  test('Localized homepage (/en) loads successfully without 500 errors', async ({ page }) => {
    const response = await page.goto('http://localhost:3000/en', { waitUntil: 'networkidle' });

    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/AI Power Ranking/);

    await page.screenshot({ path: 'tests/screenshots/homepage-en.png', fullPage: true });

    console.log('Console Errors:', consoleErrors.length);
    console.log('Console Warnings:', consoleWarnings.length);
  });

  test('API /api/rankings/current returns 200', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/rankings/current');

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('data');
  });

  test('API /api/tools/list returns 200', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/tools/list');

    expect(response.status()).toBe(200);
  });

  test('API /api/changelog returns 200 with empty array (no CHANGELOG.md)', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/changelog');

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toEqual([]);
  });

  test('No 500 Internal Server Errors on any route', async ({ page }) => {
    const routes = ['/', '/en'];

    for (const route of routes) {
      const response = await page.goto(`http://localhost:3000${route}`, { waitUntil: 'networkidle' });
      const status = response?.status();

      expect(status).not.toBe(500);
      expect([200, 404]).toContain(status);
    }
  });

  test.afterEach(async ({}, testInfo) => {
    console.log(`\n--- Test: ${testInfo.title} ---`);
    if (consoleErrors.length > 0) {
      console.log('Console Errors:', consoleErrors);
    }
    if (consoleWarnings.length > 0) {
      console.log('Console Warnings:', consoleWarnings);
    }
  });
});
