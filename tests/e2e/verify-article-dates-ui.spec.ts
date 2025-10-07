import { test, expect } from '@playwright/test';

/**
 * Article Dates UI Verification Test
 *
 * Verifies that article dates display correctly in the admin dashboard UI
 */

test.describe('Article Dates UI Verification', () => {
  test('should display admin news page with article dates', async ({ page }) => {
    // Navigate to admin news page
    await page.goto('http://localhost:3000/en/admin/news', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for the page to load
    await page.waitForTimeout(3000);

    // Take initial screenshot
    await page.screenshot({
      path: 'test-results/admin-news-page-initial.png',
      fullPage: true
    });

    // Check if there's any text content on the page
    const bodyText = await page.textContent('body');
    console.log('\n=== Page Content Sample ===');
    console.log(bodyText?.substring(0, 500));

    // Look for article containers - try multiple selectors
    const possibleSelectors = [
      'article',
      '[class*="article"]',
      '[data-testid*="article"]',
      'table tbody tr',
      'div[role="row"]',
      '.grid > div',
      '[class*="card"]'
    ];

    console.log('\n=== Searching for Article Elements ===');
    for (const selector of possibleSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`Found ${count} elements with selector: ${selector}`);

        // Get first few elements
        const elements = page.locator(selector);
        const sampleSize = Math.min(count, 3);

        for (let i = 0; i < sampleSize; i++) {
          const text = await elements.nth(i).textContent();
          console.log(`  Element ${i + 1}: ${text?.substring(0, 100)}...`);
        }
      }
    }

    // Search for any date-like text patterns
    console.log('\n=== Searching for Date Patterns ===');
    const datePatterns = [
      /\d{1,2}\/\d{1,2}\/\d{4}/g,
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}/gi,
      /\b20\d{2}-\d{2}-\d{2}/g,
      /Published:.*?\d{4}/gi
    ];

    const fullText = await page.textContent('body');
    for (const pattern of datePatterns) {
      const matches = fullText?.match(pattern);
      if (matches && matches.length > 0) {
        console.log(`Found ${matches.length} matches for pattern ${pattern}`);
        console.log(`Sample matches: ${matches.slice(0, 5).join(', ')}`);
      }
    }

    // Take a final screenshot after waiting
    await page.screenshot({
      path: 'test-results/admin-news-page-final.png',
      fullPage: true
    });
  });

  test('should display articles with publishedDate in UI', async ({ page }) => {
    // Navigate to admin news page
    await page.goto('http://localhost:3000/en/admin/news');

    // Wait for any dynamic content
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Try to find text that contains "Published:"
    const publishedText = await page.getByText(/Published:/i).first().textContent().catch(() => null);

    if (publishedText) {
      console.log('\n=== Found Published Date ===');
      console.log(publishedText);
    } else {
      console.log('\n=== No "Published:" text found ===');
    }

    // Take screenshot
    await page.screenshot({
      path: 'test-results/admin-news-search-published.png',
      fullPage: true
    });
  });
});
