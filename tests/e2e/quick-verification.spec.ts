import { test, expect } from '@playwright/test';

test.describe('Quick Changelog Fix Verification', () => {
  test('Homepage loads without 500 errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const response = await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBe(200);
    await page.screenshot({ path: 'tests/screenshots/homepage-verification.png', fullPage: false });

    console.log(`Console errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('Errors:', consoleErrors.slice(0, 5));
    }
  });

  // #231: entries come from the build-time module; an empty list is a 503, never `200 []`.
  test('Changelog API returns 200 with platform entries', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/changelog');

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.items.length).toBeGreaterThan(0);
    expect(data._degraded).toBe(false);

    console.log('✅ Changelog route returns platform entries');
  });
});
