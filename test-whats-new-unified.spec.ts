import { test, expect } from '@playwright/test';

test.describe('What\'s New Unified Feed', () => {
  test('should display unified feed with mixed content types', async ({ page }) => {
    // Navigate to the site
    await page.goto('http://localhost:3000');

    // Open What's New modal
    const whatsNewButton = page.locator('button:has-text("What\'s New")').or(page.locator('[aria-label*="What\'s New"]')).or(page.locator('text=What\'s New')).first();

    if (await whatsNewButton.count() > 0) {
      await whatsNewButton.click();
    } else {
      // If no button, try to trigger it programmatically
      await page.evaluate(() => {
        const event = new CustomEvent('openWhatsNew');
        window.dispatchEvent(event);
      });
    }

    // Wait for modal to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Verify modal title
    await expect(page.locator('text=What\'s New')).toBeVisible();

    // Verify "Recent (7 Days)" tab is active by default
    await expect(page.locator('text=Recent (7 Days)')).toBeVisible();

    // Take screenshot of the modal
    await page.screenshot({ path: '/Users/masa/Projects/aipowerranking/test-screenshots/whats-new-modal.png', fullPage: true });

    // Check for feed items
    const feedItems = page.locator('[role="dialog"] .space-y-3 > a, [role="dialog"] .space-y-3 > div');
    const itemCount = await feedItems.count();

    console.log(`Found ${itemCount} feed items`);

    if (itemCount > 0) {
      // Verify first few items have proper structure
      for (let i = 0; i < Math.min(5, itemCount); i++) {
        const item = feedItems.nth(i);

        // Check for icon
        const icon = item.locator('svg').first();
        await expect(icon).toBeVisible();

        // Check for badge (News, Tool Update, or Platform)
        const badge = item.locator('[class*="badge"]').or(item.locator('text=/News|Tool Update|Platform/i')).first();
        if (await badge.count() > 0) {
          await expect(badge).toBeVisible();
          const badgeText = await badge.textContent();
          console.log(`Item ${i + 1} badge: ${badgeText}`);
        }

        // Check for date
        const dateElement = item.locator('text=/ago|Yesterday/i').or(item.locator('[class*="Calendar"]')).first();
        if (await dateElement.count() > 0) {
          await expect(dateElement).toBeVisible();
        }
      }
    }

    // Check console for errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait a bit to catch any late errors
    await page.waitForTimeout(2000);

    // Report console errors
    if (consoleErrors.length > 0) {
      console.error('Console errors found:', consoleErrors);
    }

    // Close the modal
    await page.locator('[role="dialog"] button:has-text("Close")').click();
  });

  test('should fetch and verify API response structure', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/whats-new');

    expect(response.ok()).toBeTruthy();

    const data = await response.json();

    // Verify feed array exists
    expect(data).toHaveProperty('feed');
    expect(Array.isArray(data.feed)).toBeTruthy();

    // Verify max 20 items
    expect(data.feed.length).toBeLessThanOrEqual(20);

    // Verify each item has required fields
    if (data.feed.length > 0) {
      for (const item of data.feed) {
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('date');
        expect(['news', 'tool', 'platform']).toContain(item.type);
      }

      // Verify items are sorted by date (descending)
      for (let i = 0; i < data.feed.length - 1; i++) {
        const current = new Date(data.feed[i].date);
        const next = new Date(data.feed[i + 1].date);
        expect(current >= next).toBeTruthy();
      }

      console.log('API Response Summary:');
      console.log(`Total items: ${data.feed.length}`);
      const typeCounts = data.feed.reduce((acc: any, item: any) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {});
      console.log('Type distribution:', typeCounts);
      console.log('First 3 items:', data.feed.slice(0, 3).map((item: any) => ({
        type: item.type,
        date: item.date,
        title: item.title || item.name
      })));
    }
  });

  test('should verify cache headers', async ({ request }) => {
    const response = await request.get('http://localhost:3000/api/whats-new');

    const cacheControl = response.headers()['cache-control'];
    expect(cacheControl).toContain('max-age=60');
    expect(cacheControl).toContain('s-maxage=60');

    console.log('Cache headers:', {
      'cache-control': cacheControl,
      'cdn-cache-control': response.headers()['cdn-cache-control'],
    });
  });
});
